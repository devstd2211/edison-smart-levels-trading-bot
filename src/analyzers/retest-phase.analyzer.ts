/**
 * Retest Phase Analyzer
 *
 * Tracks retest zone: price returning to the broken level.
 * - LONG: price returns to Daily High * retestThreshold (99%)
 * - SHORT: price returns to Daily Low * (2 - retestThreshold) (101%)
 *
 * Counts touches and provides stop loss levels.
 */

import { Candle, LoggerService } from '../types';
import {
  DailyLevel,
  DailyLevelConfig,
  FractalSetup,
  LocalHighLow,
  RetestInfo,
  RetestPhaseResult
} from '../types/fractal-strategy.types';
import { SignalDirection } from '../types';
import { INTEGER_MULTIPLIERS } from '../constants';
import { formatPrice, TIME_INTERVALS, DEFAULT_TIGHT_STOPLOSS_BUFFER_PERCENT } from '../constants/technical.constants';

// ============================================================================
// CONSTANTS
// ============================================================================

// 5-minute bars in 24 hours: 1440 minutes / 5 minutes per bar = 288 bars
const BARS_PER_DAY = (INTEGER_MULTIPLIERS.TWENTY_FOUR as number) * (INTEGER_MULTIPLIERS.SIXTY as number) / INTEGER_MULTIPLIERS.FIVE;

export class RetestPhaseAnalyzer {
  constructor(
    private config: DailyLevelConfig,
    private logger: LoggerService
  ) {}

  /**
   * Check if price is currently in retest zone
   */
  isInRetestZone(
    currentPrice: number,
    dailyLevel: DailyLevel,
    direction: SignalDirection
  ): boolean {
    const zone = this.getRetestZoneBoundaries(dailyLevel, direction);
    return currentPrice >= zone.lower && currentPrice <= zone.upper;
  }

  /**
   * Get retest zone boundaries
   */
  private getRetestZoneBoundaries(
    dailyLevel: DailyLevel,
    direction: SignalDirection
  ): { upper: number; lower: number } {
    if (direction === SignalDirection.LONG) {
      // LONG: retest zone is from 99% of high to high
      return {
        upper: dailyLevel.high,
        lower: dailyLevel.high * this.config.retestThreshold
      };
    } else {
      // SHORT: retest zone is from low to 101% of low
      return {
        upper: dailyLevel.low * (2 - this.config.retestThreshold),
        lower: dailyLevel.low
      };
    }
  }

  /**
   * Update retest information when price enters zone
   * Increments touch count and updates local high/low for tight stops
   */
  updateRetestInfo(
    setup: FractalSetup,
    candle: Candle,
    candles1m: Candle[]
  ): RetestPhaseResult {
    const existing = setup.retest;
    const isInZone = this.isInRetestZone(candle.close, setup.dailyLevel, setup.direction);

    // Not yet in retest zone and no previous entry
    if (!isInZone && !existing) {
      return {
        inRetestZone: false,
        timedOut: false
      };
    }

    // First entry into retest zone
    if (!existing && isInZone) {
      const retestInfo: RetestInfo = {
        entryPrice: candle.close,
        timestamp: candle.timestamp,
        touchCount: 1,
        isSecondTouch: false,
        localHighLow: this.calculateLocalHighLow(candles1m)
      };

      this.logger.debug('First retest zone touch', {
        price: formatPrice(candle.close),
        zone: this.getRetestZoneBoundaries(setup.dailyLevel, setup.direction),
        localStopLow: formatPrice(retestInfo.localHighLow.low),
        localStopHigh: formatPrice(retestInfo.localHighLow.high)
      });

      return {
        inRetestZone: true,
        retestInfo,
        timedOut: false
      };
    }

    // Already in retest - check for multiple touches
    if (existing && isInZone) {
      const touchCount = existing.touchCount + 1;
      const isSecondTouch = touchCount >= INTEGER_MULTIPLIERS.TWO;

      const retestInfo: RetestInfo = {
        ...existing,
        touchCount,
        isSecondTouch,
        localHighLow: this.calculateLocalHighLow(candles1m)
      };

      if (isSecondTouch && !existing.isSecondTouch) {
        this.logger.info('Second retest zone touch - reversal ready', {
          totalTouches: touchCount,
          price: formatPrice(candle.close)
        });
      }

      return {
        inRetestZone: true,
        retestInfo,
        timedOut: false
      };
    }

    // Was in retest zone but exited (shouldn't update, just return existing)
    return {
      inRetestZone: false,
      retestInfo: existing,
      timedOut: false
    };
  }

  /**
   * Calculate local high/low for tight stop loss
   * Uses last N 1-minute bars (default 10)
   */
  private calculateLocalHighLow(candles1m: Candle[], bars: number = 10): LocalHighLow {
    if (candles1m.length === 0) {
      this.logger.warn('No 1-minute candles available for local high/low');
      return {
        high: 0,
        low: 0,
        bars: 0
      };
    }

    const recent = candles1m.slice(-bars);
    const high = Math.max(...recent.map(c => c.high));
    const low = Math.min(...recent.map(c => c.low));

    return { high, low, bars: recent.length };
  }

  /**
   * Check if retest phase has timed out
   * LONG: if more than retestTimeoutBars have passed since breakout
   */
  isRetestTimeout(setup: FractalSetup): boolean {
    if (!setup.breakout) {
      return false;
    }

    const barsPassed = Math.floor(
      (Date.now() - setup.breakout.timestamp) / TIME_INTERVALS.MS_PER_5_MINUTES
    );

    const timedOut = barsPassed > this.config.retestTimeoutBars;

    if (timedOut) {
      this.logger.warn('Retest timeout reached', {
        barsPassed,
        timeout: this.config.retestTimeoutBars,
        days: (barsPassed / BARS_PER_DAY).toFixed(1)
      });
    }

    return timedOut;
  }

  /**
   * Get current retest zone info for logging
   */
  getRetestZoneInfo(setup: FractalSetup): string {
    const zone = this.getRetestZoneBoundaries(setup.dailyLevel, setup.direction);
    return `${formatPrice(zone.lower)} - ${formatPrice(zone.upper)}`;
  }

  /**
   * Calculate tight stop loss with buffer
   */
  calculateTightStopLoss(
    localHighLow: LocalHighLow,
    direction: SignalDirection,
    bufferPercent: number = DEFAULT_TIGHT_STOPLOSS_BUFFER_PERCENT
  ): number {
    const buffer = bufferPercent / INTEGER_MULTIPLIERS.ONE_HUNDRED;

    if (direction === SignalDirection.LONG) {
      // Stop below local low + 0.1% buffer
      return localHighLow.low * (1 - buffer);
    } else {
      // Stop above local high - 0.1% buffer
      return localHighLow.high * (1 + buffer);
    }
  }
}
