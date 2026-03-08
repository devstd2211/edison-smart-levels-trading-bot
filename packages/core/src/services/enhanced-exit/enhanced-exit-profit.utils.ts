import { SignalDirection } from '../../types/legacy';
import { PERCENT_MULTIPLIER } from '../../constants';

export function calculateDirectionalProfitPercent(
  entryPrice: number,
  currentPrice: number,
  direction: SignalDirection,
): number {
  const isLong = direction === SignalDirection.LONG;
  return isLong
    ? ((currentPrice - entryPrice) / entryPrice) * PERCENT_MULTIPLIER
    : ((entryPrice - currentPrice) / entryPrice) * PERCENT_MULTIPLIER;
}
