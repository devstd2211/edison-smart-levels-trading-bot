import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';
import { MAX_TICK_HISTORY, CLEANUP_INTERVAL_MS } from '../constants/technical.constants';
/**
 * Tick Delta Analyzer Service (Phase 4)
 *
 * Analyzes buy/sell tick delta for momentum detection.
 *
 * Features:
 * - Tracks tick history (buy/sell trades)
 * - Calculates buy/sell delta ratio
 * - Detects momentum spikes (e.g., 2x more buys than sells)
 * - Automatic cleanup of old ticks
 *
 * Example:
 * - 40 buy ticks, 15 sell ticks → deltaRatio = 2.67 → BUY momentum spike
 * - 10 buy ticks, 35 sell ticks → deltaRatio = 0.29 (inverse 3.5) → SELL momentum spike
 */

import {
  LoggerService,
  SignalDirection,
  Tick,
  MomentumSpike,
  TickDeltaAnalyzerConfig,
} from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

// MAX_TICK_HISTORY imported from technical.constants (max ticks in memory)
// CLEANUP_INTERVAL_MS imported from technical.constants (cleanup every 10s)

// ============================================================================
// TICK DELTA ANALYZER SERVICE
// ============================================================================

export class TickDeltaAnalyzerService {
  private tickHistory: Tick[] = [];
  private lastCleanupTime: number = Date.now();

  constructor(
    private config: TickDeltaAnalyzerConfig,
    private logger: LoggerService,
  ) {
    this.logger.info('TickDeltaAnalyzerService initialized', {
      minDeltaRatio: config.minDeltaRatio,
      detectionWindow: config.detectionWindow,
      minTickCount: config.minTickCount,
      minVolumeUSDT: config.minVolumeUSDT,
    });
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Add new tick to history
   *
   * @param tick - New trade/tick
   */
  addTick(tick: Tick): void {
    this.tickHistory.push(tick);

    // Limit history size
    if (this.tickHistory.length > MAX_TICK_HISTORY) {
      this.tickHistory.shift(); // Remove oldest tick
    }

    // Periodic cleanup
    if (Date.now() - this.lastCleanupTime > CLEANUP_INTERVAL_MS) {
      this.cleanupOldTicks();
    }

    //     this.logger.debug('Tick added', {
    //       side: tick.side,
    //       price: tick.price,
    //       size: tick.size,
    //       historySize: this.tickHistory.length,
    //     });
  }

  /**
   * Calculate buy/sell delta ratio for recent window
   *
   * Returns ratio of buy volume to sell volume.
   * - Ratio > 1: More buy pressure (bullish)
   * - Ratio < 1: More sell pressure (bearish)
   *
   * @param windowMs - Time window to analyze (ms, default: config.detectionWindow)
   * @param currentTime - Current time reference (ms, default: Date.now() for live, override for backtest)
   * @returns Delta ratio (buy/sell)
   */
  calculateDeltaRatio(windowMs: number = this.config.detectionWindow, currentTime: number = Date.now()): number {
    const cutoffTime = currentTime - windowMs;

    // Filter ticks in window
    const recentTicks = this.tickHistory.filter((tick) => tick.timestamp >= cutoffTime);

    if (recentTicks.length === 0) {
      return 1.0; // Neutral (no data)
    }

    // Calculate buy and sell volumes
    let buyVolume = 0;
    let sellVolume = 0;

    for (const tick of recentTicks) {
      if (tick.side === 'BUY') {
        buyVolume += tick.size;
      } else {
        sellVolume += tick.size;
      }
    }

    // Avoid division by zero
    if (sellVolume === 0 && buyVolume === 0) {
      return 1.0; // Neutral (no volume)
    }

    if (sellVolume === 0) {
      // Only buys: strong bullish, but cap at reasonable max (10x instead of 999)
      return 10.0;
    }

    if (buyVolume === 0) {
      // Only sells: strong bearish (inverse will be 10x for SHORT)
      return 0.1;
    }

    return buyVolume / sellVolume;
  }

  /**
   * Detect momentum spike from recent ticks
   *
   * Checks if delta ratio exceeds threshold and meets volume requirements.
   *
   * @param currentTime - Current time reference (ms, default: Date.now() for live, override for backtest)
   * @returns MomentumSpike if detected, null otherwise
   */
  detectMomentumSpike(currentTime: number = Date.now()): MomentumSpike | null {
    const cutoffTime = currentTime - this.config.detectionWindow;

    // Filter recent ticks
    const recentTicks = this.tickHistory.filter((tick) => tick.timestamp >= cutoffTime);

    // Debug: Show tick filtering
    if (this.tickHistory.length > 0) {
      const oldestTickTime = this.tickHistory[0].timestamp;
      const newestTickTime = this.tickHistory[this.tickHistory.length - 1].timestamp;
      if (recentTicks.length === 0 || recentTicks.length % 10 === 0) {
        this.logger.debug('[TickDelta] Tick filtering', {
          detectionWindow: `${this.config.detectionWindow}ms`,
          currentTime,
          tickHistoryTotal: this.tickHistory.length,
          oldestTickTime,
          newestTickTime,
          recentTicksInWindow: recentTicks.length,
          cutoffTime
        });
      }
    }

    // Check min tick count
    if (recentTicks.length < this.config.minTickCount) {
      this.logger.debug('Not enough ticks for momentum detection', {
        tickCount: recentTicks.length,
        minRequired: this.config.minTickCount,
      });
      return null;
    }

    // Calculate volumes
    let buyVolume = 0;
    let sellVolume = 0;
    let totalVolumeContracts = 0;

    for (const tick of recentTicks) {
      totalVolumeContracts += tick.size;
      if (tick.side === 'BUY') {
        buyVolume += tick.size;
      } else {
        sellVolume += tick.size;
      }
    }

    // Calculate average price for USDT volume estimation
    const avgPrice =
      recentTicks.reduce((sum, tick) => sum + tick.price, 0) / recentTicks.length;
    const volumeUSDT = totalVolumeContracts * avgPrice;

    // Check min volume
    if (volumeUSDT < this.config.minVolumeUSDT) {
      this.logger.debug('Volume too low for momentum spike', {
        volumeUSDT,
        minRequired: this.config.minVolumeUSDT,
      });
      return null;
    }

    // Calculate delta ratio (with safety checks)
    let deltaRatio: number;
    if (sellVolume === 0 && buyVolume === 0) {
      this.logger.debug('No volume in window', {volumeUSDT});
      return null; // Skip if no volume
    } else if (sellVolume === 0) {
      deltaRatio = 10.0; // Cap at 10x instead of 999
    } else if (buyVolume === 0) {
      deltaRatio = 0.1; // Inverse 10x for SHORT
    } else {
      deltaRatio = buyVolume / sellVolume;
    }

    // Detect spike
    let direction: SignalDirection | null = null;
    let actualRatio = deltaRatio;

    this.logger.debug('[TickDelta] Delta Analysis', {
      ratio: deltaRatio.toFixed(DECIMAL_PLACES.STRENGTH),
      minRatio: this.config.minDeltaRatio,
      buyVolume: buyVolume.toFixed(0),
      sellVolume: sellVolume.toFixed(0)
    });

    if (deltaRatio >= this.config.minDeltaRatio) {
      // Buy momentum
      direction = SignalDirection.LONG;
      this.logger.debug('✅ LONG SIGNAL DETECTED', {
        ratio: deltaRatio.toFixed(DECIMAL_PLACES.STRENGTH)
      });
    } else if (deltaRatio <= 1 / this.config.minDeltaRatio) {
      // Sell momentum (inverse ratio)
      direction = SignalDirection.SHORT;
      actualRatio = buyVolume > 0 ? sellVolume / buyVolume : 10.0; // Safe division
      this.logger.debug('✅ SHORT SIGNAL DETECTED', {
        ratio: actualRatio.toFixed(DECIMAL_PLACES.STRENGTH)
      });
    }

    if (direction == null) {
      this.logger.debug('Delta ratio not strong enough', {
        deltaRatio,
        minRequired: this.config.minDeltaRatio,
      });
      return null;
    }

    // Calculate confidence (0-maxConfidence)
    // Higher ratio = higher confidence
    const confidence = Math.min(
      this.config.maxConfidence,
      ((actualRatio - this.config.minDeltaRatio) / this.config.minDeltaRatio) * PERCENT_MULTIPLIER,
    );

    const spike: MomentumSpike = {
      direction,
      deltaRatio: actualRatio,
      confidence,
      tickCount: recentTicks.length,
      volumeUSDT,
    };

    this.logger.info('🚀 Momentum spike detected!', {
      direction,
      deltaRatio: actualRatio.toFixed(DECIMAL_PLACES.PERCENT),
      confidence: confidence.toFixed(1),
      tickCount: recentTicks.length,
      volumeUSDT: volumeUSDT.toFixed(DECIMAL_PLACES.PERCENT),
    });

    return spike;
  }

  /**
   * Cleanup old ticks beyond detection window
   *
   * Removes ticks older than 2x detection window
   */
  cleanupOldTicks(): void {
    const cutoffTime = Date.now() - this.config.detectionWindow * 2;
    const beforeCount = this.tickHistory.length;

    this.tickHistory = this.tickHistory.filter((tick) => tick.timestamp >= cutoffTime);

    const afterCount = this.tickHistory.length;
    const removed = beforeCount - afterCount;

    if (removed > 0) {
      this.logger.debug('Old ticks cleaned up', {
        removed,
        remaining: afterCount,
      });
    }

    this.lastCleanupTime = Date.now();
  }

  /**
   * Get tick history (for testing/debugging)
   */
  getTickHistory(): Tick[] {
    return this.tickHistory;
  }

  /**
   * Clear all tick history (for testing)
   */
  clearHistory(): void {
    this.tickHistory = [];
  }
}
