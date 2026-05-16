import * as webApiAdapterModule from '../api/create-web-api-adapter';
import * as runtimeFactoryModule from '../factories/create-trading-bot-runtime';
import { createManagedTrackedServicesContext } from './helpers/service-lifecycle-test.utils';

describe('createTradingBotRuntime factory boundary', () => {
  const context = createManagedTrackedServicesContext();

  afterEach(async () => {
    await context.cleanup();
    jest.restoreAllMocks();
  });

  test('builds a tracked bot/runtime pair without eagerly creating the web API adapter', () => {
    const webApiAdapterSpy = jest.spyOn(webApiAdapterModule, 'createWebApiAdapter');
    const { runtime, services, bot } = context.createFactoryTradingBotRuntimeHarness();

    expect(runtime.bot).toBe(bot);
    expect(runtime.runtimeSource).toBe(services);
    expect(bot.getStatus()).toEqual({
      isRunning: false,
      hasPosition: false,
      position: null,
    });
    expect(webApiAdapterSpy).not.toHaveBeenCalled();
  });

  test('lazy web API adapter still initializes on first consumer access', () => {
    const webApiAdapterSpy = jest.spyOn(webApiAdapterModule, 'createWebApiAdapter');
    const { bot } = context.createFactoryTradingBotRuntimeHarness();

    const firstAdapter = bot.getWebApiAdapter();
    const secondAdapter = bot.getWebApiAdapter();

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
      });

    const createdBot = runtimeFactoryModule.createTradingBot(
      context.createInitializerHarness().config,
    );

    expect(runtimeSpy).toHaveBeenCalledTimes(1);
    expect(createdBot).toBe(bot);
  });
});
