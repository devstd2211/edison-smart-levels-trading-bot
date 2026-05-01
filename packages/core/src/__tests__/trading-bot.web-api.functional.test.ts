import {
  createManagedTrackedServicesContext,
  type ManagedTrackedServicesContext,
} from './helpers/service-lifecycle-test.utils';

describe('TradingBot web API adapter boundary', () => {
  let context: ManagedTrackedServicesContext;

  beforeEach(() => {
    context = createManagedTrackedServicesContext();
  });

  afterEach(async () => {
    await context.cleanup();
    jest.restoreAllMocks();
  });

  test('getWebApiAdapter() returns a stable read-only adapter instance', () => {
    const { bot } = context.createTradingBotHarness();

    const adapter = bot.getWebApiAdapter();

    expect(bot.getWebApiAdapter()).toBe(adapter);
    expect(adapter).not.toBe(bot as unknown as object);
    expect(typeof adapter.getMarketData).toBe('function');
    expect(typeof adapter.getCandles).toBe('function');
    expect(typeof adapter.getPositionHistory).toBe('function');
    expect(typeof adapter.getOrderBook).toBe('function');
    expect(typeof adapter.getWalls).toBe('function');
    expect(typeof adapter.getFundingRate).toBe('function');
    expect(typeof adapter.getVolumeProfile).toBe('function');
    expect('start' in (adapter as unknown as Record<string, unknown>)).toBe(false);
    expect('stop' in (adapter as unknown as Record<string, unknown>)).toBe(false);
  });

  test('bot market-data methods delegate through the cached web API adapter', async () => {
    const { bot } = context.createTradingBotHarness();
    const adapter = bot.getWebApiAdapter();
    const marketData = {
      currentPrice: 123.45,
      priceChangePercent: 1.23,
    };
    const getMarketDataSpy = jest
      .spyOn(adapter, 'getMarketData')
      .mockResolvedValue(marketData);

    await expect(bot.getMarketData()).resolves.toEqual(marketData);

    expect(getMarketDataSpy).toHaveBeenCalledTimes(1);
    expect(bot.getWebApiAdapter()).toBe(adapter);
  });

  test('all read-only web methods delegate through one cached adapter instance', async () => {
    const { bot } = context.createTradingBotHarness();
    const adapter = bot.getWebApiAdapter();

    const getCandlesSpy = jest.spyOn(adapter, 'getCandles').mockResolvedValue([
      { open: 1, high: 2, low: 0.5, close: 1.5, volume: undefined, timestamp: 10 },
    ]);
    const getHistorySpy = jest.spyOn(adapter, 'getPositionHistory').mockResolvedValue([
      { side: 'LONG', entryPrice: 100, entryTime: 1, pnl: 2, quantity: 1 },
    ]);
    const getOrderBookSpy = jest.spyOn(adapter, 'getOrderBook').mockResolvedValue({
      symbol: 'BTCUSDT',
      bids: [],
      asks: [],
      timestamp: 11,
    });
    const getWallsSpy = jest.spyOn(adapter, 'getWalls').mockResolvedValue({
      symbol: 'BTCUSDT',
      walls: [],
    });
    const getFundingRateSpy = jest.spyOn(adapter, 'getFundingRate').mockResolvedValue({
      symbol: 'BTCUSDT',
      current: 0.01,
      predicted: 0.01,
      nextFundingTime: 12,
      lastFundingTime: 13,
    });
    const getVolumeProfileSpy = jest.spyOn(adapter, 'getVolumeProfile').mockResolvedValue({
      symbol: 'BTCUSDT',
      levels: ['$100.00'],
      volumes: [5],
      maxVolume: 5,
    });

    await expect(bot.getCandles('5m', 10)).resolves.toEqual([
      { open: 1, high: 2, low: 0.5, close: 1.5, volume: 0, timestamp: 10 },
    ]);
    await expect(bot.getPositionHistory(5)).resolves.toEqual([
      { side: 'LONG', entryPrice: 100, entryTime: 1, pnl: 2, quantity: 1 },
    ]);
    await expect(bot.getOrderBook('BTCUSDT')).resolves.toEqual({
      symbol: 'BTCUSDT',
      bids: [],
      asks: [],
      timestamp: 11,
    });
    await expect(bot.getWalls('BTCUSDT')).resolves.toEqual({
      symbol: 'BTCUSDT',
      walls: [],
    });
    await expect(bot.getFundingRate('BTCUSDT')).resolves.toEqual({
      symbol: 'BTCUSDT',
      current: 0.01,
      predicted: 0.01,
      nextFundingTime: 12,
      lastFundingTime: 13,
    });
    await expect(bot.getVolumeProfile('BTCUSDT', 8)).resolves.toEqual({
      symbol: 'BTCUSDT',
      levels: ['$100.00'],
      volumes: [5],
      maxVolume: 5,
    });

    expect(getCandlesSpy).toHaveBeenCalledWith('5m', 10);
    expect(getHistorySpy).toHaveBeenCalledWith(5);
    expect(getOrderBookSpy).toHaveBeenCalledWith('BTCUSDT');
    expect(getWallsSpy).toHaveBeenCalledWith('BTCUSDT');
    expect(getFundingRateSpy).toHaveBeenCalledWith('BTCUSDT');
    expect(getVolumeProfileSpy).toHaveBeenCalledWith('BTCUSDT', 8);
    expect(bot.getWebApiAdapter()).toBe(adapter);
  });
});
