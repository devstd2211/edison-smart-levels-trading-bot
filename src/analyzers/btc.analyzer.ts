import { BTC_ANALYZER_CONSTANTS, CONFIDENCE_THRESHOLDS, DECIMAL_PLACES, MULTIPLIERS, PERCENTAGE_THRESHOLDS, PERCENT_MULTIPLIER, RATIO_MULTIPLIERS, INTEGER_MULTIPLIERS, THRESHOLD_VALUES } from '../constants';
/**
 * BTC Analyzer
 *
 * Analyzes Bitcoin price movement to confirm altcoin signals.
 * Key metrics:
 * - Direction: UP/DOWN/NEUTRAL
 * - Momentum: strength of movement (0-1)
 * - Alignment: whether BTC supports the altcoin signal
 *
 * Fast and lightweight - optimized for speed.
 */

import {
  Candle,
  SignalDirection,
  BTCConfirmationConfig,
  LoggerService,
  BTCDirection,
  BTCAnalysis,
} from '../types';
import { CorrelationCalculator, CorrelationResult } from './correlation.calculator';

// ============================================================================
// TYPES
// ============================================================================

// Re-export unified types from types.ts for backwards compatibility
export { BTCDirection, BTCAnalysis };

// ============================================================================
// BTC ANALYZER
// ============================================================================

export class BTCAnalyzer {
  private correlationCalculator: CorrelationCalculator;

  constructor(
    private config: BTCConfirmationConfig,
    private logger: LoggerService,
  ) {
    this.correlationCalculator = new CorrelationCalculator();
  }

  /**
   * Analyze BTC movement for signal confirmation
   *
   * @param btcCandles - BTC candles (most recent last)
   * @param signalDirection - Altcoin signal direction (LONG/SHORT)
   * @param altCandles - Altcoin candles for correlation (optional)
   * @returns BTC analysis result
   */
  analyze(
    btcCandles: Candle[],
    signalDirection: SignalDirection,
    altCandles?: Candle[],
  ): BTCAnalysis {
    if (btcCandles.length < this.config.lookbackCandles) {
      this.logger.warn('Not enough BTC candles for analysis', {
        available: btcCandles.length,
        required: this.config.lookbackCandles,
      });

      return {
        direction: BTCDirection.NEUTRAL,
        momentum: 0,
        priceChange: 0,
        consecutiveMoves: 0,
        volumeRatio: 1,
        isAligned: false,
        reason: 'Insufficient BTC data',
      };
    }

    // Calculate correlation if enabled and altcoin candles provided
    let correlation: CorrelationResult | undefined;
    if (this.config.useCorrelation && altCandles && altCandles.length > 0) {
      const period = this.config.correlationPeriod ?? BTC_ANALYZER_CONSTANTS.DEFAULT_CORRELATION_PERIOD;
      correlation = this.correlationCalculator.calculate(btcCandles, altCandles, period) || undefined;

      if (correlation) {
        this.logger.debug('BTC-Alt correlation calculated', {
          coefficient: correlation.coefficient.toFixed(DECIMAL_PLACES.PERCENT),
          strength: correlation.strength,
          filterStrength: correlation.filterStrength,
        });
      }
    }

    // Take last N candles
    const lookbackCandles = btcCandles.slice(-this.config.lookbackCandles);
    const currentPrice = lookbackCandles[lookbackCandles.length - 1].close;
    const startPrice = lookbackCandles[0].close;

    // 1. Calculate price change
    const priceChange = ((currentPrice - startPrice) / startPrice) * PERCENT_MULTIPLIER;

    // 2. Determine direction
    const direction = this.determineDirection(priceChange);

    // 3. Count consecutive moves
    const consecutiveMoves = this.countConsecutiveMoves(lookbackCandles);

    // 4. Calculate volume ratio
    const volumeRatio = this.calculateVolumeRatio(lookbackCandles);

    // 5. Calculate momentum (0-1)
    const momentum = this.calculateMomentum(
      priceChange,
      consecutiveMoves,
      volumeRatio,
    );

    // 6. Check alignment with signal
    const isAligned = this.checkAlignment(direction, signalDirection);

    // 7. Build reason
    const reason = this.buildReason(
      direction,
      momentum,
      priceChange,
      consecutiveMoves,
      isAligned,
      signalDirection,
    );

    this.logger.debug('BTC analysis complete', {
      direction,
      momentum: momentum.toFixed(DECIMAL_PLACES.PERCENT),
      priceChange: priceChange.toFixed(DECIMAL_PLACES.PERCENT) + '%',
      consecutiveMoves,
      volumeRatio: volumeRatio.toFixed(DECIMAL_PLACES.PERCENT),
      isAligned,
    });

    return {
      direction,
      momentum,
      priceChange,
      consecutiveMoves,
      volumeRatio,
      isAligned,
      reason,
      correlation,
    };
  }

  /**
   * Check if BTC passes the confirmation filter
   *
   * @param analysis - BTC analysis result
   * @returns true if BTC confirms the signal
   */
  shouldConfirm(analysis: BTCAnalysis): boolean {
    // If correlation is enabled, use dynamic thresholds
    if (this.config.useCorrelation && analysis.correlation) {
      return this.shouldConfirmWithCorrelation(analysis);
    }

    // Otherwise use fixed thresholds
    return this.shouldConfirmFixed(analysis);
  }

  /**
   * Check confirmation with fixed thresholds (no correlation)
   */
  private shouldConfirmFixed(analysis: BTCAnalysis): boolean {
    // If alignment is not required, always pass
    if (!this.config.requireAlignment) {
      return true;
    }

    // Check alignment
    if (!analysis.isAligned) {
      return false;
    }

    // Check minimum momentum
    if (analysis.momentum < this.config.minimumMomentum) {
      return false;
    }

    return true;
  }

  /**
   * Check confirmation with correlation-based adaptive thresholds
   */
  private shouldConfirmWithCorrelation(analysis: BTCAnalysis): boolean {
    if (!analysis.correlation) {
      return this.shouldConfirmFixed(analysis);
    }

    if (!this.config.correlationThresholds) {
      throw new Error('Missing correlationThresholds in analyzerThresholds.btcCorrelation config.json');
    }
    const thresholds = this.config.correlationThresholds;

    const absCorrelation = Math.abs(analysis.correlation.coefficient);

    // SKIP filter for very low correlation (<0.15)
    if (absCorrelation < thresholds.weak) {
      this.logger.debug('BTC filter SKIPPED due to very low correlation', {
        correlation: absCorrelation.toFixed(DECIMAL_PLACES.PERCENT),
        threshold: thresholds.weak,
      });
      return true; // Skip BTC filter - no correlation
    }

    // WEAK filter (<0.5) - also skip
    // If correlation is weak, BTC and alt are not moving together
    // Don't require alignment when there's weak correlation
    if (absCorrelation < thresholds.moderate) {
      this.logger.debug('BTC filter PASSED due to weak correlation', {
        correlation: absCorrelation.toFixed(DECIMAL_PLACES.PERCENT),
        threshold: thresholds.moderate,
      });
      return true; // Skip BTC filter - weak correlation
    }

    // MODERATE filter (alignment + reduced momentum)
    if (absCorrelation < thresholds.strict) {
      const reducedThreshold = this.config.minimumMomentum * BTC_ANALYZER_CONSTANTS.MOMENTUM_REDUCTION_FACTOR;
      return analysis.isAligned && analysis.momentum >= reducedThreshold;
    }

    // STRICT filter (full requirements)
    return this.shouldConfirmFixed(analysis);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Determine BTC direction based on price change
   */
  private determineDirection(priceChange: number): BTCDirection {
    const threshold = BTC_ANALYZER_CONSTANTS.NEUTRAL_THRESHOLD; // 0.1% threshold for neutral zone

    if (priceChange > threshold) {
      return BTCDirection.UP;
    } else if (priceChange < -threshold) {
      return BTCDirection.DOWN;
    } else {
      return BTCDirection.NEUTRAL;
    }
  }

  /**
   * Count consecutive candles in the same direction
   */
  private countConsecutiveMoves(candles: Candle[]): number {
    let count = 0;
    let lastDirection: 'up' | 'down' | null = null;

    // Start from most recent candle and work backwards
    for (let i = candles.length - 1; i >= 0; i--) {
      const candle = candles[i];
      const direction = candle.close > candle.open ? 'up' : 'down';

      if (lastDirection === null) {
        lastDirection = direction;
        count = 1;
      } else if (direction === lastDirection) {
        count++;
      } else {
        break;
      }
    }

    return count;
  }

  /**
   * Calculate volume ratio (current vs average)
   */
  private calculateVolumeRatio(candles: Candle[]): number {
    if (candles.length === 0) {
      return 1;
    }

    const currentVolume = candles[candles.length - 1].volume;
    const avgVolume =
      candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;

    return avgVolume > 0 ? currentVolume / avgVolume : 1;
  }

  /**
   * Calculate momentum score (0-1)
   *
   * Combines:
   * - Price change magnitude
   * - Consecutive moves
   * - Volume strength
   */
  private calculateMomentum(
    priceChange: number,
    consecutiveMoves: number,
    volumeRatio: number,
  ): number {
    // Scoring components (normalized to 0-1 scale)
    const PRICE_DIVISOR = MULTIPLIERS.DOUBLE; // 2 (TECHNICAL)
    const PRICE_MAX = RATIO_MULTIPLIERS.HALF; // 0.5 (TECHNICAL)
    const TOTAL_MAX = RATIO_MULTIPLIERS.FULL; // 1.0 (TECHNICAL)

    // Price change component (0-0.5)
    const priceScore = Math.min(Math.abs(priceChange) / PRICE_DIVISOR, PRICE_MAX);

    // Consecutive moves component (0-MOVES_MAX)
    const movesScore = Math.min(consecutiveMoves / this.config.movesDivisor, this.config.movesMaxWeight);

    // Volume component (0-VOLUME_MAX)
    const volumeScore = Math.min((volumeRatio - RATIO_MULTIPLIERS.FULL) / this.config.volumeDivisor, this.config.volumeMaxWeight);

    return Math.min(priceScore + movesScore + volumeScore, TOTAL_MAX);
  }

  /**
   * Check if BTC direction aligns with signal
   */
  private checkAlignment(
    btcDirection: BTCDirection,
    signalDirection: SignalDirection,
  ): boolean {
    if (signalDirection === SignalDirection.HOLD) {
      return false;
    }

    if (btcDirection === BTCDirection.NEUTRAL) {
      return false;
    }

    const isLong = signalDirection === SignalDirection.LONG;
    const btcUp = btcDirection === BTCDirection.UP;

    return isLong === btcUp;
  }

  /**
   * Build human-readable reason
   */
  private buildReason(
    direction: BTCDirection,
    momentum: number,
    priceChange: number,
    consecutiveMoves: number,
    isAligned: boolean,
    signalDirection: SignalDirection,
  ): string {
    const momentumStr =
      momentum >= CONFIDENCE_THRESHOLDS.LOW ? 'STRONG' : momentum >= THRESHOLD_VALUES.THIRTY_PERCENT ? 'MODERATE' : 'WEAK';

    const parts: string[] = [];

    parts.push(`BTC ${direction}`);
    parts.push(`${priceChange.toFixed(DECIMAL_PLACES.PERCENT)}%`);
    parts.push(`${momentumStr} momentum (${(momentum * PERCENT_MULTIPLIER).toFixed(0)}%)`);
    parts.push(`${consecutiveMoves} consecutive`);

    if (isAligned) {
      parts.push(`✅ ALIGNED with ${signalDirection}`);
    } else {
      parts.push(`❌ NOT aligned with ${signalDirection}`);
    }

    return parts.join(', ');
  }
}
