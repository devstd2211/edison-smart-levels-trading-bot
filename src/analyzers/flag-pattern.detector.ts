import {
  CONFIDENCE_THRESHOLDS,
  DECIMAL_PLACES,
  PERCENT_MULTIPLIER,
  PERCENTAGE_THRESHOLDS,
  TIME_UNITS,
  INTEGER_MULTIPLIERS,
  THRESHOLD_VALUES,
  RATIO_MULTIPLIERS,
  FIRST_INDEX,
  SECOND_INDEX,
  MATH_BOUNDS,
} from '../constants';
/**
 * Flag/Pennant Pattern Detector
 *
 * Detects flag and pennant continuation patterns.
 * Both patterns consist of: strong move (flagpole) + consolidation (flag/pennant).
 *
 * Bull Flag:
 *      |  ___     Strong upward move (pole)
 *      | |   |    + rectangular consolidation (flag)
 *      | |___|    → LONG on break
 *
 * Pennant:
 *      |  /\      Strong move (pole)
 *      | /  \     + triangular consolidation (pennant)
 *      |/____\    → Direction = pole direction
 */

import { SwingPoint, LoggerService, AnalysisConfig } from '../types';

export enum FlagPatternType {
  BULL_FLAG = 'BULL_FLAG',
  BEAR_FLAG = 'BEAR_FLAG',
  BULL_PENNANT = 'BULL_PENNANT',
  BEAR_PENNANT = 'BEAR_PENNANT',
  NONE = 'NONE',
}

export interface FlagPattern {
  detected: boolean;
  type: FlagPatternType;
  direction: 'LONG' | 'SHORT';
  confidence: number;
  poleHeight: number;
  target: number;
  stopLoss: number;
  consolidationPoints: SwingPoint[];
  explanation: string;
}

const MIN_POLE_HEIGHT_PERCENT = INTEGER_MULTIPLIERS.TWO; // Pole must be strong (2%+ move)

export class FlagPatternDetector {
  private readonly baseConfidence: number;
  private readonly maxConsolidationBars: number;
  private readonly minConsolidationBars: number;

  constructor(
    private logger: LoggerService,
    config?: any,
  ) {
    // Load from DI config - these are strategic values that should come from config.json
    this.baseConfidence = config?.baseConfidence ?? (INTEGER_MULTIPLIERS.SIXTY_FIVE as number);
    this.minConsolidationBars = config?.minConsolidationBars ?? (INTEGER_MULTIPLIERS.TEN as number);
    this.maxConsolidationBars = config?.maxConsolidationBars ?? (INTEGER_MULTIPLIERS.ONE_HUNDRED as number);
  }

  detect(swingPoints: SwingPoint[]): FlagPattern {
    if (swingPoints.length < (INTEGER_MULTIPLIERS.SIX as number)) {
      return this.noPattern('Not enough swing points');
    }

    const recent = swingPoints.slice(-(INTEGER_MULTIPLIERS.TEN as number));

    // Detect flagpole (strong directional move)
    const poleResult = this.detectPole(recent);
    if (poleResult === null) {
      return this.noPattern('No strong flagpole detected');
    }

    const { direction, poleHeight, poleStart, poleEnd } = poleResult;

    // Detect consolidation after pole
    const consolidation = recent.slice(recent.indexOf(poleEnd) + (RATIO_MULTIPLIERS.FULL as number));
    if (consolidation.length < (INTEGER_MULTIPLIERS.THREE as number)) {
      return this.noPattern('No consolidation after pole');
    }

    const consolidationMinutes = (consolidation[consolidation.length - (RATIO_MULTIPLIERS.FULL as number)].timestamp - consolidation[FIRST_INDEX].timestamp) / TIME_UNITS.MINUTE;
    if (consolidationMinutes < this.minConsolidationBars || consolidationMinutes > this.maxConsolidationBars) {
      return this.noPattern('Consolidation timespan invalid');
    }

    // Check if consolidation is rectangular (flag) or triangular (pennant)
    const isTriangular = this.isTriangularConsolidation(consolidation);
    const type = direction === 'LONG'
      ? (isTriangular ? FlagPatternType.BULL_PENNANT : FlagPatternType.BULL_FLAG)
      : (isTriangular ? FlagPatternType.BEAR_PENNANT : FlagPatternType.BEAR_FLAG);

    const currentPrice = consolidation[consolidation.length - (RATIO_MULTIPLIERS.FULL as number)].price;
    const target = direction === 'LONG' ? currentPrice + poleHeight : currentPrice - poleHeight;
    const stopLoss = direction === 'LONG' ? currentPrice - poleHeight * THRESHOLD_VALUES.THIRTY_PERCENT : currentPrice + poleHeight * THRESHOLD_VALUES.THIRTY_PERCENT;

    let confidence = this.baseConfidence;
    if (poleHeight / poleStart.price > THRESHOLD_VALUES.THREE_PERCENT) {
      confidence += THRESHOLD_VALUES.TEN_PERCENT * (MATH_BOUNDS.MAX_PERCENTAGE as number);
    } // Strong pole bonus

    return {
      detected: true,
      type,
      direction,
      confidence: Math.min(MATH_BOUNDS.MAX_PERCENTAGE, confidence),
      poleHeight,
      target,
      stopLoss,
      consolidationPoints: consolidation,
      explanation: `${type}: pole ${poleHeight.toFixed(DECIMAL_PLACES.PERCENT)}, consolidation ${consolidation.length} points`,
    };
  }

  private detectPole(points: SwingPoint[]): { direction: 'LONG' | 'SHORT'; poleHeight: number; poleStart: SwingPoint; poleEnd: SwingPoint } | null {
    for (let i = FIRST_INDEX; i < points.length - (RATIO_MULTIPLIERS.FULL as number); i++) {
      const start = points[i];
      const end = points[i + (RATIO_MULTIPLIERS.FULL as number)];
      const heightPercent = Math.abs((end.price - start.price) / start.price) * PERCENT_MULTIPLIER;

      if (heightPercent >= MIN_POLE_HEIGHT_PERCENT) {
        return {
          direction: end.price > start.price ? 'LONG' : 'SHORT',
          poleHeight: Math.abs(end.price - start.price),
          poleStart: start,
          poleEnd: end,
        };
      }
    }
    return null;
  }

  private isTriangularConsolidation(points: SwingPoint[]): boolean {
    if (points.length < (INTEGER_MULTIPLIERS.FOUR as number)) {
      return false;
    }
    const firstRange = Math.abs(points[SECOND_INDEX].price - points[FIRST_INDEX].price);
    const lastRange = Math.abs(points[points.length - (RATIO_MULTIPLIERS.FULL as number)].price - points[points.length - (INTEGER_MULTIPLIERS.TWO as number)].price);
    return lastRange < firstRange * THRESHOLD_VALUES.SIXTY_PERCENT; // Range narrowing = triangular
  }

  private noPattern(reason: string): FlagPattern {
    return {
      detected: false,
      type: FlagPatternType.NONE,
      direction: 'LONG',
      confidence: MATH_BOUNDS.MIN_PERCENTAGE,
      poleHeight: MATH_BOUNDS.MIN_PERCENTAGE,
      target: MATH_BOUNDS.MIN_PERCENTAGE,
      stopLoss: MATH_BOUNDS.MIN_PERCENTAGE,
      consolidationPoints: [],
      explanation: reason,
    };
  }
}
