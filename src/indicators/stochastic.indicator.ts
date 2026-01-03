/**
 * Stochastic Oscillator Indicator
 * Measures momentum by comparing closing price to price range over a period
 *
 * Formula:
 * 1. %K = 100 * (Close - Lowest Low) / (Highest High - Lowest Low)
 * 2. %D = SMA of %K over smoothing period
 *
 * Range: 0-100
 * - Above 80: Overbought
 * - Below 20: Oversold
 *
 * Common settings:
 * - K period: 14 (lookback period)
 * - D period: 3 (smoothing period for %D)
 * - Smooth: 3 (smooth %K before calculating %D)
 */

import { Candle, CONFIDENCE_THRESHOLDS, PERCENTAGE_THRESHOLDS, StochasticConfig } from '../types';
import { INTEGER_MULTIPLIERS } from '../constants';

// ============================================================================
// CONSTANTS
// ============================================================================

const STOCH_MIN = INTEGER_MULTIPLIERS.ZERO;
const STOCH_MAX = INTEGER_MULTIPLIERS.ONE_HUNDRED;
const STOCH_OVERBOUGHT = INTEGER_MULTIPLIERS.EIGHTY;
const STOCH_OVERSOLD = PERCENTAGE_THRESHOLDS.LOW_MODERATE;
const PERCENT_MULTIPLIER = INTEGER_MULTIPLIERS.ONE_HUNDRED;
const ZERO_RANGE_FALLBACK = CONFIDENCE_THRESHOLDS.MODERATE; // If high === low, return neutral value

// ============================================================================
// STOCHASTIC CALCULATOR
// ============================================================================

export class StochasticIndicator {
  private readonly kPeriod: number;
  private readonly dPeriod: number;
  private readonly smooth: number;
  private kHistory: number[] = [];

  /**
   * Create Stochastic Oscillator indicator
   *
   * @param config - Stochastic configuration with kPeriod, dPeriod, smooth
   */
  constructor(config: StochasticConfig) {
    this.kPeriod = config.kPeriod;
    this.dPeriod = config.dPeriod;
    this.smooth = config.smooth;
  }

  /**
   * Calculate Stochastic for a series of candles
   *
   * @param candles - Array of candles (must be at least kPeriod length)
   * @returns Object with %K and %D values
   * @throws {Error} If not enough candles
   */
  calculate(candles: Candle[]): { k: number; d: number } {
    const minCandles = this.kPeriod + this.smooth + this.dPeriod - 2;
    if (candles.length < minCandles) {
      throw new Error(
        `Not enough candles for Stochastic calculation. Need ${minCandles}, got ${candles.length}`,
      );
    }

    // Reset history
    this.kHistory = [];

    // Calculate %K for all periods
    const rawKValues: number[] = [];
    for (let i = this.kPeriod - 1; i < candles.length; i++) {
      const slice = candles.slice(i - this.kPeriod + 1, i + 1);
      const rawK = this.calculateRawK(slice);
      rawKValues.push(rawK);
    }

    // Smooth %K if smooth > 1
    const smoothedKValues: number[] = [];
    for (let i = this.smooth - 1; i < rawKValues.length; i++) {
      const slice = rawKValues.slice(i - this.smooth + 1, i + 1);
      const smoothedK = this.calculateSMA(slice);
      smoothedKValues.push(smoothedK);
      this.kHistory.push(smoothedK);
    }

    // Calculate %D (SMA of smoothed %K)
    const currentK = smoothedKValues[smoothedKValues.length - 1];
    let currentD: number;

    if (smoothedKValues.length < this.dPeriod) {
      // Not enough data for %D yet, return current %K as %D
      currentD = currentK;
    } else {
      const dSlice = smoothedKValues.slice(-this.dPeriod);
      currentD = this.calculateSMA(dSlice);
    }

    return {
      k: this.clamp(currentK),
      d: this.clamp(currentD),
    };
  }

  /**
   * Calculate raw %K for a period
   *
   * @param candles - Candles for this period (kPeriod length)
   * @returns Raw %K value (0-100)
   */
  private calculateRawK(candles: Candle[]): number {
    const currentClose = candles[candles.length - 1].close;
    const lowestLow = Math.min(...candles.map((c) => c.low));
    const highestHigh = Math.max(...candles.map((c) => c.high));

    // Handle edge case: no price movement
    if (highestHigh === lowestLow) {
      return ZERO_RANGE_FALLBACK;
    }

    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * PERCENT_MULTIPLIER;
    return k;
  }

  /**
   * Calculate Simple Moving Average
   *
   * @param values - Array of values
   * @returns SMA
   */
  private calculateSMA(values: number[]): number {
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * Clamp value to valid range [0, 100]
   *
   * @param value - Value to clamp
   * @returns Clamped value
   */
  private clamp(value: number): number {
    return Math.max(STOCH_MIN, Math.min(STOCH_MAX, value));
  }

  /**
   * Check if Stochastic is in oversold zone
   *
   * @param k - Current %K value
   * @returns True if oversold (< 20)
   */
  isOversold(k: number): boolean {
    return k < STOCH_OVERSOLD;
  }

  /**
   * Check if Stochastic is in overbought zone
   *
   * @param k - Current %K value
   * @returns True if overbought (> 80)
   */
  isOverbought(k: number): boolean {
    return k > STOCH_OVERBOUGHT;
  }

  /**
   * Detect bullish divergence with RSI
   * Both RSI and Stochastic should be oversold for strong signal
   *
   * @param k - Current Stochastic %K
   * @param rsi - Current RSI value
   * @returns True if both confirm oversold
   */
  confirmOversoldWithRSI(k: number, rsi: number): boolean {
    const rsiOversold = rsi < 30;
    const stochOversold = this.isOversold(k);
    return rsiOversold && stochOversold;
  }

  /**
   * Detect bearish divergence with RSI
   * Both RSI and Stochastic should be overbought for strong signal
   *
   * @param k - Current Stochastic %K
   * @param rsi - Current RSI value
   * @returns True if both confirm overbought
   */
  confirmOverboughtWithRSI(k: number, rsi: number): boolean {
    const rsiOverbought = rsi > 70;
    const stochOverbought = this.isOverbought(k);
    return rsiOverbought && stochOverbought;
  }

  /**
   * Detect %K and %D crossover
   * Bullish: %K crosses above %D in oversold zone
   * Bearish: %K crosses below %D in overbought zone
   *
   * @param currentK - Current %K
   * @param currentD - Current %D
   * @param previousK - Previous %K
   * @param previousD - Previous %D
   * @returns 'BULLISH', 'BEARISH', or 'NONE'
   */
  detectCrossover(
    currentK: number,
    currentD: number,
    previousK: number,
    previousD: number,
  ): 'BULLISH' | 'BEARISH' | 'NONE' {
    // Bullish crossover: %K crosses above %D
    if (previousK <= previousD && currentK > currentD) {
      return 'BULLISH';
    }

    // Bearish crossover: %K crosses below %D
    if (previousK >= previousD && currentK < currentD) {
      return 'BEARISH';
    }

    return 'NONE';
  }

  /**
   * Get %K history (for %D calculation or analysis)
   *
   * @returns Array of %K values
   */
  getKHistory(): number[] {
    return [...this.kHistory];
  }

  /**
   * Reset indicator state
   */
  reset(): void {
    this.kHistory = [];
  }
}
