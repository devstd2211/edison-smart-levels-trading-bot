import { Signal } from '../../types/legacy';

export type PositionExposure = {
  quantity: number;
  marginUsed: number;
  notionalValue: number;
};

export function resolveFirstTakeProfitPrice(signal: Signal): number {
  if (signal.takeProfits && signal.takeProfits[0]) {
    const directionMultiplier = signal.direction === 'LONG' ? 1 : -1;
    return signal.price * (1 + signal.takeProfits[0].percent / 100 * directionMultiplier);
  }
  return signal.price * 1.01;
}

export function calculateRiskRewardRatio(
  entryPrice: number,
  stopLoss: number,
  firstTakeProfitPrice: number,
): number {
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const tpDistance = Math.abs(firstTakeProfitPrice - entryPrice);
  return stopDistance > 0 ? tpDistance / stopDistance : 1.5;
}

export function calculatePositionExposure(
  positionSizeUsdt: number,
  leverage: number,
  signalPrice: number,
): PositionExposure {
  const rawQuantity = (positionSizeUsdt * leverage) / signalPrice;
  const quantity = Math.floor(rawQuantity * 100) / 100;
  const marginUsed = positionSizeUsdt;
  const notionalValue = quantity * signalPrice;

  return { quantity, marginUsed, notionalValue };
}
