import { PositionMemoryRepository } from '../../repositories/position.memory-repository';
import { IPositionRepository } from '../../repositories/IRepositories';
import { Position, PositionSide } from '../../types/legacy';

export function createPositionRepositoryHarness(): IPositionRepository {
  return new PositionMemoryRepository();
}

export function createSeededPositionRepositoryHarness(options: {
  currentPosition?: Position | null;
  history?: Position[];
} = {}): IPositionRepository {
  const repository = createPositionRepositoryHarness();

  if (options.currentPosition !== undefined) {
    repository.setCurrentPosition(options.currentPosition);
  }

  for (const position of options.history ?? []) {
    repository.addToHistory(position);
  }

  return repository;
}

export function createSeededCurrentPositionRepository(
  currentPosition: Position | null,
): IPositionRepository {
  return createSeededPositionRepositoryHarness({ currentPosition });
}

export function createSeededHistoryRepository(
  history: Position[],
): IPositionRepository {
  return createSeededPositionRepositoryHarness({ history });
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

export function createClosedRepositoryPosition(
  overrides: Partial<Position> = {},
): Position {
  return createRepositoryPosition({
    status: 'CLOSED',
    ...overrides,
  });
}

export function createSeededClosedHistoryRepository(
  overrides: Partial<Position>[] = [{}],
): IPositionRepository {
  return createSeededHistoryRepository(
    overrides.map((positionOverrides) => createClosedRepositoryPosition(positionOverrides)),
  );
}

export function createSeededCurrentAndHistoryRepository(options: {
  currentPosition?: Partial<Position>;
  history?: Partial<Position>[];
} = {}): IPositionRepository {
  const history = (options.history ?? []).map((positionOverrides) =>
    createClosedRepositoryPosition(positionOverrides),
  );

  return createSeededPositionRepositoryHarness({
    currentPosition: options.currentPosition
      ? createRepositoryPosition(options.currentPosition)
      : undefined,
    history,
  });
}
