/**
 * EMA Indicator (Exponential Moving Average)
 * Smooths price data with more weight on recent prices
 *
 * Formula:
 * 1. Multiplier = 2 / (period + 1)
 * 2. EMA = (Close - EMA_prev) * Multiplier + EMA_prev
 *
 * First EMA = SMA (Simple Moving Average) of first N periods
 *
 * Use cases:
 * - Trend identification (price above EMA = uptrend)
 * - Support/resistance levels
 * - Entry confirmation (price crosses EMA)
 */

import type { Candle } from '../types';
import { INTEGER_MULTIPLIERS } from '../constants';

// ============================================================================
// CONSTANTS
// ============================================================================

const MULTIPLIER_NUMERATOR = INTEGER_MULTIPLIERS.TWO;
const MULTIPLIER_DENOMINATOR_OFFSET = INTEGER_MULTIPLIERS.ONE;

// ============================================================================
// EMA CALCULATOR
// ============================================================================

export class EMAIndicator {
  private readonly period: number;
  private readonly multiplier: number;
  private ema: number = 0;
  private initialized: boolean = false;

  constructor(period: number) {
    this.period = period;
    this.multiplier = MULTIPLIER_NUMERATOR / (period + MULTIPLIER_DENOMINATOR_OFFSET);
  }

  /**
   * Calculate EMA for a series of candles
   *
   * @param candles - Array of candles (must be at least period length)
   * @returns EMA value
   * @throws {Error} If not enough candles
   */
  calculate(candles: Candle[]): number {
    if (candles.length < this.period) {
      throw new Error(
        `Not enough candles for EMA calculation. Need ${this.period}, got ${candles.length}`,
      );
    }

    // Reset state
    this.initialized = false;

    // Calculate initial SMA
    let sum = 0;
    for (let i = 0; i < this.period; i++) {
      sum += candles[i].close;
    }
    this.ema = sum / this.period;
    this.initialized = true;

    // Apply EMA formula for remaining candles
    for (let i = this.period; i < candles.length; i++) {
      this.ema = (candles[i].close - this.ema) * this.multiplier + this.ema;
    }

    return this.ema;
  }

  /**
   * Update EMA with a new price (incremental calculation)
   *
   * @param price - Current close price
   * @returns Updated EMA value
   * @throws {Error} If not initialized
   */
  update(price: number): number {
    if (!this.initialized) {
      throw new Error('EMA not initialized. Call calculate() first.');
    }

    this.ema = (price - this.ema) * this.multiplier + this.ema;
    return this.ema;
  }

  /**
   * Get current EMA value
   *
   * @returns Current EMA
   * @throws {Error} If not initialized
   */
  getValue(): number {
    if (!this.initialized) {
      throw new Error('EMA not initialized. Call calculate() first.');
    }
    return this.ema;
  }

  /**
   * Get current state
   *
   * @returns Current EMA and initialization status
   */
  getState(): { ema: number; initialized: boolean } {
    return {
      ema: this.ema,
      initialized: this.initialized,
    };
  }

  /**
   * Reset indicator state
   */
  reset(): void {
    this.ema = 0;
    this.initialized = false;
  }
}
