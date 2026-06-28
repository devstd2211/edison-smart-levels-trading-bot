import { LoggerService } from './logger.service';
import { TradingJournalService } from './trading-journal.service';
import { ErrorHandler, RecoveryStrategy, PerformanceCalculationError } from '../errors';
import {
  PerformanceAnalyticsConfig,
  TradeStatistics,
  TopTrade,
  IPerformanceAnalytics,
  PerformanceAnalyticsTradeInput,
} from '../types/legacy';
import { normalizeError } from '../utils/error.utils';

export class PerformanceAnalytics implements IPerformanceAnalytics {
  private config: PerformanceAnalyticsConfig;
  private journalService: TradingJournalService;
  private logger: LoggerService;
  private errorHandler?: ErrorHandler;
  private metricsCache: Map<string, unknown> = new Map();
  private lastUpdateTime: number = 0;

  constructor(
    config: PerformanceAnalyticsConfig,
    journalService: TradingJournalService,
    logger: LoggerService,
    errorHandler?: ErrorHandler,
  ) {
    this.config = config;
    this.journalService = journalService;
    this.logger = logger;
    this.errorHandler = errorHandler;
  }

  private handleRecoveryError(error: unknown, strategy: RecoveryStrategy, context: string): void {
    if (!this.errorHandler) {
      return;
    }

    this.errorHandler.handle(normalizeError(error), {
      strategy,
      context,
    }).catch(() => {});
  }

  public calculateWinRate(trades: PerformanceAnalyticsTradeInput[], period: number = 10): number {
    if (!trades || !Array.isArray(trades)) {
      const error = new PerformanceCalculationError(
        'Invalid trades array for win rate calculation',
        {
          operation: 'calculateWinRate',
          tradesProvided: typeof trades,
          period,
        },
      );
      if (this.errorHandler) {
        throw this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'PerformanceAnalyticsService.calculateWinRate.validation',
        });
      }
      throw error;
    }

    if (period <= 0 || !Number.isFinite(period)) {
      const error = new PerformanceCalculationError(
        'Invalid period for win rate calculation',
        {
          operation: 'calculateWinRate',
          period,
        },
      );
      if (this.errorHandler) {
        throw this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'PerformanceAnalyticsService.calculateWinRate.periodValidation',
        });
      }
      throw error;
    }

    if (trades.length === 0) return 0;

    try {
      const recentTrades = trades.slice(-period);
      const winningTrades = recentTrades.filter(
        (t) => (t.pnl ?? 0) > 0 || (t.pnlPercent ?? 0) > 0
      ).length;

      return (winningTrades / recentTrades.length) * 100;
    } catch (calcError) {
      this.handleRecoveryError(calcError, RecoveryStrategy.GRACEFUL_DEGRADE, 'PerformanceAnalyticsService.calculateWinRate.calculation');
      return 0;
    }
  }

  public calculateProfitFactor(trades: PerformanceAnalyticsTradeInput[]): number {
    if (!trades || !Array.isArray(trades)) {
      const error = new PerformanceCalculationError(
        'Invalid trades array for profit factor calculation',
        {
          operation: 'calculateProfitFactor',
          tradesProvided: typeof trades,
        },
      );
      if (this.errorHandler) {
        throw this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'PerformanceAnalyticsService.calculateProfitFactor.validation',
        });
      }
      throw error;
    }

    if (trades.length === 0) return 0;

    try {
      let grossProfit = 0;
      let grossLoss = 0;

      for (const trade of trades) {
        const pnl = trade.pnl || 0;
        if (pnl > 0) {
          grossProfit += pnl;
        } else {
          grossLoss += Math.abs(pnl);
        }
      }

      if (grossLoss === 0) {
        return grossProfit > 0 ? 100 : 0;
      }

      const result = grossProfit / grossLoss;
      if (!Number.isFinite(result)) return 0;
      return result;
    } catch (calcError) {
      this.handleRecoveryError(calcError, RecoveryStrategy.GRACEFUL_DEGRADE, 'PerformanceAnalyticsService.calculateProfitFactor.calculation');
      return 0;
    }
  }

  public calculateAverageHoldTime(trades: PerformanceAnalyticsTradeInput[]): number {
    try {
      if (trades.length === 0) return 0;

      const holdingTimes = trades.map((t) => {
        const exitTime = t.exitTime || Date.now();
        const entryTime = t.entryTime || Date.now();
        return (exitTime - entryTime) / 1000 / 60; // Convert to minutes
      });

      const total = holdingTimes.reduce((a, b) => a + b, 0);
      const result = Math.round((total / holdingTimes.length) * 10) / 10; // Round to 1 decimal
      if (!Number.isFinite(result)) return 0;
      return result;
    } catch (error) {
      this.handleRecoveryError(error, RecoveryStrategy.GRACEFUL_DEGRADE, 'PerformanceAnalyticsService.calculateAverageHoldTime.calculation');
      return 0;
    }
  }

  public async getMetrics(period: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH'): Promise<TradeStatistics> {
    const validPeriods = ['ALL', 'TODAY', 'WEEK', 'MONTH'];
    if (!validPeriods.includes(period)) {
      const error = new PerformanceCalculationError(
        'Invalid period for metrics calculation',
        {
          operation: 'getMetrics',
          period,
          validPeriods,
        },
      );
      if (this.errorHandler) {
        throw this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'PerformanceAnalyticsService.getMetrics.periodValidation',
        });
      }
      throw error;
    }

    try {
      const trades = this.getTradesForPeriod(period);

      if (trades.length === 0) {
        return this.getEmptyStatistics();
      }

      const totalTrades = trades.length;
      const winningTrades = trades.filter((t) => (t.pnl ?? 0) > 0).length;
      const losingTrades = trades.filter((t) => (t.pnl ?? 0) < 0).length;

      const winRate = (winningTrades / totalTrades) * 100;
      const lossRate = (losingTrades / totalTrades) * 100;
      const profitFactor = this.calculateProfitFactor(trades);

      const wins = trades.map((t) => t.pnl ?? 0).filter((pnl) => pnl > 0);
      const losses = trades.map((t) => t.pnl ?? 0).filter((pnl) => pnl < 0);

      const averageWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
      const averageLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;

      const largestWin = Math.max(...wins, 0);
      const largestLoss = Math.min(...losses, 0);

      const averageHoldingTime = this.calculateAverageHoldTime(trades);

      const totalPnL = trades.reduce((a, b) => a + (b.pnl || 0), 0);
      const totalPnLPercent = trades.reduce((a, b) => a + (b.pnlPercent || 0), 0) / totalTrades;

      const sharpeRatio = this.calculateSharpeRatio(trades);
      const sortinoRatio = this.calculateSortinoRatio(trades);

      const maxDrawdown = this.calculateMaxDrawdown(trades);

      return {
        totalTrades,
        winRate: Math.round(winRate * 100) / 100,
        lossRate: Math.round(lossRate * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        sharpeRatio: Math.round(sharpeRatio * 100) / 100,
        sortinoRatio: Math.round(sortinoRatio * 100) / 100,
        maxDrawdown: Math.round(maxDrawdown * 100) / 100,
        averageWin: Math.round(averageWin * 100) / 100,
        averageLoss: Math.round(averageLoss * 100) / 100,
        largestWin: Math.round(largestWin * 100) / 100,
        largestLoss: Math.round(largestLoss * 100) / 100,
        averageHoldingTime,
        totalPnL: Math.round(totalPnL * 100) / 100,
        totalPnLPercent: Math.round(totalPnLPercent * 100) / 100,
      };
    } catch (error) {
      this.handleRecoveryError(error, RecoveryStrategy.GRACEFUL_DEGRADE, 'PerformanceAnalyticsService.getMetrics.calculation');
      return this.getEmptyStatistics();
    }
  }

  public async getTopTrades(limit: number = 10): Promise<TopTrade[]> {
    if (limit <= 0 || !Number.isFinite(limit)) {
      const error = new PerformanceCalculationError(
        'Invalid limit for top trades query',
        {
          operation: 'getTopTrades',
          limit,
        },
      );
      if (this.errorHandler) {
        throw this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'PerformanceAnalyticsService.getTopTrades.validation',
        });
      }
      throw error;
    }

    try {
      const trades = this.getTradesForPeriod('ALL');

      const topTrades = trades
        .sort((a, b) => (b.pnl || 0) - (a.pnl || 0))
        .slice(0, limit)
        .map((t) => ({
          tradeId: t.tradeId || `trade-${Date.now()}`,
          symbol: t.symbol || 'UNKNOWN',
          direction: this.normalizeTradeDirection(t.direction),
          entryPrice: t.entryPrice || 0,
          exitPrice: t.exitPrice || 0,
          pnl: t.pnl || 0,
          pnlPercent: t.pnlPercent || 0,
          holdingTimeMinutes: this.calculateTradeHoldingTime(t),
          entryTime: t.entryTime || 0,
          exitTime: t.exitTime || 0,
          reason: t.exitReason || 'UNKNOWN',
        }));

      return topTrades;
    } catch (error) {
      this.handleRecoveryError(error, RecoveryStrategy.GRACEFUL_DEGRADE, 'PerformanceAnalyticsService.getTopTrades.retrieval');
      return [];
    }
  }

  public async getWorstTrades(limit: number = 10): Promise<TopTrade[]> {
    if (limit <= 0 || !Number.isFinite(limit)) {
      const error = new PerformanceCalculationError(
        'Invalid limit for worst trades query',
        {
          operation: 'getWorstTrades',
          limit,
        },
      );
      if (this.errorHandler) {
        throw this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'PerformanceAnalyticsService.getWorstTrades.validation',
        });
      }
      throw error;
    }

    try {
      const trades = this.getTradesForPeriod('ALL');

      const worstTrades = trades
        .sort((a, b) => (a.pnl || 0) - (b.pnl || 0))
        .slice(0, limit)
        .map((t) => ({
          tradeId: t.tradeId || `trade-${Date.now()}`,
          symbol: t.symbol || 'UNKNOWN',
          direction: this.normalizeTradeDirection(t.direction),
          entryPrice: t.entryPrice || 0,
          exitPrice: t.exitPrice || 0,
          pnl: t.pnl || 0,
          pnlPercent: t.pnlPercent || 0,
          holdingTimeMinutes: this.calculateTradeHoldingTime(t),
          entryTime: t.entryTime || 0,
          exitTime: t.exitTime || 0,
          reason: t.exitReason || 'UNKNOWN',
        }));

      return worstTrades;
    } catch (error) {
      this.handleRecoveryError(error, RecoveryStrategy.GRACEFUL_DEGRADE, 'PerformanceAnalyticsService.getWorstTrades.retrieval');
      return [];
    }
  }

  private calculateSharpeRatio(trades: PerformanceAnalyticsTradeInput[]): number {
    try {
      if (trades.length < 2) return 0;

      const pnls = trades.map((t) => t.pnl || 0);
      const avgPnL = pnls.reduce((a, b) => a + b, 0) / pnls.length;

      const variance = pnls.reduce((a, b) => a + Math.pow(b - avgPnL, 2), 0) / pnls.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev === 0 || !Number.isFinite(stdDev)) return 0;

      const ratio = avgPnL / stdDev;
      if (!Number.isFinite(ratio)) return 0;

      return ratio;
    } catch (error) {
      this.handleRecoveryError(error, RecoveryStrategy.GRACEFUL_DEGRADE, 'PerformanceAnalyticsService.calculateSharpeRatio.calculation');
      return 0;
    }
  }

  private calculateSortinoRatio(trades: PerformanceAnalyticsTradeInput[]): number {
    try {
      if (trades.length < 2) return 0;

      const pnls = trades.map((t) => t.pnl || 0);
      const avgPnL = pnls.reduce((a, b) => a + b, 0) / pnls.length;

      const downsideDeviations = pnls.map((p) => Math.min(p - avgPnL, 0));
      const downsideVariance = downsideDeviations.reduce((a, b) => a + Math.pow(b, 2), 0) / pnls.length;
      const downsideStdDev = Math.sqrt(downsideVariance);

      if (downsideStdDev === 0 || !Number.isFinite(downsideStdDev)) return avgPnL > 0 ? 100 : 0;

      const ratio = avgPnL / downsideStdDev;
      if (!Number.isFinite(ratio)) return avgPnL > 0 ? 100 : 0;

      return ratio;
    } catch (error) {
      this.handleRecoveryError(error, RecoveryStrategy.GRACEFUL_DEGRADE, 'PerformanceAnalyticsService.calculateSortinoRatio.calculation');
      return 0;
    }
  }

  private calculateMaxDrawdown(trades: PerformanceAnalyticsTradeInput[]): number {
    try {
      if (trades.length === 0) return 0;

      let runningProfit = 0;
      let peak = 0;
      let maxDrawdown = 0;

      for (const trade of trades) {
        runningProfit += trade.pnl || 0;
        peak = Math.max(peak, runningProfit);

        const drawdown = (peak - runningProfit) / (peak || 1);
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }

      const result = maxDrawdown * 100;
      if (!Number.isFinite(result)) return 0;
      return result;
    } catch (error) {
      this.handleRecoveryError(error, RecoveryStrategy.GRACEFUL_DEGRADE, 'PerformanceAnalyticsService.calculateMaxDrawdown.calculation');
      return 0;
    }
  }

  private getTradesForPeriod(period: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH'): PerformanceAnalyticsTradeInput[] {
    try {
      const allTrades = this.journalService.getAllTrades();

      if (period === 'ALL') {
        return allTrades;
      }

      const now = Date.now();
      let cutoffTime: number;

      switch (period) {
        case 'TODAY': {
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          cutoffTime = today.getTime();
          break;
        }
        case 'WEEK':
          cutoffTime = now - 7 * 24 * 60 * 60 * 1000;
          break;
        case 'MONTH':
          cutoffTime = now - 30 * 24 * 60 * 60 * 1000;
          break;
        default:
          return allTrades;
      }

      return allTrades.filter((trade: PerformanceAnalyticsTradeInput) => {
        const tradeOpenTime = trade.openedAt || trade.entryTime || 0;
        return tradeOpenTime >= cutoffTime;
      });
    } catch (error) {
      this.handleRecoveryError(error, RecoveryStrategy.GRACEFUL_DEGRADE, 'PerformanceAnalyticsService.getTradesForPeriod.journalAccess');
      return [];
    }
  }

  private calculateTradeHoldingTime(trade: PerformanceAnalyticsTradeInput): number {
    const exitTime = trade.exitTime || Date.now();
    const entryTime = trade.entryTime || Date.now();
    return Math.round(((exitTime - entryTime) / 1000 / 60) * 10) / 10; // Minutes, 1 decimal
  }

  private normalizeTradeDirection(direction: string | undefined): 'LONG' | 'SHORT' {
    return direction === 'SHORT' ? 'SHORT' : 'LONG';
  }

  private getEmptyStatistics(): TradeStatistics {
    return {
      totalTrades: 0,
      winRate: 0,
      lossRate: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      averageHoldingTime: 0,
      totalPnL: 0,
      totalPnLPercent: 0,
    };
  }

  public getStatistics(): {
    totalAnalyzed: number;
    cacheSize: number;
    lastUpdateTime: number;
  } {
    try {
      return {
        totalAnalyzed: this.metricsCache.size,
        cacheSize: this.metricsCache.size,
        lastUpdateTime: this.lastUpdateTime,
      };
    } catch (error) {
      this.handleRecoveryError(error, RecoveryStrategy.GRACEFUL_DEGRADE, 'PerformanceAnalyticsService.getStatistics.cacheAccess');
      return {
        totalAnalyzed: 0,
        cacheSize: 0,
        lastUpdateTime: this.lastUpdateTime || 0,
      };
    }
  }

  public clearCache(): void {
    this.metricsCache.clear();

    try {
      this.logger.debug('[PerformanceAnalytics] Cleared metrics cache');
    } catch (logError) {
      this.handleRecoveryError(logError, RecoveryStrategy.SKIP, 'PerformanceAnalyticsService.clearCache.debugLog');
    }
  }
}

