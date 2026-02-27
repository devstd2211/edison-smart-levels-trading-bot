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
import { extractErrorMessage } from '../utils/error-helper';

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
  duration: number; // milliseconds
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
  winRate: number; // percentage
  totalPnL: number;
  avgPnLPerTrade: number;
  totalROI: number; // percentage
  maxDrawdown: number;
  profitFactor: number; // gross profit / gross loss
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  avgDuration: number; // ms per trade
}

/**
 * Event processing metrics
 */
export interface EventMetrics {
  eventType: string;
  count: number;
  successes: number;
  failures: number;
  avgDuration: number; // ms
  minDuration: number;
  maxDuration: number;
  errorRate: number; // percentage
}

/**
 * Comprehensive bot metrics collection
 */
export class BotMetricsService {
  private trades: TradeMetrics[] = [];
  private eventMetrics: Map<string, EventMetrics> = new Map();
  private sessionStartTime: number = Date.now();
  private totalProfit: number = 0;
  private totalLoss: number = 0;
  private maxDrawdown: number = 0;
  private currentDrawdown: number = 0;
  private peakBalance: number = 0;
  private errorHandler?: ErrorHandler;
  private started = false;

  constructor(private logger: LoggerService, errorHandler?: ErrorHandler) {
    this.errorHandler = errorHandler;
  }

  /**
   * Start service initialization (explicit lifecycle)
   */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.sessionStartTime = Date.now();
    try {
      this.logger.info('???? BotMetrics service initialized');
    } catch (error: unknown) {
      // RETRY strategy: logger might be temporarily unavailable
      if (this.errorHandler) {
        this.errorHandler.handle(new Error('Failed to log initialization'), {
          strategy: RecoveryStrategy.RETRY,
          context: 'BotMetricsService.start',
        });
      } else {
        try {
          this.logger.error('??? Failed to initialize BotMetrics service', {
            error,
            errorMessage: extractErrorMessage(error),
          });
        } catch {
          // Even error logging failed - continue silently to never block startup
        }
      }
      // Continue even if logger fails - metrics collection must not block startup
    }
  }

  private ensureStarted(): void {
    if (!this.started) {
      this.start();
    }
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

      if (trade.pnl > 0) {
        this.totalProfit += trade.pnl;
      } else {
        this.totalLoss += Math.abs(trade.pnl);
      }

      // Update peak balance for drawdown calculation
      const currentBalance = this.totalProfit - this.totalLoss;
      if (currentBalance > this.peakBalance) {
        this.peakBalance = currentBalance;
        this.currentDrawdown = 0;
      } else {
        this.currentDrawdown = this.peakBalance - currentBalance;
        if (this.currentDrawdown > this.maxDrawdown) {
          this.maxDrawdown = this.currentDrawdown;
        }
      }

      this.logger.debug('📊 Trade recorded', {
        tradeId: trade.id,
        pnl: trade.pnl.toFixed(4),
        pnlPercent: trade.pnlPercent.toFixed(2) + '%',
        duration: (trade.duration / 60000).toFixed(1) + 'min',
        totalTrades: this.trades.length,
      });
    } catch (error: unknown) {
      // SKIP strategy: losing one trade record doesn't impact trading logic
      if (this.errorHandler) {
        this.errorHandler.handle(new Error('Failed to record trade metrics'), {
          strategy: RecoveryStrategy.SKIP,
          context: `BotMetricsService.recordTrade [${trade.id}]`,
        });
      } else {
        try {
          this.logger.error('❌ Failed to record trade', { error, errorMessage: extractErrorMessage(error) });
        } catch {
          // Even error logging failed - continue silently to never block trading
        }
      }
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
      if (!this.eventMetrics.has(eventType)) {
        this.eventMetrics.set(eventType, {
          eventType,
          count: 0,
          successes: 0,
          failures: 0,
          avgDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          errorRate: 0,
        });
      }

      const metrics = this.eventMetrics.get(eventType)!;
      metrics.count++;

      if (success) {
        metrics.successes++;
      } else {
        metrics.failures++;
      }

      // Update duration stats
      const oldAvg = metrics.avgDuration;
      metrics.avgDuration = (oldAvg * (metrics.count - 1) + duration) / metrics.count;
      metrics.minDuration = Math.min(metrics.minDuration, duration);
      metrics.maxDuration = Math.max(metrics.maxDuration, duration);
      metrics.errorRate = (metrics.failures / metrics.count) * 100;

      try {
        if (!success && error) {
          this.logger.warn(`⚠️ Event processing error: ${eventType}`, {
            duration: duration.toFixed(2) + 'ms',
            error,
          });
        }
      } catch (logError: unknown) {
        // SKIP strategy: losing event logging doesn't impact core trading logic
        if (this.errorHandler) {
          this.errorHandler.handle(new Error('Failed to log event metrics'), {
            strategy: RecoveryStrategy.SKIP,
            context: `BotMetricsService.recordEvent [${eventType}]`,
          });
        }
      }
    } catch (err: unknown) {
      // SKIP strategy: losing event metrics doesn't impact core trading logic
      if (this.errorHandler) {
        this.errorHandler.handle(new Error('Failed to record event metrics'), {
          strategy: RecoveryStrategy.SKIP,
          context: `BotMetricsService.recordEvent [${eventType}]`,
        });
      } else {
        try {
          this.logger.error('❌ Failed to record event', { error: err, errorMessage: extractErrorMessage(err) });
        } catch {
          // Even error logging failed - continue silently to never block trading
        }
      }
    }
  }

  /**
   * Get comprehensive performance metrics
   *
   * @returns Performance metrics summary
   */
  getPerformanceMetrics(): PerformanceMetrics {
    this.ensureStarted();
    const totalTrades = this.trades.length;
    const winningTrades = this.trades.filter(t => t.pnl > 0).length;
    const losingTrades = this.trades.filter(t => t.pnl < 0).length;

    const totalPnL = this.trades.reduce((sum, t) => sum + t.pnl, 0);
    const avgPnLPerTrade = totalTrades > 0 ? totalPnL / totalTrades : 0;
    const avgDuration = totalTrades > 0
      ? this.trades.reduce((sum, t) => sum + t.duration, 0) / totalTrades
      : 0;

    const avgWin = winningTrades > 0
      ? this.trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / winningTrades
      : 0;
    const avgLoss = losingTrades > 0
      ? this.trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + Math.abs(t.pnl), 0) / losingTrades
      : 0;

    const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
    const profitFactor = this.totalLoss > 0 ? this.totalProfit / this.totalLoss : (this.totalProfit > 0 ? Infinity : 0);

    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
      totalPnL,
      avgPnLPerTrade,
      totalROI: this.peakBalance > 0 ? (totalPnL / this.peakBalance) * 100 : 0,
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
      const perf = this.getPerformanceMetrics();
      const sessionDuration = this.getSessionDuration();

      this.logger.info('═══════════════════════════════════════════════════════════════');
      this.logger.info('📊 PERFORMANCE METRICS REPORT');
      this.logger.info('═══════════════════════════════════════════════════════════════');

      this.logger.info('💰 PnL & Profitability:');
      this.logger.info(`  Total PnL: ${perf.totalPnL.toFixed(4)} (${perf.totalROI.toFixed(2)}%)`);
      this.logger.info(`  Profit Factor: ${perf.profitFactor.toFixed(2)}`);
      this.logger.info(`  Max Drawdown: ${perf.maxDrawdown.toFixed(4)}`);

      this.logger.info('📈 Trade Statistics:');
      this.logger.info(`  Total Trades: ${perf.totalTrades}`);
      this.logger.info(`  Wins: ${perf.winningTrades} (${perf.winRate.toFixed(1)}%)`);
      this.logger.info(`  Losses: ${perf.losingTrades}`);
      this.logger.info(`  Avg Win: ${perf.avgWin.toFixed(4)} | Avg Loss: ${perf.avgLoss.toFixed(4)}`);
      this.logger.info(`  Win/Loss Ratio: ${perf.winLossRatio.toFixed(2)}:1`);
      this.logger.info(`  Avg Duration: ${(perf.avgDuration / 60000).toFixed(1)} min`);

      this.logger.info('⏱️ Session:');
      this.logger.info(`  Duration: ${(sessionDuration / 60).toFixed(1)} min`);
      this.logger.info(`  Trades/Hour: ${perf.totalTrades > 0 ? ((perf.totalTrades / sessionDuration) * 3600).toFixed(1) : 0}`);

      // Event metrics
      if (this.eventMetrics.size > 0) {
        this.logger.info('🔄 Event Processing (top 5):');
        const topEvents = Array.from(this.eventMetrics.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        for (const event of topEvents) {
          this.logger.info(
            `  ${event.eventType}: ${event.count} events ` +
            `(${event.successes}✓ ${event.failures}✗) ` +
            `Avg: ${event.avgDuration.toFixed(2)}ms`
          );
        }
      }

      this.logger.info('═══════════════════════════════════════════════════════════════');
    } catch (error: unknown) {
      // GRACEFUL_DEGRADE strategy: never blocks trading due to logging failure
      if (this.errorHandler) {
        this.errorHandler.handle(new Error('Failed to print metrics report'), {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'BotMetricsService.printReport',
        });
      } else {
        try {
          this.logger.error('❌ Failed to print metrics report', { error, errorMessage: extractErrorMessage(error) });
        } catch {
          // Even error logging failed - continue silently to never block trading
        }
      }
      // Continue trading even if report generation fails
    }
  }

  /**
   * Reset all metrics for a new session
   */
  reset(): void {
    this.ensureStarted();
    try {
      this.trades = [];
      this.eventMetrics.clear();
      this.sessionStartTime = Date.now();
      this.totalProfit = 0;
      this.totalLoss = 0;
      this.maxDrawdown = 0;
      this.currentDrawdown = 0;
      this.peakBalance = 0;

      this.logger.info('✅ Metrics reset for new session');
    } catch (error: unknown) {
      // SKIP strategy: reset must complete even if logging fails
      if (this.errorHandler) {
        this.errorHandler.handle(new Error('Failed to reset metrics'), {
          strategy: RecoveryStrategy.SKIP,
          context: 'BotMetricsService.reset',
        });
      } else {
        try {
          this.logger.error('❌ Failed to reset metrics', { error, errorMessage: extractErrorMessage(error) });
        } catch {
          // Even error logging failed - continue silently to never block trading
        }
      }
    }
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
    return this.trades.find(t => t.id === tradeId);
  }
}
