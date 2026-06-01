import { ExitType, Position, PositionSide } from '../../types/legacy';
import {
  getFirstUnhitTakeProfitLevel,
  getTakeProfitExitType,
  resolveExitTypeFromCloseReason,
  resolveTakeProfitLevel,
} from '../../services/handlers/websocket-event-decoding.utils';

const createPosition = (): Position => ({
  id: 'position-1',
  symbol: 'BTCUSDT',
  side: PositionSide.LONG,
  quantity: 1,
  entryPrice: 45000,
  leverage: 10,
  marginUsed: 4500,
  unrealizedPnL: 250,
  openedAt: Date.now(),
  orderId: 'order-1',
  reason: 'test-position',
  takeProfits: [
    { level: 1, percent: 1, sizePercent: 25, price: 45500, hit: true, orderId: 'tp-1' },
    { level: 2, percent: 2, sizePercent: 35, price: 46000, hit: false, orderId: 'tp-2' },
    { level: 3, percent: 3, sizePercent: 40, price: 46500, hit: false, orderId: 'tp-3' },
  ],
  stopLoss: {
    price: 44000,
    initialPrice: 44000,
    isBreakeven: false,
    isTrailing: false,
    updatedAt: Date.now(),
  },
  status: 'OPEN',
});

describe('websocket-event-decoding.utils', () => {
  test('getFirstUnhitTakeProfitLevel returns the next unhit TP level', () => {
    expect(getFirstUnhitTakeProfitLevel(createPosition())).toBe(2);
  });

  test('getFirstUnhitTakeProfitLevel returns null when every TP is already hit', () => {
    const position = createPosition();
    position.takeProfits.forEach((takeProfit) => {
      takeProfit.hit = true;
    });

    expect(getFirstUnhitTakeProfitLevel(position)).toBeNull();
  });

  test('getTakeProfitExitType maps the last hit TP to the matching exit type', () => {
    expect(getTakeProfitExitType([1, 2])).toBe(ExitType.TAKE_PROFIT_2);
  });

  test('getTakeProfitExitType returns null when no TP hits were recorded', () => {
    expect(getTakeProfitExitType([])).toBeNull();
  });

  test('resolveExitTypeFromCloseReason reuses TP exit-type mapping before trailing fallback', () => {
    expect(resolveExitTypeFromCloseReason(null, [1, 2], true)).toBe(
      ExitType.TAKE_PROFIT_2,
    );
  });

  test('resolveTakeProfitLevel falls back to the first unhit TP when no direct match exists', () => {
    const resolution = resolveTakeProfitLevel(
      createPosition(),
      {
        orderId: 'unknown-order',
        avgPrice: 0,
        cumExecQty: 0,
      },
      0.003,
    );

    expect(resolution).toMatchObject({
      tpLevel: 2,
      method: 'FIRST_UNHIT',
    });
  });
});
