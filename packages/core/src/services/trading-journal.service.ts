import * as fs from 'fs';
import * as path from 'path';

import { DECIMAL_PLACES, TIME_MULTIPLIERS, TIME_UNITS } from '../constants';
import { JSON_INDENT } from '../constants/technical.constants';
import { CSVExportError } from '../errors/DomainErrors';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { IJournalRepository } from '../repositories/IRepositories';
import {
  EntryCondition,
  ExitCondition,
  LoggerService,
  PositionSide,
  TradeHistoryConfig,
  TradeRecord,
} from '../types/legacy';
import { getErrorMessage } from '../utils/error.utils';
import { TradeHistoryService, TradeRecord as CSVTradeRecord } from './trade-history.service';
import {
  aggregateJournalStatistics,
  calculateTradeFeeSummary,
  JournalStatistics,
} from './trading-journal/trading-journal-calculations.utils';
import { VirtualBalanceService } from './virtual-balance.service';
import { TradeRecordValidationError } from '../errors/DomainErrors';

const DATA_DIR = 'data';
const JOURNAL_FILE = 'trade-journal.json';
const CSV_FILE = 'trade-journal.csv';
const JOURNAL_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 100,
  backoffMultiplier: 2,
  maxDelayMs: 500,
} as const;

type TradeCloseParams = {
  id: string;
  exitPrice: number;
  exitCondition: ExitCondition;
  realizedPnL: number;
};

export class TradingJournalService {
  private readonly trades = new Map<string, TradeRecord>();
  private readonly journalPath: string;
  private readonly dataDir: string;
  private initialized = false;

  private tradeHistory?: TradeHistoryService;
  private virtualBalance?: VirtualBalanceService;
  private sessionVersion = 'v2.6';

  constructor(
    private readonly logger: LoggerService,
    dataPath?: string,
    private readonly tradeHistoryConfig?: TradeHistoryConfig,
    private readonly baseDeposit?: number,
    private readonly journalRepository?: IJournalRepository,
    private readonly errorHandler?: ErrorHandler,
  ) {
    this.dataDir = dataPath || path.join(process.cwd(), DATA_DIR);
    this.journalPath = path.join(this.dataDir, JOURNAL_FILE);
  }

  start(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.ensureDataDirectory();
    this.initializeTradeStorage();
    this.loadJournal();
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.start();
    }
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private initializeTradeStorage(): void {
    if (!this.tradeHistoryConfig?.enabled) {
      return;
    }

    const historyDataDir = this.getTradeHistoryDataDir();
    this.tradeHistory = new TradeHistoryService(this.logger, historyDataDir);
    this.tradeHistory.start();
    this.initializeVirtualBalance(historyDataDir);
  }

  private initializeVirtualBalance(historyDataDir: string): void {
    if (!this.baseDeposit || this.baseDeposit <= 0 || !this.errorHandler) {
      return;
    }

    this.virtualBalance = new VirtualBalanceService(
      this.logger,
      this.errorHandler,
      this.baseDeposit,
      historyDataDir,
    );
    this.virtualBalance.start();
    this.syncVirtualBalanceAsync();
  }

  private getTradeHistoryDataDir(): string {
    return this.tradeHistoryConfig?.dataDir || this.dataDir;
  }

  private async syncVirtualBalanceAsync(): Promise<void> {
    if (!this.virtualBalance || !this.tradeHistory) {
      return;
    }

    try {
      const allTrades = await this.tradeHistory.readAllTrades();
      await this.virtualBalance.syncFromHistory(allTrades.map((trade) => ({ id: trade.id, netPnl: trade.netPnl })));
    } catch (error: unknown) {
      this.logger.error('âŒ Failed to sync virtual balance', {
        error,
        errorMessage: getErrorMessage(error),
      });
    }
  }

  private loadJournal(): void {
    try {
      if (!fs.existsSync(this.journalPath)) {
        this.logger.info('ðŸ“– Trade journal file not found, creating new', {
          path: this.journalPath,
        });
        return;
      }

      const entries = this.readJournalEntries();
      if (!entries) {
        return;
      }

      this.replaceTrades(entries);
      this.logger.info('ðŸ“– Trade journal loaded', {
        entriesCount: this.trades.size,
        path: this.journalPath,
      });
    } catch (error: unknown) {
      this.logger.error('âŒ Failed to load trade journal', {
        error: getErrorMessage(error),
        path: this.journalPath,
      });
    }
  }

  private readJournalEntries(): TradeRecord[] | null {
    const data = fs.readFileSync(this.journalPath, 'utf-8');

    try {
      return JSON.parse(data) as TradeRecord[];
    } catch (parseError: unknown) {
      this.handleCorruptedJournal(parseError);
      return null;
    }
  }

  private handleCorruptedJournal(parseError: unknown): void {
    const backupPath = `${this.journalPath}.corrupted`;
    this.logger.warn('âš ï¸ Corrupted journal file, starting with empty journal', {
      path: this.journalPath,
      backupPath,
      reason: getErrorMessage(parseError),
    });

    try {
      fs.copyFileSync(this.journalPath, backupPath);
    } catch (backupError: unknown) {
      this.logger.error('Failed to backup corrupted journal', {
        error: getErrorMessage(backupError),
      });
    }
  }

  private replaceTrades(entries: TradeRecord[]): void {
    this.trades.clear();
    for (const entry of entries) {
      this.trades.set(entry.id, entry);
    }
  }

  private saveJournal(): void {
    const entries = Array.from(this.trades.values());
    const data = JSON.stringify(entries, null, JSON_INDENT);

    if (this.errorHandler) {
      this.errorHandler.wrapSync(
        () => {
          this.writeJournalFile(data);
        },
        {
          strategy: RecoveryStrategy.RETRY,
          context: 'TradingJournalService.saveJournal',
          retryConfig: JOURNAL_RETRY_CONFIG,
          onRetry: (attempt: number, error: Error) => {
            this.logger.warn(`âš ï¸ Journal save retry ${attempt}/${JOURNAL_RETRY_CONFIG.maxAttempts}`, {
              error: error.message,
              path: this.journalPath,
            });
          },
          onRecover: () => {
            this.logger.debug('ðŸ’¾ Trade journal saved after retry', {
              entriesCount: entries.length,
            });
          },
          onFailure: (error: Error) => {
            this.logger.error('âŒ CRITICAL: Failed to save journal after retries', {
              error: error.message,
              entries: entries.length,
              path: this.journalPath,
            });
          },
        },
      );
      return;
    }

    try {
      this.writeJournalFile(data);
      this.logger.debug('ðŸ’¾ Trade journal saved', { entriesCount: entries.length });
    } catch (error: unknown) {
      this.logger.error('âŒ Failed to save trade journal', {
        error: getErrorMessage(error),
      });
    }
  }

  private writeJournalFile(data: string): void {
    fs.writeFileSync(this.journalPath, data, 'utf-8');
  }

  recordTradeOpen(params: {
    id: string;
    symbol: string;
    side: PositionSide;
    entryPrice: number;
    quantity: number;
    leverage: number;
    entryCondition: EntryCondition;
  }): void {
    this.ensureInitialized();

    if (!params.id || params.id.length === 0) {
      throw new TradeRecordValidationError('Trade ID is required', {
        field: 'id',
        value: params.id,
        reason: 'Empty or missing trade ID',
      });
    }

    if (this.trades.has(params.id)) {
      throw new TradeRecordValidationError(`Trade ${params.id} already exists in journal`, {
        field: 'id',
        value: params.id,
        reason: 'Duplicate trade ID',
        tradeId: params.id,
      });
    }

    const trade: TradeRecord = {
      id: params.id,
      symbol: params.symbol,
      side: params.side,
      entryPrice: params.entryPrice,
      quantity: params.quantity,
      leverage: params.leverage,
      entryCondition: params.entryCondition,
      openedAt: Date.now(),
      status: 'OPEN',
    };

    this.trades.set(params.id, trade);
    this.saveJournal();

    if (this.journalRepository) {
      this.logger.debug('[Phase 6.2] Repository available (type adaptation pending)', {
        tradeId: trade.id,
      });
    }

    this.logger.info('ðŸ“ Trade entry recorded', {
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      entryPrice: trade.entryPrice.toFixed(DECIMAL_PLACES.PRICE),
      signal: params.entryCondition.signal.reason,
      type: params.entryCondition.signal.type,
      confidence: params.entryCondition.signal.confidence,
    });
  }

  private snapshotTradeState(tradeId: string): TradeRecord | null {
    const trade = this.trades.get(tradeId);
    return trade ? { ...trade } : null;
  }

  recordTradeClose(params: TradeCloseParams): { rollback: () => void } {
    this.ensureInitialized();
    const trade = this.requireTrade(params.id);
    const snapshot = this.snapshotTradeState(params.id);

    if (!snapshot) {
      throw new Error(`Failed to snapshot trade state for ${params.id}`);
    }

    const balanceBefore = this.virtualBalance?.getCurrentBalance() || 0;
    this.applyTradeClose(trade, params);
    this.saveJournal();

    const { totalFees, netPnL } = calculateTradeFeeSummary(
      trade.entryPrice,
      trade.quantity,
      params.realizedPnL,
    );

    if (this.virtualBalance) {
      this.virtualBalance.updateBalance(netPnL, params.id);
    }

    const balanceAfter = this.virtualBalance?.getCurrentBalance() || balanceBefore;

    if (this.tradeHistory && this.tradeHistoryConfig?.enabled) {
      const csvRecord = this.createCsvTradeRecord(trade, params, totalFees, netPnL, balanceBefore, balanceAfter);
      this.appendTradeHistoryRecord(params.id, csvRecord);
    }

    this.logger.info('ðŸ“ Trade exit recorded', {
      id: trade.id,
      symbol: trade.symbol,
      exitType: params.exitCondition.exitType,
      realizedPnL: `${params.realizedPnL.toFixed(DECIMAL_PLACES.PERCENT)} USDT`,
      netPnL: `${netPnL.toFixed(DECIMAL_PLACES.PERCENT)} USDT`,
      fees: `${totalFees.toFixed(DECIMAL_PLACES.PERCENT)} USDT`,
      pnlPercent: `${params.exitCondition.pnlPercent.toFixed(DECIMAL_PLACES.PERCENT)}%`,
      holdingTime: `${params.exitCondition.holdingTimeMinutes.toFixed(1)} min`,
      tpHit: params.exitCondition.tpLevelsHit.join(', ') || 'none',
      virtualBalance: `${balanceAfter.toFixed(DECIMAL_PLACES.PERCENT)} USDT`,
    });

    return {
      rollback: this.createTradeCloseRollback(snapshot, balanceBefore, params.id),
    };
  }

  private requireTrade(id: string): TradeRecord {
    const trade = this.trades.get(id);
    if (!trade) {
      throw new Error(`Trade ${id} not found`);
    }

    return trade;
  }

  private applyTradeClose(trade: TradeRecord, params: TradeCloseParams): void {
    trade.exitPrice = params.exitPrice;
    trade.exitCondition = params.exitCondition;
    trade.realizedPnL = params.realizedPnL;
    trade.closedAt = Date.now();
    trade.status = 'CLOSED';

    this.trades.set(params.id, trade);
  }

  private createCsvTradeRecord(
    trade: TradeRecord,
    params: TradeCloseParams,
    totalFees: number,
    netPnL: number,
    balanceBefore: number,
    balanceAfter: number,
  ): CSVTradeRecord {
    const marketData = this.getSignalMarketData(trade.entryCondition.signal);
    const stochastic = this.getIndicatorData(marketData, 'stochastic');
    const bollingerBands = this.getIndicatorData(marketData, 'bollingerBands');
    const duration = this.formatDuration((trade.closedAt || trade.openedAt) - trade.openedAt);

    return {
      timestamp: new Date(trade.openedAt).toISOString(),
      id: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      strategy: trade.entryCondition.signal.type,
      entryPrice: trade.entryPrice,
      exitPrice: params.exitPrice,
      quantity: trade.quantity,
      leverage: trade.leverage,
      pnl: params.realizedPnL,
      fees: totalFees,
      netPnl: netPnL,
      duration,
      exitType: params.exitCondition.exitType,
      confidence: trade.entryCondition.signal.confidence,
      virtualBalanceBefore: balanceBefore,
      virtualBalanceAfter: balanceAfter,
      sessionVersion: this.sessionVersion,
      notes: trade.entryCondition.signal.reason,
      rsi: marketData.rsi,
      rsiEntry: marketData.rsiEntry,
      rsiTrend1: marketData.rsiTrend1,
      ema: marketData.ema,
      emaEntry: marketData.emaEntry,
      distanceToLevel: marketData.distanceToLevel,
      distanceToEma: marketData.distanceToEma,
      volumeRatio: marketData.volumeRatio,
      swingHighsCount: marketData.swingHighsCount,
      swingLowsCount: marketData.swingLowsCount,
      trend: marketData.trend,
      atr: marketData.atr,
      btcCorrelation: marketData.btcCorrelation,
      stochasticK: stochastic.k,
      stochasticD: stochastic.d,
      stochasticOversold: stochastic.isOversold,
      stochasticOverbought: stochastic.isOverbought,
      bollingerUpper: bollingerBands.upper,
      bollingerMiddle: bollingerBands.middle,
      bollingerLower: bollingerBands.lower,
      bollingerWidth: bollingerBands.width,
      bollingerPercentB: bollingerBands.percentB,
      bollingerSqueeze: bollingerBands.isSqueeze,
      exitReason: params.exitCondition.reason,
      tpLevelsHit: params.exitCondition.tpLevelsHit.join(';'),
      tpLevelsHitCount: params.exitCondition.tpLevelsHitCount,
      stoppedOut: params.exitCondition.stoppedOut,
      slMovedToBreakeven: params.exitCondition.slMovedToBreakeven,
      trailingStopActivated: params.exitCondition.trailingStopActivated,
      maxProfitPercent: params.exitCondition.maxProfitPercent,
      maxDrawdownPercent: params.exitCondition.maxDrawdownPercent,
      holdingTimeMinutes: params.exitCondition.holdingTimeMinutes,
      pnlPercent: params.exitCondition.pnlPercent,
    };
  }

  private appendTradeHistoryRecord(tradeId: string, csvRecord: CSVTradeRecord): void {
    this.tradeHistory?.appendTrade(csvRecord).catch((error: unknown) => {
      if (this.errorHandler) {
        this.errorHandler.wrapSync(
          () => {
            throw error;
          },
          {
            strategy: RecoveryStrategy.SKIP,
            context: 'TradingJournalService.recordTradeClose[tradeHistory]',
          },
        );
      }

      this.logger.error('âŒ Failed to append to CSV history', {
        error: getErrorMessage(error),
        tradeId,
      });
    });
  }

  private createTradeCloseRollback(
    snapshot: TradeRecord | null,
    balanceBefore: number,
    tradeId: string,
  ): () => void {
    return () => {
      if (!snapshot) {
        this.logger.error('âŒ CRITICAL: Cannot rollback - snapshot missing');
        return;
      }

      this.trades.set(snapshot.id, snapshot);
      this.saveJournal();
      this.restoreVirtualBalance(balanceBefore, tradeId);

      this.logger.info('âœ… Journal rollback complete', {
        tradeId,
        balanceRestored: balanceBefore,
      });
    };
  }

  private restoreVirtualBalance(balanceBefore: number, tradeId: string): void {
    const balanceAfterUpdate = this.virtualBalance?.getCurrentBalance() || 0;
    if (balanceAfterUpdate === balanceBefore || !this.virtualBalance) {
      return;
    }

    const balanceDiff = balanceAfterUpdate - balanceBefore;
    this.virtualBalance.updateBalance(-balanceDiff, `ROLLBACK_${tradeId}`);
  }

  getTrade(id: string): TradeRecord | undefined {
    this.ensureInitialized();
    return this.trades.get(id);
  }

  getAllTrades(): TradeRecord[] {
    this.ensureInitialized();

    if (this.journalRepository) {
      this.logger.debug('[Phase 6.2] getAllTrades called - repository available but using sync Map for compatibility');
    }

    return Array.from(this.trades.values());
  }

  getOpenTrades(): TradeRecord[] {
    this.ensureInitialized();
    return this.getTradesByStatus('OPEN');
  }

  getOpenPositionBySymbol(symbol: string): TradeRecord | undefined {
    this.ensureInitialized();
    return this.getOpenTrades().find((trade) => trade.symbol === symbol);
  }

  getClosedTrades(): TradeRecord[] {
    this.ensureInitialized();
    return this.getTradesByStatus('CLOSED');
  }

  getStatistics(): JournalStatistics {
    this.ensureInitialized();
    return aggregateJournalStatistics(this.getAllTrades());
  }

  private getTradesByStatus(status: 'OPEN' | 'CLOSED'): TradeRecord[] {
    return this.getAllTrades().filter((trade) => trade.status === status);
  }

  private formatDuration(durationMs: number): string {
    const minutes = Math.floor(durationMs / TIME_UNITS.MINUTE);
    const hours = Math.floor(minutes / TIME_MULTIPLIERS.MINUTES_PER_HOUR);
    const days = Math.floor(hours / TIME_MULTIPLIERS.HOURS_PER_DAY);

    if (days > 0) {
      return `${days}d ${hours % TIME_MULTIPLIERS.HOURS_PER_DAY}h`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes % TIME_MULTIPLIERS.MINUTES_PER_HOUR}m`;
    }

    return `${minutes}m`;
  }

  private getSignalMarketData(signal: EntryCondition['signal']): Record<string, unknown> {
    return signal.marketData ?? {};
  }

  private getIndicatorData(
    marketData: Record<string, unknown>,
    key: 'stochastic' | 'bollingerBands',
  ): Record<string, unknown> {
    return this.asRecord(marketData[key]) ?? {};
  }

  getVirtualBalance(): number {
    this.ensureInitialized();
    return this.virtualBalance?.getCurrentBalance() || 0;
  }

  getVirtualBalanceService(): VirtualBalanceService | undefined {
    this.ensureInitialized();
    return this.virtualBalance;
  }

  exportToCSV(outputPath?: string): void {
    this.ensureInitialized();
    const csvPath = outputPath || path.join(this.dataDir, CSV_FILE);

    try {
      const entries = Array.from(this.trades.values());
      const csv = [this.buildExportHeader(), ...entries.map((entry) => this.buildExportRow(entry))].join('\n');
      fs.writeFileSync(csvPath, csv, 'utf-8');

      this.logger.info('ðŸ“Š Trade journal exported to CSV', {
        path: csvPath,
        entries: entries.length,
      });
    } catch (error: unknown) {
      if (this.errorHandler) {
        this.errorHandler.wrapSync(
          () => {
            throw new CSVExportError('Failed to export journal to CSV', {
              filePath: csvPath,
              reason: getErrorMessage(error),
              recordsCount: this.trades.size,
            });
          },
          {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'TradingJournalService.exportToCSV',
          },
        );
      }

      this.logger.error('âŒ Failed to export trade journal to CSV', {
        error: getErrorMessage(error),
        path: csvPath,
      });
    }
  }

  private buildExportHeader(): string {
    return [
      'ID',
      'Symbol',
      'Side',
      'Entry Price',
      'Exit Price',
      'Quantity',
      'Leverage',
      'Signal Type',
      'Signal Reason',
      'Confidence',
      'RSI',
      'RSI Entry',
      'RSI Trend1',
      'EMA',
      'EMA Entry',
      'Distance to Level %',
      'Distance to EMA %',
      'Volume Multiplier',
      'Swing Highs',
      'Swing Lows',
      'Trend',
      'Market Condition',
      'Exit Type',
      'Exit Reason',
      'Realized PnL USDT',
      'PnL %',
      'Holding Time Min',
      'TP Levels Hit',
      'TP Count',
      'Stopped Out',
      'SL to Breakeven',
      'Trailing Activated',
      'Max Profit %',
      'Max Drawdown %',
      'Opened At',
      'Closed At',
      'Status',
    ].join(',');
  }

  private buildExportRow(trade: TradeRecord): string {
    const signal = trade.entryCondition.signal;
    const exitCondition = trade.exitCondition;
    const marketData = this.getSignalMarketData(signal);

    return [
      trade.id,
      trade.symbol,
      trade.side,
      trade.entryPrice.toFixed(DECIMAL_PLACES.PRICE),
      trade.exitPrice?.toFixed(DECIMAL_PLACES.PRICE) || '',
      trade.quantity,
      trade.leverage,
      signal.type,
      `"${signal.reason}"`,
      signal.confidence,
      typeof marketData.rsi === 'number' ? marketData.rsi.toFixed(DECIMAL_PLACES.PERCENT) : '',
      typeof marketData.rsiEntry === 'number' ? marketData.rsiEntry.toFixed(DECIMAL_PLACES.PERCENT) : '',
      typeof marketData.rsiTrend1 === 'number' ? marketData.rsiTrend1.toFixed(DECIMAL_PLACES.PERCENT) : '',
      typeof marketData.ema === 'number' ? marketData.ema.toFixed(DECIMAL_PLACES.PRICE) : '',
      typeof marketData.emaEntry === 'number' ? marketData.emaEntry.toFixed(DECIMAL_PLACES.PRICE) : '',
      typeof marketData.distanceToLevel === 'number'
        ? marketData.distanceToLevel.toFixed(DECIMAL_PLACES.PERCENT)
        : '',
      typeof marketData.distanceToEma === 'number'
        ? marketData.distanceToEma.toFixed(DECIMAL_PLACES.PERCENT)
        : '',
      typeof marketData.volumeRatio === 'number' ? marketData.volumeRatio.toFixed(DECIMAL_PLACES.PERCENT) : '',
      marketData.swingHighsCount || '',
      marketData.swingLowsCount || '',
      marketData.trend || '',
      marketData.trend || '',
      exitCondition?.exitType || '',
      exitCondition ? `"${exitCondition.reason}"` : '',
      trade.realizedPnL?.toFixed(DECIMAL_PLACES.PERCENT) || '',
      exitCondition?.pnlPercent.toFixed(DECIMAL_PLACES.PERCENT) || '',
      exitCondition?.holdingTimeMinutes.toFixed(1) || '',
      exitCondition?.tpLevelsHit.join(';') || '',
      exitCondition?.tpLevelsHitCount || 0,
      exitCondition?.stoppedOut || false,
      exitCondition?.slMovedToBreakeven || false,
      exitCondition?.trailingStopActivated || false,
      exitCondition?.maxProfitPercent?.toFixed(DECIMAL_PLACES.PERCENT) || '',
      exitCondition?.maxDrawdownPercent?.toFixed(DECIMAL_PLACES.PERCENT) || '',
      new Date(trade.openedAt).toISOString(),
      trade.closedAt ? new Date(trade.closedAt).toISOString() : '',
      trade.status,
    ].join(',');
  }

  clear(): void {
    this.ensureInitialized();
    this.trades.clear();
    this.saveJournal();
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
}
