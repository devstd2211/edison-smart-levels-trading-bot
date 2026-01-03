import {
  PERCENT_MULTIPLIER,
  INTEGER_MULTIPLIERS,
  RATIO_MULTIPLIERS,
  MATH_BOUNDS,
  NEGATIVE_MARKERS,
  DIVERGENCE_THRESHOLDS,
} from '../constants';
/**
 * Divergence Detector
 *
 * Detects divergences between price action and RSI indicator.
 * Divergences are powerful reversal signals used by professional traders.
 *
 * Types of divergences:
 * - BULLISH: Price makes lower low, RSI makes higher low → Potential reversal UP
 * - BEARISH: Price makes higher high, RSI makes lower high → Potential reversal DOWN
 *
 * Based on classical technical analysis and momentum theory.
 */

import { SwingPoint, SwingPointType, LoggerService } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export enum DivergenceType {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NONE = 'NONE',
}

/**
 * Divergence between price and RSI
 */
export interface Divergence {
  type: DivergenceType;           // BULLISH, BEARISH, or NONE
  strength: number;               // 0-1 (confidence in divergence)
  pricePoints: [number, number];  // [old price, new price]
  rsiPoints: [number, number];    // [old RSI, new RSI]
  timePoints: [number, number];   // [old timestamp, new timestamp]
}

/**
 * RSI value with timestamp
 */
export interface RSIPoint {
  value: number;
  timestamp: number;
}

/**
 * Configuration for divergence detection (strategic thresholds)
 */
export interface DivergenceDetectorConfig {
  /** Minimum divergence strength to report (0-1 range) - STRATEGIC */
  minStrength: number;
  /** Minimum price difference percentage for divergence - STRATEGIC */
  priceDiffPercent: number;
}

// ============================================================================
// DIVERGENCE DETECTOR
// ============================================================================

export class DivergenceDetector {
  constructor(private logger: LoggerService, private config: DivergenceDetectorConfig) {}

  /**
   * Detect divergence from swing points and RSI values
   */
  detect(
    swingPoints: SwingPoint[],
    rsiValues: Map<number, number>, // timestamp -> RSI value
  ): Divergence {
    if (swingPoints.length < (INTEGER_MULTIPLIERS.TWO as number)) {
      return this.noDivergence();
    }

    // Get last two swing highs (for bearish divergence)
    const lastTwoHighs = swingPoints
      .filter(p => p.type === SwingPointType.HIGH)
      .slice(NEGATIVE_MARKERS.MINUS_TWO);

    // Get last two swing lows (for bullish divergence)
    const lastTwoLows = swingPoints
      .filter(p => p.type === SwingPointType.LOW)
      .slice(NEGATIVE_MARKERS.MINUS_TWO);

    // Check for bearish divergence (price HH, RSI LH)
    if (lastTwoHighs.length === (INTEGER_MULTIPLIERS.TWO as number)) {
      const bearish = this.checkBearishDivergence(lastTwoHighs, rsiValues);
      if (bearish.type !== DivergenceType.NONE) {
        this.logger.debug('Bearish divergence detected', {
          strength: bearish.strength,
          pricePoints: bearish.pricePoints,
          rsiPoints: bearish.rsiPoints,
        });
        return bearish;
      }
    }

    // Check for bullish divergence (price LL, RSI HL)
    if (lastTwoLows.length === (INTEGER_MULTIPLIERS.TWO as number)) {
      const bullish = this.checkBullishDivergence(lastTwoLows, rsiValues);
      if (bullish.type !== DivergenceType.NONE) {
        this.logger.debug('Bullish divergence detected', {
          strength: bullish.strength,
          pricePoints: bullish.pricePoints,
          rsiPoints: bullish.rsiPoints,
        });
        return bullish;
      }
    }

    return this.noDivergence();
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Check for bearish divergence (price HH, RSI LH)
   */
  private checkBearishDivergence(
    swingHighs: SwingPoint[],
    rsiValues: Map<number, number>,
  ): Divergence {
    const [old, recent] = swingHighs;

    // Get RSI values at swing points
    const oldRSI = rsiValues.get(old.timestamp);
    const recentRSI = rsiValues.get(recent.timestamp);

    if (oldRSI === undefined || recentRSI === undefined) {
      return this.noDivergence();
    }

    // Check if time between points is not too large (TECHNICAL: 24 hours)
    if (recent.timestamp - old.timestamp > DIVERGENCE_THRESHOLDS.MAX_TIME_BETWEEN_MS) {
      return this.noDivergence();
    }

    // Bearish divergence: Price makes HH, RSI makes LH
    const priceIsHigher = recent.price > old.price;
    const rsiIsLower = recentRSI < oldRSI;

    if (priceIsHigher && rsiIsLower) {
      const priceDiff = Math.abs(recent.price - old.price) / old.price * PERCENT_MULTIPLIER;
      const rsiDiff = Math.abs(recentRSI - oldRSI);

      // Check if differences are significant (STRATEGIC config + TECHNICAL RSI unit)
      if (priceDiff >= this.config.priceDiffPercent && rsiDiff >= DIVERGENCE_THRESHOLDS.RSI_DIFF_POINTS) {
        const strength = this.calculateStrength(priceDiff, rsiDiff);

        if (strength >= this.config.minStrength) {
          return {
            type: DivergenceType.BEARISH,
            strength,
            pricePoints: [old.price, recent.price],
            rsiPoints: [oldRSI, recentRSI],
            timePoints: [old.timestamp, recent.timestamp],
          };
        }
      }
    }

    return this.noDivergence();
  }

  /**
   * Check for bullish divergence (price LL, RSI HL)
   */
  private checkBullishDivergence(
    swingLows: SwingPoint[],
    rsiValues: Map<number, number>,
  ): Divergence {
    const [old, recent] = swingLows;

    // Get RSI values at swing points
    const oldRSI = rsiValues.get(old.timestamp);
    const recentRSI = rsiValues.get(recent.timestamp);

    if (oldRSI === undefined || recentRSI === undefined) {
      return this.noDivergence();
    }

    // Check if time between points is not too large (TECHNICAL: 24 hours)
    if (recent.timestamp - old.timestamp > DIVERGENCE_THRESHOLDS.MAX_TIME_BETWEEN_MS) {
      return this.noDivergence();
    }

    // Bullish divergence: Price makes LL, RSI makes HL
    const priceIsLower = recent.price < old.price;
    const rsiIsHigher = recentRSI > oldRSI;

    if (priceIsLower && rsiIsHigher) {
      const priceDiff = Math.abs(recent.price - old.price) / old.price * PERCENT_MULTIPLIER;
      const rsiDiff = Math.abs(recentRSI - oldRSI);

      // Check if differences are significant (STRATEGIC config + TECHNICAL RSI unit)
      if (priceDiff >= this.config.priceDiffPercent && rsiDiff >= DIVERGENCE_THRESHOLDS.RSI_DIFF_POINTS) {
        const strength = this.calculateStrength(priceDiff, rsiDiff);

        if (strength >= this.config.minStrength) {
          return {
            type: DivergenceType.BULLISH,
            strength,
            pricePoints: [old.price, recent.price],
            rsiPoints: [oldRSI, recentRSI],
            timePoints: [old.timestamp, recent.timestamp],
          };
        }
      }
    }

    return this.noDivergence();
  }

  /**
   * Calculate divergence strength (0-1)
   */
  private calculateStrength(priceDiffPercent: number, rsiDiff: number): number {
    // Strength based on:
    // 1. Price difference (larger = stronger)
    // 2. RSI difference (larger = stronger)

    // Normalize price diff (0-5% range)
    const priceScore = Math.min(priceDiffPercent / (INTEGER_MULTIPLIERS.FIVE as number), RATIO_MULTIPLIERS.FULL);

    // Normalize RSI diff (0-20 points range)
    const rsiScore = Math.min(rsiDiff / (INTEGER_MULTIPLIERS.TWENTY as number), RATIO_MULTIPLIERS.FULL);

    // Average of both scores
    const strength = (priceScore + rsiScore) / (INTEGER_MULTIPLIERS.TWO as number);

    return Math.min(Math.max(strength, MATH_BOUNDS.MIN_PERCENTAGE), RATIO_MULTIPLIERS.FULL); // Clamp to 0-1
  }

  /**
   * Return "no divergence" result
   */
  private noDivergence(): Divergence {
    return {
      type: DivergenceType.NONE,
      strength: MATH_BOUNDS.MIN_PERCENTAGE,
      pricePoints: [MATH_BOUNDS.MIN_PERCENTAGE, MATH_BOUNDS.MIN_PERCENTAGE],
      rsiPoints: [MATH_BOUNDS.MIN_PERCENTAGE, MATH_BOUNDS.MIN_PERCENTAGE],
      timePoints: [MATH_BOUNDS.MIN_PERCENTAGE, MATH_BOUNDS.MIN_PERCENTAGE],
    };
  }
}
