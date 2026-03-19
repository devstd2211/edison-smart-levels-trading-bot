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
  return createPositionLifecycleRepositoryHarness({
    ...options,
    errorHandler,
  });
}
