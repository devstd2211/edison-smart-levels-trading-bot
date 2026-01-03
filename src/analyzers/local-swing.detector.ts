/**
 * Local Swing Detector
 *
 * Detects local swing highs/lows over configurable period.
 * Useful for short-duration data where Daily levels don't exist.
 */

import { Candle, LoggerService } from '../types';
import { DailyLevel } from '../types/fractal-strategy.types';
import { formatPrice } from '../constants/technical.constants';

export class LocalSwingDetector {
  constructor(
    private lookbackBars: number = 72, // 6 hours of 5m candles
    private logger?: LoggerService
  ) {}

  /**
   * Get local swing High/Low from recent candles
   */
  getLocalSwings(candles: Candle[]): DailyLevel {
    if (candles.length < 5) {
      throw new Error('Need at least 5 candles for swing detection');
    }

    const relevantCandles = candles.length > this.lookbackBars
      ? candles.slice(-this.lookbackBars)
      : candles;

    let swingHigh = -Infinity;
    let swingLow = Infinity;

    // Find high/low in lookback period
    for (const candle of relevantCandles) {
      if (candle.high > swingHigh) swingHigh = candle.high;
      if (candle.low < swingLow) swingLow = candle.low;
    }

    // Fallback if no valid high/low
    if (swingHigh === -Infinity) {
      swingHigh = candles[candles.length - 1].high;
    }
    if (swingLow === Infinity) {
      swingLow = candles[candles.length - 1].low;
    }

    const result: DailyLevel = {
      high: swingHigh,
      low: swingLow,
      timestamp: candles[candles.length - 1].timestamp,
      source: '5m_local'
    };

    if (this.logger) {
      this.logger.debug('Local swings detected', {
        high: formatPrice(swingHigh),
        low: formatPrice(swingLow),
        bars: this.lookbackBars
      });
    }

    return result;
  }

  /**
   * Get multiple resistance/support levels
   */
  getMultipleLevels(candles: Candle[], count: number = 3): DailyLevel[] {
    if (candles.length < 10) {
      return [this.getLocalSwings(candles)];
    }

    const levels: DailyLevel[] = [];
    const barsPerLevel = Math.floor(this.lookbackBars / count);

    for (let i = 0; i < count; i++) {
      const startIdx = Math.max(0, candles.length - (barsPerLevel * (i + 1)));
      const endIdx = Math.max(0, candles.length - (barsPerLevel * i)) || candles.length;
      const segment = candles.slice(startIdx, endIdx);

      if (segment.length > 0) {
        levels.push(this.getLocalSwings(segment));
      }
    }

    return levels;
  }
}
