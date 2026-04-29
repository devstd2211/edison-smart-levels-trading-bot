/**
 * BotMetrics Service - Comprehensive Performance Monitoring
 *
 * Tracks and reports:
 * - Trade statistics (wins, losses, ratios)
 * - Performance metrics (PnL, ROI, Sharpe ratio)
 * - Operation timings (event processing, API calls)
 * - Error rates and recovery
 * - Market conditions during trading
 *
 * Provides structured metrics for debugging, performance analysis, and reporting.
 *
 * Phase 8.9.40: ErrorHandler Integration
 * - RETRY strategy for logger failures (transient network issues)
 * - GRACEFUL_DEGRADE for report generation (never blocks trading)
 * - SKIP for event metrics collection (can afford to lose a few metrics)
 */

import { LoggerService } from './logger.service';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { getErrorMessage } from '../utils/error.utils';

const REPORT_SEPARATOR = '='.repeat(63);

/**
 * Trade result snapshot
 */
export interface TradeMetrics {
  id: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  duration: number;
  exitType: string;
  timestamp: number;
}

/**
 * Performance metrics summary
 */
export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  avgPnLPerTrade: number;
  totalROI: number;
  maxDrawdown: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  avgDuration: number;
}

/**
 * Event processing metrics
 */
export interface EventMetrics {
  eventType: string;
  count: number;
  successes: number;
  failures: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  errorRate: number;
}

type TradeTotals = {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnL: number;
  totalDuration: number;
  totalWinPnL: number;
  totalLossPnL: number;
};

/**
 * Comprehensive bot metrics collection
 */
export class BotMetricsService {
  private trades: TradeMetrics[] = [];
  private eventMetrics: Map<string, EventMetrics> = new Map();
  private sessionStartTime = Date.now();
  private totalProfit = 0;
  private totalLoss = 0;
  private maxDrawdown = 0;
  private currentDrawdown = 0;
  private peakBalance = 0;
  private started = false;

  constructor(
    private logger: LoggerService,
    private readonly errorHandler?: ErrorHandler,
  ) {}

  /**
   * Start service initialization (explicit lifecycle)
   */
  start(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    this.sessionStartTime = Date.now();
    this.tryLogInfo(
      'BotMetrics service initialized',
      undefined,
      'Failed to log initialization',
      RecoveryStrategy.RETRY,
      'BotMetricsService.start',
      'Failed to initialize BotMetrics service',
    );
  }

  /**
   * Record a completed trade
   *
   * @param trade - Trade metrics to record
   */
  recordTrade(trade: TradeMetrics): void {
    this.ensureStarted();

    try {
      this.trades.push(trade);
      this.updateTradeTotals(trade);

      this.logger.debug('Trade recorded', {
        tradeId: trade.id,
        pnl: trade.pnl.toFixed(4),
        pnlPercent: `${trade.pnlPercent.toFixed(2)}%`,
        duration: `${(trade.duration / 60000).toFixed(1)}min`,
        totalTrades: this.trades.length,
      });
    } catch (error: unknown) {
      this.handleServiceFailure(
        error,
        'Failed to record trade metrics',
        RecoveryStrategy.SKIP,
        `BotMetricsService.recordTrade [${trade.id}]`,
        'Failed to record trade',
      );
    }
  }

  /**
   * Record event processing metrics
   *
   * @param eventType - Type of event
   * @param duration - Processing duration in milliseconds
   * @param success - Whether event was processed successfully
   * @param error - Optional error message
   */
  recordEvent(eventType: string, duration: number, success: boolean = true, error?: string): void {
    this.ensureStarted();

    try {
      const metrics = this.getOrCreateEventMetrics(eventType);
      this.updateEventMetrics(metrics, duration, success);

      if (!success && error) {
        this.tryLogWarn(
          `Event processing error: ${eventType}`,
          {
            duration: `${duration.toFixed(2)}ms`,
            error,
          },
          'Failed to log event metrics',
          RecoveryStrategy.SKIP,
          `BotMetricsService.recordEvent [${eventType}]`,
        );
      }
    } catch (caughtError: unknown) {
      this.handleServiceFailure(
        caughtError,
        'Failed to record event metrics',
        RecoveryStrategy.SKIP,
        `BotMetricsService.recordEvent [${eventType}]`,
        'Failed to record event',
      );
    }
  }

  /**
   * Get comprehensive performance metrics
   *
   * @returns Performance metrics summary
   */
  getPerformanceMetrics(): PerformanceMetrics {
    this.ensureStarted();

    const totals = this.calculateTradeTotals();
    const avgPnLPerTrade = totals.totalTrades > 0 ? totals.totalPnL / totals.totalTrades : 0;
    const avgDuration = totals.totalTrades > 0 ? totals.totalDuration / totals.totalTrades : 0;
    const avgWin = totals.winningTrades > 0 ? totals.totalWinPnL / totals.winningTrades : 0;
    const avgLoss = totals.losingTrades > 0 ? totals.totalLossPnL / totals.losingTrades : 0;
    const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
    const profitFactor =
      this.totalLoss > 0 ? this.totalProfit / this.totalLoss : this.totalProfit > 0 ? Infinity : 0;

    return {
      totalTrades: totals.totalTrades,
      winningTrades: totals.winningTrades,
      losingTrades: totals.losingTrades,
      winRate: totals.totalTrades > 0 ? (totals.winningTrades / totals.totalTrades) * 100 : 0,
      totalPnL: totals.totalPnL,
      avgPnLPerTrade,
      totalROI: this.peakBalance > 0 ? (totals.totalPnL / this.peakBalance) * 100 : 0,
      maxDrawdown: this.maxDrawdown,
      profitFactor,
      avgWin,
      avgLoss,
      winLossRatio,
      avgDuration,
    };
  }

  /**
   * Get event processing metrics
   *
   * @returns Map of event metrics by type
   */
  getEventMetrics(): Map<string, EventMetrics> {
    this.ensureStarted();
    return this.eventMetrics;
  }

  /**
   * Get session duration in seconds
   *
   * @returns Duration in seconds
   */
  getSessionDuration(): number {
    this.ensureStarted();
    return (Date.now() - this.sessionStartTime) / 1000;
  }

  /**
   * Print comprehensive metrics report (GRACEFUL_DEGRADE: never blocks trading)
   */
  printReport(): void {
    this.ensureStarted();

    try {
      const performance = this.getPerformanceMetrics();
      const sessionDuration = this.getSessionDuration();

      for (const line of this.buildReportLines(performance, sessionDuration)) {
        this.logger.info(line);
      }
    } catch (error: unknown) {
      this.handleServiceFailure(
        error,
        'Failed to print metrics report',
        RecoveryStrategy.GRACEFUL_DEGRADE,
        'BotMetricsService.printReport',
        'Failed to print metrics report',
      );
    }
  }

  /**
   * Reset all metrics for a new session
   */
  reset(): void {
    this.ensureStarted();

    this.resetState();
    this.tryLogInfo(
      'Metrics reset for new session',
      undefined,
      'Failed to reset metrics',
      RecoveryStrategy.SKIP,
      'BotMetricsService.reset',
      'Failed to reset metrics',
    );
  }

  /**
   * Get all recorded trades
   *
   * @returns Array of trade metrics
   */
  getTrades(): TradeMetrics[] {
    this.ensureStarted();
    return [...this.trades];
  }

  /**
   * Get trade by ID
   *
   * @param tradeId - ID of trade to find
   * @returns Trade metrics or undefined
   */
  getTradeById(tradeId: string): TradeMetrics | undefined {
    this.ensureStarted();
    return this.trades.find((trade) => trade.id === tradeId);
  }

  private ensureStarted(): void {
    if (!this.started) {
      this.start();
    }
  }

  private updateTradeTotals(trade: TradeMetrics): void {
    if (trade.pnl > 0) {
      this.totalProfit += trade.pnl;
    } else {
      this.totalLoss += Math.abs(trade.pnl);
    }

    const currentBalance = this.totalProfit - this.totalLoss;
    if (currentBalance > this.peakBalance) {
      this.peakBalance = currentBalance;
      this.currentDrawdown = 0;
      return;
    }

    this.currentDrawdown = this.peakBalance - currentBalance;
    if (this.currentDrawdown > this.maxDrawdown) {
      this.maxDrawdown = this.currentDrawdown;
    }
  }

  private getOrCreateEventMetrics(eventType: string): EventMetrics {
    const existing = this.eventMetrics.get(eventType);
    if (existing) {
      return existing;
    }

    const created: EventMetrics = {
      eventType,
      count: 0,
      successes: 0,
      failures: 0,
      avgDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      errorRate: 0,
    };
    this.eventMetrics.set(eventType, created);
    return created;
  }

  private updateEventMetrics(metrics: EventMetrics, duration: number, success: boolean): void {
    metrics.count += 1;
    if (success) {
      metrics.successes += 1;
    } else {
      metrics.failures += 1;
    }

    metrics.avgDuration = ((metrics.avgDuration * (metrics.count - 1)) + duration) / metrics.count;
    metrics.minDuration = Math.min(metrics.minDuration, duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);
    metrics.errorRate = (metrics.failures / metrics.count) * 100;
  }

  private calculateTradeTotals(): TradeTotals {
    return this.trades.reduce<TradeTotals>(
      (totals, trade) => {
        totals.totalTrades += 1;
        totals.totalPnL += trade.pnl;
        totals.totalDuration += trade.duration;

        if (trade.pnl > 0) {
          totals.winningTrades += 1;
          totals.totalWinPnL += trade.pnl;
        } else if (trade.pnl < 0) {
          totals.losingTrades += 1;
          totals.totalLossPnL += Math.abs(trade.pnl);
        }

        return totals;
      },
      {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalPnL: 0,
        totalDuration: 0,
        totalWinPnL: 0,
        totalLossPnL: 0,
      },
    );
  }

  private buildReportLines(performance: PerformanceMetrics, sessionDuration: number): string[] {
    const lines = [
      REPORT_SEPARATOR,
      'PERFORMANCE METRICS REPORT',
      REPORT_SEPARATOR,
      'PnL & Profitability:',
      `  Total PnL: ${performance.totalPnL.toFixed(4)} (${performance.totalROI.toFixed(2)}%)`,
      `  Profit Factor: ${performance.profitFactor.toFixed(2)}`,
      `  Max Drawdown: ${performance.maxDrawdown.toFixed(4)}`,
      'Trade Statistics:',
      `  Total Trades: ${performance.totalTrades}`,
      `  Wins: ${performance.winningTrades} (${performance.winRate.toFixed(1)}%)`,
      `  Losses: ${performance.losingTrades}`,
      `  Avg Win: ${performance.avgWin.toFixed(4)} | Avg Loss: ${performance.avgLoss.toFixed(4)}`,
      `  Win/Loss Ratio: ${performance.winLossRatio.toFixed(2)}:1`,
      `  Avg Duration: ${(performance.avgDuration / 60000).toFixed(1)} min`,
      'Session:',
      `  Duration: ${(sessionDuration / 60).toFixed(1)} min`,
      `  Trades/Hour: ${performance.totalTrades > 0 ? ((performance.totalTrades / sessionDuration) * 3600).toFixed(1) : 0}`,
    ];

    if (this.eventMetrics.size > 0) {
      lines.push('Event Processing (top 5):');
      for (const event of Array.from(this.eventMetrics.values()).sort((a, b) => b.count - a.count).slice(0, 5)) {
        lines.push(
          `  ${event.eventType}: ${event.count} events (${event.successes} ok ${event.failures} failed) Avg: ${event.avgDuration.toFixed(2)}ms`,
        );
      }
    }

    lines.push(REPORT_SEPARATOR);
    return lines;
  }

  private resetState(): void {
    this.trades = [];
    this.eventMetrics.clear();
    this.sessionStartTime = Date.now();
    this.totalProfit = 0;
    this.totalLoss = 0;
    this.maxDrawdown = 0;
    this.currentDrawdown = 0;
    this.peakBalance = 0;
  }

  private tryLogInfo(
    message: string,
    meta: Record<string, unknown> | undefined,
    recoveryMessage: string,
    strategy: RecoveryStrategy,
    context: string,
    fallbackMessage: string,
  ): void {
    try {
      this.logger.info(message, meta);
    } catch (error: unknown) {
      this.handleServiceFailure(error, recoveryMessage, strategy, context, fallbackMessage);
    }
  }

  private tryLogWarn(
    message: string,
    meta: Record<string, unknown> | undefined,
    recoveryMessage: string,
    strategy: RecoveryStrategy,
    context: string,
  ): void {
    try {
      this.logger.warn(message, meta);
    } catch (error: unknown) {
      if (this.errorHandler) {
        this.handleRecoveryError(recoveryMessage, strategy, context);
      }
    }
  }

  private handleServiceFailure(
    error: unknown,
    recoveryMessage: string,
    strategy: RecoveryStrategy,
    context: string,
    fallbackMessage: string,
  ): void {
    if (this.errorHandler) {
      this.handleRecoveryError(recoveryMessage, strategy, context);
      return;
    }

    try {
      this.logger.error(fallbackMessage, {
        error,
        errorMessage: getErrorMessage(error),
      });
    } catch {
      // Never block trading because metrics logging failed.
    }
  }

  private handleRecoveryError(message: string, strategy: RecoveryStrategy, context: string): void {
    if (!this.errorHandler) {
      return;
    }

    this.errorHandler.handle(new Error(message), {
      strategy,
      context,
    });
  }
}
