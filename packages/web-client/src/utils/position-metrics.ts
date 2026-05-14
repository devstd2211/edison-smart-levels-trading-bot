import { getMetricDirection, type MetricDirection } from './metric-direction';

export interface PositionDistanceMetric {
  value: number;
  direction: MetricDirection;
}

export function getPositionProgressPercent(entry: number, current: number, target: number): number {
  if (!Number.isFinite(entry) || !Number.isFinite(current) || !Number.isFinite(target)) {
    return 0;
  }

  const range = target - entry;
  if (range === 0) {
    return 0;
  }

  const progress = ((current - entry) / range) * 100;
  return Math.min(100, Math.max(0, progress));
}

export function getPositionDistanceMetric(
  current: number,
  target: number,
  referencePrice: number
): PositionDistanceMetric | null {
  if (
    !Number.isFinite(current)
    || !Number.isFinite(target)
    || !Number.isFinite(referencePrice)
    || referencePrice === 0
  ) {
    return null;
  }

  const value = ((target - current) / referencePrice) * 100;

  return {
    value,
    direction: getMetricDirection(value),
  };
}
