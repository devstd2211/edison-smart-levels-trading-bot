import { BotInitializer } from '../../services/bot-initializer';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import type { IBotInitializerServices } from '../../interfaces';
import type { LoggerService } from '../../services/logger.service';
import type { Config } from '../../types/legacy';
import { LogLevel, OrderType } from '../../types/legacy';

type LoggerLike = Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error' | 'getLogFilePath'>;

export function createBotInitializerMockLogger(): LoggerLike {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    getLogFilePath: jest.fn().mockReturnValue('/mock/log/path'),
  };
}

export function createBotInitializerConfig(
  overrides: Partial<Config> = {},
): Config {
  return {
    exchange: {
      name: 'bybit',
      timeframe: '1',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      demo: false,
      testnet: true,
      symbol: 'APEXUSDT',
    },
    trading: {
      leverage: 10,
      riskPercent: 1,
      maxPositions: 1,
      maxConcurrentPositions: 1,
      positionSizeUsdt: 100,
      tradingCycleIntervalMs: 1000,
      orderType: OrderType.MARKET,
      tradingFeeRate: 0.0002,
      favorableMovementThresholdPercent: 0.1,
    },
    riskManagement: {
      stopLossPercent: 2,
      minStopLossPercent: 1,
      maxDailyLossPercent: 5,
      breakevenOffsetPercent: 0.3,
      trailingStopEnabled: false,
      trailingStopPercent: 1,
      trailingStopActivationLevel: 2,
      positionSizeUsdt: 100,
      takeProfits: [
        { level: 1, percent: 0.5, sizePercent: 100 },
      ],
    },
    indicators: {
      atrPeriod: 14,
      fastEmaPeriod: 5,
      slowEmaPeriod: 20,
      rsiPeriod: 14,
      rsiOversold: 30,
      rsiOverbought: 70,
      zigzagDepth: 5,
      zigzagDeviation: 5,
    },
    timeframes: {
      entry: { interval: '1', candleLimit: 100, enabled: true },
      primary: { interval: '5', candleLimit: 100, enabled: true },
      trend1: { interval: '15', candleLimit: 100, enabled: true },
      trend2: { interval: '60', candleLimit: 100, enabled: false },
      context: { interval: '240', candleLimit: 100, enabled: false },
    },
    logging: {
      level: LogLevel.INFO,
      logDir: './logs',
      logToFile: false,
    },
    system: {
      timeSyncIntervalMs: 60000,
      timeSyncMaxFailures: 3,
    },
    atrFilter: { enabled: false, period: 14, minimumATR: 0.01, maximumATR: 100 },
    dataSubscriptions: {
      candles: { enabled: true, calculateIndicators: true },
      orderbook: { enabled: true, updateIntervalMs: 100 },
      ticks: { enabled: true, calculateDelta: true },
    },
    strategies: {} as Config['strategies'],
    entryConfirmation: {} as Config['entryConfirmation'],
    entryConfig: {
      rsiPeriod: 14,
      rsiOversold: 30,
      rsiOverbought: 70,
      fastEmaPeriod: 5,
      slowEmaPeriod: 20,
      zigzagDepth: 5,
      divergenceDetector: {
        minStrength: 0.5,
        priceDiffPercent: 0.5,
      },
    },
    telegram: { enabled: false },
    analysisConfig: {} as Config['analysisConfig'],
    strategicWeights: {} as Config['strategicWeights'],
    tradeHistory: {} as Config['tradeHistory'],
    strategy: {} as Config['strategy'],
    ...overrides,
  } as Config;
}

export function createBotInitializerMockServices(): IBotInitializerServices {
  const logger = createBotInitializerMockLogger();
  const bybitService = {
    initialize: jest.fn().mockResolvedValue(undefined),
    resyncTime: jest.fn().mockResolvedValue(undefined),
    cancelAllConditionalOrders: jest.fn().mockResolvedValue(undefined),
    getOpenPositions: jest.fn().mockResolvedValue([]),
    getCandles: jest.fn().mockResolvedValue([]),
  };
  const exchangeRuntime = {
    current: bybitService,
    setCurrent(exchange: typeof bybitService) {
      exchangeRuntime.current = exchange;
    },
  };

  return {
    coreServices: {
      logger: logger as unknown as LoggerService,
      timeService: {
        syncWithExchange: jest.fn().mockResolvedValue(undefined),
        getSyncInfo: jest.fn().mockReturnValue({
          offset: 0,
          nextSyncIn: 60000,
        }),
      },
      telegram: {
        notifyBotStopped: jest.fn().mockResolvedValue(undefined),
      },
      eventBus: {
        emit: jest.fn(),
      },
    },
    marketDataServices: {
      bybitService,
      candleProvider: {
        initialize: jest.fn().mockResolvedValue(undefined),
      },
      orderbookManager: {
        getSnapshot: jest.fn().mockReturnValue(null),
      } as unknown as IBotInitializerServices['marketDataServices']['orderbookManager'],
      webSocketManager: {
        start: jest.fn(),
        stop: jest.fn(),
        removeAllListeners: jest.fn(),
      },
      publicWebSocket: {
        start: jest.fn(),
        stop: jest.fn(),
        removeAllListeners: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        setBtcCandlesStore: jest.fn(),
      },
    },
    exchangeRuntime,
    executionServices: {
      positionMonitor: {
        start: jest.fn(),
        stop: jest.fn(),
        removeAllListeners: jest.fn(),
      },
      positionManager: {
        getCurrentPosition: jest.fn().mockReturnValue(null),
        isPositionOpening: jest.fn().mockReturnValue(false),
        syncWithWebSocket: jest.fn(),
      },
      positionExitingService: {
        cancelAllOrders: jest.fn(),
      },
      tradingOrchestrator: {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn(),
        initializeTrendAnalysis: jest.fn().mockResolvedValue(undefined),
      },
      orderStateMachine: {
        start: jest.fn().mockResolvedValue(undefined),
        stop: jest.fn(),
      },
    },
    journal: {
      start: jest.fn(),
    },
    sessionStats: {
      start: jest.fn(),
      startSession: jest.fn().mockReturnValue('session-123'),
      endSession: jest.fn(),
    },
    btcMarketState: {
      btcCandles1m: [],
    },
  } as unknown as IBotInitializerServices;
}

export function asBotInitializerMock(fn: unknown): jest.Mock {
  return fn as jest.Mock;
}

export function createBotInitializerMockErrorHandler(): jest.Mocked<ErrorHandler> {
  return {
    handle: jest.fn(async (_operation, options) => {
      return {
        success: true,
        recovered: false,
        attempts: 1,
        message: 'Handled',
        strategy: options.strategy || RecoveryStrategy.SKIP,
        error: undefined,
      };
    }),
    getLogger: jest.fn(() => createBotInitializerMockLogger()),
  } as unknown as jest.Mocked<ErrorHandler>;
}

export function createBotInitializerHarness(options: {
  services?: IBotInitializerServices;
  config?: Config;
  errorHandler?: ErrorHandler;
} = {}) {
  const services = options.services ?? createBotInitializerMockServices();
  const config = options.config ?? createBotInitializerConfig();

  return {
    services,
    config,
    initializer: new BotInitializer(services, config, options.errorHandler),
  };
}

export function createBotInitializerWithoutHandler(
  services: IBotInitializerServices,
  config: Config,
): BotInitializer {
  return new BotInitializer(services, config, undefined);
}

export interface BotInitializerTestContext {
  services: IBotInitializerServices;
  config: Config;
  errorHandler?: ErrorHandler;
  initializer: BotInitializer;
  rebuild: (overrides?: {
    services?: IBotInitializerServices;
    config?: Config;
    errorHandler?: ErrorHandler;
  }) => BotInitializer;
  createWithoutHandler: () => BotInitializer;
  shutdown: () => Promise<void>;
}

export interface ManagedBotInitializerTestContext extends BotInitializerTestContext {
  cleanup: () => Promise<void>;
}

export type BotInitializerManagedRuntime = Pick<
  ManagedBotInitializerTestContext,
  'services' | 'config' | 'errorHandler' | 'rebuild' | 'createWithoutHandler' | 'cleanup'
>;

export type BotInitializerErrorHandlingState = Pick<
  ManagedBotInitializerTestContext,
  'services' | 'config' | 'errorHandler' | 'rebuild' | 'createWithoutHandler' | 'cleanup'
>;

export function createBotInitializerTestContext(options: {
  services?: IBotInitializerServices;
  config?: Config;
  errorHandler?: ErrorHandler;
} = {}): BotInitializerTestContext {
  const context: BotInitializerTestContext = {
    services: options.services ?? createBotInitializerMockServices(),
    config: options.config ?? createBotInitializerConfig(),
    errorHandler: options.errorHandler,
    initializer: undefined as unknown as BotInitializer,
    rebuild(overrides = {}) {
      context.services = overrides.services ?? context.services;
      context.config = overrides.config ?? context.config;
      context.errorHandler =
        Object.prototype.hasOwnProperty.call(overrides, 'errorHandler')
          ? overrides.errorHandler
          : context.errorHandler;
      context.initializer = createBotInitializerHarness({
        services: context.services,
        config: context.config,
        errorHandler: context.errorHandler,
      }).initializer;
      return context.initializer;
    },
    createWithoutHandler() {
      return createBotInitializerWithoutHandler(context.services, context.config);
    },
    async shutdown() {
      await context.initializer.shutdown().catch(() => undefined);
    },
  };

  context.rebuild();

  return context;
}

export function createManagedBotInitializerTestContext(options: {
  services?: IBotInitializerServices;
  config?: Config;
  errorHandler?: ErrorHandler;
} = {}): ManagedBotInitializerTestContext {
  const context = createBotInitializerTestContext(options);

  return {
    ...context,
    cleanup: async () => {
      await context.shutdown();
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}
