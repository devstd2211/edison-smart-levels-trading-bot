import type { PositionState } from '../position-scaling.service';

export function calculatePositionProfitPercent(position: PositionState): number {
  if (position.side === 'long') {
    const priceMove = position.currentPrice - position.entryPrice;
    const targetMove = position.profitTarget - position.entryPrice;
    return targetMove > 0 ? priceMove / targetMove : 0;
  }

  const priceMove = position.entryPrice - position.currentPrice;
  const targetMove = position.entryPrice - position.profitTarget;
  return targetMove > 0 ? priceMove / targetMove : 0;
}

export function calculateScaleSizeValue(
  position: Pick<PositionState, 'size' | 'scaleCount'>,
  scaleReduction: number,
  minimumPositionSize: number,
): number {
  const scaleFactor = Math.pow(scaleReduction, position.scaleCount + 1);
  return Math.max(position.size * scaleFactor, minimumPositionSize);
}

export function calculateScaledStopLoss(
  position: PositionState,
  profitPercent: number,
  breakevenThreshold: number,
): number {
  if (profitPercent >= breakevenThreshold) {
    return position.entryPrice;
  }

  const movePercent = profitPercent / breakevenThreshold;
  if (position.side === 'long') {
    const stopLossDistance = position.entryPrice - position.stopLoss;
    return position.stopLoss + stopLossDistance * movePercent;
  }

  const stopLossDistance = position.stopLoss - position.entryPrice;
  return position.stopLoss - stopLossDistance * movePercent;
}
