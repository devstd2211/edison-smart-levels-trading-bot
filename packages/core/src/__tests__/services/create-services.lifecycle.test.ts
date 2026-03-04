import { BotInitializer } from '../../services/bot-initializer';
import { createServices } from '../../services/bot-factory.service';
import type { Config } from '../../types/legacy';
import type { IExchange, IBotInitializerServices } from '../../interfaces';

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

describe('createServices lifecycle orchestration', () => {
  test('services stay idle until explicit bootstrap/start and stop on shutdown', async () => {
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
    } as unknown as IExchange;

    const services = createServices(config, {
      bybitService: mockExchange,
    });
    const initializer = new BotInitializer(services as unknown as IBotInitializerServices, config);

    const bybit = services.marketDataServices.bybitService;
    const wsManager = services.marketDataServices.webSocketManager;
    const publicWs = services.marketDataServices.publicWebSocket;
    const positionMonitor = services.executionServices.positionMonitor;

    const bybitInitSpy = jest.spyOn(bybit, 'initialize');
    const bybitOpenPositionsSpy = jest.spyOn(bybit, 'getOpenPositions');

    const syncSpy = jest
      .spyOn(services.coreServices.timeService, 'syncWithExchange')
      .mockResolvedValue(undefined);
    const sessionStartSpy = jest
      .spyOn(services.sessionStats, 'startSession')
      .mockReturnValue('session-test');
    const sessionEndSpy = jest
      .spyOn(services.sessionStats, 'endSession')
      .mockImplementation(() => undefined);

    const wsStartSpy = jest.spyOn(wsManager, 'start').mockResolvedValue(undefined);
    const wsStopSpy = jest.spyOn(wsManager, 'stop').mockResolvedValue(undefined);
    const publicStartSpy = jest.spyOn(publicWs, 'start').mockImplementation(() => undefined);
    const publicStopSpy = jest.spyOn(publicWs, 'stop').mockImplementation(() => undefined);
    const monitorStartSpy = jest.spyOn(positionMonitor, 'start').mockImplementation(() => undefined);
    const monitorStopSpy = jest.spyOn(positionMonitor, 'stop').mockImplementation(() => undefined);

    // Side-effect-free creation: no lifecycle start calls at construction time.
    expect(bybitInitSpy).not.toHaveBeenCalled();
    expect(wsStartSpy).not.toHaveBeenCalled();
    expect(publicStartSpy).not.toHaveBeenCalled();
    expect(monitorStartSpy).not.toHaveBeenCalled();

    try {
      await initializer.bootstrap();

      expect(bybitInitSpy).toHaveBeenCalledTimes(1);
      expect(bybitOpenPositionsSpy).toHaveBeenCalled();
      expect(syncSpy).toHaveBeenCalled();
      expect(sessionStartSpy).toHaveBeenCalled();
      expect(wsStartSpy).toHaveBeenCalledTimes(1);
      expect(publicStartSpy).toHaveBeenCalledTimes(1);
      expect(monitorStartSpy).toHaveBeenCalledTimes(1);
    } finally {
      await initializer.shutdown();
    }

    expect(wsStopSpy).toHaveBeenCalledTimes(1);
    expect(publicStopSpy).toHaveBeenCalledTimes(1);
    expect(monitorStopSpy).toHaveBeenCalledTimes(1);
    expect(sessionEndSpy).toHaveBeenCalled();
  });
});
