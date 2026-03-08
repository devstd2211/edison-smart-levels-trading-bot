import type { IndicatorWeight } from '../../types/legacy';

interface ScoreMultipliers {
  GOOD: number;
  OK: number;
  WEAK: number;
}

export function scoreByAtLeastThreshold(
  value: number,
  weight: IndicatorWeight,
  multipliers: ScoreMultipliers,
): number {
  const { maxPoints, thresholds } = weight;

  if (thresholds.excellent !== undefined && value >= thresholds.excellent) {
    return maxPoints;
  }
  if (thresholds.good !== undefined && value >= thresholds.good) {
    return maxPoints * multipliers.GOOD;
  }
  if (thresholds.ok !== undefined && value >= thresholds.ok) {
    return maxPoints * multipliers.OK;
  }
  if (thresholds.weak !== undefined && value >= thresholds.weak) {
    return maxPoints * multipliers.WEAK;
  }

  return 0;
}

export function scoreByAtMostThreshold(
  value: number,
  weight: IndicatorWeight,
  multipliers: ScoreMultipliers,
): number {
  const { maxPoints, thresholds } = weight;

  if (thresholds.excellent !== undefined && value <= thresholds.excellent) {
    return maxPoints;
  }
  if (thresholds.good !== undefined && value <= thresholds.good) {
    return maxPoints * multipliers.GOOD;
  }
  if (thresholds.ok !== undefined && value <= thresholds.ok) {
    return maxPoints * multipliers.OK;
  }
  if (thresholds.weak !== undefined && value <= thresholds.weak) {
    return maxPoints * multipliers.WEAK;
  }

  return 0;
}
