import { BotInitializer } from '../../services/bot-initializer';
import { TradingBot } from '../../bot';
import { cleanupManagedHarnessesAsync } from './managed-test-context.utils';
import {
  createBotInitializerServices,
} from '../../services/runtime-service-adapters';
import { createBotRuntimeBundle, type BotRuntimeBundle } from '../../factories/create-runtime-bundle';
import {
  createTradingBotRuntime,
  type TradingBotRuntime,
} from '../../factories/create-trading-bot-runtime';
import { createBotFactoryRuntimeSource, type BotFactoryOptions } from '../../services/bot-factory.service';
import type {
  IBotFactoryRuntimeSource,
  IBotInitializerServices,
  ITradingBotRuntimeDependencies,
} from '../../interfaces';
import type { IExchange } from '../../interfaces';
import type { LoggerService } from '../../services/logger.service';
import type { Config } from '../../types/legacy';

export interface TrackedServiceState {
  config: Config;
  services: IBotFactoryRuntimeSource;
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
  services: IBotFactoryRuntimeSource;
};

export type TrackedRuntimeBundleHarness = TrackedLifecycleHarness & {
  runtimeBundle: BotRuntimeBundle;
  runtimeDependencies: ITradingBotRuntimeDependencies;
};

export type TrackedTradingBotHarness = TrackedRuntimeBundleHarness & {
  bot: TradingBot;
};

export type TrackedFactoryTradingBotRuntimeHarness = TrackedLifecycleHarness & {
  runtime: TradingBotRuntime;
  bot: TradingBot;
};

export type TrackedInitializerHarness = TrackedLifecycleHarness & {
  initializerServices: IBotInitializerServices;
  initializer: BotInitializer;
};

export type ManagedTrackedServicesContext = {
  trackedServices: TrackedServiceState[];
  cleanup: () => Promise<void>;
  createRuntimeBundleHarness: (
    overrides?: TrackedLifecycleHarnessOverrides,
  ) => TrackedRuntimeBundleHarness;
  createTradingBotHarness: (
    overrides?: TrackedLifecycleHarnessOverrides,
  ) => TrackedTradingBotHarness;
  createFactoryTradingBotRuntimeHarness: (
    overrides?: TrackedLifecycleHarnessOverrides,
  ) => TrackedFactoryTradingBotRuntimeHarness;
  createInitializerHarness: (
    overrides?: TrackedLifecycleHarnessOverrides,
  ) => TrackedInitializerHarness;
  reset: () => void;
};

export type TrackedServicesFactories = Pick<
  ManagedTrackedServicesContext,
  | 'createInitializerHarness'
  | 'createRuntimeBundleHarness'
  | 'createFactoryTradingBotRuntimeHarness'
  | 'cleanup'
>;

export type TrackedServicesRuntime = Pick<
  ManagedTrackedServicesContext,
  'trackedServices'
>;

export type TrackedServicesState = Pick<
  ManagedTrackedServicesContext,
  'trackedServices' | 'cleanup'
>;

export type TrackedServicesLifecycleRuntime = Pick<
  ManagedTrackedServicesContext,
  'createInitializerHarness' | 'createFactoryTradingBotRuntimeHarness' | 'cleanup'
>;

export function normalizeTrackedLifecycleConfig(config: Config): Config {
  return withQuietLifecycleLogging(config);
}

export function trackCreatedServices(
  trackedServices: TrackedServiceState[],
  config: Config,
  services: IBotFactoryRuntimeSource,
): IBotFactoryRuntimeSource {
  trackedServices.push({ config, services });
  return services;
}

export function createTrackedServices(
  trackedServices: TrackedServiceState[],
  config: Config,
  options: BotFactoryOptions = {},
): IBotFactoryRuntimeSource {
  const trackedConfig = normalizeTrackedLifecycleConfig(config);
  return trackCreatedServices(
    trackedServices,
    trackedConfig,
    createBotFactoryRuntimeSource(trackedConfig, options),
  );
}

export function createTrackedInitializer(
  config: Config,
  services: IBotFactoryRuntimeSource,
): BotInitializer {
  return new BotInitializer(createBotInitializerServices(services), config);
}

function createTrackedInitializerHarnessFromState(
  tracked: TrackedServiceState,
): TrackedInitializerHarness {
  const initializerServices = createBotInitializerServices(tracked.services);

  return {
    initializerServices,
    initializer: createTrackedInitializer(tracked.config, tracked.services),
    config: tracked.config,
    exchange: tracked.services.marketDataServices.bybitService,
    telegram: tracked.services.coreServices.telegram,
    services: tracked.services,
  };
}

type TrackableLogger = Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error'>;

export function silenceTrackedLifecycleLogger(logger: TrackableLogger): () => void {
  const methodNames: Array<keyof TrackableLogger> = ['debug', 'info', 'warn', 'error'];
  const restores = methodNames.flatMap((methodName) => {
    const method = logger[methodName];
    return typeof method === 'function'
      ? [jest.spyOn(logger, methodName).mockImplementation(() => undefined)]
      : [];
  });

  return () => {
    for (const restore of restores.reverse()) {
      restore.mockRestore();
    }
  };
}

export async function shutdownTrackedServices(
  trackedServices: TrackedServiceState[],
): Promise<void> {
  await cleanupManagedHarnessesAsync({
    trackedHarnesses: trackedServices,
    resetHarness: async (tracked) => {
      const harness = createTrackedInitializerHarnessFromState(tracked);
      const restoreLogger = silenceTrackedLifecycleLogger(harness.initializerServices.coreServices.logger);
      try {
        await harness.initializer.shutdown().catch(() => undefined);
      } finally {
        restoreLogger();
      }
    },
  });
}

export function createManagedTrackedServicesContext(): ManagedTrackedServicesContext {
  const state = createManagedTrackedServicesState();

  return {
    ...state,
    reset: () => {
      state.trackedServices.length = 0;
    },
    createRuntimeBundleHarness: (overrides = {}) =>
      createTrackedRuntimeBundleHarness(state.trackedServices, overrides),
    createTradingBotHarness: (overrides = {}) =>
      createTrackedTradingBotHarness(state.trackedServices, overrides),
    createFactoryTradingBotRuntimeHarness: (overrides = {}) =>
      createTrackedFactoryTradingBotRuntimeHarness(state.trackedServices, overrides),
    createInitializerHarness: (overrides = {}) =>
      createTrackedInitializerHarness(state.trackedServices, overrides),
  };
}

export function createManagedTrackedServicesState(): TrackedServicesState {
  const trackedServices: TrackedServiceState[] = [];

  return {
    trackedServices,
    cleanup: () => shutdownTrackedServices(trackedServices),
  };
}

export function createMinimalLifecycleConfig(): Config {
  return normalizeTrackedLifecycleConfig({
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
    logging: { level: 'error', logDir: './logs', logToFile: false },
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
  } as unknown as Config);
}

export function withQuietLifecycleLogging(config: Config): Config {
  return {
    ...config,
    logging: {
      ...(config.logging ?? {}),
      level: 'error',
      logToFile: false,
      logDir: './logs',
    },
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
  const config = normalizeTrackedLifecycleConfig(overrides.config ?? createMinimalLifecycleConfig());
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
  const harness = createTrackedRuntimeBundleHarness(trackedServices, overrides);

  return {
    ...harness,
    bot: new TradingBot(harness.runtimeDependencies, harness.config),
  };
}

export function createTrackedFactoryTradingBotRuntimeHarness(
  trackedServices: TrackedServiceState[],
  overrides: TrackedLifecycleHarnessOverrides = {},
): TrackedFactoryTradingBotRuntimeHarness {
  const config = normalizeTrackedLifecycleConfig(overrides.config ?? createMinimalLifecycleConfig());
  const exchange = overrides.exchange ?? createMockLifecycleExchange();
  const telegram = overrides.telegram ?? createMockLifecycleTelegram();
  const runtime = createTradingBotRuntime(config, {
    bybitService: exchange,
    telegram,
    ...overrides.options,
  });

  trackCreatedServices(trackedServices, config, runtime.runtimeSource);

  return {
    runtime,
    bot: runtime.bot,
    config,
    exchange,
    telegram,
    services: runtime.runtimeSource,
  };
}

export function createTrackedRuntimeBundleHarness(
  trackedServices: TrackedServiceState[],
  overrides: TrackedLifecycleHarnessOverrides = {},
): TrackedRuntimeBundleHarness {
  const harness = createTrackedLifecycleHarness(trackedServices, overrides);
  const runtimeBundle = createBotRuntimeBundle(harness.services);

  return {
    runtimeBundle,
    runtimeDependencies: runtimeBundle.runtimeDependencies,
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
  const initializerHarness = createTrackedInitializerHarnessFromState({
    config: harness.config,
    services: harness.services,
  });

  return {
    ...initializerHarness,
    exchange: harness.exchange,
    telegram: harness.telegram,
  };
}

export function mockSuccessfulInitializerLifecycle(): {
  bootstrapSpy: jest.SpyInstance;
  shutdownSpy: jest.SpyInstance;
} {
  const bootstrapSpy = jest
    .spyOn(BotInitializer.prototype, 'bootstrap')
    .mockImplementation(async (hooks) => {
      await hooks?.beforeMonitoring?.();
      await hooks?.afterStart?.();
    });
  const shutdownSpy = jest
    .spyOn(BotInitializer.prototype, 'shutdown')
    .mockImplementation(async (hooks) => {
      await hooks?.beforeShutdown?.();
      await hooks?.afterShutdown?.();
    });

  return {
    bootstrapSpy,
    shutdownSpy,
  };
}

export function spyOnTrackedServiceLifecycle(services: IBotFactoryRuntimeSource): {
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
