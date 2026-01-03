/**
 * RSI Indicator (Relative Strength Index)
 * Measures momentum and overbought/oversold conditions
 *
 * Formula:
 * 1. Calculate price changes (gains and losses)
 * 2. Average gain = EMA of gains over period
 * 3. Average loss = EMA of losses over period
 * 4. RS = Average Gain / Average Loss
 * 5. RSI = 100 - (100 / (1 + RS))
 *
 * Range: 0-100
 * - Above 70: Overbought
 * - Below 30: Oversold
 *
 * Implementation: Wilder's smoothing (modified EMA)
 */

import type { Candle } from '../types';
import { CONFIDENCE_THRESHOLDS } from '../constants/strategy-constants';
import {
  INTEGER_MULTIPLIERS,
  MATH_BOUNDS,
  FIRST_INDEX,
  SECOND_INDEX,
} from '../constants/technical.constants';

// ============================================================================
// CONSTANTS
// ============================================================================

const RSI_MIN = MATH_BOUNDS.MIN_PERCENTAGE as number;
const RSI_MAX = MATH_BOUNDS.MAX_PERCENTAGE as number;
const RSI_NEUTRAL = CONFIDENCE_THRESHOLDS.MODERATE;
const ZERO_DIVISION_FALLBACK = RSI_NEUTRAL;
const PERCENT_DIVISOR = INTEGER_MULTIPLIERS.ONE_HUNDRED as number;

// ============================================================================
// RSI CALCULATOR
// ============================================================================

export class RSIIndicator {
  private readonly period: number;
  private avgGain: number = (FIRST_INDEX as number);
  private avgLoss: number = (FIRST_INDEX as number);
  private initialized: boolean = false;

  constructor(period: number) {
    this.period = period;
  }

  /**
   * Calculate RSI for a series of candles
   *
   * @param candles - Array of candles (must be at least period + 1 length)
   * @returns RSI value (0-100)
   * @throws {Error} If not enough candles
   */
  calculate(candles: Candle[]): number {
    if (candles.length < this.period + 1) {
      throw new Error(
        `Not enough candles for RSI calculation. Need ${this.period + 1}, got ${candles.length}`,
      );
    }

    // Reset state
    this.initialized = false;

    // Calculate price changes
    const changes: number[] = [];
    for (let i = (SECOND_INDEX as number); i < candles.length; i++) {
      changes.push(candles[i].close - candles[i - (SECOND_INDEX as number)].close);
    }

    // Initial averages (simple average for first period)
    let sumGain = (FIRST_INDEX as number);
    let sumLoss = (FIRST_INDEX as number);

    for (let i = (FIRST_INDEX as number); i < this.period; i++) {
      if (changes[i] > (FIRST_INDEX as number)) {
        sumGain += changes[i];
      } else {
        sumLoss += Math.abs(changes[i]);
      }
    }

    this.avgGain = sumGain / this.period;
    this.avgLoss = sumLoss / this.period;
    this.initialized = true;

    // Wilder's smoothing for remaining periods
    for (let i = this.period; i < changes.length; i++) {
      const change = changes[i];
      const gain = change > (FIRST_INDEX as number) ? change : (FIRST_INDEX as number);
      const loss = change < (FIRST_INDEX as number) ? Math.abs(change) : (FIRST_INDEX as number);

      this.avgGain = (this.avgGain * (this.period - (SECOND_INDEX as number)) + gain) / this.period;
      this.avgLoss = (this.avgLoss * (this.period - (SECOND_INDEX as number)) + loss) / this.period;
    }

    // Calculate RSI
    return this.calculateRSI();
  }

  /**
   * Update RSI with a new candle (incremental calculation)
   *
   * @param previousClose - Previous candle close
   * @param currentClose - Current candle close
   * @returns Updated RSI value
   * @throws {Error} If not initialized
   */
  update(previousClose: number, currentClose: number): number {
    if (!this.initialized) {
      throw new Error('RSI not initialized. Call calculate() first.');
    }

    const change = currentClose - previousClose;
    const gain = change > (FIRST_INDEX as number) ? change : (FIRST_INDEX as number);
    const loss = change < (FIRST_INDEX as number) ? Math.abs(change) : (FIRST_INDEX as number);

    // Wilder's smoothing
    this.avgGain = (this.avgGain * (this.period - (SECOND_INDEX as number)) + gain) / this.period;
    this.avgLoss = (this.avgLoss * (this.period - (SECOND_INDEX as number)) + loss) / this.period;

    return this.calculateRSI();
  }

  /**
   * Calculate RSI from current avg gain/loss
   *
   * @returns RSI value (0-100)
   */
  private calculateRSI(): number {
    if (this.avgLoss === (FIRST_INDEX as number)) {
      // No losses means RSI = 100 (or 50 if no gains either)
      return this.avgGain === (FIRST_INDEX as number) ? ZERO_DIVISION_FALLBACK : RSI_MAX;
    }

    const rs = this.avgGain / this.avgLoss;
    const rsi = RSI_MAX - (PERCENT_DIVISOR / ((SECOND_INDEX as number) + rs));

    // Clamp to valid range
    return Math.max(RSI_MIN, Math.min(RSI_MAX, rsi));
  }

  /**
   * Get current state
   *
   * @returns Current avg gain and loss
   */
  getState(): { avgGain: number; avgLoss: number; initialized: boolean } {
    return {
      avgGain: this.avgGain,
      avgLoss: this.avgLoss,
      initialized: this.initialized,
    };
  }

  /**
   * Reset indicator state
   */
  reset(): void {
    this.avgGain = (FIRST_INDEX as number);
    this.avgLoss = (FIRST_INDEX as number);
    this.initialized = false;
  }
}
