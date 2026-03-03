import { TradingBot } from '../bot';
import { createServices } from '../services/bot-factory.service';
import { createTradingBotServiceBundle } from '../services/bot-services-adapter';
import type { Config } from '../types/legacy';

function getMinimalConfig(): Config {
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
  } as any;
}

describe('TradingBot + createServices lifecycle orchestration', () => {
  test('services are idle before start and explicitly stopped via bot.stop()', async () => {
    const config = getMinimalConfig();
    const mockExchange = {
      name: 'MockExchange',
      initialize: jest.fn().mockResolvedValue(undefined),
      resyncTime: jest.fn().mockResolvedValue(undefined),
      cancelAllConditionalOrders: jest.fn().mockResolvedValue(undefined),
      getOpenPositions: jest.fn().mockResolvedValue([]),
      getCandles: jest.fn().mockResolvedValue([]),
      getServerTime: jest.fn().mockResolvedValue(Date.now()),
      isConnected: jest.fn(() => true),
    };
    const mockTelegram = {
      notifyBotStarted: jest.fn().mockResolvedValue(undefined),
      notifyBotStopped: jest.fn().mockResolvedValue(undefined),
    };

    const serviceState = createServices(config, {
      bybitService: mockExchange as any,
      telegram: mockTelegram as any,
    });
    const bot = new TradingBot(createTradingBotServiceBundle(serviceState), config);

    const wsManager = serviceState.marketDataServices.webSocketManager as any;
    const publicWs = serviceState.marketDataServices.publicWebSocket as any;
    const positionMonitor = serviceState.executionServices.positionMonitor as any;

    const syncSpy = jest
      .spyOn(serviceState.coreServices.timeService, 'syncWithExchange')
      .mockResolvedValue(undefined);
    const wsStartSpy = jest.spyOn(wsManager, 'start').mockResolvedValue(undefined);
    const wsStopSpy = jest.spyOn(wsManager, 'stop').mockResolvedValue(undefined);
    const publicStartSpy = jest.spyOn(publicWs, 'start').mockImplementation(() => undefined);
    const publicStopSpy = jest.spyOn(publicWs, 'stop').mockImplementation(() => undefined);
    const monitorStartSpy = jest.spyOn(positionMonitor, 'start').mockImplementation(() => undefined);
    const monitorStopSpy = jest.spyOn(positionMonitor, 'stop').mockImplementation(() => undefined);

    expect(mockExchange.initialize).not.toHaveBeenCalled();
    expect(syncSpy).not.toHaveBeenCalled();
    expect(wsStartSpy).not.toHaveBeenCalled();
    expect(publicStartSpy).not.toHaveBeenCalled();
    expect(monitorStartSpy).not.toHaveBeenCalled();
    expect(bot.isRunning).toBe(false);

    try {
      await bot.start();
      expect(bot.isRunning).toBe(true);
      expect(mockExchange.initialize).toHaveBeenCalledTimes(1);
      expect(syncSpy).toHaveBeenCalled();
      expect(wsStartSpy).toHaveBeenCalledTimes(1);
      expect(publicStartSpy).toHaveBeenCalledTimes(1);
      expect(monitorStartSpy).toHaveBeenCalledTimes(1);
      expect(mockTelegram.notifyBotStarted).toHaveBeenCalledTimes(1);
    } finally {
      await bot.stop();
    }

    expect(bot.isRunning).toBe(false);
    expect(wsStopSpy).toHaveBeenCalledTimes(1);
    expect(publicStopSpy).toHaveBeenCalledTimes(1);
    expect(monitorStopSpy).toHaveBeenCalledTimes(1);
    expect(mockTelegram.notifyBotStopped).toHaveBeenCalledTimes(1);
  });
});
