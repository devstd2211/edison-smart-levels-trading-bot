import { BotFactory } from '../bot-factory';
import { TradingBot } from '../bot';
import { createBotFactoryTestConfig } from './helpers/bot-factory-test.utils';
import type { IExchange } from '../interfaces';

describe('BotFactory', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('creates a TradingBot without starting lifecycle side effects', async () => {
    const config = createBotFactoryTestConfig();

    const bot = await BotFactory.create({ config });

    expect(bot).toBeInstanceOf(TradingBot);
    expect(bot.isRunning).toBe(false);
    expect(bot.eventBus).toBeDefined();
  });

  test('createForTesting applies service overrides through the bot bundle', async () => {
    const config = createBotFactoryTestConfig();
    const mockExchange = {
      name: 'MockExchange',
      getBalance: jest.fn().mockResolvedValue({ walletBalance: 321 }),
      isConnected: jest.fn(() => true),
    } as unknown as IExchange;

    const bot = BotFactory.createForTesting(config, { bybitService: mockExchange });

    await expect(bot.getBalance()).resolves.toBe(321);
  });

  test('createRuntimeBundle exposes narrowed runtime dependencies and read-only web adapter', async () => {
    const config = createBotFactoryTestConfig();
    const mockExchange = {
      name: 'MockExchange',
      getCurrentPrice: jest.fn().mockResolvedValue(12345),
      getFundingRate: jest.fn().mockResolvedValue(0.01),
      isConnected: jest.fn(() => true),
    } as unknown as IExchange;

    const { runtimeDependencies, webApiAdapter } = BotFactory.createRuntimeBundle(config, {
      bybitService: mockExchange,
    });

    expect(runtimeDependencies.webApiServices.bybitService).toBe(mockExchange);
    expect('marketDataServices' in runtimeDependencies.tradingBotServices).toBe(false);
    expect('bybitService' in runtimeDependencies.tradingBotServices).toBe(false);
    await expect(webApiAdapter.getFundingRate('BTCUSDT')).resolves.toEqual(
      expect.objectContaining({
        symbol: 'BTCUSDT',
        current: 0.01,
      }),
    );
  });

  test('createWithEmitter starts the external event bridge', async () => {
    const config = createBotFactoryTestConfig();
    const { bot, emitter } = await BotFactory.createWithEmitter({ config });

    const started = new Promise<void>((resolve) => {
      emitter.once('bot-started', () => resolve());
    });

    bot.eventBus.emit('bot-started', true);
    await expect(started).resolves.toBeUndefined();

    emitter.stop();
  });
});
