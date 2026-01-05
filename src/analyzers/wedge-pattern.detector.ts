import { TIME_UNITS } from '../constants';
import {
  INTEGER_MULTIPLIERS,
  FIRST_INDEX,
  RATIO_MULTIPLIERS,
  PERCENT_MULTIPLIER,
  THRESHOLD_VALUES,
  PATTERN_GEOMETRY_THRESHOLDS,
} from '../constants/technical.constants';
/**
 * Wedge Pattern Detector
 *
 * Detects wedge reversal patterns (Rising Wedge, Falling Wedge).
 * Unlike triangles which are continuation patterns, wedges are REVERSAL patterns.
 *
 * Rising Wedge (Bearish Reversal):
 *    /|        Both lines rising
 *   / |        but converging
 *  /  |        → SHORT on break
 * /   |        Price exhaustion
 *
 * Falling Wedge (Bullish Reversal):
 * |\          Both lines falling
 * | \         but converging
 * |  \        → LONG on break
 * |   \       Selling exhaustion
 */

import { SwingPoint, SwingPointType, LoggerService } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export enum WedgePatternType {
  RISING = 'RISING_WEDGE',
  FALLING = 'FALLING_WEDGE',
  NONE = 'NONE',
}

export interface WedgePattern {
  detected: boolean;
  type: WedgePatternType;
  direction: 'LONG' | 'SHORT';
  confidence: number; // 0-100%
  apex: number; // Price at apex
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
const CONVERGENCE_THRESHOLD = PATTERN_GEOMETRY_THRESHOLDS.CONVERGENCE; // Minimum convergence required

// ============================================================================
// WEDGE PATTERN DETECTOR
// ============================================================================

export class WedgePatternDetector {
  private readonly baseConfidence: number;
  private readonly minPatternBars: number;
  private readonly maxPatternBars: number;
  private readonly recentLookback: number;
  private readonly exhaustionBonus: number;

  constructor(
    private logger: LoggerService,
    config?: any,
  ) {
    // Load from DI config - these are strategic values that should come from config.json
    this.baseConfidence = config?.baseConfidence ?? (INTEGER_MULTIPLIERS.SIXTY_FIVE as number);
    this.minPatternBars = config?.minPatternBars ?? (INTEGER_MULTIPLIERS.TWENTY_FIVE as number);
    this.maxPatternBars = config?.maxPatternBars ?? (INTEGER_MULTIPLIERS.ONE_HUNDRED_EIGHTY as number);
    this.recentLookback = config?.recentLookback ?? (INTEGER_MULTIPLIERS.TWELVE as number);
    this.exhaustionBonus = config?.exhaustionBonus ?? (INTEGER_MULTIPLIERS.FIFTEEN as number);
  }

  /**
   * Detect wedge pattern from swing points
   */
  detect(swingPoints: SwingPoint[], currentTrend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL'): WedgePattern {
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
    const firstPoint = recent[FIRST_INDEX as number];
    const lastPoint = recent[recent.length - 1];
    const patternMinutes = (lastPoint.timestamp - firstPoint.timestamp) / TIME_UNITS.MINUTE;

    if (patternMinutes < this.minPatternBars || patternMinutes > this.maxPatternBars) {
      return this.noPattern('Pattern timespan invalid');
    }

    // Check if lines converge
    const converging = resistanceLine.slope - supportLine.slope < -CONVERGENCE_THRESHOLD;

    if (!converging) {
      return this.noPattern('Lines not converging');
    }

    // Rising Wedge: BOTH lines rising (bearish reversal)
    if (resistanceLine.slope > (FIRST_INDEX as number) && supportLine.slope > (FIRST_INDEX as number)) {
      // Support line MUST be steeper (rising faster) for valid rising wedge
      if (supportLine.slope > resistanceLine.slope * (RATIO_MULTIPLIERS.HALF as number)) {
        return this.buildPattern(
          WedgePatternType.RISING,
          'SHORT',
          resistanceLine,
          supportLine,
          highs,
          lows,
          currentTrend,
        );
      }
    }

    // Falling Wedge: BOTH lines falling (bullish reversal)
    if (resistanceLine.slope < (FIRST_INDEX as number) && supportLine.slope < (FIRST_INDEX as number)) {
      // Resistance line MUST be steeper (falling faster) for valid falling wedge
      if (resistanceLine.slope < supportLine.slope * (RATIO_MULTIPLIERS.HALF as number)) {
        return this.buildPattern(
          WedgePatternType.FALLING,
          'LONG',
          resistanceLine,
          supportLine,
          highs,
          lows,
          currentTrend,
        );
      }
    }

    return this.noPattern('No valid wedge pattern');
  }

  /**
   * Calculate trendline using linear regression
   */
  private calculateTrendline(points: SwingPoint[]): { slope: number; intercept: number } {
    const n = points.length;
    let sumX = FIRST_INDEX as number;
    let sumY = FIRST_INDEX as number;
    let sumXY = FIRST_INDEX as number;
    let sumX2 = FIRST_INDEX as number;

    // Use timestamp as X, price as Y
    const baseTime = points[FIRST_INDEX as number].timestamp;

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
   * Build wedge pattern result
   */
  private buildPattern(
    type: WedgePatternType,
    direction: 'LONG' | 'SHORT',
    resistanceLine: { slope: number; intercept: number },
    supportLine: { slope: number; intercept: number },
    highs: SwingPoint[],
    lows: SwingPoint[],
    currentTrend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
  ): WedgePattern {
    // Calculate apex (where lines meet)
    const latestHigh = highs[highs.length - 1];
    const latestLow = lows[lows.length - 1];
    const currentPrice = (latestHigh.price + latestLow.price) / (INTEGER_MULTIPLIERS.TWO as number);

    // Wedge height (widest part)
    const firstHigh = highs[FIRST_INDEX as number].price;
    const firstLow = lows[FIRST_INDEX as number].price;
    const wedgeHeight = firstHigh - firstLow;

    // Target: project wedge height from breakout
    const target = direction === 'LONG'
      ? currentPrice + wedgeHeight
      : currentPrice - wedgeHeight;

    // Stop loss: opposite side of wedge
    const stopLoss = direction === 'LONG'
      ? latestLow.price - wedgeHeight * THRESHOLD_VALUES.FIFTEEN_PERCENT
      : latestHigh.price + wedgeHeight * THRESHOLD_VALUES.FIFTEEN_PERCENT;

    // Calculate confidence
    let confidence = this.baseConfidence;

    // Bonus for trend exhaustion (wedge against trend = more reliable)
    if (type === WedgePatternType.RISING && currentTrend === 'BULLISH') {
      confidence += this.exhaustionBonus; // Rising wedge in bullish trend = exhaustion signal
    } else if (type === WedgePatternType.FALLING && currentTrend === 'BEARISH') {
      confidence += this.exhaustionBonus; // Falling wedge in bearish trend = exhaustion signal
    }

    // Bonus for more touches
    const totalTouches = highs.length + lows.length;
    if (totalTouches >= (INTEGER_MULTIPLIERS.SIX as number)) {
      confidence += INTEGER_MULTIPLIERS.TEN as number;
    }

    return {
      detected: true,
      type,
      direction,
      confidence: Math.min(PERCENT_MULTIPLIER as number, confidence),
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
  private noPattern(reason: string): WedgePattern {
    return {
      detected: false,
      type: WedgePatternType.NONE,
      direction: 'LONG',
      confidence: FIRST_INDEX as number,
      apex: FIRST_INDEX as number,
      target: FIRST_INDEX as number,
      stopLoss: FIRST_INDEX as number,
      resistanceLine: { slope: FIRST_INDEX as number, highs: [] },
      supportLine: { slope: FIRST_INDEX as number, lows: [] },
      explanation: reason,
    };
  }
}
