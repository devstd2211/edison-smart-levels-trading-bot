import { BotWebAPI } from '../../api/bot-web-api';
import type { IWebApiReadServices } from '../../interfaces';
import { TimeframeRole } from '../../types/enums';

type WebApiReadServicesFixture = {
  services: IWebApiReadServices;
  getCandles: jest.Mock;
  getSnapshot: jest.Mock;
  indicatorGet: jest.Mock;
  getClosedTrades: jest.Mock;
  getCurrentPrice: jest.Mock;
  getFundingRate: jest.Mock;
};

function createWebApiServices(
  overrides: Partial<IWebApiReadServices> = {},
): IWebApiReadServices {
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
        availableBalance: 900,
        totalMarginUsed: 100,
        totalUnrealizedPnL: 0,
      }),
      getCurrentPrice: jest.fn().mockResolvedValue(0),
      getFundingRate: jest.fn().mockResolvedValue(0),
    },
    indicatorPreferences: {
      timeframes: ['5m', '1h'],
      rsiPeriods: [14],
      emaPeriods: [20, 50],
      atrPeriods: [14],
    },
    ...overrides,
  };
}

function createWebApiReadServicesFixture(
  overrides: Partial<IWebApiReadServices> = {},
): WebApiReadServicesFixture {
  const services = createWebApiServices(overrides);

  return {
    services,
    getCandles: services.candleProvider.getCandles as jest.Mock,
    getSnapshot: services.orderbookManager.getSnapshot as jest.Mock,
    indicatorGet: services.indicatorCache.get as jest.Mock,
    getClosedTrades: services.journal.getClosedTrades as jest.Mock,
    getCurrentPrice: services.bybitService.getCurrentPrice as jest.Mock,
    getFundingRate: services.bybitService.getFundingRate as jest.Mock,
  };
}

describe('BotWebAPI', () => {
  test('reads market data from flat read-only dependencies and falls back to exchange price', async () => {
    const { services, getCandles, indicatorGet, getCurrentPrice } = createWebApiReadServicesFixture();

    getCandles.mockResolvedValue([
      { open: 100, high: 101, low: 99, close: 0, volume: 10, timestamp: 1 },
      { open: 100, high: 102, low: 98, close: 0, volume: 12, timestamp: 2 },
    ]);
    indicatorGet.mockImplementation((key: string) => ({
      'RSI-14-5m': 55,
      'EMA-20-5m': 101,
      'EMA-50-5m': 99,
      'ATR-14-5m': 4,
    }[key] ?? null));
    getCurrentPrice.mockResolvedValue(123.45);

    const api = new BotWebAPI(services);

    await expect(api.getMarketData()).resolves.toEqual({
      currentPrice: 123.45,
      priceChangePercent: 0,
      rsi: 55,
      ema20: 101,
      ema50: 99,
      atr: 4,
      trend: 'NEUTRAL',
      btcCorrelation: undefined,
      nearestLevel: undefined,
      distanceToLevel: undefined,
    });

    expect(getCandles).toHaveBeenCalledWith(TimeframeRole.PRIMARY, 2);
    expect(getCurrentPrice).toHaveBeenCalledTimes(1);
  });

  test('maps candles and position history through the read-only adapter contract', async () => {
    const { services, getCandles, getClosedTrades } = createWebApiReadServicesFixture();

    getCandles.mockResolvedValue([
      { open: 1, high: 3, low: 0.5, close: 2, volume: 20, timestamp: 10 },
    ]);
    getClosedTrades.mockReturnValue([
      {
        id: 'older',
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: 100,
        exitPrice: 102,
        quantity: 2,
        leverage: 3,
        openedAt: 1000,
        closedAt: 2000,
        status: 'CLOSED',
      },
      {
        id: 'newer',
        symbol: 'BTCUSDT',
        side: 'SHORT',
        entryPrice: 110,
        exitPrice: 105,
        quantity: 3,
        leverage: 2,
        openedAt: 3000,
        closedAt: 4000,
        status: 'CLOSED',
      },
    ]);

    const api = new BotWebAPI(services);

    await expect(api.getCandles('15m', 25)).resolves.toEqual([
      { open: 1, high: 3, low: 0.5, close: 2, volume: 20, timestamp: 10 },
    ]);
    await expect(api.getPositionHistory(2)).resolves.toEqual([
      {
        id: 'newer',
        side: 'SHORT',
        entryPrice: 110,
        entryTime: 3000,
        exitPrice: 105,
        exitTime: 4000,
        pnl: 15,
        quantity: 3,
        status: 'CLOSED',
      },
      {
        id: 'older',
        side: 'LONG',
        entryPrice: 100,
        entryTime: 1000,
        exitPrice: 102,
        exitTime: 2000,
        pnl: 4,
        quantity: 2,
        status: 'CLOSED',
      },
    ]);

    expect(getCandles).toHaveBeenCalledWith(TimeframeRole.TREND1, 25);
  });

  test('provides stable fallback payloads for orderbook, walls, funding rate, and volume profile', async () => {
    const { services, getSnapshot, getCandles, getFundingRate } = createWebApiReadServicesFixture({
      wallTrackerService: {
        getActiveWalls: jest.fn().mockReturnValue([
          { side: 'SELL', price: 130, currentSize: 7 },
        ]),
        getWallStrength: jest.fn().mockReturnValue(0.9),
      },
    });

    getSnapshot.mockReturnValue({
      bids: [
        { price: 100, size: 2 },
        { price: 99, size: 3 },
      ],
      asks: [
        { price: 101, size: 4 },
        { price: 102, size: 5 },
      ],
      timestamp: 999,
      updateId: 1,
    });
    getFundingRate.mockResolvedValue(0.01);
    getCandles.mockResolvedValue([
      { open: 100, high: 100, low: 100, close: 100, volume: 9, timestamp: 1 },
    ]);

    const api = new BotWebAPI(services);

    await expect(api.getOrderBook('BTCUSDT')).resolves.toEqual({
      symbol: 'BTCUSDT',
      bids: [
        { price: 100, quantity: 2, cumulative: 2 },
        { price: 99, quantity: 3, cumulative: 5 },
      ],
      asks: [
        { price: 101, quantity: 4, cumulative: 4 },
        { price: 102, quantity: 5, cumulative: 9 },
      ],
      timestamp: 999,
    });
    await expect(api.getWalls('BTCUSDT')).resolves.toEqual({
      symbol: 'BTCUSDT',
      walls: [
        { side: 'SELL', price: 130, quantity: 7, strength: 0.9, detected: true },
      ],
    });

    const funding = await api.getFundingRate('BTCUSDT');
    expect(funding).toEqual({
      symbol: 'BTCUSDT',
      current: 0.01,
      predicted: 0.01,
      nextFundingTime: expect.any(Number),
      lastFundingTime: expect.any(Number),
    });

    await expect(api.getVolumeProfile('BTCUSDT', 0)).resolves.toEqual({
      symbol: 'BTCUSDT',
      levels: Array.from({ length: 20 }, (_, index) => `$${(100 + index).toFixed(2)}`),
      volumes: [9, ...Array.from({ length: 19 }, () => 0)],
      maxVolume: 9,
    });
  });

  test('normalizes invalid limits and timeframe strings to stable defaults', async () => {
    const { services, getCandles, getClosedTrades } = createWebApiReadServicesFixture();
    getClosedTrades.mockReturnValue([
      {
        id: 'only-trade',
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: 100,
        exitPrice: 101,
        quantity: 1,
        leverage: 1,
        openedAt: 10,
        closedAt: 20,
        status: 'CLOSED',
      },
    ]);

    const api = new BotWebAPI(services);

    await api.getCandles('unsupported-timeframe', Number.NaN);
    await expect(api.getPositionHistory(-5)).resolves.toHaveLength(1);

    expect(getCandles).toHaveBeenCalledWith(TimeframeRole.PRIMARY, 100);
  });

  test('returns safe fallbacks when optional wall or funding readers are unavailable', async () => {
    const { services } = createWebApiReadServicesFixture({
      bybitService: {
        getBalance: jest.fn().mockResolvedValue({
          walletBalance: 1000,
          availableBalance: 900,
          totalMarginUsed: 100,
          totalUnrealizedPnL: 0,
        }),
      },
      wallTrackerService: undefined,
    });
    const api = new BotWebAPI(services);

    await expect(api.getWalls('BTCUSDT')).resolves.toEqual({
      symbol: 'BTCUSDT',
      walls: [],
    });
    await expect(api.getFundingRate('BTCUSDT')).resolves.toEqual({
      symbol: 'BTCUSDT',
      current: 0,
      predicted: 0,
      nextFundingTime: expect.any(Number),
      lastFundingTime: expect.any(Number),
    });
  });
});
