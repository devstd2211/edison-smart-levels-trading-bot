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
});
