import { BotInitializer } from '../../services/bot-initializer';
import { TradingBot } from '../../bot';
import { createTradingBotServiceBundle } from '../../services/bot-services-adapter';
import { createServices, type BotFactoryOptions } from '../../services/bot-factory.service';
import type { IBotInitializerServices, IBotServicesAdapterSource } from '../../interfaces';
import type { IExchange } from '../../interfaces';
import type { Config } from '../../types/legacy';

export interface TrackedServiceState {
  config: Config;
  services: IBotServicesAdapterSource;
}

export type ManagedTrackedServicesContext = {
  trackedServices: TrackedServiceState[];
  cleanup: () => Promise<void>;
  createTradingBotHarness: (
    overrides?: Parameters<typeof createTrackedLifecycleHarness>[1],
  ) => ReturnType<typeof createTrackedTradingBotHarness>;
  createInitializerHarness: (
    overrides?: Parameters<typeof createTrackedLifecycleHarness>[1],
  ) => ReturnType<typeof createTrackedInitializerHarness>;
  reset: () => void;
};

export type TrackedServicesFactories = Pick<
  ManagedTrackedServicesContext,
  'createInitializerHarness' | 'cleanup'
>;

export type TrackedServicesRuntime = Pick<
  ManagedTrackedServicesContext,
  'trackedServices'
>;

export type TrackedServicesState = Pick<
  ManagedTrackedServicesContext,
  'trackedServices' | 'cleanup'
>;

export type TrackedServicesLifecycleState = Pick<
  ManagedTrackedServicesContext,
  'createInitializerHarness' | 'cleanup'
>;

export function trackCreatedServices(
  trackedServices: TrackedServiceState[],
  config: Config,
  services: IBotServicesAdapterSource,
): IBotServicesAdapterSource {
  trackedServices.push({ config, services });
  return services;
}

export function createTrackedServices(
  trackedServices: TrackedServiceState[],
  config: Config,
  options: BotFactoryOptions = {},
): IBotServicesAdapterSource {
  return trackCreatedServices(trackedServices, config, createServices(config, options));
}

export async function shutdownTrackedServices(
  trackedServices: TrackedServiceState[],
): Promise<void> {
  while (trackedServices.length > 0) {
    const tracked = trackedServices.pop();
    if (!tracked) {
      continue;
    }

    const initializer = new BotInitializer(
      tracked.services as unknown as IBotInitializerServices,
      tracked.config,
    );
    await initializer.shutdown().catch(() => undefined);
  }
}

export function createManagedTrackedServicesContext(): ManagedTrackedServicesContext {
  const trackedServices: TrackedServiceState[] = [];

  return {
    trackedServices,
    cleanup: () => shutdownTrackedServices(trackedServices),
    reset: () => {
      trackedServices.length = 0;
    },
    createTradingBotHarness: (overrides = {}) =>
      createTrackedTradingBotHarness(trackedServices, overrides),
    createInitializerHarness: (overrides = {}) =>
      createTrackedInitializerHarness(trackedServices, overrides),
  };
}

export function createMinimalLifecycleConfig(): Config {
  return {
    exchange: {
      name: 'bybit',
      symbol: 'XRPUSDT',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      demo: true,
      testnet: true,
    },
    trading: { leverage: 10, marginType: 'CROSS' },
    riskManagement: {
      stopLossPercent: 2,
      takeProfits: [0.5, 1, 1.5],
      positionSizeUsdt: 100,
    },
    logging: { level: 'info', logDir: './logs', logToFile: false },
    telegram: { enabled: false },
    timeframes: {
      entry: { interval: '1', candleLimit: 1000, enabled: true },
      primary: { interval: '5', candleLimit: 500, enabled: true },
    },
    dashboard: { enabled: false },
    dataSubscriptions: {
      candles: { enabled: false, calculateIndicators: false },
      orderbook: { enabled: true, updateIntervalMs: 100 },
      ticks: { enabled: true, calculateDelta: true },
    },
    system: { timeSyncIntervalMs: 60000, timeSyncMaxFailures: 3 },
    indicators: { rsiPeriod: 14, slowEmaPeriod: 50 },
    entryConfig: {
      divergenceDetector: false,
    },
    strategy: {
      priceAction: false,
    },
    strategies: {},
    analyzers: [],
  } as unknown as Config;
}

export function createMockLifecycleExchange(): IExchange {
  return {
    name: 'MockExchange',
    initialize: jest.fn().mockResolvedValue(undefined),
    resyncTime: jest.fn().mockResolvedValue(undefined),
    cancelAllConditionalOrders: jest.fn().mockResolvedValue(undefined),
    getOpenPositions: jest.fn().mockResolvedValue([]),
    getCandles: jest.fn().mockResolvedValue([]),
    getServerTime: jest.fn().mockResolvedValue(Date.now()),
    isConnected: jest.fn(() => true),
  } as unknown as IExchange;
}

export function createMockLifecycleTelegram(): NonNullable<BotFactoryOptions['telegram']> {
  return {
    notifyBotStarted: jest.fn().mockResolvedValue(undefined),
    notifyBotStopped: jest.fn().mockResolvedValue(undefined),
  } as unknown as NonNullable<BotFactoryOptions['telegram']>;
}

export function createTrackedLifecycleHarness(
  trackedServices: TrackedServiceState[],
  overrides: {
    config?: Config;
    exchange?: IExchange;
    telegram?: NonNullable<BotFactoryOptions['telegram']>;
    options?: BotFactoryOptions;
  } = {},
): {
  config: Config;
  exchange: IExchange;
  telegram: NonNullable<BotFactoryOptions['telegram']>;
  services: IBotServicesAdapterSource;
} {
  const config = overrides.config ?? createMinimalLifecycleConfig();
  const exchange = overrides.exchange ?? createMockLifecycleExchange();
  const telegram = overrides.telegram ?? createMockLifecycleTelegram();
  const services = createTrackedServices(trackedServices, config, {
    bybitService: exchange,
    telegram,
    ...overrides.options,
  });

  return {
    config,
    exchange,
    telegram,
    services,
  };
}

export function createTrackedTradingBotHarness(
  trackedServices: TrackedServiceState[],
  overrides: Parameters<typeof createTrackedLifecycleHarness>[1] = {},
): {
  bot: TradingBot;
  config: Config;
  exchange: IExchange;
  telegram: NonNullable<BotFactoryOptions['telegram']>;
  services: IBotServicesAdapterSource;
} {
  const harness = createTrackedLifecycleHarness(trackedServices, overrides);

  return {
    bot: new TradingBot(createTradingBotServiceBundle(harness.services), harness.config),
    config: harness.config,
    exchange: harness.exchange,
    telegram: harness.telegram,
    services: harness.services,
  };
}

export function createTrackedInitializerHarness(
  trackedServices: TrackedServiceState[],
  overrides: Parameters<typeof createTrackedLifecycleHarness>[1] = {},
): {
  initializer: BotInitializer;
  config: Config;
  exchange: IExchange;
  telegram: NonNullable<BotFactoryOptions['telegram']>;
  services: IBotServicesAdapterSource;
} {
  const harness = createTrackedLifecycleHarness(trackedServices, overrides);

  return {
    initializer: new BotInitializer(
      harness.services as unknown as IBotInitializerServices,
      harness.config,
    ),
    config: harness.config,
    exchange: harness.exchange,
    telegram: harness.telegram,
    services: harness.services,
  };
}

export function spyOnTrackedServiceLifecycle(services: IBotServicesAdapterSource): {
  bybitInitSpy: jest.SpyInstance;
  bybitOpenPositionsSpy: jest.SpyInstance;
  syncSpy: jest.SpyInstance;
  sessionStartSpy: jest.SpyInstance;
  sessionEndSpy: jest.SpyInstance;
  wsStartSpy: jest.SpyInstance;
  wsStopSpy: jest.SpyInstance;
  publicStartSpy: jest.SpyInstance;
  publicStopSpy: jest.SpyInstance;
  monitorStartSpy: jest.SpyInstance;
  monitorStopSpy: jest.SpyInstance;
} {
  const bybit = services.marketDataServices.bybitService;
  const wsManager = services.marketDataServices.webSocketManager;
  const publicWs = services.marketDataServices.publicWebSocket;
  const positionMonitor = services.executionServices.positionMonitor;

  return {
    bybitInitSpy: jest.spyOn(bybit, 'initialize'),
    bybitOpenPositionsSpy: jest.spyOn(bybit, 'getOpenPositions'),
    syncSpy: jest
      .spyOn(services.coreServices.timeService, 'syncWithExchange')
      .mockResolvedValue(undefined),
    sessionStartSpy: jest
      .spyOn(services.sessionStats, 'startSession')
      .mockReturnValue('session-test'),
    sessionEndSpy: jest
      .spyOn(services.sessionStats, 'endSession')
      .mockImplementation(() => undefined),
    wsStartSpy: jest.spyOn(wsManager, 'start').mockResolvedValue(undefined),
    wsStopSpy: jest.spyOn(wsManager, 'stop').mockResolvedValue(undefined),
    publicStartSpy: jest.spyOn(publicWs, 'start').mockImplementation(() => undefined),
    publicStopSpy: jest.spyOn(publicWs, 'stop').mockImplementation(() => undefined),
    monitorStartSpy: jest.spyOn(positionMonitor, 'start').mockImplementation(() => undefined),
    monitorStopSpy: jest.spyOn(positionMonitor, 'stop').mockImplementation(() => undefined),
  };
}
