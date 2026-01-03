/**
 * Breakout Detector
 *
 * Detects confirmed breakouts of Daily High/Low levels with:
 * - Close price beyond level
 * - Volume confirmation (above average)
 * - Minimum breakout strength
 */

import { Candle, LoggerService } from '../types';
import { BreakoutDetectionResult, BreakoutInfo, DailyLevel, DailyLevelConfig } from '../types/fractal-strategy.types';
import { SignalDirection } from '../types';
import { formatPrice, formatToDecimal, DECIMAL_PLACES } from '../constants/technical.constants';
import { INTEGER_MULTIPLIERS, THRESHOLD_VALUES, MULTIPLIER_VALUES } from '../constants';

export class BreakoutDetector {
  constructor(
    private config: DailyLevelConfig,
    private logger: LoggerService
  ) {}

  /**
   * Detect breakout of Daily High/Low level
   * Requires:
   * 1. Close price beyond level
   * 2. Volume > average
   * 3. Breakout strength >= minBreakoutStrength
   */
  detectBreakout(
    candle: Candle,
    dailyLevel: DailyLevel,
    avgVolume: number
  ): BreakoutDetectionResult {
    // Check LONG breakout (close > daily high)
    const longBreakout = candle.close > dailyLevel.high;
    // Check SHORT breakout (close < daily low)
    const shortBreakout = candle.close < dailyLevel.low;

    if (!longBreakout && !shortBreakout) {
      return {
        detected: false,
        reason: 'No breakout detected'
      };
    }

    const direction = longBreakout ? SignalDirection.LONG : SignalDirection.SHORT;
    const level = longBreakout ? dailyLevel.high : dailyLevel.low;

    // Calculate breakout strength as percentage beyond level
    const strength = Math.abs(candle.close - level) / level;

    // Check minimum breakout strength (0.2% by default)
    if (strength < this.config.minBreakoutStrength) {
      this.logger.debug('Breakout rejected: too weak', {
        strength: formatToDecimal(strength * INTEGER_MULTIPLIERS.ONE_HUNDRED, DECIMAL_PLACES.STRENGTH) + '%',
        required: formatToDecimal(this.config.minBreakoutStrength * INTEGER_MULTIPLIERS.ONE_HUNDRED, DECIMAL_PLACES.STRENGTH) + '%'
      });
      return {
        detected: false,
        reason: `Breakout strength ${formatToDecimal(strength * INTEGER_MULTIPLIERS.ONE_HUNDRED, DECIMAL_PLACES.STRENGTH)}% < ${formatToDecimal(this.config.minBreakoutStrength * INTEGER_MULTIPLIERS.ONE_HUNDRED, DECIMAL_PLACES.STRENGTH)}%`
      };
    }

    // Check volume confirmation
    const volumeRatio = candle.volume / avgVolume;
    const minVolumeRatio = this.config.minVolumeRatio ?? 1.0; // Default: 1.0x average volume

    if (volumeRatio < minVolumeRatio) {
      this.logger.debug('Breakout rejected: low volume', {
        volumeRatio: formatPrice(volumeRatio) + 'x',
        required: formatPrice(minVolumeRatio) + 'x'
      });
      return {
        detected: false,
        reason: `Volume ${formatPrice(volumeRatio)}x < ${formatPrice(minVolumeRatio)}x minimum`
      };
    }

    this.logger.info('Breakout detected', {
      direction,
      price: formatPrice(candle.close),
      level: formatPrice(level),
      strength: formatToDecimal(strength * INTEGER_MULTIPLIERS.ONE_HUNDRED, DECIMAL_PLACES.STRENGTH) + '%',
      volumeRatio: formatPrice(volumeRatio) + 'x',
      timestamp: new Date(candle.timestamp).toISOString()
    });

    const breakoutInfo: BreakoutInfo = {
      direction,
      price: candle.close,
      timestamp: candle.timestamp,
      volume: candle.volume,
      volumeRatio,
      strength,
      confirmedByClose: true
    };

    return {
      detected: true,
      breakout: breakoutInfo
    };
  }

  /**
   * Check if candle is a strong breakout (for filtering purposes)
   */
  isStrongBreakout(breakout: BreakoutInfo): boolean {
    // Strong if: strength >= 0.5% AND volume >= 1.5x average
    return breakout.strength >= THRESHOLD_VALUES.HALF_PERCENT && breakout.volumeRatio >= MULTIPLIER_VALUES.ONE_POINT_FIVE;
  }

  /**
   * Calculate entry price for breakout (slight buffer above breakout price)
   * LONG: breakout price + 1 tick
   * SHORT: breakout price - 1 tick
   */
  getEntryPrice(breakout: BreakoutInfo, tickSize: number = THRESHOLD_VALUES.ONE_PERCENT): number {
    if (breakout.direction === SignalDirection.LONG) {
      return breakout.price + tickSize;
    } else {
      return breakout.price - tickSize;
    }
  }
}
