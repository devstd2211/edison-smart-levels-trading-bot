/**
 * Fractal Detector
 *
 * Detects William's fractals (5-candle pattern) on timeframes.
 * A fractal is a reversal indicator where:
 * - Bullish fractal: candle with lowest LOW among 5 candles
 * - Bearish fractal: candle with highest HIGH among 5 candles
 *
 * Usage: Secondary filter to confirm support/resistance levels
 */

import { Candle, FractalSignal, FractalType, LoggerService } from '../types';
import { DECIMAL_PLACES } from '../constants';
import {
  INTEGER_MULTIPLIERS,
  FIRST_INDEX,
  SECOND_INDEX,
  THIRD_INDEX,
  PERCENT_MULTIPLIER,
  RATIO_MULTIPLIERS,
  DEFAULT_FRACTAL_TOLERANCE_PERCENT,
} from '../constants/technical.constants';

// ============================================================================
// CONSTANTS
// ============================================================================

const FRACTAL_WINDOW_SIZE = INTEGER_MULTIPLIERS.FIVE as number; // 5-candle pattern
const MIN_RELATIVE_HEIGHT_PERCENT = INTEGER_MULTIPLIERS.TWENTY as number; // Minimum distance from neighboring candles (%)
const STRENGTH_BASE = INTEGER_MULTIPLIERS.FIFTY as number; // Base strength for valid fractal
const STRENGTH_BOOST_PER_PERCENT = INTEGER_MULTIPLIERS.ONE as number; // +1 strength for each % above minimum

// ============================================================================
// FRACTAL DETECTOR
// ============================================================================

export class FractalDetector {
  constructor(private logger: LoggerService) {
    this.logger.info('FractalDetector initialized', {
      windowSize: FRACTAL_WINDOW_SIZE,
      minRelativeHeight: MIN_RELATIVE_HEIGHT_PERCENT,
    });
  }

  /**
   * Detect fractal in the last candles
   * Returns fractal if 5-candle pattern detected
   *
   * Bullish fractal (support):
   * - Candle at index 2 has LOWEST LOW among [0,1,2,3,4]
   * - Price < EMA means price is below average
   *
   * Bearish fractal (resistance):
   * - Candle at index 2 has HIGHEST HIGH among [0,1,2,3,4]
   * - Price > EMA means price is above average
   */
  detectFractal(candles: Candle[]): FractalSignal | null {
    if (!candles || candles.length < FRACTAL_WINDOW_SIZE) {
      return null;
    }

    // Get last 5 candles
    const window = candles.slice(-FRACTAL_WINDOW_SIZE);
    const midCandle = window[THIRD_INDEX as number]; // Middle candle (index 2 in 5-candle window)

    // Check for BULLISH fractal (lowest low)
    const bullishFractal = this.checkBullishFractal(window);
    if (bullishFractal) {
      return bullishFractal;
    }

    // Check for BEARISH fractal (highest high)
    const bearishFractal = this.checkBearishFractal(window);
    if (bearishFractal) {
      return bearishFractal;
    }

    return null;
  }

  /**
   * Check for bullish fractal (lowest low in 5-candle window)
   */
  private checkBullishFractal(window: Candle[]): FractalSignal | null {
    const midCandle = window[THIRD_INDEX as number];
    const midLow = midCandle.low;

    // Check: middle candle has LOWEST low
    const hasLowestLow = window.every((c, idx) => {
      if (idx === (THIRD_INDEX as number)) return true; // skip self
      return c.low >= midLow;
    });

    if (!hasLowestLow) {
      return null;
    }

    // Calculate relative height (how much lower is middle candle)
    const avgLow = window.reduce((sum, c) => sum + c.low, FIRST_INDEX as number) / window.length;
    const relativeHeight = ((avgLow - midLow) / avgLow) * (PERCENT_MULTIPLIER as number);

    // Only valid if minimum distance requirement met
    if (relativeHeight < MIN_RELATIVE_HEIGHT_PERCENT) {
      return null;
    }

    // Calculate strength: 50 base + boost for distance
    const strength = Math.min(INTEGER_MULTIPLIERS.ONE_HUNDRED, STRENGTH_BASE + relativeHeight);

    return {
      type: FractalType.SUPPORT,
      price: midLow,
      strength: Math.round(strength * (INTEGER_MULTIPLIERS.TEN as number)) / (INTEGER_MULTIPLIERS.TEN as number),
      relativeHeight: Math.round(relativeHeight * (INTEGER_MULTIPLIERS.TEN as number)) / (INTEGER_MULTIPLIERS.TEN as number),
      candleIndex: THIRD_INDEX as number,
      timestamp: midCandle.timestamp,
    };
  }

  /**
   * Check for bearish fractal (highest high in 5-candle window)
   */
  private checkBearishFractal(window: Candle[]): FractalSignal | null {
    const midCandle = window[THIRD_INDEX as number];
    const midHigh = midCandle.high;

    // Check: middle candle has HIGHEST high
    const hasHighestHigh = window.every((c, idx) => {
      if (idx === (THIRD_INDEX as number)) return true; // skip self
      return c.high <= midHigh;
    });

    if (!hasHighestHigh) {
      return null;
    }

    // Calculate relative height (how much higher is middle candle)
    const avgHigh = window.reduce((sum, c) => sum + c.high, FIRST_INDEX as number) / window.length;
    const relativeHeight = ((midHigh - avgHigh) / avgHigh) * (PERCENT_MULTIPLIER as number);

    // Only valid if minimum distance requirement met
    if (relativeHeight < MIN_RELATIVE_HEIGHT_PERCENT) {
      return null;
    }

    // Calculate strength: 50 base + boost for distance
    const strength = Math.min(INTEGER_MULTIPLIERS.ONE_HUNDRED, STRENGTH_BASE + relativeHeight);

    return {
      type: FractalType.RESISTANCE,
      price: midHigh,
      strength: Math.round(strength * (INTEGER_MULTIPLIERS.TEN as number)) / (INTEGER_MULTIPLIERS.TEN as number),
      relativeHeight: Math.round(relativeHeight * (INTEGER_MULTIPLIERS.TEN as number)) / (INTEGER_MULTIPLIERS.TEN as number),
      candleIndex: THIRD_INDEX as number,
      timestamp: midCandle.timestamp,
    };
  }

  /**
   * Check if price is near fractal level (within tolerance)
   */
  isFractalAligned(fractalPrice: number, currentPrice: number, tolerancePercent: number = DEFAULT_FRACTAL_TOLERANCE_PERCENT): boolean {
    const tolerance = (tolerancePercent / (PERCENT_MULTIPLIER as number)) * fractalPrice;
    const distance = Math.abs(currentPrice - fractalPrice);
    return distance <= tolerance;
  }

  /**
   * Get fractal strength as confidence multiplier (0.5 - 1.5)
   */
  getStrengthMultiplier(strength: number): number {
    // strength 0-100 → multiplier 0.5-1.5
    const normalized = strength / (PERCENT_MULTIPLIER as number); // 0-1
    return (RATIO_MULTIPLIERS.HALF as number) + normalized; // 0.5-1.5
  }
}
