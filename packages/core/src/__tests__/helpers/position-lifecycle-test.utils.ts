import { ErrorHandler } from '../../errors';
import type { IExchange } from '../../interfaces/IExchange';
import { IPositionRepository } from '../../repositories/IRepositories';
import { BotEventBus } from '../../services/event-bus';
import { PositionLifecycleService } from '../../services/position-lifecycle.service';
import { LoggerService, SessionStatsService, TelegramService, TradingJournalService } from '../../services';
import {
  Config,
  EntryConfirmationConfig,
  Position,
  PositionSide,
  RiskManagementConfig,
  Signal,
  SignalDirection,
  TradingConfig,
} from '../../types/legacy';

export function createMockLifecycleTradingConfig(
  overrides: Partial<TradingConfig> = {},
): TradingConfig {
  return {
    leverage: 10,
    tradingFeeRate: 0.0002,
    positionSizeUsdt: 100,
    riskPercent: 2,
    ...overrides,
  } as unknown as TradingConfig;
}

export function createMockLifecycleRiskConfig(
  overrides: Partial<RiskManagementConfig> = {},
): RiskManagementConfig {
  return {
    trailingStopActivationLevel: 2,
    dailyLossLimit: 1000,
    maxConsecutiveLosses: 3,
    ...overrides,
  } as unknown as RiskManagementConfig;
}

export function createMockLifecycleEntryConfig(
  overrides: Partial<EntryConfirmationConfig> = {},
): EntryConfirmationConfig {
  return {
    longEnabled: false,
    shortEnabled: false,
    enabled: false,
    ...overrides,
  } as unknown as EntryConfirmationConfig;
}

export function createMockLifecycleConfig(
  trading: TradingConfig,
  risk: RiskManagementConfig,
  entry: EntryConfirmationConfig,
  overrides: Partial<Config> = {},
): Config {
  return {
    exchange: { name: 'bybit', testnet: true } as unknown as Config['exchange'],
    trading,
    riskManagement: risk,
    entryConfirmation: entry,
    ...overrides,
  } as unknown as Config;
}

export function createMockLifecyclePosition(overrides: Partial<Position> = {}): Position {
  return {
    id: 'BTC_BUY',
    journalId: 'JOURNAL1',
    symbol: 'BTCUSDT',
    side: PositionSide.LONG,
    entryPrice: 40000,
    quantity: 0.25,
    leverage: 10,
    marginUsed: 100,
    orderId: 'ORDER1',
    reason: 'ENTRY_SIGNAL',
    status: 'OPEN',
    openedAt: Date.now(),
    stopLoss: {
      price: 39000,
      initialPrice: 39000,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
    takeProfits: [
      { level: 1, price: 41000, percent: 0.5, sizePercent: 50, hit: false },
      { level: 2, price: 42000, percent: 1, sizePercent: 30, hit: false },
      { level: 3, price: 43000, percent: 1.5, sizePercent: 20, hit: false },
    ],
    unrealizedPnL: 250,
    ...overrides,
  };
}

export function createLifecycleSafetyPosition(overrides: Partial<Position> = {}): Position {
  return createMockLifecyclePosition({
    id: 'BTCUSDT_Buy',
    symbol: 'BTCUSDT',
    quantity: 1,
    entryPrice: 45000,
    marginUsed: 4500,
    unrealizedPnL: 500,
    openedAt: Date.now() - 3600000,
    orderId: 'order-123',
    reason: 'Test entry',
    takeProfits: [
      { level: 1, percent: 0.5, sizePercent: 50, price: 45225, hit: false },
    ],
    stopLoss: {
      price: 44000,
      initialPrice: 44000,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
    ...overrides,
  });
}

export function createMockLifecycleSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    direction: SignalDirection.LONG,
    price: 40000,
    stopLoss: 39000,
    takeProfits: [
      { level: 1, price: 41000, percent: 0.5, sizePercent: 50, hit: false },
      { level: 2, price: 42000, percent: 1, sizePercent: 30, hit: false },
      { level: 3, price: 43000, percent: 1.5, sizePercent: 20, hit: false },
    ],
    timestamp: Date.now(),
    confidence: 0.85,
    type: 'technical',
    ...overrides,
  } as unknown as Signal;
}

export function cloneLifecyclePosition(position: Position): Position {
  return JSON.parse(JSON.stringify(position)) as Position;
}

export function createLifecycleWebSocketPosition(
  basePosition: Position,
  overrides: Partial<Position> = {},
): Position {
  return {
    ...cloneLifecyclePosition(basePosition),
    ...overrides,
  };
}

export function createLifecycleRestorePosition(
  overrides: Partial<Position> = {},
): Position {
  return createMockLifecyclePosition({
    id: 'BTC_BUY_RESTORE',
    reason: 'RESTORE',
    openedAt: Date.now() - 60000,
    journalId: undefined,
    unrealizedPnL: 0,
    ...overrides,
  });
}

export function createMockLifecycleExchange(position: Position) {
  return {
    openPosition: jest.fn().mockResolvedValue(position),
    closePosition: jest.fn().mockResolvedValue(undefined),
    cancelAllConditionalOrders: jest.fn().mockResolvedValue(undefined),
    cancelAllOrders: jest.fn(),
    cancelOrder: jest.fn(),
    placeOrder: jest.fn(),
    updateTakeProfitPartial: jest.fn().mockResolvedValue(undefined),
    getCurrentPrice: jest.fn().mockResolvedValue(40000),
    getSymbol: jest.fn().mockReturnValue('BTCUSDT'),
    getSymbols: jest.fn().mockResolvedValue([]),
    getBalance: jest.fn().mockResolvedValue({}),
    getTicker: jest.fn(),
    getKlines: jest.fn(),
    getOrderHistory: jest.fn(),
    getOpenOrders: jest.fn(),
    getPositions: jest.fn(),
    getTradingPairs: jest.fn(),
    subscribeToTicker: jest.fn(),
    subscribeToPositions: jest.fn(),
    subscribeToOrders: jest.fn(),
    unsubscribeTicker: jest.fn(),
  } as unknown as jest.Mocked<IExchange>;
}

export function createMockLifecycleTelegram() {
  return {
    notifyPositionOpened: jest.fn().mockResolvedValue(undefined),
    sendAlert: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn(),
  } as unknown as jest.Mocked<TelegramService>;
}

export function createMockLifecycleLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  } as unknown as jest.Mocked<LoggerService>;
}

export function createMockLifecycleJournal(position: Position) {
  return {
    recordTradeOpen: jest.fn(),
    recordTradeClose: jest.fn(),
    recordTrade: jest.fn(),
    getOpenPositionBySymbol: jest.fn().mockReturnValue({ id: position.journalId }),
  } as unknown as jest.Mocked<TradingJournalService>;
}

export function createMockLifecycleEventBus() {
  return {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    publishSync: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  } as unknown as jest.Mocked<BotEventBus>;
}

export function createMockLifecycleRepository(position: Position) {
  return {
    getCurrentPosition: jest.fn().mockReturnValue(position),
    setCurrentPosition: jest.fn(),
  } as unknown as jest.Mocked<IPositionRepository>;
}

export function attachLifecycleRepositoryPosition(
  mockRepository: jest.Mocked<IPositionRepository>,
  position: Position,
): Position {
  mockRepository.getCurrentPosition.mockReturnValue(position);
  return position;
}

type LifecycleHarness = {
  service: PositionLifecycleService;
  mockExchange: jest.Mocked<IExchange>;
  mockTelegram: jest.Mocked<TelegramService>;
  mockLogger: jest.Mocked<LoggerService>;
  mockJournal: jest.Mocked<TradingJournalService>;
  mockEventBus: jest.Mocked<BotEventBus>;
  mockRepository?: jest.Mocked<IPositionRepository>;
  tradingConfig: TradingConfig;
  riskConfig: RiskManagementConfig;
  entryConfig: EntryConfirmationConfig;
  fullConfig: Config;
  position: Position;
  signal: Signal;
};

type InternalPositionLifecycleState = {
  currentPosition: Position | null;
  positionClosing: Map<string, Promise<void>>;
};

export function createPositionLifecycleService(
  dependencies: Omit<LifecycleHarness, 'service' | 'signal' | 'position'> & {
    position: Position;
    errorHandler?: ErrorHandler;
  },
): PositionLifecycleService {
  return new PositionLifecycleService(
    dependencies.mockExchange,
    dependencies.tradingConfig,
    dependencies.riskConfig,
    dependencies.mockTelegram,
    dependencies.mockLogger,
    dependencies.mockJournal,
    dependencies.entryConfig,
    dependencies.fullConfig,
    dependencies.mockEventBus,
    undefined,
    undefined as unknown as SessionStatsService,
    'TEST_STRATEGY',
    dependencies.mockRepository,
    dependencies.errorHandler,
  );
}

export function createStandardPositionLifecycleService(
  dependencies: Omit<LifecycleHarness, 'service' | 'signal' | 'position'> & {
    position: Position;
    errorHandler?: ErrorHandler;
  },
): PositionLifecycleService {
  return createPositionLifecycleService(dependencies);
}

export function createLegacyPositionLifecycleService(
  dependencies: Omit<LifecycleHarness, 'service' | 'signal' | 'position'> & {
    position: Position;
  },
): PositionLifecycleService {
  return createPositionLifecycleService({
    ...dependencies,
    errorHandler: undefined,
  });
}

export function createPositionLifecycleRepositoryHarness(options: {
  positionOverrides?: Partial<Position>;
  tradingOverrides?: Partial<TradingConfig>;
  riskOverrides?: Partial<RiskManagementConfig>;
  entryOverrides?: Partial<EntryConfirmationConfig>;
  configOverrides?: Partial<Config>;
  errorHandler?: ErrorHandler;
} = {}): LifecycleHarness {
  const position = createMockLifecyclePosition(options.positionOverrides);
  const signal = createMockLifecycleSignal();
  const tradingConfig = createMockLifecycleTradingConfig(options.tradingOverrides);
  const riskConfig = createMockLifecycleRiskConfig(options.riskOverrides);
  const entryConfig = createMockLifecycleEntryConfig(options.entryOverrides);
  const fullConfig = createMockLifecycleConfig(tradingConfig, riskConfig, entryConfig, options.configOverrides);
  const mockExchange = createMockLifecycleExchange(position);
  const mockTelegram = createMockLifecycleTelegram();
  const mockLogger = createMockLifecycleLogger();
  const mockJournal = createMockLifecycleJournal(position);
  const mockEventBus = createMockLifecycleEventBus();
  const mockRepository = createMockLifecycleRepository(position);

  return {
    service: createPositionLifecycleService({
      mockExchange,
      mockTelegram,
      mockLogger,
      mockJournal,
      mockEventBus,
      mockRepository,
      tradingConfig,
      riskConfig,
      entryConfig,
      fullConfig,
      position,
      errorHandler: options.errorHandler,
    }),
    mockExchange,
    mockTelegram,
    mockLogger,
    mockJournal,
    mockEventBus,
    mockRepository,
    tradingConfig,
    riskConfig,
    entryConfig,
    fullConfig,
    position,
    signal,
  };
}

export function createStandardPositionLifecycleRepositoryHarness(options: {
  positionOverrides?: Partial<Position>;
  tradingOverrides?: Partial<TradingConfig>;
  riskOverrides?: Partial<RiskManagementConfig>;
  entryOverrides?: Partial<EntryConfirmationConfig>;
  configOverrides?: Partial<Config>;
  errorHandler?: ErrorHandler;
} = {}): LifecycleHarness {
  return createPositionLifecycleRepositoryHarness(options);
}

export function createLegacyPositionLifecycleRepositoryHarness(options: {
  positionOverrides?: Partial<Position>;
  tradingOverrides?: Partial<TradingConfig>;
  riskOverrides?: Partial<RiskManagementConfig>;
  entryOverrides?: Partial<EntryConfirmationConfig>;
  configOverrides?: Partial<Config>;
} = {}): LifecycleHarness {
  const harness = createPositionLifecycleRepositoryHarness(options);

  return {
    ...harness,
    service: createLegacyPositionLifecycleService({
      mockExchange: harness.mockExchange,
      mockTelegram: harness.mockTelegram,
      mockLogger: harness.mockLogger,
      mockJournal: harness.mockJournal,
      mockEventBus: harness.mockEventBus,
      mockRepository: harness.mockRepository,
      tradingConfig: harness.tradingConfig,
      riskConfig: harness.riskConfig,
      entryConfig: harness.entryConfig,
      fullConfig: harness.fullConfig,
      position: harness.position,
    }),
  };
}

export function createPositionLifecycleMemoryHarness(options: {
  positionOverrides?: Partial<Position>;
  tradingOverrides?: Partial<TradingConfig>;
  riskOverrides?: Partial<RiskManagementConfig>;
  entryOverrides?: Partial<EntryConfirmationConfig>;
  configOverrides?: Partial<Config>;
  errorHandler?: ErrorHandler;
} = {}): LifecycleHarness {
  const position = createMockLifecyclePosition(options.positionOverrides);
  const signal = createMockLifecycleSignal();
  const tradingConfig = createMockLifecycleTradingConfig(options.tradingOverrides);
  const riskConfig = createMockLifecycleRiskConfig(options.riskOverrides);
  const entryConfig = createMockLifecycleEntryConfig(options.entryOverrides);
  const fullConfig = createMockLifecycleConfig(tradingConfig, riskConfig, entryConfig, options.configOverrides);
  const mockExchange = createMockLifecycleExchange(position);
  const mockTelegram = createMockLifecycleTelegram();
  const mockLogger = createMockLifecycleLogger();
  const mockJournal = createMockLifecycleJournal(position);
  const mockEventBus = createMockLifecycleEventBus();

  return {
    service: createPositionLifecycleService({
      mockExchange,
      mockTelegram,
      mockLogger,
      mockJournal,
      mockEventBus,
      tradingConfig,
      riskConfig,
      entryConfig,
      fullConfig,
      position,
      errorHandler: options.errorHandler,
    }),
    mockExchange,
    mockTelegram,
    mockLogger,
    mockJournal,
    mockEventBus,
    tradingConfig,
    riskConfig,
    entryConfig,
    fullConfig,
    position,
    signal,
  };
}

export function createStandardPositionLifecycleMemoryHarness(options: {
  positionOverrides?: Partial<Position>;
  tradingOverrides?: Partial<TradingConfig>;
  riskOverrides?: Partial<RiskManagementConfig>;
  entryOverrides?: Partial<EntryConfirmationConfig>;
  configOverrides?: Partial<Config>;
  errorHandler?: ErrorHandler;
} = {}): LifecycleHarness {
  return createPositionLifecycleMemoryHarness(options);
}

export function createPositionLifecycleSafetyHarness(options: {
  positionOverrides?: Partial<Position>;
  tradingOverrides?: Partial<TradingConfig>;
  riskOverrides?: Partial<RiskManagementConfig>;
  entryOverrides?: Partial<EntryConfirmationConfig>;
  configOverrides?: Partial<Config>;
  errorHandler?: ErrorHandler;
} = {}) {
  const position = createLifecycleSafetyPosition(options.positionOverrides);
  const harness = createPositionLifecycleMemoryHarness({
    ...options,
    positionOverrides: position,
    tradingOverrides: {
      positionSize: 100,
      ...options.tradingOverrides,
    } as never,
  });
  const internals = (): InternalPositionLifecycleState =>
    harness.service as unknown as InternalPositionLifecycleState;
  const setCurrentPosition = (value: Position | null): void => {
    internals().currentPosition = value;
  };

  return {
    ...harness,
    position,
    internals,
    setCurrentPosition,
  };
}

export function createStandardPositionLifecycleSafetyHarness(options: {
  positionOverrides?: Partial<Position>;
  tradingOverrides?: Partial<TradingConfig>;
  riskOverrides?: Partial<RiskManagementConfig>;
  entryOverrides?: Partial<EntryConfirmationConfig>;
  configOverrides?: Partial<Config>;
  errorHandler?: ErrorHandler;
} = {}) {
  return createPositionLifecycleSafetyHarness(options);
}

export function createLifecycleUpdatedSafetyPosition(
  overrides: Partial<Position> = {},
): Position {
  return createLifecycleSafetyPosition(overrides);
}

export function collectLifecycleSnapshots(
  service: PositionLifecycleService,
  count: number,
): Array<Promise<Position | null>> {
  return Array.from({ length: count }, () => Promise.resolve(service.getPositionSnapshot()));
}

export function findLifecycleLogCall(mockFn: jest.Mock, expectedFragment: string) {
  return mockFn.mock.calls.find((call: unknown[]) =>
    typeof call[0] === 'string' && call[0].includes(expectedFragment),
  );
}

export function createPositionLifecycleWithErrorHandlerHarness(
  errorHandler: ErrorHandler,
  options: {
    positionOverrides?: Partial<Position>;
    tradingOverrides?: Partial<TradingConfig>;
    riskOverrides?: Partial<RiskManagementConfig>;
    entryOverrides?: Partial<EntryConfirmationConfig>;
    configOverrides?: Partial<Config>;
  } = {},
): LifecycleHarness {
  return createStandardPositionLifecycleRepositoryHarness({
    ...options,
    errorHandler,
  });
}

export interface ManagedPositionLifecycleRepositoryContext extends LifecycleHarness {
  createHarness: (
    overrides?: Parameters<typeof createPositionLifecycleRepositoryHarness>[0],
  ) => LifecycleHarness;
  cleanup: () => void;
}

export type PositionLifecycleRepositorySuiteState = Pick<
  ManagedPositionLifecycleRepositoryContext,
  | 'service'
  | 'mockExchange'
  | 'mockTelegram'
  | 'mockLogger'
  | 'mockJournal'
  | 'mockEventBus'
  | 'mockRepository'
  | 'tradingConfig'
  | 'riskConfig'
  | 'entryConfig'
  | 'fullConfig'
  | 'cleanup'
>;

export function createManagedPositionLifecycleRepositoryContext(
  options: Parameters<typeof createPositionLifecycleRepositoryHarness>[0] = {},
): ManagedPositionLifecycleRepositoryContext {
  const trackedHarnesses: LifecycleHarness[] = [];
  const createHarness = (
    overrides: Parameters<typeof createPositionLifecycleRepositoryHarness>[0] = {},
  ): LifecycleHarness => {
    const harness = createPositionLifecycleRepositoryHarness({
      ...options,
      ...overrides,
    });
    trackedHarnesses.push(harness);
    return harness;
  };

  const harness = createHarness();

  return {
    ...harness,
    createHarness,
    cleanup: () => {
      trackedHarnesses.length = 0;
      jest.clearAllMocks();
    },
  };
}

export function syncLifecycleWebSocketPosition(
  service: PositionLifecycleService,
  basePosition: Position,
  overrides: Partial<Position> = {},
): Position {
  const wsPosition = createLifecycleWebSocketPosition(basePosition, overrides);
  service.syncWithWebSocket(wsPosition);
  return wsPosition;
}

export function seedLifecycleSyncedPosition(options: {
  service: PositionLifecycleService;
  mockRepository: jest.Mocked<IPositionRepository>;
  position: Position;
}): Position {
  attachLifecycleRepositoryPosition(options.mockRepository, options.position);
  options.service.syncWithWebSocket(options.position);
  return options.position;
}

export interface ManagedPositionLifecycleSafetyContext
  extends ReturnType<typeof createPositionLifecycleSafetyHarness> {
  createHarness: (
    overrides?: Parameters<typeof createPositionLifecycleSafetyHarness>[0],
  ) => ReturnType<typeof createPositionLifecycleSafetyHarness>;
  cleanup: () => void;
}

export type PositionLifecycleSafetySuiteState = Pick<
  ManagedPositionLifecycleSafetyContext,
  | 'service'
  | 'internals'
  | 'setCurrentPosition'
  | 'position'
  | 'mockExchange'
  | 'mockLogger'
  | 'mockEventBus'
  | 'mockTelegram'
  | 'mockJournal'
  | 'cleanup'
>;

export function createManagedPositionLifecycleSafetyContext(
  options: Parameters<typeof createPositionLifecycleSafetyHarness>[0] = {},
): ManagedPositionLifecycleSafetyContext {
  const trackedHarnesses: Array<ReturnType<typeof createPositionLifecycleSafetyHarness>> = [];
  const createHarness = (
    overrides: Parameters<typeof createPositionLifecycleSafetyHarness>[0] = {},
  ) => {
    const harness = createPositionLifecycleSafetyHarness({
      ...options,
      ...overrides,
    });
    trackedHarnesses.push(harness);
    return harness;
  };

  const harness = createHarness();

  return {
    ...harness,
    createHarness,
    cleanup: () => {
      trackedHarnesses.length = 0;
      jest.clearAllMocks();
    },
  };
}
