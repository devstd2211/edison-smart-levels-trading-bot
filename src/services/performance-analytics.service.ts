/**
 * Phase 9: Performance Analytics Service
 *
 * Analyzes trade performance with:
 * - Win rate calculation
 * - Profit factor analysis
 * - Sharpe and Sortino ratios
 * - Maximum drawdown analysis
 * - Average holding time calculation
 * - Period-based metrics (TODAY, WEEK, MONTH, ALL)
 * - Top/worst trade identification
 *
 * Metrics Periods:
 * - ALL: All trades since bot start
 * - TODAY: Trades opened today (UTC)
 * - WEEK: Trades opened in last 7 days
 * - MONTH: Trades opened in last 30 days
 */

import { LoggerService } from '../types';
import { TradingJournalService } from './trading-journal.service';
import { ErrorHandler, RecoveryStrategy, PerformanceCalculationError } from '../errors';
import {
  PerformanceAnalyticsConfig,
  TradeStatistics,
  PeriodMetrics,
  SessionAnalytics,
  TopTrade,
  IPerformanceAnalytics,
} from '../types/live-trading.types';

/**
 * PerformanceAnalytics: Comprehensive trade performance analysis
 *
 * Responsibilities:
 * 1. Calculate win rate from historical trades
 * 2. Analyze profit factor (gross profit / gross loss)
 * 3. Calculate Sharpe and Sortino ratios
 * 4. Identify maximum drawdown
 * 5. Calculate average holding time
 * 6. Track period-based metrics
 * 7. Identify top and worst trades
 *
 * Architecture:
 * - Reads from TradingJournalService
 * - Caches calculations for performance
 * - Provides multi-period analysis
 * - Supports strategy-specific analytics
 */
export class PerformanceAnalytics implements IPerformanceAnalytics {
  private config: PerformanceAnalyticsConfig;
  private journalService: TradingJournalService;
  private logger: LoggerService;
  private errorHandler?: ErrorHandler; // Phase 8.9.36: Optional ErrorHandler
  private metricsCache: Map<string, any> = new Map();
  private lastUpdateTime: number = 0;

  constructor(
    config: PerformanceAnalyticsConfig,
    journalService: TradingJournalService,
    logger: LoggerService,
    errorHandler?: ErrorHandler, // Phase 8.9.36: Optional parameter for backward compatibility
  ) {
    this.config = config;
    this.journalService = journalService;
    this.logger = logger;
    this.errorHandler = errorHandler;
  }

  /**
   * Calculate win rate from trades
   * Win rate = (winning trades / total trades) * 100
   * Phase 8.9.36: Added input validation with THROW strategy and calculation GRACEFUL_DEGRADE
   */
  public calculateWinRate(trades: any[], period: number = 10): number {
    // Phase 8.9.36: THROW on invalid trades array
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

    // Phase 8.9.36: THROW on invalid period
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

    // Phase 8.9.36: GRACEFUL_DEGRADE for calculation failures
    try {
      // Filter to period
      const recentTrades = trades.slice(-period);
      const winningTrades = recentTrades.filter((t) => t.pnl > 0 || t.pnlPercent > 0).length;

      return (winningTrades / recentTrades.length) * 100;
    } catch (calcError) {
      if (this.errorHandler) {
        this.errorHandler.handle(calcError as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PerformanceAnalyticsService.calculateWinRate.calculation',
        }).catch(() => { /* Silent */ });
      }
      return 0; // Safe default
    }
  }

  /**
   * Calculate profit factor
   * Profit Factor = Gross Profit / Gross Loss
   * Value > 1.0 indicates profitable trading
   * Phase 8.9.36: Added input validation with THROW strategy and calculation GRACEFUL_DEGRADE
   */
  public calculateProfitFactor(trades: any[]): number {
    // Phase 8.9.36: THROW on invalid trades array
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

    // Phase 8.9.36: GRACEFUL_DEGRADE for calculation failures
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
        return grossProfit > 0 ? 100 : 0; // Avoid division by zero
      }

      const result = grossProfit / grossLoss;
      if (!Number.isFinite(result)) return 0;
      return result;
    } catch (calcError) {
      if (this.errorHandler) {
        this.errorHandler.handle(calcError as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PerformanceAnalyticsService.calculateProfitFactor.calculation',
        }).catch(() => { /* Silent */ });
      }
      return 0; // Safe default
    }
  }

  /**
   * Calculate average holding time from trades
   * Returns average in minutes
   * Phase 8.9.36: Added GRACEFUL_DEGRADE for calculation failures
   */
  public calculateAverageHoldTime(trades: any[]): number {
    // Phase 8.9.36: GRACEFUL_DEGRADE for calculation errors
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
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PerformanceAnalyticsService.calculateAverageHoldTime.calculation',
        }).catch(() => { /* Silent */ });
      }
      return 0; // Safe default
    }
  }

  /**
   * Get comprehensive statistics for a trade set
   * PHASE 13.1a: Implemented period-based trade filtering
   * Phase 8.9.36: Added input validation with THROW and calculation GRACEFUL_DEGRADE
   */
  public async getMetrics(period: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH'): Promise<TradeStatistics> {
    // Phase 8.9.36: THROW on invalid period
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

    // Phase 8.9.36: GRACEFUL_DEGRADE for calculation failures
    try {
      // Get trades from journal, filtered by period
      const trades = this.getTradesForPeriod(period);

      if (trades.length === 0) {
        return this.getEmptyStatistics();
      }

      // Calculate all metrics
      const totalTrades = trades.length;
      const winningTrades = trades.filter((t) => t.pnl > 0).length;
      const losingTrades = trades.filter((t) => t.pnl < 0).length;

      const winRate = (winningTrades / totalTrades) * 100;
      const lossRate = (losingTrades / totalTrades) * 100;
      const profitFactor = this.calculateProfitFactor(trades);

      const wins = trades.filter((t) => t.pnl > 0).map((t) => t.pnl);
      const losses = trades.filter((t) => t.pnl < 0).map((t) => t.pnl);

      const averageWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
      const averageLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;

      const largestWin = Math.max(...wins, 0);
      const largestLoss = Math.min(...losses, 0);

      const averageHoldingTime = this.calculateAverageHoldTime(trades);

      const totalPnL = trades.reduce((a, b) => a + (b.pnl || 0), 0);
      const totalPnLPercent = trades.reduce((a, b) => a + (b.pnlPercent || 0), 0) / totalTrades;

      // Calculate Sharpe ratio
      const sharpeRatio = this.calculateSharpeRatio(trades);
      const sortinoRatio = this.calculateSortinoRatio(trades);

      // Calculate max drawdown
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
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PerformanceAnalyticsService.getMetrics.calculation',
        }).catch(() => { /* Silent */ });
      }
      return this.getEmptyStatistics(); // Safe fallback
    }
  }

  /**
   * Get top (best) trades
   * PHASE 13.1a: Implemented using getTradesForPeriod
   * Phase 8.9.36: Added input validation with THROW strategy
   */
  public async getTopTrades(limit: number = 10): Promise<TopTrade[]> {
    // Phase 8.9.36: THROW on invalid limit
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

    // Phase 8.9.36: GRACEFUL_DEGRADE for retrieval failures
    try {
      const trades = this.getTradesForPeriod('ALL');

      // Sort by PnL descending, take top N
      const topTrades = trades
        .sort((a, b) => (b.pnl || 0) - (a.pnl || 0))
        .slice(0, limit)
        .map((t) => ({
          tradeId: t.tradeId || `trade-${Date.now()}`,
          symbol: t.symbol || 'UNKNOWN',
          direction: t.direction || 'LONG',
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
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PerformanceAnalyticsService.getTopTrades.retrieval',
        }).catch(() => { /* Silent */ });
      }
      return []; // Safe fallback
    }
  }

  /**
   * Get worst (losing) trades
   * PHASE 13.1a: Implemented using getTradesForPeriod
   * Phase 8.9.36: Added input validation with THROW strategy
   */
  public async getWorstTrades(limit: number = 10): Promise<TopTrade[]> {
    // Phase 8.9.36: THROW on invalid limit
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

    // Phase 8.9.36: GRACEFUL_DEGRADE for retrieval failures
    try {
      const trades = this.getTradesForPeriod('ALL');

      // Sort by PnL ascending (most losses first), take top N
      const worstTrades = trades
        .sort((a, b) => (a.pnl || 0) - (b.pnl || 0))
        .slice(0, limit)
        .map((t) => ({
          tradeId: t.tradeId || `trade-${Date.now()}`,
          symbol: t.symbol || 'UNKNOWN',
          direction: t.direction || 'LONG',
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
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PerformanceAnalyticsService.getWorstTrades.retrieval',
        }).catch(() => { /* Silent */ });
      }
      return []; // Safe fallback
    }
  }

  /**
   * Calculate Sharpe ratio
   * Sharpe = (Avg Return - Risk-Free Rate) / Std Dev of Returns
   * Simplified: Avg PnL / Std Dev of PnL
   * Phase 8.9.36: Added GRACEFUL_DEGRADE for calculation failures
   */
  private calculateSharpeRatio(trades: any[]): number {
    // Phase 8.9.36: GRACEFUL_DEGRADE for calculation errors
    try {
      if (trades.length < 2) return 0;

      const pnls = trades.map((t) => t.pnl || 0);
      const avgPnL = pnls.reduce((a, b) => a + b, 0) / pnls.length;

      // Calculate standard deviation
      const variance = pnls.reduce((a, b) => a + Math.pow(b - avgPnL, 2), 0) / pnls.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev === 0 || !Number.isFinite(stdDev)) return 0;

      const ratio = avgPnL / stdDev;
      if (!Number.isFinite(ratio)) return 0;

      return ratio;
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PerformanceAnalyticsService.calculateSharpeRatio.calculation',
        }).catch(() => { /* Silent */ });
      }
      return 0; // Safe default
    }
  }

  /**
   * Calculate Sortino ratio
   * Like Sharpe but only penalizes downside volatility
   * Phase 8.9.36: Added GRACEFUL_DEGRADE for calculation failures
   */
  private calculateSortinoRatio(trades: any[]): number {
    // Phase 8.9.36: GRACEFUL_DEGRADE for calculation errors
    try {
      if (trades.length < 2) return 0;

      const pnls = trades.map((t) => t.pnl || 0);
      const avgPnL = pnls.reduce((a, b) => a + b, 0) / pnls.length;

      // Calculate downside variance (only negative deviations)
      const downsideDeviations = pnls.map((p) => Math.min(p - avgPnL, 0));
      const downsideVariance = downsideDeviations.reduce((a, b) => a + Math.pow(b, 2), 0) / pnls.length;
      const downsideStdDev = Math.sqrt(downsideVariance);

      if (downsideStdDev === 0 || !Number.isFinite(downsideStdDev)) return avgPnL > 0 ? 100 : 0;

      const ratio = avgPnL / downsideStdDev;
      if (!Number.isFinite(ratio)) return avgPnL > 0 ? 100 : 0;

      return ratio;
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PerformanceAnalyticsService.calculateSortinoRatio.calculation',
        }).catch(() => { /* Silent */ });
      }
      return 0; // Safe default
    }
  }

  /**
   * Calculate maximum drawdown
   * Max drawdown = (Peak - Trough) / Peak
   * Phase 8.9.36: Added GRACEFUL_DEGRADE for calculation failures
   */
  private calculateMaxDrawdown(trades: any[]): number {
    // Phase 8.9.36: GRACEFUL_DEGRADE for calculation errors
    try {
      if (trades.length === 0) return 0;

      let runningProfit = 0;
      let peak = 0;
      let maxDrawdown = 0;

      for (const trade of trades) {
        runningProfit += trade.pnl || 0;
        peak = Math.max(peak, runningProfit);

        const drawdown = (peak - runningProfit) / (peak || 1); // Avoid division by zero
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }

      const result = maxDrawdown * 100; // Return as percentage
      if (!Number.isFinite(result)) return 0;
      return result;
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PerformanceAnalyticsService.calculateMaxDrawdown.calculation',
        }).catch(() => { /* Silent */ });
      }
      return 0; // Safe default
    }
  }

  /**
   * PHASE 13.1a: Get trades filtered by time period
   *
   * Filters trades by:
   * - ALL: All trades
   * - TODAY: Trades opened today (UTC)
   * - WEEK: Trades opened in last 7 days
   * - MONTH: Trades opened in last 30 days
   * Phase 8.9.36: Added GRACEFUL_DEGRADE for journal access failures
   */
  private getTradesForPeriod(period: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH'): any[] {
    // Phase 8.9.36: GRACEFUL_DEGRADE for journal access failure
    try {
      const allTrades = this.journalService.getAllTrades();

      if (period === 'ALL') {
        return allTrades;
      }

      const now = Date.now();
      let cutoffTime: number;

      switch (period) {
        case 'TODAY': {
          // Trades opened today (UTC)
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          cutoffTime = today.getTime();
          break;
        }
        case 'WEEK':
          // Last 7 days
          cutoffTime = now - 7 * 24 * 60 * 60 * 1000;
          break;
        case 'MONTH':
          // Last 30 days
          cutoffTime = now - 30 * 24 * 60 * 60 * 1000;
          break;
        default:
          return allTrades;
      }

      // Filter trades by openedAt timestamp
      return allTrades.filter((trade: any) => {
        const tradeOpenTime = trade.openedAt || trade.entryTime || 0;
        return tradeOpenTime >= cutoffTime;
      });
    } catch (error) {
      // Phase 8.9.36: GRACEFUL_DEGRADE on journal access failure
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PerformanceAnalyticsService.getTradesForPeriod.journalAccess',
        }).catch(() => { /* Silent */ });
      }
      return []; // Return empty array - safe fallback
    }
  }

  /**
   * Helper: Calculate holding time for a single trade
   */
  private calculateTradeHoldingTime(trade: any): number {
    const exitTime = trade.exitTime || Date.now();
    const entryTime = trade.entryTime || Date.now();
    return Math.round(((exitTime - entryTime) / 1000 / 60) * 10) / 10; // Minutes, 1 decimal
  }

  /**
   * Get empty statistics (when no trades)
   */
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

  /**
   * Get analytics statistics
   * Phase 8.9.36: Added GRACEFUL_DEGRADE for cache access failures
   */
  public getStatistics(): {
    totalAnalyzed: number;
    cacheSize: number;
    lastUpdateTime: number;
  } {
    // Phase 8.9.36: GRACEFUL_DEGRADE for cache retrieval
    try {
      return {
        totalAnalyzed: this.metricsCache.size,
        cacheSize: this.metricsCache.size,
        lastUpdateTime: this.lastUpdateTime,
      };
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PerformanceAnalyticsService.getStatistics.cacheAccess',
        }).catch(() => { /* Silent */ });
      }
      // Return safe defaults
      return {
        totalAnalyzed: 0,
        cacheSize: 0,
        lastUpdateTime: this.lastUpdateTime || 0,
      };
    }
  }

  /**
   * Clear metrics cache
   * Phase 8.9.36: Added SKIP strategy for logger errors (non-blocking)
   */
  public clearCache(): void {
    this.metricsCache.clear();

    // Phase 8.9.36: SKIP logger errors (non-blocking)
    try {
      this.logger.debug('[PerformanceAnalytics] Cleared metrics cache');
    } catch (logError) {
      if (this.errorHandler) {
        this.errorHandler.handle(logError as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PerformanceAnalyticsService.clearCache.debugLog',
        }).catch(() => { /* Silent */ });
      }
    }
  }
}
