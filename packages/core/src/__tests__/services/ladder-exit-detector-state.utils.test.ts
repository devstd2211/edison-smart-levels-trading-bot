import {
  detectLadderHitLevel,
  getFilledReduceOnlyOrders,
  identifyClosestTpLevel,
  isBybitOrder,
  toBybitOrders,
} from '../../services/ladder-exit-detector/ladder-exit-detector-state.utils';
import {
  createLadderExitOrderHistory,
  createLadderExitPosition,
} from '../helpers/ladder-exit-detector-test.utils';
import { PositionSide } from '../../types/legacy';

describe('ladder-exit-detector state utils', () => {
  it('detects the highest ladder level that has been reached', () => {
    const position = createLadderExitPosition(PositionSide.LONG, 100);
    expect(detectLadderHitLevel(position, 100.25)).toBe(3);
    expect(detectLadderHitLevel(position, 99.9)).toBeUndefined();
  });

  it('identifies the closest configured take-profit level', () => {
    const position = createLadderExitPosition(PositionSide.LONG, 100);
    expect(identifyClosestTpLevel(100.09, position)).toBe(1);
    expect(identifyClosestTpLevel(100.24, position)).toBe(3);
  });

  it('normalizes and filters exchange order history', () => {
    const position = createLadderExitPosition(PositionSide.LONG, 100);
    const orders = toBybitOrders([
      ...createLadderExitOrderHistory([
        { price: '100.08', reduceOnly: true },
        { price: '100.15', symbol: 'OTHER', reduceOnly: true },
      ]),
      { invalid: true },
    ]);

    expect(orders.every(isBybitOrder)).toBe(true);
    expect(getFilledReduceOnlyOrders(orders, position)).toHaveLength(1);
  });
});
