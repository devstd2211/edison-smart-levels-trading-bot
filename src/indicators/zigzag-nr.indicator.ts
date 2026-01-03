/**
 * Non-Repainting ZigZag Indicator (Optimized)
 *
 * This indicator identifies swing points (highs and lows) without repainting.
 * A swing point is only confirmed after a certain number of subsequent candles have closed.
 *
 * Algorithm:
 * - A Swing High is a candle whose high is the highest over a pivot period (N bars left, M bars right).
 * - A Swing Low is a candle whose low is the lowest over a pivot period (N bars left, M bars right).
 *
 * OPTIMIZATION:
 * - Asymmetric lookback: leftBars (historical context) vs rightBars (confirmation speed)
 * - Dual-mode: Quick swings (pending) for entry signals, Confirmed swings for structure
 * - Timeframe-optimized: Configure per timeframe (ENTRY=quick, TREND=confirmed)
 *
 * The indicator only identifies points up to the Nth most recent candle, where N is the
 * right-hand lookback period. This prevents it from changing past signals.
 */

import type { Candle, SwingPoint } from '../types';
import { SwingPointType } from '../types';

export interface SwingPointsResult {
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
  pendingHighs: SwingPoint[]; // Potential swings not yet confirmed
  pendingLows: SwingPoint[];
}

export class ZigZagNRIndicator {
  private readonly leftBars: number;
  private readonly rightBars: number;
  private readonly requiredBars: number;
  private readonly quickRightBars: number; // Faster confirmation for entry signals

  constructor(leftBars: number, rightBars: number = leftBars, quickRightBars?: number) {
    // Asymmetric lookback: leftBars (history) vs rightBars (confirmation)
    this.leftBars = leftBars;
    this.rightBars = rightBars;
    this.quickRightBars = quickRightBars || Math.max(2, Math.floor(rightBars / 3)); // Default: 1/3 of rightBars
    this.requiredBars = this.leftBars + this.rightBars + 1;
  }

  /**
   * Finds all swing points (backward compatible).
   * Uses confirmed swings (full rightBars confirmation).
   * @param candles - Array of candles
   * @returns An object containing arrays of swing highs and swing lows.
   */
  findSwingPoints(candles: Candle[]): { swingHighs: SwingPoint[]; swingLows: SwingPoint[] } {
    const result = this.findAllSwingPoints(candles);
    return {
      swingHighs: result.swingHighs,
      swingLows: result.swingLows,
    };
  }

  /**
   * Finds all swing points with pending detection.
   * Useful for entry scanning where quick confirmation is needed.
   * @param candles - Array of candles
   * @returns Object containing confirmed and pending swing points
   */
  findAllSwingPoints(candles: Candle[]): SwingPointsResult {
    const swingHighs: SwingPoint[] = [];
    const swingLows: SwingPoint[] = [];
    const pendingHighs: SwingPoint[] = [];
    const pendingLows: SwingPoint[] = [];

    if (candles.length < this.leftBars + 2) {
      return { swingHighs, swingLows, pendingHighs, pendingLows };
    }

    // Find CONFIRMED swings (full rightBars confirmation)
    if (candles.length >= this.requiredBars) {
      for (let i = this.leftBars; i < candles.length - this.rightBars; i++) {
        if (this.isSwingHigh(candles, i, this.rightBars)) {
          swingHighs.push({
            price: candles[i].high,
            timestamp: candles[i].timestamp,
            type: SwingPointType.HIGH,
          });
        }
        if (this.isSwingLow(candles, i, this.rightBars)) {
          swingLows.push({
            price: candles[i].low,
            timestamp: candles[i].timestamp,
            type: SwingPointType.LOW,
          });
        }
      }
    }

    // Find PENDING swings (faster confirmation with quickRightBars)
    const quickRequiredBars = this.leftBars + this.quickRightBars + 1;
    if (candles.length >= quickRequiredBars) {
      for (let i = this.leftBars; i < candles.length - this.quickRightBars; i++) {
        // Only add pending if not already confirmed
        const isConfirmedHigh = swingHighs.some(sh => sh.timestamp === candles[i].timestamp);
        const isConfirmedLow = swingLows.some(sl => sl.timestamp === candles[i].timestamp);

        if (!isConfirmedHigh && this.isSwingHigh(candles, i, this.quickRightBars)) {
          pendingHighs.push({
            price: candles[i].high,
            timestamp: candles[i].timestamp,
            type: SwingPointType.HIGH,
          });
        }
        if (!isConfirmedLow && this.isSwingLow(candles, i, this.quickRightBars)) {
          pendingLows.push({
            price: candles[i].low,
            timestamp: candles[i].timestamp,
            type: SwingPointType.LOW,
          });
        }
      }
    }

    return { swingHighs, swingLows, pendingHighs, pendingLows };
  }

  /**
   * Checks if the candle at the given index is a swing high.
   * A candle is a swing high if its high is the highest among the surrounding candles
   * (leftBars to the left, checkRightBars to the right).
   * @param candles - Array of candles
   * @param index - The index of the candle to check
   * @param checkRightBars - Number of bars to check on the right (default: this.rightBars)
   * @returns True if the candle is a swing high, false otherwise.
   */
  private isSwingHigh(candles: Candle[], index: number, checkRightBars?: number): boolean {
    const rightBars = checkRightBars || this.rightBars;
    const pivotHigh = candles[index].high;

    // Check left side
    for (let i = index - this.leftBars; i < index; i++) {
      if (candles[i].high > pivotHigh) {
        return false;
      }
    }

    // Check right side
    for (let i = index + 1; i <= index + rightBars; i++) {
      if (i >= candles.length) break; // Safety check
      if (candles[i].high >= pivotHigh) { // Use >= to avoid pivots on flat tops
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if the candle at the given index is a swing low.
   * A candle is a swing low if its low is the lowest among the surrounding candles
   * (leftBars to the left, checkRightBars to the right).
   * @param candles - Array of candles
   * @param index - The index of the candle to check
   * @param checkRightBars - Number of bars to check on the right (default: this.rightBars)
   * @returns True if the candle is a swing low, false otherwise.
   */
  private isSwingLow(candles: Candle[], index: number, checkRightBars?: number): boolean {
    const rightBars = checkRightBars || this.rightBars;
    const pivotLow = candles[index].low;

    // Check left side
    for (let i = index - this.leftBars; i < index; i++) {
      if (candles[i].low < pivotLow) {
        return false;
      }
    }

    // Check right side
    for (let i = index + 1; i <= index + rightBars; i++) {
      if (i >= candles.length) break; // Safety check
      if (candles[i].low <= pivotLow) { // Use <= to avoid pivots on flat bottoms
        return false;
      }
    }

    return true;
  }
}
