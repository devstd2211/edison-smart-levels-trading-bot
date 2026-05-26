import { EventEmitter } from 'events';
import type { IWebApiAdapter } from '@edison/contracts/web-api';
import { createWebApiAdapter } from '../../api/create-web-api-adapter';
import { createWebServerBotInstance, createWebServerRuntime } from '../../web';
import { startWebServerRuntime } from '../../web/web-entrypoint-runtime';
import type { IWebApiReadServices } from '../../interfaces';
import { PositionSide } from '../../types/enums';
import type { Position } from '../../types/position';

var mockWebServer = jest.fn();
var mockWebServerStart = jest.fn();

class WebServerMock {
  close = jest.fn();
  start = mockWebServerStart;

  constructor(...args: unknown[]) {
    mockWebServer(...args);
  }
}

function createWebApiReadServicesFixture(): IWebApiReadServices {
  return {
    logger: {
      error: jest.fn(),
      warn: jest.fn(),
    },
    candleProvider: {
      getCandles: jest.fn().mockResolvedValue([]),
    },
    orderbookManager: {
      getSnapshot: jest.fn().mockReturnValue(null),
    },
    indicatorCache: {
      get: jest.fn().mockReturnValue(null),
    },
    journal: {
      getClosedTrades: jest.fn().mockReturnValue([]),
    },
    bybitService: {
      getBalance: jest.fn().mockResolvedValue({
        walletBalance: 1000,
        availableBalance: 1000,
        totalMarginUsed: 0,
        totalUnrealizedPnL: 0,
      }),
      getFundingRate: jest.fn().mockResolvedValue(0.01),
    },
    wallTrackerService: {
      getActiveWalls: jest.fn().mockReturnValue([
        { side: 'BUY', price: 100, currentSize: 5 },
      ]),
      getWallStrength: jest.fn().mockReturnValue(0.75),
    },
    indicatorPreferences: {
      timeframes: ['5m'],
      rsiPeriods: [14],
      emaPeriods: [20, 50],
      atrPeriods: [14],
    },
  };
}

describe('core web boundary', () => {
  beforeEach(() => {
    mockWebServer.mockReset();
    mockWebServerStart.mockReset();
    mockWebServerStart.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('createWebApiAdapter exposes read-only BotWebAPI accessors', async () => {
    const adapter = createWebApiAdapter(createWebApiReadServicesFixture());

    await expect(adapter.getWalls('BTCUSDT')).resolves.toEqual({
      symbol: 'BTCUSDT',
      walls: [
        { side: 'BUY', price: 100, quantity: 5, strength: 0.75, detected: true },
      ],
    });
  });

  test('startWebServer passes the workspace WebServer the bot adapter and read-only web API adapter', async () => {
    const webApiAdapter: IWebApiAdapter = {
      getMarketData: jest.fn(),
      getCandles: jest.fn(),
      getPositionHistory: jest.fn(),
      getOrderBook: jest.fn(),
      getWalls: jest.fn(),
      getFundingRate: jest.fn(),
      getVolumeProfile: jest.fn(),
    };
    const bot = {
      eventBus: new EventEmitter(),
      isRunning: true,
      getCurrentPosition: jest.fn().mockReturnValue(null),
      getBalance: jest.fn().mockResolvedValue(1000),
      getStatus: jest.fn().mockReturnValue({
        isRunning: true,
        hasPosition: false,
        position: null,
      }),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    };

    const runtime = createWebServerRuntime(bot, webApiAdapter);

    await startWebServerRuntime(runtime, { apiPort: 4100, wsPort: 4101 }, WebServerMock);

    expect(mockWebServer).toHaveBeenCalledTimes(1);
    const [botInstance, config, passedAdapter] = mockWebServer.mock.calls[0];

    expect(config).toEqual({ apiPort: 4100, wsPort: 4101 });
    expect(botInstance).toBe(runtime.botAdapter);
    expect(passedAdapter).toBe(webApiAdapter);
    expect(typeof botInstance.on).toBe('function');
    expect(typeof botInstance.off).toBe('function');
    expect(typeof botInstance.emit).toBe('function');
    expect(typeof botInstance.stop).toBe('function');
    expect(mockWebServerStart).toHaveBeenCalledTimes(1);
  });

  test('createWebServerBotInstance proxies event subscriptions and stop calls through the runtime bus', () => {
    const eventBus = new EventEmitter();
    const listener = jest.fn();
    const bot = {
      eventBus,
      isRunning: true,
      getCurrentPosition: jest.fn().mockReturnValue(null),
      getBalance: jest.fn().mockResolvedValue(1000),
      getStatus: jest.fn().mockReturnValue({
        isRunning: true,
        hasPosition: false,
        position: null,
      }),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    };

    const botInstance = createWebServerBotInstance(bot);

    botInstance.on('signal', listener);
    eventBus.emit('signal', { id: 'signal-1' });
    expect(listener).toHaveBeenCalledWith({ id: 'signal-1' });

    botInstance.off('signal', listener);
    eventBus.emit('signal', { id: 'signal-2' });
    expect(listener).toHaveBeenCalledTimes(1);

    botInstance.emit('bot-started', true);
    botInstance.stop();

    expect(bot.stop).toHaveBeenCalledTimes(1);
  });

  test('createWebServerBotInstance maps runtime positions to the web-server contract shape', () => {
    const eventBus = new EventEmitter();
    const position: Position = {
      id: 'position-1',
      symbol: 'BTCUSDT',
      side: PositionSide.LONG,
      quantity: 0.25,
      entryPrice: 64000,
      leverage: 10,
      marginUsed: 1600,
      stopLoss: {
        price: 63000,
        initialPrice: 63000,
        isBreakeven: true,
        isTrailing: true,
        updatedAt: 1,
      },
      takeProfits: [
        {
          level: 1,
          percent: 1.5,
          sizePercent: 25,
          price: 65000,
          hit: true,
        },
      ],
      openedAt: 123456,
      unrealizedPnL: 80,
      orderId: 'order-1',
      reason: 'test',
      status: 'OPEN',
    };
    const bot = {
      eventBus,
      isRunning: true,
      getCurrentPosition: jest.fn().mockReturnValue(position),
      getBalance: jest.fn().mockResolvedValue(1000),
      getStatus: jest.fn().mockReturnValue({
        isRunning: true,
        hasPosition: true,
        position,
      }),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    };

    const botInstance = createWebServerBotInstance(bot);

    expect(botInstance.getCurrentPosition()).toEqual({
      id: 'position-1',
      symbol: 'BTCUSDT',
      side: 'LONG',
      quantity: 0.25,
      entryPrice: 64000,
      currentPrice: 64000,
      leverage: 10,
      marginUsed: 1600,
      unrealizedPnL: 80,
      unrealizedPnLPercent: 5,
      stopLoss: {
        price: 63000,
        breakeven: 63000,
        trailing: true,
      },
      takeProfits: [
        {
          price: 65000,
          quantity: 25,
          hit: true,
        },
      ],
      openedAt: 123456,
      status: 'OPEN',
    });
  });

  test('createWebServerRuntime materializes the web-server bot adapter before startup handoff', async () => {
    const bot = {
      eventBus: new EventEmitter(),
      isRunning: true,
      getCurrentPosition: jest.fn().mockReturnValue(null),
      getBalance: jest.fn().mockResolvedValue(1000),
      getStatus: jest.fn().mockReturnValue({
        isRunning: true,
        hasPosition: false,
        position: null,
      }),
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    };
    const webApiAdapter: IWebApiAdapter = {
      getMarketData: jest.fn(),
      getCandles: jest.fn(),
      getPositionHistory: jest.fn(),
      getOrderBook: jest.fn(),
      getWalls: jest.fn(),
      getFundingRate: jest.fn(),
      getVolumeProfile: jest.fn(),
    };

    const runtime = createWebServerRuntime(bot, webApiAdapter);

    expect(Object.keys(runtime).sort()).toEqual(['botAdapter', 'webApiAdapter']);
    expect(runtime.webApiAdapter).toBe(webApiAdapter);
    expect(runtime.botAdapter).toBeInstanceOf(EventEmitter);
    await expect(runtime.botAdapter.getBalance()).resolves.toBe(1000);
    expect(bot.getBalance).toHaveBeenCalledTimes(1);
  });
});
