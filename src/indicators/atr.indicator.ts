import { PERCENT_MULTIPLIER } from '../constants';
import { INTEGER_MULTIPLIERS } from '../constants/technical.constants';
/**
 * ATR Indicator (Average True Range)
 * Measures market volatility
 *
 * Formula:
 * 1. True Range (TR) = max of:
 *    - High - Low
 *    - |High - Previous Close|
 *    - |Low - Previous Close|
 * 2. ATR = EMA of TR over period (Wilder's smoothing)
 *
 * Returns: ATR value as percentage of current price
 * - Low volatility: < MULTIPLIERS.HALF%
 * - Normal volatility: MULTIPLIERS.HALF% - 2%
 * - High volatility: 2% - 5%
 * - Extreme volatility: > 5%
 *
 * Implementation: Wilder's smoothing (same as RSI)
 */

import type { Candle } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_CANDLES = INTEGER_MULTIPLIERS.TWO; // Need at least 2 candles for TR calculation

// ============================================================================
// ATR CALCULATOR
// ============================================================================

export class ATRIndicator {
  private readonly period: number;
  private atr: number = 0;
  private initialized: boolean = false;

  constructor(period: number) {
    if (period < 1) {
      throw new Error('ATR period must be at least 1');
    }
    this.period = period;
  }

  /**
   * Calculate True Range for a single candle
   *
   * @param current - Current candle
   * @param previous - Previous candle
   * @returns True Range value
   */
  private calculateTrueRange(current: Candle, previous: Candle): number {
    const highLow = current.high - current.low;
    const highClose = Math.abs(current.high - previous.close);
    const lowClose = Math.abs(current.low - previous.close);

    return Math.max(highLow, highClose, lowClose);
  }

  /**
   * Calculate ATR for a series of candles
   *
   * @param candles - Array of candles (must be at least period + 1 length)
   * @returns ATR value as percentage of current price
   * @throws {Error} If not enough candles
   */
  calculate(candles: Candle[]): number {
    if (candles.length < this.period + 1) {
      throw new Error(
        `Not enough candles for ATR calculation. Need ${this.period + 1}, got ${candles.length}`,
      );
    }

    // Reset state
    this.initialized = false;

    // Calculate True Range for each candle
    const trueRanges: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const tr = this.calculateTrueRange(candles[i], candles[i - 1]);
      trueRanges.push(tr);
    }

    // Initial ATR (simple average for first period)
    let sumTR = 0;
    for (let i = 0; i < this.period; i++) {
      sumTR += trueRanges[i];
    }
    this.atr = sumTR / this.period;
    this.initialized = true;

    // Wilder's smoothing for remaining periods
    for (let i = this.period; i < trueRanges.length; i++) {
      this.atr = (this.atr * (this.period - 1) + trueRanges[i]) / this.period;
    }

    // Convert to percentage of current price
    const currentPrice = candles[candles.length - 1].close;
    const atrPercent = (this.atr / currentPrice) * PERCENT_MULTIPLIER;

    return atrPercent;
  }

  /**
   * Update ATR with a new candle (incremental calculation)
   *
   * @param newCandle - New candle
   * @param previousCandle - Previous candle
   * @returns Updated ATR value as percentage
   * @throws {Error} If not initialized
   */
  update(newCandle: Candle, previousCandle: Candle): number {
    if (!this.initialized) {
      throw new Error('ATR not initialized. Call calculate() first.');
    }

    // Calculate new True Range
    const tr = this.calculateTrueRange(newCandle, previousCandle);

    // Wilder's smoothing
    this.atr = (this.atr * (this.period - 1) + tr) / this.period;

    // Convert to percentage of current price
    const atrPercent = (this.atr / newCandle.close) * PERCENT_MULTIPLIER;

    return atrPercent;
  }

  /**
   * Get current ATR value (must be initialized)
   *
   * @returns ATR value
   * @throws {Error} If not initialized
   */
  getValue(): number {
    if (!this.initialized) {
      throw new Error('ATR not initialized. Call calculate() first.');
    }
    return this.atr;
  }

  /**
   * Check if ATR is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset ATR state
   */
  reset(): void {
    this.atr = 0;
    this.initialized = false;
  }

  /**
   * Get current state (for serialization/debugging)
   */
  getState(): { period: number; atr: number; initialized: boolean } {
    return {
      period: this.period,
      atr: this.atr,
      initialized: this.initialized,
    };
  }
}
