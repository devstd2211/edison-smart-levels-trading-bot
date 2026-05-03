import { EventEmitter } from 'events';
import { createWebApiAdapter } from '../../api/create-web-api-adapter';
import { startWebServer } from '../../web';
import type { IWebApiReadServices } from '../../interfaces';
import type { IWebApiAdapter } from 'trading-bot-web-server';

var mockWebServer = jest.fn();

jest.mock('trading-bot-web-server', () => ({
  WebServer: class WebServerMock {
    close = jest.fn();

    constructor(...args: unknown[]) {
      mockWebServer(...args);
    }
  },
}), { virtual: true });

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
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      getWebApiAdapter: jest.fn().mockReturnValue(webApiAdapter),
    };

    await startWebServer(bot, { apiPort: 4100, wsPort: 4101 });

    expect(mockWebServer).toHaveBeenCalledTimes(1);
    const [botInstance, config, passedAdapter] = mockWebServer.mock.calls[0];

    expect(config).toEqual({ apiPort: 4100, wsPort: 4101 });
    expect(passedAdapter).toBe(webApiAdapter);
    expect(typeof botInstance.on).toBe('function');
    expect(typeof botInstance.off).toBe('function');
    expect(typeof botInstance.emit).toBe('function');
    expect(typeof botInstance.stop).toBe('function');
  });
});
