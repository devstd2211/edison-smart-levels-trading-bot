/**
 * Market Health Monitor
 *
 * Tracks strategy performance and detects degraded market conditions:
 * - Win Rate (min: 40%)
 * - Profit Factor (min: 1.2)
 * - Consecutive Losses (max: 5)
 * - Max Drawdown (max: 15%)
 *
 * Status levels:
 * - HEALTHY: All metrics good
 * - CAUTION: Some degradation, reduce position size
 * - BROKEN: Strategy no longer working, STOP trading
 */

import { LoggerService } from '../types';
import {
  MarketHealthConfig,
  MarketHealthResult,
  MarketHealthStatus,
  Trade
} from '../types/fractal-strategy.types';
import { INTEGER_MULTIPLIERS, THRESHOLD_VALUES, RATIO_MULTIPLIERS, DECIMAL_PLACES } from '../constants';

export class MarketHealthMonitor {
  private tradeHistory: Trade[] = [];
  private readonly MAX_HISTORY = 50; // Keep last 50 trades

  constructor(
    private config: MarketHealthConfig,
    private logger: LoggerService
  ) {}

  /**
   * Record a completed trade
   */
  recordTrade(trade: Trade): void {
    this.tradeHistory.push(trade);

    // Keep only last N trades
    if (this.tradeHistory.length > this.MAX_HISTORY) {
      this.tradeHistory.shift();
    }

    this.logger.debug('Trade recorded', {
      pnl: trade.pnl.toFixed(DECIMAL_PLACES.PERCENT),
      totalTrades: this.tradeHistory.length
    });
  }

  /**
   * Diagnose current market health
   */
  diagnose(): MarketHealthResult {
    // Need at least 10 trades for meaningful analysis
    if (this.tradeHistory.length < 10) {
      return {
        status: MarketHealthStatus.HEALTHY,
        winRate: 0,
        profitFactor: 0,
        consecutiveLosses: 0,
        message: 'Insufficient data (< 10 trades)',
        positionSizeMultiplier: 1.0
      };
    }

    const winRate = this.calculateWinRate();
    const profitFactor = this.calculateProfitFactor();
    const consecutiveLosses = this.calculateConsecutiveLosses();
    const maxDrawdown = this.calculateMaxDrawdown();

    // Determine status based on thresholds
    let status = MarketHealthStatus.HEALTHY;
    let message = 'Strategy performing well';

    // BROKEN status (stop trading)
    if (
      winRate < 0.30 ||
      profitFactor < 0.9 ||
      consecutiveLosses >= 10 ||
      maxDrawdown > 0.25
    ) {
      status = MarketHealthStatus.BROKEN;
      message = 'Strategy broken - STOP TRADING';
    }
    // CAUTION status (reduce position size)
    else if (
      winRate < this.config.minWinRate ||
      profitFactor < this.config.minProfitFactor ||
      consecutiveLosses >= this.config.maxConsecutiveLosses ||
      maxDrawdown > this.config.maxDrawdown
    ) {
      status = MarketHealthStatus.CAUTION;
      message = 'Strategy degraded - reduce position size to 50%';
    }

    const result: MarketHealthResult = {
      status,
      winRate,
      profitFactor,
      consecutiveLosses,
      maxDrawdown,
      message,
      positionSizeMultiplier:
        status === MarketHealthStatus.BROKEN ? INTEGER_MULTIPLIERS.ZERO : status === MarketHealthStatus.CAUTION ? THRESHOLD_VALUES.FIFTY_PERCENT : RATIO_MULTIPLIERS.FULL
    };

    // Log status change
    if (status !== MarketHealthStatus.HEALTHY) {
      this.logger.warn(`Market health status: ${status}`, {
        winRate: (winRate * INTEGER_MULTIPLIERS.ONE_HUNDRED).toFixed(1) + '%',
        profitFactor: profitFactor.toFixed(DECIMAL_PLACES.PERCENT),
        consecutiveLosses,
        maxDrawdown: (maxDrawdown * INTEGER_MULTIPLIERS.ONE_HUNDRED).toFixed(1) + '%'
      });
    }

    return result;
  }

  /**
   * Calculate win rate (0-1)
   */
  private calculateWinRate(): number {
    if (this.tradeHistory.length === 0) {
      return 0;
    }

    const wins = this.tradeHistory.filter(t => t.pnl > 0).length;
    return wins / this.tradeHistory.length;
  }

  /**
   * Calculate profit factor (gross profit / gross loss)
   */
  private calculateProfitFactor(): number {
    const winTrades = this.tradeHistory.filter(t => t.pnl > 0);
    const lossTrades = this.tradeHistory.filter(t => t.pnl < 0);

    if (lossTrades.length === 0) {
      return winTrades.length > 0 ? 999.99 : 0; // All wins
    }

    const grossProfit = winTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(lossTrades.reduce((sum, t) => sum + t.pnl, 0));

    return grossProfit / grossLoss;
  }

  /**
   * Calculate consecutive losses
   */
  private calculateConsecutiveLosses(): number {
    let count = 0;

    // Iterate backwards from most recent trade
    for (let i = this.tradeHistory.length - 1; i >= 0; i--) {
      if (this.tradeHistory[i].pnl < 0) {
        count++;
      } else {
        break; // Stop at first win
      }
    }

    return count;
  }

  /**
   * Calculate maximum drawdown
   * Uses cumulative profit/loss
   */
  private calculateMaxDrawdown(): number {
    if (this.tradeHistory.length === 0) {
      return 0;
    }

    let cumulative = 0;
    let peak = 0;
    let maxDD = 0;

    for (const trade of this.tradeHistory) {
      cumulative += trade.pnl;
      if (cumulative > peak) {
        peak = cumulative;
      }

      const drawdown = peak - cumulative;
      const drawdownPercent = peak > 0 ? drawdown / Math.abs(peak) : 0;

      if (drawdownPercent > maxDD) {
        maxDD = drawdownPercent;
      }
    }

    return maxDD;
  }

  /**
   * Get detailed statistics for logging
   */
  getDetailedStats(): {
    totalTrades: number;
    wins: number;
    losses: number;
    winRate: string;
    profitFactor: string;
    totalPnL: string;
    consecutiveLosses: number;
    maxDrawdown: string;
  } {
    const winRate = this.calculateWinRate();
    const profitFactor = this.calculateProfitFactor();
    const consecutiveLosses = this.calculateConsecutiveLosses();
    const maxDrawdown = this.calculateMaxDrawdown();

    const wins = this.tradeHistory.filter(t => t.pnl > 0).length;
    const losses = this.tradeHistory.filter(t => t.pnl < 0).length;
    const totalPnL = this.tradeHistory.reduce((sum, t) => sum + t.pnl, 0);

    return {
      totalTrades: this.tradeHistory.length,
      wins,
      losses,
      winRate: (winRate * INTEGER_MULTIPLIERS.ONE_HUNDRED).toFixed(1) + '%',
      profitFactor: profitFactor.toFixed(DECIMAL_PLACES.PERCENT),
      totalPnL: totalPnL.toFixed(DECIMAL_PLACES.PERCENT),
      consecutiveLosses,
      maxDrawdown: (maxDrawdown * INTEGER_MULTIPLIERS.ONE_HUNDRED).toFixed(1) + '%'
    };
  }

  /**
   * Clear history (for testing or reset)
   */
  clearHistory(): void {
    this.tradeHistory = [];
    this.logger.info('Market health history cleared');
  }

  /**
   * Get current status without detailed analysis
   */
  getQuickStatus(): MarketHealthStatus {
    const diagnosis = this.diagnose();
    return diagnosis.status;
  }
}
