import { DECIMAL_PLACES, MULTIPLIERS, PERCENT_MULTIPLIER, PERCENTAGE_THRESHOLDS, MULTIPLIER_VALUES, INTEGER_MULTIPLIERS } from '../constants';
/**
 * Volume Calculator
 *
 * Calculates volume metrics and confirmations for trading signals.
 * Used to filter out low liquidity entries and boost high volume signals.
 */

import { Candle, LoggerService } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_ROLLING_PERIOD = PERCENTAGE_THRESHOLDS.LOW_MODERATE; // Candles for average calculation
const LOW_VOLUME_THRESHOLD = MULTIPLIERS.HALF; // Volume < 0.5x avg = low liquidity
const HIGH_VOLUME_THRESHOLD = MULTIPLIER_VALUES.TWO; // Volume > 2x avg = high volume

// ============================================================================
// TYPES
// ============================================================================

export interface VolumeAnalysis {
  currentVolume: number;
  avgVolume: number;
  volumeRatio: number; // current / avg
  isLowVolume: boolean; // < 0.5x avg (should block)
  isHighVolume: boolean; // > 2x avg (boost confidence)
  volumeModifier: number; // Confidence modifier (-10% to +10%)
}

// ============================================================================
// VOLUME CALCULATOR
// ============================================================================

export class VolumeCalculator {
  constructor(
    private logger: LoggerService,
    private rollingPeriod: number = DEFAULT_ROLLING_PERIOD,
  ) {}

  /**
   * Calculate volume analysis
   * @param candles - Recent candles (at least rollingPeriod candles)
   * @returns Volume analysis result
   */
  calculate(candles: Candle[]): VolumeAnalysis {
    if (candles.length < this.rollingPeriod) {
      this.logger.warn('Not enough candles for volume analysis', {
        required: this.rollingPeriod,
        available: candles.length,
      });
      return this.noVolumeData();
    }

    // Calculate average volume over rolling period
    const recentCandles = candles.slice(-this.rollingPeriod);
    const avgVolume =
      recentCandles.reduce((sum, c) => sum + c.volume, 0) / this.rollingPeriod;

    // Current candle volume
    const currentCandle = candles[candles.length - 1];
    const currentVolume = currentCandle.volume;

    // Volume ratio
    const volumeRatio = currentVolume / avgVolume;

    // Low/High volume detection
    const isLowVolume = volumeRatio < LOW_VOLUME_THRESHOLD;
    const isHighVolume = volumeRatio > HIGH_VOLUME_THRESHOLD;

    // Volume modifier for confidence
    const volumeModifier = this.calculateVolumeModifier(volumeRatio);

    this.logger.debug('Volume analysis', {
      currentVolume: currentVolume.toFixed(DECIMAL_PLACES.PERCENT),
      avgVolume: avgVolume.toFixed(DECIMAL_PLACES.PERCENT),
      volumeRatio: volumeRatio.toFixed(DECIMAL_PLACES.PERCENT),
      isLowVolume,
      isHighVolume,
      volumeModifier: (volumeModifier * PERCENT_MULTIPLIER - INTEGER_MULTIPLIERS.ONE_HUNDRED).toFixed(1) + '%',
    });

    return {
      currentVolume,
      avgVolume,
      volumeRatio,
      isLowVolume,
      isHighVolume,
      volumeModifier,
    };
  }

  /**
   * Calculate volume modifier for confidence
   * @param volumeRatio - Current volume / average volume
   * @returns Modifier (0.90 to 1.10)
   */
  private calculateVolumeModifier(volumeRatio: number): number {
    if (volumeRatio > HIGH_VOLUME_THRESHOLD) {
      // High volume: +10% confidence
      return MULTIPLIER_VALUES.ONE_POINT_ONE;
    } else if (volumeRatio < LOW_VOLUME_THRESHOLD) {
      // Low volume: -10% confidence
      return MULTIPLIER_VALUES.ZERO_POINT_NINE;
    }
    // Normal volume: no modifier
    return MULTIPLIER_VALUES.ONE;
  }

  /**
   * Return no volume data result
   */
  private noVolumeData(): VolumeAnalysis {
    return {
      currentVolume: 0,
      avgVolume: 0,
      volumeRatio: 0,
      isLowVolume: false,
      isHighVolume: false,
      volumeModifier: MULTIPLIERS.NEUTRAL,
    };
  }
}
