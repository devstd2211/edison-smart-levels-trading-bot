import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';
import { MAX_TICK_HISTORY, CLEANUP_INTERVAL_MS } from '../constants/technical.constants';
import { ErrorHandler } from '../errors/ErrorHandler';
import { RecoveryStrategy } from '../errors/ErrorHandler';
import { ICONS } from '../cli/cli-runtime';
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
} from '../types/legacy';

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
    private errorHandler?: ErrorHandler,
  ) {
    // THROW: Config validation
    this.validateConfig(config);
  }

  /**
   * Safe logging wrapper - SKIP strategy for logger errors
   */
  private safeLog(logFn: () => void): void {
    try {
      logFn();
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
      }
    }
  }

  /**
   * Validate config on construction
   * THROW on invalid configuration
   *
   * @param config - The tick delta analyzer configuration
   * @throws If configuration is invalid
   */
  private validateConfig(config: TickDeltaAnalyzerConfig): void {
    // THROW: null/undefined config
    if (!config) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error('TickDeltaAnalyzerConfig cannot be null or undefined'),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error('TickDeltaAnalyzerConfig cannot be null or undefined');
    }

    // THROW: Invalid minDeltaRatio
    if (typeof config.minDeltaRatio !== 'number' || config.minDeltaRatio <= 0 || !Number.isFinite(config.minDeltaRatio)) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`minDeltaRatio must be > 0 and finite (got ${config.minDeltaRatio})`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`minDeltaRatio must be > 0 and finite (got ${config.minDeltaRatio})`);
    }

    // THROW: Invalid detectionWindow
    if (typeof config.detectionWindow !== 'number' || config.detectionWindow <= 0) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`detectionWindow must be > 0 (got ${config.detectionWindow})`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`detectionWindow must be > 0 (got ${config.detectionWindow})`);
    }

    // THROW: Invalid minTickCount
    if (typeof config.minTickCount !== 'number' || config.minTickCount < 0) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`minTickCount must be >= 0 (got ${config.minTickCount})`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`minTickCount must be >= 0 (got ${config.minTickCount})`);
    }

    // THROW: Invalid minVolumeUSDT
    if (typeof config.minVolumeUSDT !== 'number' || config.minVolumeUSDT < 0) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`minVolumeUSDT must be >= 0 (got ${config.minVolumeUSDT})`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`minVolumeUSDT must be >= 0 (got ${config.minVolumeUSDT})`);
    }

    // THROW: Invalid maxConfidence
    if (typeof config.maxConfidence !== 'number' || config.maxConfidence <= 0 || !Number.isFinite(config.maxConfidence)) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`maxConfidence must be > 0 and finite (got ${config.maxConfidence})`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`maxConfidence must be > 0 and finite (got ${config.maxConfidence})`);
    }
  }

  /**
   * Validate tick data
   * THROW on invalid tick
   *
   * @param tick - The tick to validate
   * @throws If tick is invalid
   */
  private validateTick(tick: Tick): void {
    // THROW: null/undefined tick
    if (!tick) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error('Tick cannot be null or undefined'),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error('Tick cannot be null or undefined');
    }

    // THROW: Invalid side
    if (!tick.side || (tick.side !== 'BUY' && tick.side !== 'SELL')) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`Tick side must be BUY or SELL (got ${tick.side})`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`Tick side must be BUY or SELL (got ${tick.side})`);
    }

    // THROW: Invalid price
    if (!Number.isFinite(tick.price) || tick.price < 0) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`Tick price must be >= 0 and finite (got ${tick.price})`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`Tick price must be >= 0 and finite (got ${tick.price})`);
    }

    // THROW: Invalid size
    if (!Number.isFinite(tick.size) || tick.size < 0) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`Tick size must be >= 0 and finite (got ${tick.size})`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`Tick size must be >= 0 and finite (got ${tick.size})`);
    }

    // THROW: Invalid timestamp
    if (!Number.isFinite(tick.timestamp) || tick.timestamp <= 0) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`Tick timestamp must be > 0 and finite (got ${tick.timestamp})`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`Tick timestamp must be > 0 and finite (got ${tick.timestamp})`);
    }
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Add new tick to history
   *
   * @param tick - New trade/tick
   * @throws If tick validation fails
   */
  addTick(tick: Tick): void {
    // Validation happens outside try-catch to propagate THROW errors
    this.validateTick(tick);

    try {
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
    } catch (error) {
      // GRACEFUL_DEGRADE: Tick addition failed, skip this tick
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
    }
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
    try {
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

      // GRACEFUL_DEGRADE: Check for NaN/Infinity in volumes
      if (!Number.isFinite(buyVolume) || !Number.isFinite(sellVolume)) {
        return 1.0; // Return neutral on invalid volumes
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

      const ratio = buyVolume / sellVolume;

      // GRACEFUL_DEGRADE: Check result is valid
      if (!Number.isFinite(ratio)) {
        return 1.0;
      }

      return ratio;
    } catch (error) {
      // GRACEFUL_DEGRADE: Calculation failed, return neutral
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      return 1.0;
    }
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
    try {
      const cutoffTime = currentTime - this.config.detectionWindow;

      // Filter recent ticks
      const recentTicks = this.tickHistory.filter((tick) => tick.timestamp >= cutoffTime);

      // Debug: Show tick filtering
      this.safeLog(() => {
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
      });

      // Check min tick count
      if (recentTicks.length < this.config.minTickCount) {
        this.safeLog(() => {
          this.logger.debug('Not enough ticks for momentum detection', {
            tickCount: recentTicks.length,
            minRequired: this.config.minTickCount,
          });
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

      // GRACEFUL_DEGRADE: Check for NaN/Infinity in volumes
      if (!Number.isFinite(buyVolume) || !Number.isFinite(sellVolume) || !Number.isFinite(totalVolumeContracts)) {
        return null;
      }

      // Calculate average price for USDT volume estimation
      const avgPrice =
        recentTicks.reduce((sum, tick) => sum + tick.price, 0) / recentTicks.length;
      const volumeUSDT = totalVolumeContracts * avgPrice;

      // GRACEFUL_DEGRADE: Check volumeUSDT is valid
      if (!Number.isFinite(volumeUSDT)) {
        return null;
      }

      // Check min volume
      if (volumeUSDT < this.config.minVolumeUSDT) {
        this.safeLog(() => {
          this.logger.debug('Volume too low for momentum spike', {
            volumeUSDT,
            minRequired: this.config.minVolumeUSDT,
          });
        });
        return null;
      }

      // Calculate delta ratio (with safety checks)
      let deltaRatio: number;
      if (sellVolume === 0 && buyVolume === 0) {
        this.safeLog(() => {
          this.logger.debug('No volume in window', {volumeUSDT});
        });
        return null; // Skip if no volume
      } else if (sellVolume === 0) {
        deltaRatio = 10.0; // Cap at 10x instead of 999
      } else if (buyVolume === 0) {
        deltaRatio = 0.1; // Inverse 10x for SHORT
      } else {
        deltaRatio = buyVolume / sellVolume;
      }

      // GRACEFUL_DEGRADE: Check deltaRatio is valid
      if (!Number.isFinite(deltaRatio)) {
        return null;
      }

      // Detect spike
      let direction: SignalDirection | null = null;
      let actualRatio = deltaRatio;

      this.safeLog(() => {
        this.logger.debug('[TickDelta] Delta Analysis', {
          ratio: deltaRatio.toFixed(DECIMAL_PLACES.STRENGTH),
          minRatio: this.config.minDeltaRatio,
          buyVolume: buyVolume.toFixed(0),
          sellVolume: sellVolume.toFixed(0)
        });
      });

      if (deltaRatio >= this.config.minDeltaRatio) {
        // Buy momentum
        direction = SignalDirection.LONG;
        this.safeLog(() => {
          this.logger.debug(`${ICONS.success} LONG signal detected`, {
            ratio: deltaRatio.toFixed(DECIMAL_PLACES.STRENGTH)
          });
        });
      } else if (deltaRatio <= 1 / this.config.minDeltaRatio) {
        // Sell momentum (inverse ratio)
        direction = SignalDirection.SHORT;
        actualRatio = buyVolume > 0 ? sellVolume / buyVolume : 10.0; // Safe division
        this.safeLog(() => {
          this.logger.debug(`${ICONS.success} SHORT signal detected`, {
            ratio: actualRatio.toFixed(DECIMAL_PLACES.STRENGTH)
          });
        });
      }

      if (direction == null) {
        this.safeLog(() => {
          this.logger.debug('Delta ratio not strong enough', {
            deltaRatio,
            minRequired: this.config.minDeltaRatio,
          });
        });
        return null;
      }

      // Calculate confidence (0-maxConfidence)
      // Higher ratio = higher confidence
      const confidence = Math.min(
        this.config.maxConfidence,
        ((actualRatio - this.config.minDeltaRatio) / this.config.minDeltaRatio) * PERCENT_MULTIPLIER,
      );

      // GRACEFUL_DEGRADE: Check confidence is valid
      if (!Number.isFinite(confidence)) {
        return null;
      }

      const spike: MomentumSpike = {
        direction,
        deltaRatio: actualRatio,
        confidence,
        tickCount: recentTicks.length,
        volumeUSDT,
      };

      this.safeLog(() => {
        this.logger.info(`${ICONS.chart} Momentum spike detected`, {
          direction,
          deltaRatio: actualRatio.toFixed(DECIMAL_PLACES.PERCENT),
          confidence: confidence.toFixed(1),
          tickCount: recentTicks.length,
          volumeUSDT: volumeUSDT.toFixed(DECIMAL_PLACES.PERCENT),
        });
      });

      return spike;
    } catch (error) {
      // GRACEFUL_DEGRADE: Detection failed, return null
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      return null;
    }
  }

  /**
   * Cleanup old ticks beyond detection window
   *
   * Removes ticks older than 2x detection window
   */
  cleanupOldTicks(): void {
    try {
      const cutoffTime = Date.now() - this.config.detectionWindow * 2;
      const beforeCount = this.tickHistory.length;

      this.tickHistory = this.tickHistory.filter((tick) => tick.timestamp >= cutoffTime);

      const afterCount = this.tickHistory.length;
      const removed = beforeCount - afterCount;

      if (removed > 0) {
        this.safeLog(() => {
          this.logger.debug('Old ticks cleaned up', {
            removed,
            remaining: afterCount,
          });
        });
      }

      this.lastCleanupTime = Date.now();
    } catch (error) {
      // GRACEFUL_DEGRADE: Cleanup failed, continue operation
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
    }
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
