/**
 * Daily Level Tracker
 *
 * Identifies Daily High/Low levels from 5-minute candle aggregation.
 * Uses UTC midnight (00:00) as the daily boundary.
 */

import { Candle, LoggerService } from '../types';
import { DailyLevel, DailyLevelConfig } from '../types/fractal-strategy.types';
import { formatPrice, TIME_MULTIPLIERS, INTEGER_MULTIPLIERS } from '../constants/technical.constants';

export class DailyLevelTracker {
  /** 5-minute bars in 24 hours: 1440 minutes / 5 minutes per bar = 288 bars */
  private readonly BARS_PER_DAY = (TIME_MULTIPLIERS.HOURS_PER_DAY * TIME_MULTIPLIERS.MINUTES_PER_HOUR) / INTEGER_MULTIPLIERS.FIVE;

  // Cache for last calculated daily level
  private cachedDailyLevel: DailyLevel | null = null;
  private cachedDayKey: string | null = null;

  constructor(
    private config: DailyLevelConfig,
    private logger: LoggerService
  ) {}

  /**
   * Get Daily High/Low from 5-minute candles
   * OPTIMIZED: Uses caching to avoid recalculating every bar
   */
  getDailyLevels(candles5m: Candle[]): DailyLevel {
    if (candles5m.length < 1) {
      throw new Error('No candles provided');
    }

    const lastCandle = candles5m[candles5m.length - 1];
    const currentDayKey = new Date(lastCandle.timestamp).toISOString().split('T')[0];

    // Return cached value if day hasn't changed
    if (this.cachedDailyLevel && this.cachedDayKey === currentDayKey) {
      return this.cachedDailyLevel;
    }

    // Calculate fresh if day changed
    const lookbackBars = this.config.lookbackPeriod * this.BARS_PER_DAY;
    const relevantCandles = candles5m.length > lookbackBars
      ? candles5m.slice(-lookbackBars)
      : candles5m;

    // Find high/low for today's candles only
    let dailyHigh = -Infinity;
    let dailyLow = Infinity;
    let dayStartIndex = 0;

    // Find where today started
    for (let i = relevantCandles.length - 1; i >= 0; i--) {
      const candleDay = new Date(relevantCandles[i].timestamp).toISOString().split('T')[0];
      if (candleDay !== currentDayKey) {
        dayStartIndex = i + 1;
        break;
      }
    }

    // Calculate min/max for today only (O(n) single pass)
    for (let i = dayStartIndex; i < relevantCandles.length; i++) {
      const candle = relevantCandles[i];
      if (candle.high > dailyHigh) dailyHigh = candle.high;
      if (candle.low < dailyLow) dailyLow = candle.low;
    }

    // Handle edge case: first day of data
    if (dailyHigh === -Infinity) {
      dailyHigh = lastCandle.high;
      dailyLow = lastCandle.low;
    }

    const result: DailyLevel = {
      high: dailyHigh,
      low: dailyLow,
      timestamp: lastCandle.timestamp,
      source: '5m_aggregated'
    };

    // Cache the result
    this.cachedDailyLevel = result;
    this.cachedDayKey = currentDayKey;

    this.logger.debug('DailyLevelTracker calculated', {
      dayKey: currentDayKey,
      dayStartIndex,
      candlesInDay: relevantCandles.length - dayStartIndex,
      totalCandles: candles5m.length,
      high: formatPrice(dailyHigh),
      low: formatPrice(dailyLow),
      lookbackBars,
      firstCandleTime: new Date(relevantCandles[dayStartIndex]?.timestamp || 0).toISOString(),
      lastCandleTime: new Date(lastCandle.timestamp).toISOString()
    });

    return result;
  }


  /**
   * Check if price is in retest zone
   * LONG: price between (level * retestThreshold) and level
   * SHORT: price between level and (level * (2 - retestThreshold))
   */
  isInRetestZone(
    currentPrice: number,
    dailyLevel: DailyLevel,
    direction: 'LONG' | 'SHORT'
  ): boolean {
    if (direction === 'LONG') {
      const retestZone = dailyLevel.high * this.config.retestThreshold;
      return currentPrice <= dailyLevel.high && currentPrice >= retestZone;
    } else {
      const retestZone = dailyLevel.low * (INTEGER_MULTIPLIERS.TWO - this.config.retestThreshold);
      return currentPrice >= dailyLevel.low && currentPrice <= retestZone;
    }
  }

  /**
   * Calculate retest zone boundaries
   */
  getRetestZoneBoundaries(dailyLevel: DailyLevel, direction: 'LONG' | 'SHORT'): { upper: number; lower: number } {
    if (direction === 'LONG') {
      return {
        upper: dailyLevel.high,
        lower: dailyLevel.high * this.config.retestThreshold
      };
    } else {
      return {
        upper: dailyLevel.low * (INTEGER_MULTIPLIERS.TWO - this.config.retestThreshold),
        lower: dailyLevel.low
      };
    }
  }
}
