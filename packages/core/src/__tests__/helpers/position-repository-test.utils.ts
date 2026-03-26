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

export function seedRepositoryCurrentPosition(
  repository: IPositionRepository,
  currentPosition: Position | null,
): IPositionRepository {
  repository.setCurrentPosition(currentPosition);
  return repository;
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

export function updateRepositoryCurrentPosition(
  repository: IPositionRepository,
  basePosition: Position,
  overrides: Partial<Position>,
): Position {
  const updatedPosition = { ...basePosition, ...overrides };
  repository.setCurrentPosition(updatedPosition);
  return updatedPosition;
}

export function createRepositoryCurrentPositionHarness(
  overrides: Partial<Position> = {},
): {
  repository: IPositionRepository;
  position: Position;
} {
  const position = createRepositoryPosition(overrides);
  return {
    repository: createSeededCurrentPositionRepository(position),
    position,
  };
}

export function createRepositoryClosedHistoryHarness(
  overrides: Partial<Position>[] = [{}],
): {
  repository: IPositionRepository;
  history: Position[];
} {
  const history = overrides.map((positionOverrides) =>
    createClosedRepositoryPosition(positionOverrides),
  );

  return {
    repository: createSeededHistoryRepository(history),
    history,
  };
}

export function createRepositoryCurrentAndHistoryHarness(options: {
  currentPosition?: Partial<Position>;
  history?: Partial<Position>[];
} = {}): {
  repository: IPositionRepository;
  currentPosition: Position | null;
  history: Position[];
} {
  const currentPosition = options.currentPosition
    ? createRepositoryPosition(options.currentPosition)
    : null;
  const history = (options.history ?? []).map((positionOverrides) =>
    createClosedRepositoryPosition(positionOverrides),
  );

  return {
    repository: createSeededPositionRepositoryHarness({
      currentPosition: currentPosition ?? undefined,
      history,
    }),
    currentPosition,
    history,
  };
}

export function createRepositoryBulkHistoryHarness(
  count: number,
  buildOverrides: (index: number) => Partial<Position> = () => ({}),
): {
  repository: IPositionRepository;
  history: Position[];
} {
  const history = createRepositoryPositions(count, buildOverrides).map((position) =>
    createClosedRepositoryPosition(position),
  );

  return {
    repository: createSeededHistoryRepository(history),
    history,
  };
}

export function createRepositoryUpdateHarness(
  overrides: Partial<Position> = {},
): {
  repository: IPositionRepository;
  position: Position;
} {
  return createRepositoryCurrentPositionHarness(overrides);
}

export interface ManagedPositionRepositoryContext {
  repository: IPositionRepository;
  createCurrentPositionHarness: typeof createRepositoryCurrentPositionHarness;
  createClosedHistoryHarness: typeof createRepositoryClosedHistoryHarness;
  createCurrentAndHistoryHarness: typeof createRepositoryCurrentAndHistoryHarness;
  createBulkHistoryHarness: typeof createRepositoryBulkHistoryHarness;
  createUpdateHarness: typeof createRepositoryUpdateHarness;
  cleanup: () => void;
}

export function createManagedPositionRepositoryContext(
  options: Parameters<typeof createRepositoryCurrentAndHistoryHarness>[0] = {},
): ManagedPositionRepositoryContext {
  const trackedRepositories: IPositionRepository[] = [];
  const trackRepository = <THarness extends { repository: IPositionRepository }>(harness: THarness): THarness => {
    trackedRepositories.push(harness.repository);
    return harness;
  };

  const baseHarness = trackRepository(createRepositoryCurrentAndHistoryHarness(options));

  return {
    repository: baseHarness.repository,
    createCurrentPositionHarness: (overrides = {}) =>
      trackRepository(createRepositoryCurrentPositionHarness(overrides)),
    createClosedHistoryHarness: (overrides = [{}]) =>
      trackRepository(createRepositoryClosedHistoryHarness(overrides)),
    createCurrentAndHistoryHarness: (overrides = {}) =>
      trackRepository(createRepositoryCurrentAndHistoryHarness(overrides)),
    createBulkHistoryHarness: (count, buildOverrides = () => ({})) =>
      trackRepository(createRepositoryBulkHistoryHarness(count, buildOverrides)),
    createUpdateHarness: (overrides = {}) =>
      trackRepository(createRepositoryUpdateHarness(overrides)),
    cleanup: () => {
      trackedRepositories.forEach((repository) => repository.clear());
      trackedRepositories.length = 0;
      jest.clearAllMocks();
    },
  };
}
