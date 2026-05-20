import * as webApiAdapterModule from '../api/create-web-api-adapter';
import * as runtimeFactoryModule from '../factories/create-trading-bot-runtime';
import {
  createManagedTrackedServicesLifecycleRuntime,
  spyOnTrackedServiceLifecycle,
  type TrackedServicesLifecycleRuntime,
} from './helpers/service-lifecycle-test.utils';

describe('createTradingBotRuntime factory boundary', () => {
  let createFactoryTradingBotRuntimeHarness!: TrackedServicesLifecycleRuntime['createFactoryTradingBotRuntimeHarness'];
  let createInitializerHarness!: TrackedServicesLifecycleRuntime['createInitializerHarness'];
  let cleanup!: TrackedServicesLifecycleRuntime['cleanup'];

  beforeEach(() => {
    ({
      createFactoryTradingBotRuntimeHarness,
      createInitializerHarness,
      cleanup,
    } = createManagedTrackedServicesLifecycleRuntime());
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  test('builds a tracked bot/runtime pair with one explicit web API adapter for runtime consumers', () => {
    const webApiAdapterSpy = jest.spyOn(webApiAdapterModule, 'createWebApiAdapter');
    const { runtime, services, bot } = createFactoryTradingBotRuntimeHarness();

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
    const { runtime, bot } = createFactoryTradingBotRuntimeHarness();

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
      createInitializerHarness().config,
    );

    expect(runtimeSpy).toHaveBeenCalledTimes(1);
    expect(createdBot).toBe(bot);
  });

  test('tracked runtime construction stays side-effect free until start is called', () => {
    const harness = createFactoryTradingBotRuntimeHarness();
    const lifecycle = spyOnTrackedServiceLifecycle(harness.services);

    expect(harness.exchange.initialize).not.toHaveBeenCalled();
    expect(lifecycle.journalStartSpy).not.toHaveBeenCalled();
    expect(lifecycle.sessionInitSpy).not.toHaveBeenCalled();
    expect(lifecycle.bybitInitSpy).not.toHaveBeenCalled();
    expect(lifecycle.bybitOpenPositionsSpy).not.toHaveBeenCalled();
    expect(lifecycle.syncSpy).not.toHaveBeenCalled();
    expect(lifecycle.wsStartSpy).not.toHaveBeenCalled();
    expect(lifecycle.publicStartSpy).not.toHaveBeenCalled();
    expect(lifecycle.monitorStartSpy).not.toHaveBeenCalled();
    expect(harness.bot.isRunning).toBe(false);
  });
});
