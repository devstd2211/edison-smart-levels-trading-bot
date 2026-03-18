import { BotInitializer } from '../../services/bot-initializer';
import { createServices, type BotFactoryOptions } from '../../services/bot-factory.service';
import type { IBotInitializerServices, IBotServicesAdapterSource } from '../../interfaces';
import type { IExchange } from '../../interfaces';
import type { Config } from '../../types/legacy';

export interface TrackedServiceState {
  config: Config;
  services: IBotServicesAdapterSource;
}

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
    logging: { level: 'info', logDir: './logs' },
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
