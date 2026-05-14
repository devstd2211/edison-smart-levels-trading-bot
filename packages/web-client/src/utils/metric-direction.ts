export type MetricDirection = 'positive' | 'negative' | 'neutral';

export function getMetricDirection(value: number): MetricDirection {
  if (value > 0) {
    return 'positive';
  }

  if (value < 0) {
    return 'negative';
  }

  return 'neutral';
}

export function getSignedValuePrefix(direction: MetricDirection): string {
  return direction === 'positive' ? '+' : '';
}

export function getBoundedMagnitudePercent(value: number, scale: number, max = 100): number {
  if (value === 0 || scale <= 0 || max <= 0) {
    return 0;
  }

  return Math.min(Math.abs(value) * scale, max);
}

export function getRatioPercent(value: number, maxValue: number): number {
  if (value <= 0 || maxValue <= 0) {
    return 0;
  }

  return (value / maxValue) * 100;
}
