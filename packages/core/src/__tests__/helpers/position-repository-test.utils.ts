import { PositionMemoryRepository } from '../../repositories/position.memory-repository';
import { IPositionRepository } from '../../repositories/IRepositories';
import { Position, PositionSide } from '../../types/legacy';

export function createPositionRepositoryHarness(): IPositionRepository {
  return new PositionMemoryRepository();
}

export function createRepositoryPosition(
  overrides: Partial<Position> = {},
): Position {
  return {
    id: 'BTCUSDT_Buy',
    journalId: 'trade-1',
    symbol: 'BTCUSDT',
    side: PositionSide.LONG,
    quantity: 0.1,
    entryPrice: 50000,
    leverage: 10,
    marginUsed: 500,
    stopLoss: {
      price: 49000,
      initialPrice: 49000,
      orderId: undefined,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
    takeProfits: [],
    openedAt: Date.now(),
    unrealizedPnL: 0,
    orderId: 'order-1',
    reason: 'Entry signal',
    protectionVerifiedOnce: true,
    status: 'OPEN',
    ...overrides,
  };
}

export function createRepositoryPositions(
  count: number,
  buildOverrides: (index: number) => Partial<Position> = () => ({}),
): Position[] {
  return Array.from({ length: count }, (_, index) =>
    createRepositoryPosition(buildOverrides(index)),
  );
}
