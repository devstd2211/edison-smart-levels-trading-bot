import { BotInitializer } from '../../services/bot-initializer';
import { TradingBot } from '../../bot';
import {
  createBotInitializerServices,
  createTradingBotRuntimeDependencies,
} from '../../services/bot-services-adapter';
import { createServiceState, type BotFactoryOptions } from '../../services/bot-factory.service';
import type { IBotFactoryServiceSource } from '../../interfaces';
import type { IExchange } from '../../interfaces';
import type { Config } from '../../types/legacy';

export interface TrackedServiceState {
  config: Config;
  services: IBotFactoryServiceSource;
}

export type TrackedLifecycleHarnessOverrides = {
  config?: Config;
  exchange?: IExchange;
  telegram?: NonNullable<BotFactoryOptions['telegram']>;
  options?: BotFactoryOptions;
};

export type TrackedLifecycleHarness = {
  config: Config;
  exchange: IExchange;
  telegram: NonNullable<BotFactoryOptions['telegram']>;
  services: IBotFactoryServiceSource;
};

export type TrackedTradingBotHarness = TrackedLifecycleHarness & {
  bot: TradingBot;
};

export type TrackedInitializerHarness = TrackedLifecycleHarness & {
  initializer: BotInitializer;
};

export type ManagedTrackedServicesContext = {
  trackedServices: TrackedServiceState[];
  cleanup: () => Promise<void>;
  createTradingBotHarness: (
    overrides?: TrackedLifecycleHarnessOverrides,
  ) => TrackedTradingBotHarness;
  createInitializerHarness: (
    overrides?: TrackedLifecycleHarnessOverrides,
  ) => TrackedInitializerHarness;
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
  services: IBotFactoryServiceSource,
): IBotFactoryServiceSource {
  trackedServices.push({ config, services });
  return services;
}

export function createTrackedServices(
  trackedServices: TrackedServiceState[],
  config: Config,
  options: BotFactoryOptions = {},
): IBotFactoryServiceSource {
  return trackCreatedServices(trackedServices, config, createServiceState(config, options));
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
      createBotInitializerServices(tracked.services),
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
  overrides: TrackedLifecycleHarnessOverrides = {},
): TrackedLifecycleHarness {
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
  overrides: TrackedLifecycleHarnessOverrides = {},
): TrackedTradingBotHarness {
  const harness = createTrackedLifecycleHarness(trackedServices, overrides);

  return {
    bot: new TradingBot(createTradingBotRuntimeDependencies(harness.services), harness.config),
    config: harness.config,
    exchange: harness.exchange,
    telegram: harness.telegram,
    services: harness.services,
  };
}

export function createTrackedInitializerHarness(
  trackedServices: TrackedServiceState[],
  overrides: TrackedLifecycleHarnessOverrides = {},
): TrackedInitializerHarness {
  const harness = createTrackedLifecycleHarness(trackedServices, overrides);

  return {
    initializer: new BotInitializer(
      createBotInitializerServices(harness.services),
      harness.config,
    ),
    config: harness.config,
    exchange: harness.exchange,
    telegram: harness.telegram,
    services: harness.services,
  };
}

export function spyOnTrackedServiceLifecycle(services: IBotFactoryServiceSource): {
  journalStartSpy: jest.SpyInstance;
  sessionInitSpy: jest.SpyInstance;
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
    journalStartSpy: jest.spyOn(services.journal, 'start').mockImplementation(() => undefined),
    sessionInitSpy: jest.spyOn(services.sessionStats, 'start').mockImplementation(() => undefined),
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
