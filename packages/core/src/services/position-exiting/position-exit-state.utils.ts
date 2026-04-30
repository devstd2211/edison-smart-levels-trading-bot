import { PERCENT_MULTIPLIER } from '../../constants';
import { Position, PositionSide } from '../../types/legacy';

export interface DirectionalPnlSnapshot {
  readonly priceDiff: number;
  readonly pnlPercent: number;
  readonly pnlGross: number;
  readonly fees: number;
  readonly pnlNet: number;
}

export function isFavorableStopLossUpdate(
  side: PositionSide,
  currentStopLoss: number,
  nextStopLoss: number,
): boolean {
  return side === PositionSide.LONG
    ? nextStopLoss > currentStopLoss
    : nextStopLoss < currentStopLoss;
}

export function calculateDirectionalPnlSnapshot(
  position: Pick<Position, 'entryPrice' | 'quantity' | 'side'>,
  exitPrice: number,
  leverage: number,
  tradingFeeRate: number,
): DirectionalPnlSnapshot {
  const priceDiff = exitPrice - position.entryPrice;
  const pnlMultiplier = position.side === PositionSide.LONG ? 1 : -1;
  const pnlPercent = (priceDiff / position.entryPrice) * PERCENT_MULTIPLIER * pnlMultiplier;
  const pnlGross = priceDiff * position.quantity * pnlMultiplier * leverage;
  const fees =
    (position.entryPrice * position.quantity + exitPrice * position.quantity) * tradingFeeRate;

  return {
    priceDiff,
    pnlPercent,
    pnlGross,
    fees,
    pnlNet: pnlGross - fees,
  };
}

export function applyStopLossUpdate(
  position: Pick<Position, 'stopLoss'>,
  nextStopLoss: number,
  updates: Partial<Position['stopLoss']> = {},
): void {
  position.stopLoss.price = nextStopLoss;
  position.stopLoss.updatedAt = Date.now();
  Object.assign(position.stopLoss, updates);
}
