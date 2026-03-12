import { TradingBot } from '../bot';
import { createTradingBotServiceBundle } from '../services/bot-services-adapter';
import { BotInitializer } from '../services/bot-initializer';
import { createTrackedServices, shutdownTrackedServices, type TrackedServiceState } from './helpers/service-lifecycle-test.utils';
import { WebSocketEventHandlerManager } from '../services/websocket-event-handler-manager';
import type { BotFactoryOptions } from '../services/bot-factory.service';
import type { Config } from '../types/legacy';
import type { IExchange } from '../interfaces';

const createConfig = (): Config => ({
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
} as unknown as Config);

const createMockExchange = (): IExchange => ({
  name: 'MockExchange',
  initialize: jest.fn().mockResolvedValue(undefined),
  resyncTime: jest.fn().mockResolvedValue(undefined),
  cancelAllConditionalOrders: jest.fn().mockResolvedValue(undefined),
  getOpenPositions: jest.fn().mockResolvedValue([]),
  getCandles: jest.fn().mockResolvedValue([]),
  getServerTime: jest.fn().mockResolvedValue(Date.now()),
  isConnected: jest.fn(() => true),
} as unknown as IExchange);

const createMockTelegram = (): NonNullable<BotFactoryOptions['telegram']> => ({
  notifyBotStarted: jest.fn().mockResolvedValue(undefined),
  notifyBotStopped: jest.fn().mockResolvedValue(undefined),
} as unknown as NonNullable<BotFactoryOptions['telegram']>);

describe('TradingBot lifecycle delegation', () => {
  let trackedServices: TrackedServiceState[];

  beforeEach(() => {
    trackedServices = [];
  });

  afterEach(async () => {
    await shutdownTrackedServices(trackedServices);
    jest.restoreAllMocks();
  });

  const createBot = () => {
    const config = createConfig();
    const exchange = createMockExchange();
    const telegram = createMockTelegram();
    const serviceState = createTrackedServices(trackedServices, config, {
      bybitService: exchange,
      telegram,
    });

    return {
      bot: new TradingBot(createTradingBotServiceBundle(serviceState), config),
      config,
      exchange,
      telegram,
    };
  };

  test('start() delegates startup to initializer.bootstrap()', async () => {
    const { bot, telegram } = createBot();
    const registerAllHandlersSpy = jest
      .spyOn(WebSocketEventHandlerManager.prototype, 'registerAllHandlers')
      .mockImplementation(() => {});
    const bootstrapSpy = jest
      .spyOn(BotInitializer.prototype, 'bootstrap')
      .mockImplementation(async (hooks) => {
        await hooks?.beforeMonitoring?.();
      });
    jest.spyOn(BotInitializer.prototype, 'shutdown').mockResolvedValue(undefined);

    try {
      await bot.start();

      expect(bootstrapSpy).toHaveBeenCalledTimes(1);
      expect(registerAllHandlersSpy).toHaveBeenCalledTimes(1);
      expect(telegram.notifyBotStarted).toHaveBeenCalledTimes(1);
      expect(bot.isRunning).toBe(true);
    } finally {
      await bot.stop();
    }
  });

  test('stop() delegates shutdown to initializer.shutdown()', async () => {
    const { bot } = createBot();
    jest.spyOn(BotInitializer.prototype, 'bootstrap').mockImplementation(async (hooks) => {
      await hooks?.beforeMonitoring?.();
    });
    const shutdownSpy = jest
      .spyOn(BotInitializer.prototype, 'shutdown')
      .mockResolvedValue(undefined);
    const cleanupSpy = jest
      .spyOn(WebSocketEventHandlerManager.prototype, 'cleanupAllListeners')
      .mockImplementation(() => {});

    await bot.start();
    await bot.stop();

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    expect(shutdownSpy).toHaveBeenCalledTimes(1);
    expect(bot.isRunning).toBe(false);
  });

  test('start() propagates bootstrap error and keeps bot stopped', async () => {
    const { bot, telegram } = createBot();
    jest
      .spyOn(BotInitializer.prototype, 'bootstrap')
      .mockRejectedValue(new Error('bootstrap failed'));
    const shutdownSpy = jest
      .spyOn(BotInitializer.prototype, 'shutdown')
      .mockResolvedValue(undefined);

    await expect(bot.start()).rejects.toThrow('bootstrap failed');

    expect(bot.isRunning).toBe(false);
    expect(shutdownSpy).not.toHaveBeenCalled();
    expect(telegram.notifyBotStarted).not.toHaveBeenCalled();
  });
});
