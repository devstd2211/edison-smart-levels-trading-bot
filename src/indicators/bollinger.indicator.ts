/**
 * Bollinger Bands Indicator
 * Measures volatility and potential reversal zones
 *
 * Formula:
 * 1. Middle Band = SMA(close, period)
 * 2. Upper Band = Middle + (stdDev × Standard Deviation)
 * 3. Lower Band = Middle - (stdDev × Standard Deviation)
 * 4. Width % = ((Upper - Lower) / Middle) × 100
 * 5. %B = (Price - Lower) / (Upper - Lower)
 *
 * Usage:
 * - Price near lower band (< 0.15%B): Potential long entry
 * - Price near upper band (> 0.85%B): Potential short entry
 * - Squeeze (narrow bands): Low volatility, expect breakout
 * - Width expansion: High volatility, strong move
 */

import type { Candle } from '../types';
import { MULTIPLIERS, THRESHOLD_VALUES, MULTIPLIER_VALUES } from '../constants';
import {
  INTEGER_MULTIPLIERS,
  RATIO_MULTIPLIERS,
  MATH_BOUNDS,
  FIRST_INDEX,
  SECOND_INDEX,
  INDICATOR_DEFAULTS,
} from '../constants/technical.constants';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PERIOD = INDICATOR_DEFAULTS.BOLLINGER_PERIOD as number;
const DEFAULT_STD_DEV = INDICATOR_DEFAULTS.BOLLINGER_STD_DEV as number;
const MAX_HISTORY_LENGTH = INTEGER_MULTIPLIERS.ONE_HUNDRED as number;
const PERCENT_MULTIPLIER = INTEGER_MULTIPLIERS.ONE_HUNDRED as number;
const PERCENT_B_MIN = MATH_BOUNDS.MIN_PERCENTAGE as number;
const PERCENT_B_MAX = RATIO_MULTIPLIERS.FULL as number;

// Volatility thresholds for adaptive parameters
const HIGH_VOLATILITY_THRESHOLD = THRESHOLD_VALUES.FIVE_PERCENT; // 5% ATR/price ratio
const MEDIUM_VOLATILITY_THRESHOLD = THRESHOLD_VALUES.THREE_PERCENT; // 3% ATR/price ratio

// Adaptive stdDev values
const HIGH_VOLATILITY_STD_DEV = MULTIPLIER_VALUES.TWO_POINT_FIVE;
const MEDIUM_VOLATILITY_STD_DEV = MULTIPLIER_VALUES.TWO;
const LOW_VOLATILITY_STD_DEV = MULTIPLIER_VALUES.ONE_POINT_FIVE;

// Squeeze detection
const DEFAULT_SQUEEZE_THRESHOLD = MULTIPLIERS.ZERO_EIGHT; // 80% of average width

// ============================================================================
// TYPES
// ============================================================================

export interface BollingerBandsResult {
  upper: number; // Upper band
  middle: number; // Middle band (SMA)
  lower: number; // Lower band
  width: number; // Width in percent
  percentB: number; // Price position (0.0 - 1.0)
}

export interface BollingerBandsHistory {
  timestamp: number;
  upper: number;
  middle: number;
  lower: number;
  width: number;
}

export interface AdaptiveParams {
  period: number;
  stdDev: number;
}

// ============================================================================
// BOLLINGER BANDS CALCULATOR
// ============================================================================

export class BollingerBandsIndicator {
  private period: number;
  private stdDev: number;
  private history: BollingerBandsHistory[] = [];

  /**
   * Create Bollinger Bands indicator
   *
   * @param period - SMA period (default: 20)
   * @param stdDev - Standard deviation multiplier (default: 2.0)
   */
  constructor(period: number = DEFAULT_PERIOD, stdDev: number = DEFAULT_STD_DEV) {
    this.period = period;
    this.stdDev = stdDev;
  }

  /**
   * Calculate Bollinger Bands for a series of candles
   *
   * @param candles - Array of candles (must be at least period length)
   * @returns Bollinger Bands result
   * @throws {Error} If not enough candles
   */
  calculate(candles: Candle[]): BollingerBandsResult {
    if (candles.length < this.period) {
      throw new Error(
        `Not enough candles for Bollinger Bands calculation. Need ${this.period}, got ${candles.length}`,
      );
    }

    // Get last N candles for calculation
    const recentCandles = candles.slice(-this.period);
    const closePrices = recentCandles.map((c) => c.close);
    const currentPrice = closePrices[closePrices.length - (SECOND_INDEX as number)];

    // Calculate SMA (middle band)
    const middle = this.calculateSMA(closePrices);

    // Calculate standard deviation
    const stdDeviation = this.calculateStdDev(closePrices, middle);

    // Calculate bands
    const upper = middle + this.stdDev * stdDeviation;
    const lower = middle - this.stdDev * stdDeviation;

    // Calculate width percentage
    const width = ((upper - lower) / middle) * PERCENT_MULTIPLIER;

    // Calculate %B (price position)
    let percentB: number;
    if (upper === lower) {
      // No volatility, price is at middle
      percentB = MULTIPLIERS.HALF;
    } else {
      percentB = (currentPrice - lower) / (upper - lower);
      percentB = Math.max(PERCENT_B_MIN, Math.min(PERCENT_B_MAX, percentB));
    }

    // Store in history
    const timestamp = candles[candles.length - (SECOND_INDEX as number)].timestamp;
    this.addToHistory({ timestamp, upper, middle, lower, width });

    return {
      upper,
      middle,
      lower,
      width,
      percentB,
    };
  }

  /**
   * Calculate Simple Moving Average
   *
   * @param values - Array of values
   * @returns SMA
   */
  private calculateSMA(values: number[]): number {
    const sum = values.reduce((acc, val) => acc + val, (FIRST_INDEX as number));
    return sum / values.length;
  }

  /**
   * Calculate Standard Deviation
   *
   * @param values - Array of values
   * @param mean - Mean (average) of values
   * @returns Standard deviation
   */
  private calculateStdDev(values: number[], mean: number): number {
    const squaredDiffs = values.map((val) => Math.pow(val - mean, (INTEGER_MULTIPLIERS.TWO as number)));
    const variance = this.calculateSMA(squaredDiffs);
    return Math.sqrt(variance);
  }

  /**
   * Add entry to history (limited to MAX_HISTORY_LENGTH)
   *
   * @param entry - History entry
   */
  private addToHistory(entry: BollingerBandsHistory): void {
    this.history.push(entry);

    // Trim history if too long
    if (this.history.length > MAX_HISTORY_LENGTH) {
      this.history.shift();
    }
  }

  /**
   * Detect Bollinger Squeeze
   * Squeeze occurs when bands are narrower than average (low volatility)
   *
   * @param threshold - Squeeze threshold (default: MULTIPLIERS.ZERO_EIGHT = 80% of average)
   * @returns True if squeeze detected
   */
  isSqueeze(threshold: number = DEFAULT_SQUEEZE_THRESHOLD): boolean {
    if (this.history.length < DEFAULT_PERIOD) {
      return false; // Not enough history
    }

    // Calculate average width over last N periods
    const recentWidths = this.history.slice(-DEFAULT_PERIOD).map((h) => h.width);
    const avgWidth = this.calculateSMA(recentWidths);

    // Current width
    const currentWidth = this.history[this.history.length - (SECOND_INDEX as number)].width;

    // Squeeze: current width < threshold * average width
    return currentWidth < avgWidth * threshold;
  }

  /**
   * Get adaptive parameters based on market volatility
   * High volatility → wider bands (stdDev 2.5)
   * Medium volatility → normal bands (stdDev 2.0)
   * Low volatility → tighter bands (stdDev 1.5)
   *
   * @param atr - Average True Range
   * @param price - Current price
   * @returns Adaptive parameters
   */
  getAdaptiveParams(atr: number, price: number): AdaptiveParams {
    const volatility = atr / price;

    if (volatility > HIGH_VOLATILITY_THRESHOLD) {
      return { period: DEFAULT_PERIOD, stdDev: HIGH_VOLATILITY_STD_DEV };
    }

    if (volatility > MEDIUM_VOLATILITY_THRESHOLD) {
      return { period: DEFAULT_PERIOD, stdDev: MEDIUM_VOLATILITY_STD_DEV };
    }

    return { period: DEFAULT_PERIOD, stdDev: LOW_VOLATILITY_STD_DEV };
  }

  /**
   * Apply adaptive parameters to indicator
   *
   * @param params - Adaptive parameters
   */
  applyAdaptiveParams(params: AdaptiveParams): void {
    this.period = params.period;
    this.stdDev = params.stdDev;
  }

  /**
   * Check if price is near lower band (potential long entry)
   *
   * @param percentB - Current %B value
   * @param threshold - Threshold for "near" (default: THRESHOLD_VALUES.FIFTEEN_PERCENT = 0.15)
   * @returns True if near lower band
   */
  isNearLowerBand(percentB: number, threshold: number = THRESHOLD_VALUES.FIFTEEN_PERCENT): boolean {
    return percentB <= threshold;
  }

  /**
   * Check if price is near upper band (potential short entry)
   *
   * @param percentB - Current %B value
   * @param threshold - Threshold for "near" (default: THRESHOLD_VALUES.EIGHTY_FIVE_PERCENT = 0.85)
   * @returns True if near upper band
   */
  isNearUpperBand(percentB: number, threshold: number = THRESHOLD_VALUES.EIGHTY_FIVE_PERCENT): boolean {
    return percentB >= threshold;
  }

  /**
   * Check if price is in middle zone (avoid trading)
   *
   * @param percentB - Current %B value
   * @returns True if in middle zone (THRESHOLD_VALUES.THIRTY_PERCENT - THRESHOLD_VALUES.SEVENTY_PERCENT)
   */
  isInMiddleZone(percentB: number): boolean {
    return percentB > THRESHOLD_VALUES.THIRTY_PERCENT && percentB < THRESHOLD_VALUES.SEVENTY_PERCENT;
  }

  /**
   * Get history
   *
   * @param length - Number of history entries (optional, default: all)
   * @returns Array of history entries
   */
  getHistory(length?: number): BollingerBandsHistory[] {
    if (length === undefined) {
      return [...this.history];
    }
    return this.history.slice(-length);
  }

  /**
   * Get current parameters
   *
   * @returns Current period and stdDev
   */
  getParams(): { period: number; stdDev: number } {
    return {
      period: this.period,
      stdDev: this.stdDev,
    };
  }

  /**
   * Reset indicator state
   */
  reset(): void {
    this.history = [];
  }
}
