import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';
import { TIME_MULTIPLIERS, INTEGER_MULTIPLIERS } from '../constants/technical.constants';
/**
 * Session Statistics Service
 *
 * Manages persistent session-based trading statistics for performance analysis.
 * Tracks all trades with full entry context (indicators, patterns, levels, context)
 * and generates comparative analysis across different configurations.
 *
 * Phase 6.2: Integrated with IJournalRepository for persistent storage
 * Version: v3.4.0
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  LoggerService,
  Session,
  SessionDatabase,
  SessionTradeRecord,
  SessionSummary,
  StrategyStats,
  DirectionStats,
  SignalDirection,
  ExitType,
  Config,
} from '../types/legacy';
import { IJournalRepository } from '../repositories/IRepositories';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { SessionRecordValidationError } from '../errors/DomainErrors';
import { getErrorMessage } from '../utils/error.utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_DATA_DIR = './data';
const SESSION_STATS_FILE = 'session-stats.json';
const BOT_VERSION = 'v3.4.0';
const SESSION_STATS_SAVE_RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 100,
  backoffMultiplier: 2,
  maxDelayMs: 500,
} as const;

type SessionTradeExitUpdate = {
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  exitType: ExitType;
  tpHitLevels: number[];
  holdingTimeMs: number;
  stopLoss: {
    initial: number;
    final: number;
    movedToBreakeven: boolean;
    trailingActivated: boolean;
  };
};

type SessionOverallStats = Omit<SessionSummary, 'byStrategy' | 'byDirection'>;

// ============================================================================
// SESSION STATS SERVICE
// ============================================================================

export class SessionStatsService {
  private readonly logger: LoggerService;
  private readonly dataDir: string;
  private readonly filePath: string;

  private database: SessionDatabase = { sessions: [] };
  private currentSession: Session | null = null;
  private initialized = false;

  constructor(
    logger: LoggerService,
    private readonly journalRepository?: IJournalRepository, // Phase 6.2: Repository pattern
    dataDir: string = DEFAULT_DATA_DIR,
    private readonly errorHandler?: ErrorHandler, // Phase 8.9.10: ErrorHandler integration
  ) {
    this.logger = logger;
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, SESSION_STATS_FILE);
  }

  /**
   * Start service initialization (explicit lifecycle)
   */
  start(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.load();
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.start();
    }
  }

  // ==========================================================================
  // SESSION LIFECYCLE
  // ==========================================================================

  /**
   * Start a new trading session
   * @param config - Full bot configuration snapshot
   * @param symbol - Trading symbol (e.g., "APEXUSDT")
   * @returns Session ID
   */
  startSession(config: Config, symbol: string): string {
    this.ensureInitialized();
    this.closeActiveSessionIfNeeded();

    this.currentSession = this.createSession(config, symbol);
    this.database.sessions.push(this.currentSession);

    this.logger.info('ðŸ“Š Trading session started', {
      sessionId: this.currentSession.sessionId,
      symbol,
      version: BOT_VERSION,
    });

    this.save();

    return this.currentSession.sessionId;
  }

  /**
   * End current trading session
   */
  endSession(): void {
    this.ensureInitialized();
    const session = this.currentSession;
    if (session === null) {
      this.logger.warn('No active session to end');
      return;
    }

    this.finalizeSession(session);

    this.logger.info('ðŸ“Š Trading session ended', {
      sessionId: session.sessionId,
      totalTrades: session.trades.length,
      winRate: session.summary.winRate.toFixed(1) + '%',
      totalPnl: session.summary.totalPnl.toFixed(DECIMAL_PLACES.PERCENT),
      duration: this.calculateDuration(session.startTime, session.endTime),
    });

    this.save();
    this.currentSession = null;
  }

  /**
   * Get current active session
   */
  getCurrentSession(): Session | null {
    this.ensureInitialized();
    return this.currentSession;
  }

  // ==========================================================================
  // TRADE RECORDING
  // ==========================================================================

  /**
   * Record trade entry
   * Strategy: THROW for validation errors (fail fast on duplicates)
   * @param trade - Trade record with entry condition
   */
  recordTradeEntry(trade: SessionTradeRecord): void {
    this.ensureInitialized();
    const session = this.currentSession;
    if (session === null) {
      this.logger.error('Cannot record trade - no active session');
      return;
    }

    const existingTrade = session.trades.find((entry) => entry.tradeId === trade.tradeId);
    if (existingTrade) {
      if (this.errorHandler) {
        throw new SessionRecordValidationError(`Trade ${trade.tradeId} already exists in session`, {
          field: 'tradeId',
          value: trade.tradeId,
          reason: 'Duplicate trade ID in session',
          tradeId: trade.tradeId,
          sessionId: session.sessionId,
        });
      }

      this.logger.warn('Duplicate tradeId detected, skipping', { tradeId: trade.tradeId });
      return;
    }

    session.trades.push(trade);

    this.logger.debug('ðŸ“ Trade entry recorded', {
      sessionId: session.sessionId,
      tradeId: trade.tradeId,
      direction: trade.direction,
      strategy: trade.entryCondition.signal.type,
    });

    this.refreshSessionSummary(session);
    this.save();
  }

  /**
   * Update trade exit
   * @param tradeId - Trade ID to update
   * @param exitData - Exit data (price, PnL, exitType, etc.)
   */
  updateTradeExit(tradeId: string, exitData: SessionTradeExitUpdate): void {
    const session = this.currentSession;
    if (session === null) {
      this.logger.warn('Cannot update trade - no active session (session may have ended)');
      return;
    }

    const trade = session.trades.find((entry) => entry.tradeId === tradeId);
    if (trade === undefined) {
      this.logger.warn('Trade not found in session (may be restored position without journalId)', {
        tradeId,
        sessionId: session.sessionId,
      });
      return;
    }

    this.applyTradeExitUpdate(trade, exitData);

    this.logger.debug('ðŸ“ Trade exit updated', {
      sessionId: session.sessionId,
      tradeId,
      exitType: exitData.exitType,
      pnl: exitData.pnl.toFixed(DECIMAL_PLACES.PERCENT),
    });

    this.refreshSessionSummary(session);
    this.save();
  }

  // ==========================================================================
  // ANALYSIS
  // ==========================================================================

  /**
   * Get session by ID
   * @param sessionId - Session ID
   * @returns Session or null if not found
   */
  getSession(sessionId: string): Session | null {
    this.ensureInitialized();
    return this.database.sessions.find((session) => session.sessionId === sessionId) || null;
  }

  /**
   * Get all sessions
   * @returns All sessions sorted by start time (newest first)
   */
  getAllSessions(): Session[] {
    this.ensureInitialized();
    return [...this.database.sessions].sort(
      (left, right) => new Date(right.startTime).getTime() - new Date(left.startTime).getTime(),
    );
  }

  /**
   * Get session summary
   * @param sessionId - Session ID
   * @returns Session summary or null if not found
   */
  getSessionSummary(sessionId: string): SessionSummary | null {
    this.ensureInitialized();
    const session = this.getSession(sessionId);
    return session ? session.summary : null;
  }

  // ==========================================================================
  // SUMMARY CALCULATION
  // ==========================================================================

  /**
   * Calculate summary statistics from trades
   */
  private calculateSummary(trades: SessionTradeRecord[]): SessionSummary {
    if (trades.length === 0) {
      return this.createEmptySummary();
    }

    const overallStats = this.calculateOverallStats(trades);

    return {
      ...overallStats,
      byStrategy: this.calculateStrategyStats(trades),
      byDirection: this.calculateDirectionStats(trades),
    };
  }

  /**
   * Create empty summary for new session
   */
  private createEmptySummary(): SessionSummary {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalPnl: 0,
      avgWin: 0,
      avgLoss: 0,
      wlRatio: 0,
      stopOutRate: 0,
      avgHoldingTimeMs: 0,
      byStrategy: {},
      byDirection: {},
    };
  }

  /**
   * Calculate duration between two timestamps
   */
  private calculateDuration(startTime: string, endTime: string | null): string {
    if (endTime === null) {
      return 'ACTIVE';
    }

    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    const hours = Math.floor(
      durationMs /
        (TIME_MULTIPLIERS.MILLISECONDS_PER_SECOND *
          INTEGER_MULTIPLIERS.SIXTY *
          INTEGER_MULTIPLIERS.SIXTY),
    );
    const minutes = Math.floor(
      (durationMs %
        (TIME_MULTIPLIERS.MILLISECONDS_PER_SECOND *
          INTEGER_MULTIPLIERS.SIXTY *
          INTEGER_MULTIPLIERS.SIXTY)) /
        (TIME_MULTIPLIERS.MILLISECONDS_PER_SECOND * INTEGER_MULTIPLIERS.SIXTY),
    );

    return `${hours}h ${minutes}m`;
  }

  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================

  /**
   * Save database to file with ErrorHandler integration
   * Strategy: RETRY for transient file I/O errors, then GRACEFUL_DEGRADE
   */
  private save(): void {
    const data = this.serializeDatabase();

    if (this.errorHandler) {
      this.errorHandler.wrapSync(() => this.persistDatabase(data), {
        strategy: RecoveryStrategy.RETRY,
        context: 'SessionStatsService.save',
        retryConfig: SESSION_STATS_SAVE_RETRY_CONFIG,
        onRetry: (attempt: number, error: Error) => {
          this.logger.warn(
            `âš ï¸ Session stats save retry ${attempt}/${SESSION_STATS_SAVE_RETRY_CONFIG.maxAttempts}`,
            {
              error: error.message,
              path: this.filePath,
            },
          );
        },
        onRecover: () => {
          this.logger.debug('ðŸ’¾ Session stats saved after retry', {
            totalSessions: this.database.sessions.length,
          });
        },
        onFailure: (error: Error) => {
          this.logger.error('âŒ CRITICAL: Failed to save session stats after retries', {
            error: error.message,
            path: this.filePath,
            totalSessions: this.database.sessions.length,
          });
        },
      });
      return;
    }

    try {
      this.persistDatabase(data);
      this.logger.debug('ðŸ’¾ Session stats saved', { path: this.filePath });
    } catch (error) {
      this.logger.error('âŒ Failed to save session stats', { error: getErrorMessage(error) });
    }
  }

  /**
   * Load database from file with ErrorHandler integration
   * Strategy: GRACEFUL_DEGRADE for file read/parse errors with backup
   */
  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.logger.info('ðŸ“Š Session stats file not found, creating new database');
        return;
      }

      const data = fs.readFileSync(this.filePath, 'utf-8');
      const parsedData = this.parseDatabase(data);
      if (parsedData === null) {
        return;
      }

      this.database = parsedData;

      this.logger.info('ðŸ“Š Session stats loaded', {
        totalSessions: this.database.sessions.length,
        path: this.filePath,
      });

      this.resumeActiveSession();
    } catch (error) {
      this.logger.error('âŒ Failed to load session stats', {
        error: getErrorMessage(error),
        path: this.filePath,
      });
    }
  }

  private closeActiveSessionIfNeeded(): void {
    if (this.currentSession !== null) {
      this.logger.warn('Previous session not closed, closing now');
      this.endSession();
    }
  }

  private createSession(config: Config, symbol: string): Session {
    return {
      sessionId: this.createSessionId(),
      startTime: new Date().toISOString(),
      endTime: null,
      version: BOT_VERSION,
      symbol,
      config,
      trades: [],
      summary: this.createEmptySummary(),
    };
  }

  private createSessionId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `session_${timestamp}`;
  }

  private finalizeSession(session: Session): void {
    session.endTime = new Date().toISOString();
    this.refreshSessionSummary(session);
  }

  private refreshSessionSummary(session: Session): void {
    session.summary = this.calculateSummary(session.trades);
  }

  private applyTradeExitUpdate(trade: SessionTradeRecord, exitData: SessionTradeExitUpdate): void {
    trade.exitPrice = exitData.exitPrice;
    trade.pnl = exitData.pnl;
    trade.pnlPercent = exitData.pnlPercent;
    trade.exitType = exitData.exitType;
    trade.tpHitLevels = exitData.tpHitLevels;
    trade.holdingTimeMs = exitData.holdingTimeMs;
    trade.stopLoss = exitData.stopLoss;
  }

  private calculateOverallStats(trades: SessionTradeRecord[]): SessionOverallStats {
    const wins = trades.filter((trade) => trade.pnl > 0);
    const losses = trades.filter((trade) => trade.pnl <= 0);
    const totalPnl = trades.reduce((sum, trade) => sum + trade.pnl, 0);
    const avgWin = wins.length > 0 ? wins.reduce((sum, trade) => sum + trade.pnl, 0) / wins.length : 0;
    const avgLoss =
      losses.length > 0 ? losses.reduce((sum, trade) => sum + trade.pnl, 0) / losses.length : 0;
    const stopOuts = losses.filter((trade) => trade.exitType === ExitType.STOP_LOSS).length;

    return {
      totalTrades: trades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: (wins.length / trades.length) * PERCENT_MULTIPLIER,
      totalPnl,
      avgWin,
      avgLoss,
      wlRatio: avgLoss !== 0 ? avgWin / Math.abs(avgLoss) : 0,
      stopOutRate: losses.length > 0 ? (stopOuts / losses.length) * PERCENT_MULTIPLIER : 0,
      avgHoldingTimeMs: trades.reduce((sum, trade) => sum + trade.holdingTimeMs, 0) / trades.length,
    };
  }

  private calculateStrategyStats(trades: SessionTradeRecord[]): Record<string, StrategyStats> {
    const byStrategy: Record<string, StrategyStats> = {};

    for (const trade of trades) {
      const strategyType = trade.entryCondition.signal.type;
      const stats = byStrategy[strategyType] ?? {
        count: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalPnl: 0,
      };

      stats.count++;
      stats.totalPnl += trade.pnl;

      if (trade.pnl > 0) {
        stats.wins++;
      } else {
        stats.losses++;
      }

      byStrategy[strategyType] = stats;
    }

    for (const stats of Object.values(byStrategy)) {
      stats.winRate = (stats.wins / stats.count) * PERCENT_MULTIPLIER;
    }

    return byStrategy;
  }

  private calculateDirectionStats(trades: SessionTradeRecord[]): Record<string, DirectionStats> {
    const byDirection: Record<string, DirectionStats> = {};

    for (const direction of [SignalDirection.LONG, SignalDirection.SHORT]) {
      const directionTrades = trades.filter((trade) => trade.direction === direction);
      const directionWins = directionTrades.filter((trade) => trade.pnl > 0);
      const directionLosses = directionTrades.filter((trade) => trade.pnl <= 0);

      byDirection[direction] = {
        count: directionTrades.length,
        wins: directionWins.length,
        losses: directionLosses.length,
        winRate:
          directionTrades.length > 0
            ? (directionWins.length / directionTrades.length) * PERCENT_MULTIPLIER
            : 0,
        totalPnl: directionTrades.reduce((sum, trade) => sum + trade.pnl, 0),
      };
    }

    return byDirection;
  }

  private serializeDatabase(): string {
    return JSON.stringify(this.database, null, 2);
  }

  private persistDatabase(data: string): void {
    this.ensureDataDirectoryExists();
    fs.writeFileSync(this.filePath, data, 'utf-8');
  }

  private ensureDataDirectoryExists(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private parseDatabase(data: string): SessionDatabase | null {
    try {
      return JSON.parse(data) as SessionDatabase;
    } catch (parseError) {
      this.handleCorruptedDatabase(parseError);
      return null;
    }
  }

  private handleCorruptedDatabase(parseError: unknown): void {
    this.logger.warn('âš ï¸ Corrupted session stats file, starting with empty database', {
      path: this.filePath,
      backupPath: this.getCorruptedBackupPath(),
      reason: getErrorMessage(parseError),
    });

    try {
      fs.copyFileSync(this.filePath, this.getCorruptedBackupPath());
    } catch (backupError) {
      this.logger.error('Failed to backup corrupted session stats', {
        error: getErrorMessage(backupError),
      });
    }
  }

  private getCorruptedBackupPath(): string {
    return `${this.filePath}.corrupted`;
  }

  private resumeActiveSession(): void {
    const lastSession = this.database.sessions[this.database.sessions.length - 1];
    if (lastSession === undefined || lastSession.endTime !== null) {
      return;
    }

    this.currentSession = lastSession;
    this.logger.info('Resumed active session', {
      sessionId: lastSession.sessionId,
      startTime: lastSession.startTime,
    });
  }
}
