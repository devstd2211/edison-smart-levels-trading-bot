import * as webApiAdapterModule from '../api/create-web-api-adapter';
import * as runtimeFactoryModule from '../factories/create-trading-bot-runtime';
import { createManagedTrackedServicesContext } from './helpers/service-lifecycle-test.utils';

describe('createTradingBotRuntime factory boundary', () => {
  const context = createManagedTrackedServicesContext();

  afterEach(async () => {
    await context.cleanup();
    jest.restoreAllMocks();
  });

  test('builds a tracked bot/runtime pair with one explicit web API adapter for runtime consumers', () => {
    const webApiAdapterSpy = jest.spyOn(webApiAdapterModule, 'createWebApiAdapter');
    const { runtime, services, bot } = context.createFactoryTradingBotRuntimeHarness();

    expect(runtime.bot).toBe(bot);
    expect(runtime.runtimeSource).toBe(services);
    expect(runtime.webApiAdapter).toBe(bot.getWebApiAdapter());
    expect(bot.getStatus()).toEqual({
      isRunning: false,
      hasPosition: false,
      position: null,
    });
    expect(webApiAdapterSpy).toHaveBeenCalledTimes(1);
  });

  test('bot and runtime consumers share the same cached web API adapter instance', () => {
    const webApiAdapterSpy = jest.spyOn(webApiAdapterModule, 'createWebApiAdapter');
    const { runtime, bot } = context.createFactoryTradingBotRuntimeHarness();

    const runtimeAdapter = runtime.webApiAdapter;
    const firstAdapter = bot.getWebApiAdapter();
    const secondAdapter = bot.getWebApiAdapter();

    expect(runtimeAdapter).toBe(firstAdapter);
    expect(firstAdapter).toBe(secondAdapter);
    expect(webApiAdapterSpy).toHaveBeenCalledTimes(1);
  });

  test('createTradingBot delegates to createTradingBotRuntime and returns its bot instance', () => {
    const bot = {} as never;
    const runtimeSpy = jest
      .spyOn(runtimeFactoryModule, 'createTradingBotRuntime')
      .mockReturnValue({
        bot,
        runtimeSource: {} as never,
        webApiAdapter: {} as never,
      });

    const createdBot = runtimeFactoryModule.createTradingBot(
      context.createInitializerHarness().config,
    );

    expect(runtimeSpy).toHaveBeenCalledTimes(1);
    expect(createdBot).toBe(bot);
  });
});
