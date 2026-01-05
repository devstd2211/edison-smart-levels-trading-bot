import { CONFIDENCE_THRESHOLDS, DECIMAL_PLACES, PERCENT_MULTIPLIER, PERCENTAGE_THRESHOLDS, TIME_UNITS } from '../constants';
import {
  INTEGER_MULTIPLIERS,
  FIRST_INDEX,
  SECOND_INDEX,
  THIRD_INDEX,
  TRIPLE_PATTERN_TOLERANCE_PERCENT,
  TRIPLE_PATTERN_SL_MULTIPLIER,
  TRIPLE_PATTERN_CONFIDENCE_BONUS,
  TRIPLE_PATTERN_MAX_BARS,
} from '../constants/technical.constants';
/**
 * Triple Top/Bottom Pattern Detector
 *
 * Detects triple top (bearish) and triple bottom (bullish) reversal patterns.
 * These are stronger reversal signals than double patterns - 3 failed attempts
 * to break a level indicates strong resistance/support.
 *
 * Triple Top:
 *  Peak1  Peak2  Peak3
 *    |     |     |      → 3 peaks at same level
 *    |_____|_____|      → break neckline = SHORT
 *
 * Triple Bottom:
 *     ______               ← Neckline
 *    /  |  \
 * Bot1 Bot2 Bot3          → 3 bottoms at same level = LONG
 */

import { SwingPoint, SwingPointType, LoggerService } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export enum TriplePatternType {
  TRIPLE_TOP = 'TRIPLE_TOP',
  TRIPLE_BOTTOM = 'TRIPLE_BOTTOM',
  NONE = 'NONE',
}

export interface TriplePattern {
  detected: boolean;
  type: TriplePatternType;
  direction: 'LONG' | 'SHORT';
  confidence: number; // 0-100%
  neckline: number;
  target: number;
  stopLoss: number;
  points: SwingPoint[]; // 5 points: peak1, valley1, peak2, valley2, peak3
  explanation: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RECENT_LOOKBACK_DEFAULT = INTEGER_MULTIPLIERS.TEN as number; // Look at last 10 swing points

// ============================================================================
// TRIPLE PATTERN DETECTOR
// ============================================================================

export class TriplePatternDetector {
  private readonly baseConfidence: number;
  private readonly peakTolerancePercent: number;
  private readonly minPatternBars: number;
  private readonly maxPatternBars: number;
  private readonly stopLossMultiplier: number;
  private readonly confidenceBonusFactor: number;
  private readonly confidencePerPoint: number;
  private readonly recentLookback: number;

  constructor(
    private logger: LoggerService,
    config?: any,
  ) {
    // Use config values or defaults
    this.baseConfidence = config?.baseConfidence ?? (CONFIDENCE_THRESHOLDS.MODERATE as number) ?? 65;
    this.peakTolerancePercent = config?.peakTolerancePercent ?? TRIPLE_PATTERN_TOLERANCE_PERCENT;
    this.minPatternBars = config?.minPatternBars ?? (PERCENTAGE_THRESHOLDS.LOW_MODERATE as number) ?? 40;
    this.maxPatternBars = config?.maxPatternBars ?? TRIPLE_PATTERN_MAX_BARS;
    this.stopLossMultiplier = config?.stopLossMultiplier ?? TRIPLE_PATTERN_SL_MULTIPLIER;
    this.confidenceBonusFactor = config?.confidenceBonusFactor ?? TRIPLE_PATTERN_CONFIDENCE_BONUS;
    this.confidencePerPoint = config?.confidencePerPoint ?? (INTEGER_MULTIPLIERS.FIVE as number) ?? 5;
    this.recentLookback = config?.recentLookback ?? RECENT_LOOKBACK_DEFAULT;
  }

  /**
   * Detect triple pattern from swing points
   * @param swingPoints - Array of swing points (minimum 5 required)
   * @returns TriplePattern result
   */
  detect(swingPoints: SwingPoint[]): TriplePattern {
    if (swingPoints.length < (INTEGER_MULTIPLIERS.FIVE as number)) {
      return this.noPattern('Not enough swing points (need 5+)');
    }

    // Try triple top
    const tripleTop = this.detectTripleTop(swingPoints);
    if (tripleTop.detected) {
      return tripleTop;
    }

    // Try triple bottom
    const tripleBottom = this.detectTripleBottom(swingPoints);
    if (tripleBottom.detected) {
      return tripleBottom;
    }

    return this.noPattern('No triple pattern detected');
  }

  /**
   * Detect Triple Top pattern
   * Structure: HIGH, LOW, HIGH, LOW, HIGH
   * All 3 HIGHs should be at approximately same level (±3%)
   */
  private detectTripleTop(swingPoints: SwingPoint[]): TriplePattern {
    const recent = swingPoints.slice(-this.recentLookback);

    // Search for pattern: HIGH, LOW, HIGH, LOW, HIGH
    for (let i = (FIRST_INDEX as number); i <= recent.length - (INTEGER_MULTIPLIERS.FIVE as number); i++) {
      const peak1 = recent[i];
      const valley1 = recent[i + (SECOND_INDEX as number)];
      const peak2 = recent[i + (THIRD_INDEX as number)];
      const valley2 = recent[i + (INTEGER_MULTIPLIERS.THREE as number)];
      const peak3 = recent[i + (INTEGER_MULTIPLIERS.FOUR as number)];

      // Validate structure: HIGH -> LOW -> HIGH -> LOW -> HIGH
      if (
        peak1.type !== SwingPointType.HIGH ||
        valley1.type !== SwingPointType.LOW ||
        peak2.type !== SwingPointType.HIGH ||
        valley2.type !== SwingPointType.LOW ||
        peak3.type !== SwingPointType.HIGH
      ) {
        continue;
      }

      // Validate: all 3 peaks at approximately same level (±3%)
      const avgPeak = (peak1.price + peak2.price + peak3.price) / (INTEGER_MULTIPLIERS.THREE as number);
      const peak1Diff = Math.abs((peak1.price - avgPeak) / avgPeak) * PERCENT_MULTIPLIER;
      const peak2Diff = Math.abs((peak2.price - avgPeak) / avgPeak) * PERCENT_MULTIPLIER;
      const peak3Diff = Math.abs((peak3.price - avgPeak) / avgPeak) * PERCENT_MULTIPLIER;

      if (
        peak1Diff > this.peakTolerancePercent ||
        peak2Diff > this.peakTolerancePercent ||
        peak3Diff > this.peakTolerancePercent
      ) {
        continue; // Peaks too different
      }

      // Validate: valleys should be lower than peaks
      if (valley1.price >= peak1.price || valley2.price >= peak2.price) {
        continue;
      }

      // Check pattern timespan
      const patternMinutes = (peak3.timestamp - peak1.timestamp) / TIME_UNITS.MINUTE;
      if (patternMinutes < this.minPatternBars || patternMinutes > this.maxPatternBars) {
        continue; // Pattern too short or too long
      }

      // Calculate pattern metrics
      const neckline = (valley1.price + valley2.price) / (INTEGER_MULTIPLIERS.TWO as number);
      const patternHeight = avgPeak - neckline;
      const target = neckline - patternHeight; // Project downward
      const stopLoss = avgPeak + patternHeight * this.stopLossMultiplier; // 15% above peaks

      // Calculate confidence
      const maxDiff = Math.max(peak1Diff, peak2Diff, peak3Diff);
      const confidence = this.baseConfidence + (this.confidenceBonusFactor - maxDiff) * this.confidencePerPoint; // Bonus for closer peaks

      return {
        detected: true,
        type: TriplePatternType.TRIPLE_TOP,
        direction: 'SHORT',
        confidence: Math.min(PERCENT_MULTIPLIER as number, confidence),
        neckline,
        target,
        stopLoss,
        points: [peak1, valley1, peak2, valley2, peak3],
        explanation: `Triple Top: peaks ${peak1.price.toFixed(DECIMAL_PLACES.PRICE)}/${peak2.price.toFixed(DECIMAL_PLACES.PRICE)}/${peak3.price.toFixed(DECIMAL_PLACES.PRICE)}, neckline ${neckline.toFixed(DECIMAL_PLACES.PRICE)}`,
      };
    }

    return this.noPattern('No valid Triple Top pattern');
  }

  /**
   * Detect Triple Bottom pattern
   * Structure: LOW, HIGH, LOW, HIGH, LOW
   * All 3 LOWs should be at approximately same level (±3%)
   */
  private detectTripleBottom(swingPoints: SwingPoint[]): TriplePattern {
    const recent = swingPoints.slice(-this.recentLookback);

    // Search for pattern: LOW, HIGH, LOW, HIGH, LOW
    for (let i = (FIRST_INDEX as number); i <= recent.length - (INTEGER_MULTIPLIERS.FIVE as number); i++) {
      const bottom1 = recent[i];
      const peak1 = recent[i + (SECOND_INDEX as number)];
      const bottom2 = recent[i + (THIRD_INDEX as number)];
      const peak2 = recent[i + (INTEGER_MULTIPLIERS.THREE as number)];
      const bottom3 = recent[i + (INTEGER_MULTIPLIERS.FOUR as number)];

      // Validate structure: LOW -> HIGH -> LOW -> HIGH -> LOW
      if (
        bottom1.type !== SwingPointType.LOW ||
        peak1.type !== SwingPointType.HIGH ||
        bottom2.type !== SwingPointType.LOW ||
        peak2.type !== SwingPointType.HIGH ||
        bottom3.type !== SwingPointType.LOW
      ) {
        continue;
      }

      // Validate: all 3 bottoms at approximately same level (±3%)
      const avgBottom = (bottom1.price + bottom2.price + bottom3.price) / (INTEGER_MULTIPLIERS.THREE as number);
      const bottom1Diff = Math.abs((bottom1.price - avgBottom) / avgBottom) * PERCENT_MULTIPLIER;
      const bottom2Diff = Math.abs((bottom2.price - avgBottom) / avgBottom) * PERCENT_MULTIPLIER;
      const bottom3Diff = Math.abs((bottom3.price - avgBottom) / avgBottom) * PERCENT_MULTIPLIER;

      if (
        bottom1Diff > this.peakTolerancePercent ||
        bottom2Diff > this.peakTolerancePercent ||
        bottom3Diff > this.peakTolerancePercent
      ) {
        continue; // Bottoms too different
      }

      // Validate: peaks should be higher than bottoms
      if (peak1.price <= bottom1.price || peak2.price <= bottom2.price) {
        continue;
      }

      // Check pattern timespan
      const patternMinutes = (bottom3.timestamp - bottom1.timestamp) / TIME_UNITS.MINUTE;
      if (patternMinutes < this.minPatternBars || patternMinutes > this.maxPatternBars) {
        continue;
      }

      // Calculate pattern metrics
      const neckline = (peak1.price + peak2.price) / (INTEGER_MULTIPLIERS.TWO as number);
      const patternHeight = neckline - avgBottom;
      const target = neckline + patternHeight; // Project upward
      const stopLoss = avgBottom - patternHeight * this.stopLossMultiplier; // 15% below bottoms

      // Calculate confidence
      const maxDiff = Math.max(bottom1Diff, bottom2Diff, bottom3Diff);
      const confidence = this.baseConfidence + (this.confidenceBonusFactor - maxDiff) * this.confidencePerPoint;

      return {
        detected: true,
        type: TriplePatternType.TRIPLE_BOTTOM,
        direction: 'LONG',
        confidence: Math.min(PERCENT_MULTIPLIER as number, confidence),
        neckline,
        target,
        stopLoss,
        points: [bottom1, peak1, bottom2, peak2, bottom3],
        explanation: `Triple Bottom: bottoms ${bottom1.price.toFixed(DECIMAL_PLACES.PRICE)}/${bottom2.price.toFixed(DECIMAL_PLACES.PRICE)}/${bottom3.price.toFixed(DECIMAL_PLACES.PRICE)}, neckline ${neckline.toFixed(DECIMAL_PLACES.PRICE)}`,
      };
    }

    return this.noPattern('No valid Triple Bottom pattern');
  }

  /**
   * Return no pattern result
   */
  private noPattern(reason: string): TriplePattern {
    return {
      detected: false,
      type: TriplePatternType.NONE,
      direction: 'LONG',
      confidence: FIRST_INDEX as number,
      neckline: FIRST_INDEX as number,
      target: FIRST_INDEX as number,
      stopLoss: FIRST_INDEX as number,
      points: [],
      explanation: reason,
    };
  }
}
