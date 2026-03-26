import { SignalDirection, TrendAnalysis, TrendBias } from '../../types/legacy';

export function isBiasCompatibleWithSignal(
  bias: TrendBias,
  direction: SignalDirection,
): boolean {
  if (bias === TrendBias.NEUTRAL) {
    return true;
  }

  if (direction === SignalDirection.LONG) {
    return bias === TrendBias.BULLISH;
  }

  if (direction === SignalDirection.SHORT) {
    return bias === TrendBias.BEARISH;
  }

  return false;
}

export function getTimeframeConflictMultiplier(
  trendAnalysis: TrendAnalysis | null | undefined,
  direction: SignalDirection,
): number {
  if (!trendAnalysis) {
    return 1.0;
  }

  return isBiasCompatibleWithSignal(trendAnalysis.bias, direction) ? 1.0 : 0.7;
}
