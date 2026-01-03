import { DECIMAL_PLACES, MULTIPLIERS, PERCENTAGE_THRESHOLDS, INTEGER_MULTIPLIERS } from '../constants';
import { ENGULFING_CONFIDENCE_BONUS_PER_RATIO } from '../constants/technical.constants';
/**
 * Engulfing Pattern Detector
 *
 * Detects bullish and bearish engulfing candlestick patterns.
 * These are strong reversal signals when a candle's body completely
 * engulfs the previous candle's body.
 *
 * Bullish Engulfing:
 *  |░|     Red (bearish) candle
 * |▓▓▓|    Green (bullish) candle ENGULFS red → LONG signal
 *
 * Bearish Engulfing:
 *  |▓|     Green (bullish) candle
 * |░░░|    Red (bearish) candle ENGULFS green → SHORT signal
 */

import { Candle, LoggerService } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export enum EngulfingPatternType {
  BULLISH_ENGULFING = 'BULLISH_ENGULFING',
  BEARISH_ENGULFING = 'BEARISH_ENGULFING',
  NONE = 'NONE',
}

export interface EngulfingPattern {
  detected: boolean;
  type: EngulfingPatternType;
  direction: 'LONG' | 'SHORT';
  confidence: number; // 0-100%
  engulfingRatio: number; // How much bigger current body is (1.0 = same, 2.0 = 2x)
  prevCandle: Candle;
  currentCandle: Candle;
  explanation: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BASE_CONFIDENCE = PERCENTAGE_THRESHOLDS.VERY_HIGH; // Base confidence for detected pattern
const MIN_ENGULFING_RATIO = MULTIPLIERS.NEUTRAL; // Current body must be at least same size as prev

// ============================================================================
// ENGULFING PATTERN DETECTOR
// ============================================================================

export class EngulfingPatternDetector {
  constructor(private logger: LoggerService) {}

  /**
   * Detect engulfing pattern from last 2 candles
   * @param candles - Array of candles (minimum 2 required)
   * @returns EngulfingPattern result
   */
  detect(candles: Candle[]): EngulfingPattern {
    if (candles.length < 2) {
      return this.noPattern('Not enough candles (need 2)');
    }

    const prevCandle = candles[candles.length - INTEGER_MULTIPLIERS.TWO];
    const currentCandle = candles[candles.length - INTEGER_MULTIPLIERS.ONE];

    // Try bullish engulfing
    const bullishEngulfing = this.detectBullishEngulfing(prevCandle, currentCandle);
    if (bullishEngulfing.detected) {
      return bullishEngulfing;
    }

    // Try bearish engulfing
    const bearishEngulfing = this.detectBearishEngulfing(prevCandle, currentCandle);
    if (bearishEngulfing.detected) {
      return bearishEngulfing;
    }

    return this.noPattern('No engulfing pattern detected');
  }

  /**
   * Detect Bullish Engulfing
   * Previous candle: bearish (close < open)
   * Current candle: bullish (close > open) and ENGULFS previous
   */
  private detectBullishEngulfing(prev: Candle, current: Candle): EngulfingPattern {
    // 1. Check previous candle is bearish
    const prevIsBearish = prev.close < prev.open;
    if (!prevIsBearish) {
      return this.noPattern('Previous candle not bearish');
    }

    // 2. Check current candle is bullish
    const currentIsBullish = current.close > current.open;
    if (!currentIsBullish) {
      return this.noPattern('Current candle not bullish');
    }

    // 3. Check engulfing: current body engulfs previous body
    const prevBody = Math.abs(prev.close - prev.open);
    const currentBody = Math.abs(current.close - current.open);

    // Current open should be at or below previous close
    // Current close should be at or above previous open
    const engulfs = current.open <= prev.close && current.close >= prev.open;

    if (!engulfs) {
      return this.noPattern('Current candle does not engulf previous');
    }

    // 4. Calculate engulfing ratio
    const engulfingRatio = currentBody / prevBody;
    if (engulfingRatio < MIN_ENGULFING_RATIO) {
      return this.noPattern(`Engulfing ratio too small: ${engulfingRatio.toFixed(DECIMAL_PLACES.PERCENT)}`);
    }

    // 5. Calculate confidence based on engulfing ratio
    const confidence = this.calculateConfidence(engulfingRatio);

    return {
      detected: true,
      type: EngulfingPatternType.BULLISH_ENGULFING,
      direction: 'LONG',
      confidence,
      engulfingRatio,
      prevCandle: prev,
      currentCandle: current,
      explanation: `Bullish Engulfing: ${engulfingRatio.toFixed(DECIMAL_PLACES.PERCENT)}x bigger, confidence ${confidence.toFixed(0)}%`,
    };
  }

  /**
   * Detect Bearish Engulfing
   * Previous candle: bullish (close > open)
   * Current candle: bearish (close < open) and ENGULFS previous
   */
  private detectBearishEngulfing(prev: Candle, current: Candle): EngulfingPattern {
    // 1. Check previous candle is bullish
    const prevIsBullish = prev.close > prev.open;
    if (!prevIsBullish) {
      return this.noPattern('Previous candle not bullish');
    }

    // 2. Check current candle is bearish
    const currentIsBearish = current.close < current.open;
    if (!currentIsBearish) {
      return this.noPattern('Current candle not bearish');
    }

    // 3. Check engulfing: current body engulfs previous body
    const prevBody = Math.abs(prev.close - prev.open);
    const currentBody = Math.abs(current.close - current.open);

    // Current open should be at or above previous close
    // Current close should be at or below previous open
    const engulfs = current.open >= prev.close && current.close <= prev.open;

    if (!engulfs) {
      return this.noPattern('Current candle does not engulf previous');
    }

    // 4. Calculate engulfing ratio
    const engulfingRatio = currentBody / prevBody;
    if (engulfingRatio < MIN_ENGULFING_RATIO) {
      return this.noPattern(`Engulfing ratio too small: ${engulfingRatio.toFixed(DECIMAL_PLACES.PERCENT)}`);
    }

    // 5. Calculate confidence based on engulfing ratio
    const confidence = this.calculateConfidence(engulfingRatio);

    return {
      detected: true,
      type: EngulfingPatternType.BEARISH_ENGULFING,
      direction: 'SHORT',
      confidence,
      engulfingRatio,
      prevCandle: prev,
      currentCandle: current,
      explanation: `Bearish Engulfing: ${engulfingRatio.toFixed(DECIMAL_PLACES.PERCENT)}x bigger, confidence ${confidence.toFixed(0)}%`,
    };
  }

  /**
   * Calculate confidence based on engulfing ratio
   * Bigger engulfing = higher confidence
   */
  private calculateConfidence(engulfingRatio: number): number {
    // Base confidence: 60%
    let confidence = BASE_CONFIDENCE;

    // Bonus for larger engulfing
    // 1.5x = +10%, 2.0x = +20%, 3.0x = +40%
    const bonus = (engulfingRatio - 1.0) * ENGULFING_CONFIDENCE_BONUS_PER_RATIO;
    confidence += bonus;

    // Cap at 100%
    return Math.min(INTEGER_MULTIPLIERS.ONE_HUNDRED, confidence);
  }

  /**
   * Return no pattern result
   */
  private noPattern(reason: string): EngulfingPattern {
    return {
      detected: false,
      type: EngulfingPatternType.NONE,
      direction: 'LONG',
      confidence: 0,
      engulfingRatio: 0,
      prevCandle: {} as Candle,
      currentCandle: {} as Candle,
      explanation: reason,
    };
  }
}
