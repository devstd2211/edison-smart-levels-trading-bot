import {
  PERCENTAGE_THRESHOLDS,
  TIME_UNITS,
  INTEGER_MULTIPLIERS,
  RATIO_MULTIPLIERS,
  THRESHOLD_VALUES,
  FIRST_INDEX,
  MATH_BOUNDS,
  PATTERN_GEOMETRY_THRESHOLDS,
} from '../constants';
/**
 * Triangle Pattern Detector
 *
 * Detects triangle continuation patterns (Ascending, Descending, Symmetrical).
 * These are consolidation patterns that typically continue the previous trend.
 *
 * Ascending Triangle (Bullish):
 *     __________ Flat resistance
 *    /  /  /  /
 *   /  /  /  /   Rising support
 *  /  /  /  /    → LONG on breakout
 *
 * Descending Triangle (Bearish):
 *  \  \  \  \   Falling resistance
 *   \  \  \  \
 *    \__\__\__\ Flat support
 *              → SHORT on breakout
 *
 * Symmetrical Triangle (Continuation):
 *      /\
 *     /  \      Both lines converging
 *    /    \     → Breakout direction = trend direction
 *   /      \
 */

import { SwingPoint, SwingPointType, LoggerService, AnalysisConfig } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export enum TrianglePatternType {
  ASCENDING = 'ASCENDING_TRIANGLE',
  DESCENDING = 'DESCENDING_TRIANGLE',
  SYMMETRICAL = 'SYMMETRICAL_TRIANGLE',
  NONE = 'NONE',
}

export interface TrianglePattern {
  detected: boolean;
  type: TrianglePatternType;
  direction: 'LONG' | 'SHORT';
  confidence: number; // 0-100%
  apex: number; // Price at apex (where lines would meet)
  target: number; // Breakout target
  stopLoss: number; // Stop loss level
  resistanceLine: { slope: number; highs: SwingPoint[] };
  supportLine: { slope: number; lows: SwingPoint[] };
  explanation: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_TOUCHES = PATTERN_GEOMETRY_THRESHOLDS.MIN_TOUCHES; // Minimum touches per trendline
const FLAT_SLOPE_THRESHOLD = PATTERN_GEOMETRY_THRESHOLDS.FLAT_SLOPE; // Slope considered "flat"
const CONVERGENCE_THRESHOLD = PATTERN_GEOMETRY_THRESHOLDS.CONVERGENCE; // Minimum convergence required

// ============================================================================
// TRIANGLE PATTERN DETECTOR
// ============================================================================

export class TrianglePatternDetector {
  private readonly baseConfidence: number;
  private readonly minPatternBars: number;
  private readonly maxPatternBars: number;
  private readonly recentLookback: number;

  constructor(
    private logger: LoggerService,
    config?: any,
  ) {
    // Load from DI config - these are strategic values that should come from config.json
    this.baseConfidence = config?.baseConfidence ?? (INTEGER_MULTIPLIERS.SIXTY_FIVE as number);
    this.minPatternBars = config?.minPatternBars ?? (INTEGER_MULTIPLIERS.THIRTY as number);
    this.maxPatternBars = config?.maxPatternBars ?? (INTEGER_MULTIPLIERS.TWO_HUNDRED as number);
    this.recentLookback = config?.recentLookback ?? (INTEGER_MULTIPLIERS.TWELVE as number);
  }

  /**
   * Detect triangle pattern from swing points
   */
  detect(swingPoints: SwingPoint[], currentTrend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL'): TrianglePattern {
    if (swingPoints.length < (INTEGER_MULTIPLIERS.SIX as number)) {
      return this.noPattern('Not enough swing points (need 6+)');
    }

    const recent = swingPoints.slice(-this.recentLookback);

    // Separate highs and lows
    const highs = recent.filter(p => p.type === SwingPointType.HIGH);
    const lows = recent.filter(p => p.type === SwingPointType.LOW);

    if (highs.length < MIN_TOUCHES || lows.length < MIN_TOUCHES) {
      return this.noPattern('Not enough highs/lows for trendlines');
    }

    // Calculate trendlines
    const resistanceLine = this.calculateTrendline(highs);
    const supportLine = this.calculateTrendline(lows);

    // Check pattern timespan
    const firstPoint = recent[FIRST_INDEX];
    const lastPoint = recent[recent.length - (RATIO_MULTIPLIERS.FULL as number)];
    const patternMinutes = (lastPoint.timestamp - firstPoint.timestamp) / TIME_UNITS.MINUTE;

    if (patternMinutes < this.minPatternBars || patternMinutes > this.maxPatternBars) {
      return this.noPattern('Pattern timespan invalid');
    }

    // Determine triangle type based on slopes
    const resistanceFlat = Math.abs(resistanceLine.slope) < FLAT_SLOPE_THRESHOLD;
    const supportFlat = Math.abs(supportLine.slope) < FLAT_SLOPE_THRESHOLD;
    const converging = resistanceLine.slope - supportLine.slope < -CONVERGENCE_THRESHOLD;

    // Ascending Triangle: flat resistance + rising support
    if (resistanceFlat && supportLine.slope > MATH_BOUNDS.MIN_PERCENTAGE && converging) {
      return this.buildPattern(
        TrianglePatternType.ASCENDING,
        'LONG',
        resistanceLine,
        supportLine,
        highs,
        lows,
        currentTrend,
      );
    }

    // Descending Triangle: falling resistance + flat support
    if (supportFlat && resistanceLine.slope < MATH_BOUNDS.MIN_PERCENTAGE && converging) {
      return this.buildPattern(
        TrianglePatternType.DESCENDING,
        'SHORT',
        resistanceLine,
        supportLine,
        highs,
        lows,
        currentTrend,
      );
    }

    // Symmetrical Triangle: both converging
    if (converging && !resistanceFlat && !supportFlat && resistanceLine.slope < MATH_BOUNDS.MIN_PERCENTAGE && supportLine.slope > MATH_BOUNDS.MIN_PERCENTAGE) {
      // Direction depends on trend
      const direction = currentTrend === 'BULLISH' ? 'LONG' : currentTrend === 'BEARISH' ? 'SHORT' : 'LONG';
      return this.buildPattern(
        TrianglePatternType.SYMMETRICAL,
        direction,
        resistanceLine,
        supportLine,
        highs,
        lows,
        currentTrend,
      );
    }

    return this.noPattern('No valid triangle pattern');
  }

  /**
   * Calculate trendline using linear regression
   */
  private calculateTrendline(points: SwingPoint[]): { slope: number; intercept: number } {
    const n = points.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    // Use timestamp as X, price as Y
    const baseTime = points[FIRST_INDEX].timestamp;

    for (const point of points) {
      const x = (point.timestamp - baseTime) / TIME_UNITS.MINUTE; // Minutes from start
      const y = point.price;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  /**
   * Build triangle pattern result
   */
  private buildPattern(
    type: TrianglePatternType,
    direction: 'LONG' | 'SHORT',
    resistanceLine: { slope: number; intercept: number },
    supportLine: { slope: number; intercept: number },
    highs: SwingPoint[],
    lows: SwingPoint[],
    currentTrend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
  ): TrianglePattern {
    // Calculate apex (where lines meet)
    const latestHigh = highs[highs.length - (RATIO_MULTIPLIERS.FULL as number)];
    const latestLow = lows[lows.length - (RATIO_MULTIPLIERS.FULL as number)];
    const currentPrice = (latestHigh.price + latestLow.price) / (INTEGER_MULTIPLIERS.TWO as number);

    // Triangle height (widest part)
    const firstHigh = highs[FIRST_INDEX].price;
    const firstLow = lows[FIRST_INDEX].price;
    const triangleHeight = firstHigh - firstLow;

    // Target: project triangle height from breakout
    const target = direction === 'LONG'
      ? currentPrice + triangleHeight
      : currentPrice - triangleHeight;

    // Stop loss: opposite side of triangle
    const stopLoss = direction === 'LONG'
      ? latestLow.price - triangleHeight * THRESHOLD_VALUES.FIFTEEN_PERCENT
      : latestHigh.price + triangleHeight * THRESHOLD_VALUES.FIFTEEN_PERCENT;

    // Calculate confidence
    let confidence = this.baseConfidence;

    // Bonus for trend alignment
    if (type === TrianglePatternType.ASCENDING && currentTrend === 'BULLISH') {
      confidence += THRESHOLD_VALUES.FIFTEEN_PERCENT * (MATH_BOUNDS.MAX_PERCENTAGE as number);
    } else if (type === TrianglePatternType.DESCENDING && currentTrend === 'BEARISH') {
      confidence += THRESHOLD_VALUES.FIFTEEN_PERCENT * (MATH_BOUNDS.MAX_PERCENTAGE as number);
    } else if (type === TrianglePatternType.SYMMETRICAL) {
      confidence += THRESHOLD_VALUES.TEN_PERCENT * (MATH_BOUNDS.MAX_PERCENTAGE as number); // Symmetrical is more neutral
    }

    // Bonus for more touches
    const totalTouches = highs.length + lows.length;
    if (totalTouches >= (INTEGER_MULTIPLIERS.SIX as number)) {
      confidence += THRESHOLD_VALUES.TEN_PERCENT * (MATH_BOUNDS.MAX_PERCENTAGE as number);
    }

    return {
      detected: true,
      type,
      direction,
      confidence: Math.min(MATH_BOUNDS.MAX_PERCENTAGE, confidence),
      apex: currentPrice,
      target,
      stopLoss,
      resistanceLine: { slope: resistanceLine.slope, highs },
      supportLine: { slope: supportLine.slope, lows },
      explanation: `${type}: ${highs.length} highs, ${lows.length} lows, ${totalTouches} touches`,
    };
  }

  /**
   * Return no pattern result
   */
  private noPattern(reason: string): TrianglePattern {
    return {
      detected: false,
      type: TrianglePatternType.NONE,
      direction: 'LONG',
      confidence: MATH_BOUNDS.MIN_PERCENTAGE,
      apex: MATH_BOUNDS.MIN_PERCENTAGE,
      target: MATH_BOUNDS.MIN_PERCENTAGE,
      stopLoss: MATH_BOUNDS.MIN_PERCENTAGE,
      resistanceLine: { slope: MATH_BOUNDS.MIN_PERCENTAGE, highs: [] },
      supportLine: { slope: MATH_BOUNDS.MIN_PERCENTAGE, lows: [] },
      explanation: reason,
    };
  }
}
