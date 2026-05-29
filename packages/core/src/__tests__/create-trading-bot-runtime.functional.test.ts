import * as webApiAdapterModule from '../api/create-web-api-adapter';
import * as runtimeFactoryModule from '../factories/create-trading-bot-runtime';
import {
  createManagedTrackedServicesRuntimeFactory,
  createMockLifecycleExchange,
  createMockLifecycleTelegram,
  createRuntimeDefaultLifecycleConfig,
  spyOnTrackedServiceLifecycle,
  type TrackedServicesRuntimeFactory,
} from './helpers/service-lifecycle-test.utils';

describe('createTradingBotRuntime factory boundary', () => {
  let createRuntimeFactoryHarness!: TrackedServicesRuntimeFactory['createRuntimeFactoryHarness'];
  let cleanup!: TrackedServicesRuntimeFactory['cleanup'];

  beforeEach(() => {
    ({
      createRuntimeFactoryHarness,
      cleanup,
    } = createManagedTrackedServicesRuntimeFactory());
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  test('builds a tracked bot/runtime pair with one explicit web API adapter for runtime consumers', () => {
    const webApiAdapterSpy = jest.spyOn(webApiAdapterModule, 'createWebApiAdapter');
    const { runtime, services, bot } = createRuntimeFactoryHarness();

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
    const { runtime, bot } = createRuntimeFactoryHarness();

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
      createRuntimeDefaultLifecycleConfig(),
    );

    expect(runtimeSpy).toHaveBeenCalledTimes(1);
    expect(createdBot).toBe(bot);
  });

  test('createTradingBotFactoryRuntime assembles the narrowed runtime source and bundle for downstream consumers', () => {
    const webApiAdapterSpy = jest.spyOn(webApiAdapterModule, 'createWebApiAdapter');
    const config = createRuntimeDefaultLifecycleConfig();
    const exchange = createMockLifecycleExchange();
    const telegram = createMockLifecycleTelegram();

    const runtimeFactory = runtimeFactoryModule.createTradingBotFactoryRuntime(config, {
      bybitService: exchange,
      telegram,
    });

    expect(runtimeFactory.runtimeSource.bybitService).toBe(exchange);
    expect(runtimeFactory.runtimeSource.coreServices.telegram).toBe(telegram);
    expect(runtimeFactory.runtimeBundle.runtimeDependencies.balanceReader).toBe(exchange);
    expect(runtimeFactory.runtimeBundle.webApiAdapter).toBe(
      runtimeFactory.runtimeBundle.runtimeDependencies.webApiAdapter,
    );
    expect(webApiAdapterSpy).toHaveBeenCalledTimes(1);
  });

  test('tracked runtime construction stays side-effect free until start is called', () => {
    const harness = createRuntimeFactoryHarness();
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
