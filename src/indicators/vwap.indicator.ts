import { PERCENT_MULTIPLIER, PRECISION_THRESHOLDS, INTEGER_MULTIPLIERS } from '../constants';
/**
 * VWAP Indicator (Volume Weighted Average Price)
 *
 * VWAP is the average price weighted by volume.
 * Used by institutional traders as a benchmark.
 *
 * Formula:
 * VWAP = Σ(Typical Price × Volume) / Σ(Volume)
 * where Typical Price = (High + Low + Close) / 3
 *
 * Interpretation:
 * - Price > VWAP = Bullish (buyers in control)
 * - Price < VWAP = Bearish (sellers in control)
 * - Institutional traders aim to buy below VWAP, sell above VWAP
 *
 * Use Cases:
 * - Senior timeframe filter (M5, M30)
 * - Trend confirmation
 * - Entry timing (buy when price dips to VWAP in uptrend)
 */

import type { Candle } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_CANDLES = INTEGER_MULTIPLIERS.ONE;
const TYPICAL_PRICE_DIVISOR = INTEGER_MULTIPLIERS.THREE;

// ============================================================================
// VWAP CALCULATOR
// ============================================================================

export class VWAPIndicator {
  /**
   * Calculate VWAP from candles
   *
   * @param candles - Array of candles (ordered by timestamp)
   * @returns VWAP value, or 0 if no volume
   */
  calculate(candles: Candle[]): number {
    if (candles.length < MIN_CANDLES) {
      return 0;
    }

    let sumPriceVolume = 0;
    let sumVolume = 0;

    for (const candle of candles) {
      const typicalPrice =
        (candle.high + candle.low + candle.close) / TYPICAL_PRICE_DIVISOR;
      sumPriceVolume += typicalPrice * candle.volume;
      sumVolume += candle.volume;
    }

    return sumVolume > 0 ? sumPriceVolume / sumVolume : 0;
  }

  /**
   * Calculate VWAP and determine position relative to price
   *
   * @param candles - Array of candles
   * @param currentPrice - Current market price
   * @returns Object with VWAP value and position (above/below/at)
   */
  analyze(
    candles: Candle[],
    currentPrice: number,
  ): {
    vwap: number;
    position: 'ABOVE' | 'BELOW' | 'AT';
    distance: number;
    distancePercent: number;
  } {
    const vwap = this.calculate(candles);

    // Determine position
    const threshold = vwap * PRECISION_THRESHOLDS.TIGHT; // 0.01% threshold for "AT"
    let position: 'ABOVE' | 'BELOW' | 'AT';

    if (currentPrice > vwap + threshold) {
      position = 'ABOVE';
    } else if (currentPrice < vwap - threshold) {
      position = 'BELOW';
    } else {
      position = 'AT';
    }

    // Distance from VWAP
    const distance = currentPrice - vwap;
    const distancePercent = vwap > 0 ? (distance / vwap) * PERCENT_MULTIPLIER : 0;

    return {
      vwap,
      position,
      distance,
      distancePercent,
    };
  }

  /**
   * Check if price is aligned with VWAP for given direction
   *
   * @param candles - Array of candles
   * @param currentPrice - Current market price
   * @param direction - Trade direction ('LONG' or 'SHORT')
   * @returns true if aligned (LONG above VWAP, SHORT below VWAP)
   */
  isAligned(
    candles: Candle[],
    currentPrice: number,
    direction: 'LONG' | 'SHORT',
  ): boolean {
    const { position } = this.analyze(candles, currentPrice);

    if (direction === 'LONG') {
      return position === 'ABOVE' || position === 'AT';
    } else {
      return position === 'BELOW' || position === 'AT';
    }
  }
}
