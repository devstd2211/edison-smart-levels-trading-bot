/**
 * Entry Refinement Analyzer
 *
 * Validates entry conditions on 1-minute timeframe:
 * 1. Second touch (not first)
 * 2. Structure alignment (1m should match 5m direction)
 * 3. Volatility check (not sideways)
 * 4. Confirmation bars (1-2 bars closing in direction)
 * 5. Strong reversal candle (body >= config)
 * 6. Volume confirmation
 *
 * Requires configurable minimum number of conditions to confirm entry.
 */

import { Candle, LoggerService } from '../types';
import { INTEGER_MULTIPLIERS } from '../constants';
import { formatPrice } from '../constants/technical.constants';
import {
  FractalSetup,
  ReversalConfirmation,
  EntryRefinementResult,
  EntryRefinementConfig
} from '../types/fractal-strategy.types';
import { SignalDirection } from '../types';
import { VolumeAnalyzer } from './volume.analyzer';
import { MarketStructureAnalyzer } from './market-structure.analyzer';

export class EntryRefinementAnalyzer {
  constructor(
    private config: EntryRefinementConfig,
    private marketStructure: MarketStructureAnalyzer,
    private volumeAnalyzer: VolumeAnalyzer,
    private logger: LoggerService
  ) {}

  /**
   * Check if entry is confirmed on 1-minute timeframe
   * Analyzes last 5 candles for confirmation conditions
   */
  checkReversalConfirmation(
    setup: FractalSetup,
    candles1m: Candle[],
    volumeAvg: number
  ): EntryRefinementResult {
    // Must have second touch
    if (!setup.retest || !setup.retest.isSecondTouch) {
      return {
        confirmed: false,
        conditionsMet: 0,
        reason: 'Waiting for second retest touch'
      };
    }

    if (candles1m.length < 5) {
      return {
        confirmed: false,
        conditionsMet: 0,
        reason: 'Not enough 1m candles for analysis'
      };
    }

    const latestCandles = candles1m.slice(-INTEGER_MULTIPLIERS.FIVE); // Last 5 bars
    const lastCandle = latestCandles[latestCandles.length - 1];

    const conditions = {
      secondTouchMet: true, // Already checked above
      confirmationBars: this.countConfirmationBars(latestCandles, setup.direction),
      priceActionPattern: this.detectPriceActionPattern(latestCandles, setup.direction),
      volumeConfirmed: lastCandle.volume > volumeAvg * this.config.minVolumeConfirmationRatio,
      structureAligned: this.isStructureAligned(candles1m, setup.direction),
      volatilityOk: this.checkVolatility(latestCandles),
      strongCandleBody: this.isStrongCandleBody(lastCandle)
    };

    // Count passed conditions (require at least 4)
    const conditionsList = [
      conditions.secondTouchMet,
      conditions.confirmationBars >= 1,
      conditions.priceActionPattern !== null,
      conditions.volumeConfirmed,
      conditions.structureAligned,
      conditions.volatilityOk,
      conditions.strongCandleBody
    ];

    const passedConditions = conditionsList.filter(c => c).length;

    this.logger.debug(`[ENTRY REFINEMENT] Direction=${setup.direction}, secondTouch=${conditions.secondTouchMet}, confirmBars=${conditions.confirmationBars}(${conditions.confirmationBars >= 1}), pattern=${conditions.priceActionPattern}(${conditions.priceActionPattern !== null}), volume=${conditions.volumeConfirmed}, struct=${conditions.structureAligned}, vol=${conditions.volatilityOk}, body=${conditions.strongCandleBody} | Passed: ${passedConditions}/7, Need: ${this.config.minConditionsToConfirm}`);

    this.logger.debug('Entry refinement check', {
      direction: setup.direction,
      confirmationBars: conditions.confirmationBars,
      priceActionPattern: conditions.priceActionPattern,
      volumeConfirmed: conditions.volumeConfirmed,
      structureAligned: conditions.structureAligned,
      volatilityOk: conditions.volatilityOk,
      strongCandleBody: conditions.strongCandleBody,
      passedConditions,
      required: this.config.minConditionsToConfirm
    });

    // Require configurable minimum number of conditions
    if (passedConditions < this.config.minConditionsToConfirm) {
      return {
        confirmed: false,
        conditionsMet: passedConditions,
        reason: `Only ${passedConditions}/7 conditions met, need ${this.config.minConditionsToConfirm}`
      };
    }

    const reversal: ReversalConfirmation = {
      confirmationBars: conditions.confirmationBars,
      priceActionPattern: conditions.priceActionPattern ?? undefined,
      volumeConfirmed: conditions.volumeConfirmed,
      structureAligned: conditions.structureAligned,
      volatilityOk: conditions.volatilityOk,
      strongCandleBody: conditions.strongCandleBody
    };

    this.logger.info('Entry confirmed on 1m', {
      direction: setup.direction,
      conditionsMet: passedConditions,
      pattern: reversal.priceActionPattern
    });

    return {
      confirmed: true,
      reversal,
      conditionsMet: passedConditions
    };
  }

  /**
   * Count confirmation bars (bars closing in direction)
   * LONG: close > open (bullish)
   * SHORT: close < open (bearish)
   */
  private countConfirmationBars(candles: Candle[], direction: SignalDirection): number {
    let count = 0;

    for (const candle of candles) {
      const isBullish = candle.close > candle.open;
      const isShortConfirm = candle.close < candle.open;

      if (direction === SignalDirection.LONG && isBullish) {
        count++;
      } else if (direction === SignalDirection.SHORT && isShortConfirm) {
        count++;
      }
    }

    return count;
  }

  /**
   * Detect price action patterns
   * Returns pattern type or null if none found
   */
  private detectPriceActionPattern(candles: Candle[], direction: SignalDirection): string | null {
    if (candles.length < 2) {
      return null;
    }

    const current = candles[candles.length - INTEGER_MULTIPLIERS.ONE];
    const previous = candles[candles.length - INTEGER_MULTIPLIERS.TWO];

    // Engulfing: current candle completely contains previous
    if (
      direction === SignalDirection.LONG &&
      current.open < previous.low &&
      current.close > previous.high
    ) {
      return 'engulfing_bullish';
    }
    if (
      direction === SignalDirection.SHORT &&
      current.open > previous.high &&
      current.close < previous.low
    ) {
      return 'engulfing_bearish';
    }

    // Pin bar: small body with long wick opposite to direction
    const bodySize = Math.abs(current.close - current.open);
    const totalRange = current.high - current.low;
    const bodyRatio = bodySize / totalRange;

    if (direction === SignalDirection.LONG && bodyRatio < this.config.pinBarBodyRatioThreshold) {
      const lowerWick = current.open - current.low;
      if (lowerWick > totalRange * this.config.wickRatioThreshold) {
        return 'pin_bar_bullish';
      }
    }
    if (direction === SignalDirection.SHORT && bodyRatio < this.config.pinBarBodyRatioThreshold) {
      const upperWick = current.high - current.open;
      if (upperWick > totalRange * this.config.wickRatioThreshold) {
        return 'pin_bar_bearish';
      }
    }

    // Hammer/Hanging Man: small body with long lower wick
    if (bodyRatio < this.config.pinBarBodyRatioThreshold && (current.open - current.low) > totalRange * this.config.wickRatioThreshold) {
      return direction === SignalDirection.LONG ? 'hammer' : 'hanging_man';
    }

    return null;
  }

  /**
   * Check if 1m structure aligns with direction
   * LONG: should not have bearish structure
   * SHORT: should not have bullish structure
   */
  private isStructureAligned(candles: Candle[], direction: SignalDirection): boolean {
    try {
      // For now, just check if we have enough data
      // Full structure analysis would require MarketStructureAnalyzer
      if (candles.length < 5) {
        return true; // Not enough data to conflict
      }

      // Check basic price action alignment
      const lastFive = candles.slice(-INTEGER_MULTIPLIERS.FIVE);
      const highs = lastFive.map(c => c.high);
      const lows = lastFive.map(c => c.low);

      const currentHigh = highs[highs.length - 1];
      const currentLow = lows[lows.length - 1];
      const prevHigh = Math.max(...highs.slice(0, -1));
      const prevLow = Math.min(...lows.slice(0, -1));

      // LONG: recent high should not break previous lows
      if (direction === SignalDirection.LONG) {
        return currentLow >= prevLow * this.config.structureAlignmentMargin;
      }

      // SHORT: recent low should not break previous highs
      if (direction === SignalDirection.SHORT) {
        return currentHigh <= prevHigh * (2 - this.config.structureAlignmentMargin);
      }

      return true;
    } catch (error) {
      this.logger.debug('Structure alignment check failed', { error });
      return true; // Default to true on error
    }
  }

  /**
   * Check volatility - ensure market is not sideways
   * Sideways = ranges too small (< 50% of average)
   */
  private checkVolatility(candles: Candle[]): boolean {
    const ranges = candles.map(c => c.high - c.low);
    const avgRange = ranges.reduce((a, b) => a + b) / ranges.length;
    const lastRange = ranges[ranges.length - 1];

    // Last bar must have at least config ratio of average range
    const hasVolatility = lastRange >= avgRange * this.config.volatilityCheckRatio;

    if (!hasVolatility) {
      this.logger.debug('Low volatility detected', {
        lastRange: formatPrice(lastRange),
        avgRange: formatPrice(avgRange),
        ratio: formatPrice(lastRange / avgRange) + 'x',
        threshold: formatPrice(this.config.volatilityCheckRatio)
      });
    }

    return hasVolatility;
  }

  /**
   * Check if current candle has strong body (>= config)
   * Strong reversal candles have large bodies
   */
  private isStrongCandleBody(candle: Candle): boolean {
    const bodySize = Math.abs(candle.close - candle.open);
    const totalRange = candle.high - candle.low;

    if (totalRange === 0) {
      return false;
    }

    const bodyRatio = bodySize / totalRange;
    return bodyRatio >= this.config.strongCandleBodyRatio;
  }
}
