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

export function createRepositoryTakeProfits(
  overrides: Array<Partial<Position['takeProfits'][number]>> = [],
) {
  const defaults = [
    { level: 1, price: 50500, percent: 30, sizePercent: 30, hit: false, orderId: undefined },
    { level: 2, price: 51000, percent: 30, sizePercent: 30, hit: false, orderId: undefined },
    { level: 3, price: 51500, percent: 40, sizePercent: 40, hit: false, orderId: undefined },
  ];

  return defaults.map((takeProfit, index) => ({
    ...takeProfit,
    ...(overrides[index] ?? {}),
  }));
}

export function createRepositoryPositions(
  count: number,
  buildOverrides: (index: number) => Partial<Position> = () => ({}),
): Position[] {
  return Array.from({ length: count }, (_, index) =>
    createRepositoryPosition(buildOverrides(index)),
  );
}

export function seedRepositoryHistory(
  repository: IPositionRepository,
  count: number,
  buildOverrides: (index: number) => Partial<Position> = () => ({}),
): IPositionRepository {
  createRepositoryPositions(count, buildOverrides).forEach((position) => repository.addToHistory(position));
  return repository;
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

export function createSeededRepositoryQueryHarness(options: {
  currentPosition?: Partial<Position>;
  history?: Partial<Position>[];
} = {}): IPositionRepository {
  return createSeededCurrentAndHistoryRepository({
    currentPosition: {
      id: 'BTCUSDT_Buy_2',
      status: 'OPEN',
      ...options.currentPosition,
    },
    history: options.history ?? [{ id: 'BTCUSDT_Buy_1' }],
  });
}
