/**
 * Anti-Flip Service
 *
 * Prevents rapid direction changes (flip-flopping) that often result in losses.
 * After a signal in one direction, blocks opposite signals for a cooldown period.
 *
 * Key features:
 * - Cooldown period after each signal
 * - Consecutive candles in same direction required before new signal
 * - Exception for strong reversal patterns
 *
 * This helps avoid:
 * - Whipsaw losses in ranging markets
 * - Stop hunts where price briefly reverses then continues
 * - Overtrading due to noise
 */

import {
  SignalDirection,
  LoggerService,
  Candle,
} from '../types';

// ============================================================================
// INTERFACES
// ============================================================================

export interface AntiFlipConfig {
  enabled: boolean;
  cooldownCandles: number; // Number of candles to wait before opposite signal (default: 3)
  cooldownMs: number; // Minimum time in ms before opposite signal (default: 300000 = 5 min)
  requiredConfirmationCandles: number; // Consecutive candles in same direction (default: 2)
  overrideConfidenceThreshold: number; // Confidence level that bypasses cooldown (default: 85)
  strongReversalRsiThreshold: number; // RSI level that indicates strong reversal (default: 25/75)
}

export interface LastSignalInfo {
  direction: SignalDirection;
  timestamp: number;
  candleCount: number; // Candles since signal
  price: number;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: AntiFlipConfig = {
  enabled: true,
  cooldownCandles: 3,
  cooldownMs: 300000, // 5 minutes
  requiredConfirmationCandles: 2,
  overrideConfidenceThreshold: 85,
  strongReversalRsiThreshold: 25, // <25 for LONG reversal, >75 for SHORT reversal
};

// ============================================================================
// ANTI-FLIP SERVICE
// ============================================================================

export class AntiFlipService {
  private config: AntiFlipConfig;
  private lastSignal: LastSignalInfo | null = null;
  private candlesSinceSignal: number = 0;

  constructor(
    private logger: LoggerService,
    config?: Partial<AntiFlipConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a new signal should be blocked by anti-flip protection
   *
   * @param newDirection - Proposed signal direction
   * @param confidence - Confidence level of the new signal
   * @param currentPrice - Current market price
   * @param rsi - Current RSI value (optional)
   * @param recentCandles - Recent candles for confirmation analysis (optional)
   * @returns Object with blocked status and reason
   */
  shouldBlockSignal(
    newDirection: SignalDirection,
    confidence: number,
    currentPrice: number,
    rsi?: number,
    recentCandles?: Candle[],
  ): { blocked: boolean; reason: string } {
    if (!this.config.enabled) {
      return { blocked: false, reason: 'Anti-flip disabled' };
    }

    // No previous signal - allow
    if (!this.lastSignal) {
      return { blocked: false, reason: 'No previous signal' };
    }

    // Same direction - always allow
    if (this.lastSignal.direction === newDirection) {
      return { blocked: false, reason: 'Same direction as last signal' };
    }

    // HOLD signals don't trigger anti-flip
    if (newDirection === SignalDirection.HOLD) {
      return { blocked: false, reason: 'HOLD signal - no flip' };
    }

    const now = Date.now();
    const timeSinceSignal = now - this.lastSignal.timestamp;

    // Check cooldown period
    if (timeSinceSignal < this.config.cooldownMs) {
      // Check candle count
      if (this.candlesSinceSignal < this.config.cooldownCandles) {
        // Check for override conditions
        if (confidence >= this.config.overrideConfidenceThreshold) {
          this.logger.info('🔓 Anti-flip override | High confidence signal', {
            confidence,
            threshold: this.config.overrideConfidenceThreshold,
            newDirection,
            lastDirection: this.lastSignal.direction,
          });
          return { blocked: false, reason: `High confidence override (${confidence}% >= ${this.config.overrideConfidenceThreshold}%)` };
        }

        // Check for strong reversal via RSI
        if (this.isStrongReversal(newDirection, rsi)) {
          this.logger.info('🔓 Anti-flip override | Strong RSI reversal', {
            rsi,
            newDirection,
            threshold: this.config.strongReversalRsiThreshold,
          });
          return { blocked: false, reason: `Strong RSI reversal (RSI: ${rsi?.toFixed(1)})` };
        }

        // Check candle confirmation
        if (recentCandles && this.hasConfirmationCandles(newDirection, recentCandles)) {
          this.logger.info('🔓 Anti-flip override | Candle confirmation', {
            confirmationCandles: this.config.requiredConfirmationCandles,
            newDirection,
          });
          return { blocked: false, reason: `${this.config.requiredConfirmationCandles} confirmation candles` };
        }

        const remainingCooldown = this.config.cooldownMs - timeSinceSignal;
        const remainingCandles = this.config.cooldownCandles - this.candlesSinceSignal;

        this.logger.warn('🚫 Anti-flip BLOCKED | Signal flip too soon', {
          newDirection,
          lastDirection: this.lastSignal.direction,
          candlesSince: this.candlesSinceSignal,
          requiredCandles: this.config.cooldownCandles,
          msSince: timeSinceSignal,
          requiredMs: this.config.cooldownMs,
          confidence,
        });

        return {
          blocked: true,
          reason: `Flip blocked: wait ${remainingCandles} more candles or ${Math.round(remainingCooldown / 1000)}s`,
        };
      }
    }

    return { blocked: false, reason: 'Cooldown period passed' };
  }

  /**
   * Check if RSI indicates a strong reversal that should override cooldown
   */
  private isStrongReversal(direction: SignalDirection, rsi?: number): boolean {
    if (rsi === undefined) {
      return false;
    }

    // LONG signal with extreme oversold RSI
    if (direction === SignalDirection.LONG && rsi <= this.config.strongReversalRsiThreshold) {
      return true;
    }

    // SHORT signal with extreme overbought RSI
    if (direction === SignalDirection.SHORT && rsi >= (100 - this.config.strongReversalRsiThreshold)) {
      return true;
    }

    return false;
  }

  /**
   * Check if recent candles confirm the new direction
   */
  private hasConfirmationCandles(direction: SignalDirection, candles: Candle[]): boolean {
    if (candles.length < this.config.requiredConfirmationCandles) {
      return false;
    }

    const recentCandles = candles.slice(-this.config.requiredConfirmationCandles);

    let confirmCount = 0;
    for (const candle of recentCandles) {
      const isBullish = candle.close > candle.open;
      const isBearish = candle.close < candle.open;

      if (direction === SignalDirection.LONG && isBullish) {
        confirmCount++;
      } else if (direction === SignalDirection.SHORT && isBearish) {
        confirmCount++;
      }
    }

    return confirmCount >= this.config.requiredConfirmationCandles;
  }

  /**
   * Record a new signal (call this when a signal is executed)
   */
  recordSignal(direction: SignalDirection, price: number): void {
    if (direction === SignalDirection.HOLD) {
      return;
    }

    this.lastSignal = {
      direction,
      timestamp: Date.now(),
      candleCount: 0,
      price,
    };
    this.candlesSinceSignal = 0;

    this.logger.debug('📝 Anti-flip | Signal recorded', {
      direction,
      price: price.toFixed(4),
      cooldownCandles: this.config.cooldownCandles,
      cooldownMs: this.config.cooldownMs,
    });
  }

  /**
   * Update candle count (call this on each new candle)
   */
  onNewCandle(): void {
    this.candlesSinceSignal++;
  }

  /**
   * Get current state
   */
  getState(): {
    lastSignal: LastSignalInfo | null;
    candlesSinceSignal: number;
    isInCooldown: boolean;
  } {
    const isInCooldown = this.lastSignal !== null &&
      (Date.now() - this.lastSignal.timestamp < this.config.cooldownMs ||
       this.candlesSinceSignal < this.config.cooldownCandles);

    return {
      lastSignal: this.lastSignal,
      candlesSinceSignal: this.candlesSinceSignal,
      isInCooldown,
    };
  }

  /**
   * Reset state
   */
  reset(): void {
    this.lastSignal = null;
    this.candlesSinceSignal = 0;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AntiFlipConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): AntiFlipConfig {
    return { ...this.config };
  }
}
