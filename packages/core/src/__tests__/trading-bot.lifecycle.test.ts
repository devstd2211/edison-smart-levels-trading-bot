import { TradingBot } from '../bot';
import { BotInitializer } from '../services/bot-initializer';
import { WebSocketEventHandlerManager } from '../services/websocket-event-handler-manager';

const createConfig = (): any => ({
  exchange: { symbol: 'XRPUSDT' },
  trading: {},
  timeframes: {
    entry: { enabled: true, interval: '1' },
    primary: { enabled: true, interval: '5' },
  },
  dashboard: { enabled: false },
});

const createServices = (): any => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const positionMonitor = {
    on: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    removeAllListeners: jest.fn(),
  };

  const publicWebSocket = {
    on: jest.fn(),
    off: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    setBtcCandlesStore: jest.fn(),
    removeAllListeners: jest.fn(),
  };

  return {
    logger,
    coreServices: {
      logger,
      eventBus: {
        on: jest.fn(),
        emit: jest.fn(),
      },
      telegram: {
        notifyBotStarted: jest.fn().mockResolvedValue(undefined),
        notifyBotStopped: jest.fn().mockResolvedValue(undefined),
      },
      timeService: {
        syncWithExchange: jest.fn().mockResolvedValue(undefined),
        getSyncInfo: jest.fn().mockReturnValue({ offset: 0, nextSyncIn: 1000 }),
      },
    },
    marketDataServices: {
      bybitService: {},
      candleProvider: {},
      orderbookManager: {},
      webSocketManager: {
        on: jest.fn(),
        off: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        removeAllListeners: jest.fn(),
      },
      publicWebSocket,
    },
    executionServices: {
      positionManager: {
        getCurrentPosition: jest.fn().mockReturnValue(null),
        isPositionOpening: jest.fn().mockReturnValue(false),
        syncWithWebSocket: jest.fn(),
      },
      tradingOrchestrator: {},
      positionMonitor,
    },
    positionMonitor,
    monitoringServices: {
      metrics: {},
      dashboard: {
        start: jest.fn(),
        stop: jest.fn(),
        recordEvent: jest.fn(),
      },
    },
    webApiServices: {
      bybitService: { getBalance: jest.fn() },
    },
    publicWebSocket,
    eventHandlerServices: {},
    tradingOrchestrator: {
      onCandleClosed: jest.fn(),
      onOrderbookUpdate: jest.fn(),
      checkWhaleSignalRealtime: jest.fn(),
    },
  };
};

describe('TradingBot lifecycle delegation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('start() delegates startup to initializer.bootstrap()', async () => {
    const services = createServices();
    const registerAllHandlersSpy = jest
      .spyOn(WebSocketEventHandlerManager.prototype, 'registerAllHandlers')
      .mockImplementation(() => {});
    const bootstrapSpy = jest
      .spyOn(BotInitializer.prototype, 'bootstrap')
      .mockImplementation(async (hooks) => {
        await hooks?.beforeMonitoring?.();
      });

    const bot = new TradingBot(services, createConfig());
    await bot.start();

    expect(bootstrapSpy).toHaveBeenCalledTimes(1);
    expect(registerAllHandlersSpy).toHaveBeenCalledTimes(1);
    expect(services.coreServices.telegram.notifyBotStarted).toHaveBeenCalledTimes(1);
    expect(bot.isRunning).toBe(true);
  });

  test('stop() delegates shutdown to initializer.shutdown()', async () => {
    const services = createServices();
    jest.spyOn(BotInitializer.prototype, 'bootstrap').mockImplementation(async (hooks) => {
      await hooks?.beforeMonitoring?.();
    });
    const shutdownSpy = jest
      .spyOn(BotInitializer.prototype, 'shutdown')
      .mockResolvedValue(undefined);
    const cleanupSpy = jest
      .spyOn(WebSocketEventHandlerManager.prototype, 'cleanupAllListeners')
      .mockImplementation(() => {});

    const bot = new TradingBot(services, createConfig());
    await bot.start();
    await bot.stop();

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    expect(shutdownSpy).toHaveBeenCalledTimes(1);
    expect(bot.isRunning).toBe(false);
  });

  test('start() propagates bootstrap error and keeps bot stopped', async () => {
    const services = createServices();
    jest
      .spyOn(BotInitializer.prototype, 'bootstrap')
      .mockRejectedValue(new Error('bootstrap failed'));
    const shutdownSpy = jest
      .spyOn(BotInitializer.prototype, 'shutdown')
      .mockResolvedValue(undefined);

    const bot = new TradingBot(services, createConfig());
    await expect(bot.start()).rejects.toThrow('bootstrap failed');

    expect(bot.isRunning).toBe(false);
    expect(shutdownSpy).not.toHaveBeenCalled();
    expect(services.coreServices.telegram.notifyBotStarted).not.toHaveBeenCalled();
  });
});
