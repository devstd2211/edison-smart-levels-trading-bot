import * as webApiAdapterModule from '../api/create-web-api-adapter';
import * as runtimeFactoryModule from '../factories/create-trading-bot-runtime';
import {
  createManagedTrackedServicesBotRuntime,
  createManagedTrackedServicesRuntimeFactory,
  createRuntimeDefaultLifecycleConfig,
  spyOnTrackedServiceLifecycle,
  type TrackedServicesBotRuntime,
  type TrackedServicesRuntimeFactory,
} from './helpers/service-lifecycle-test.utils';

describe('createTradingBotRuntime factory boundary', () => {
  let createTradingBotHarness!: TrackedServicesBotRuntime['createTradingBotHarness'];
  let cleanupTradingBotHarnesses!: TrackedServicesBotRuntime['cleanup'];
  let createRuntimeFactoryHarness!: TrackedServicesRuntimeFactory['createRuntimeFactoryHarness'];
  let cleanupRuntimeFactoryHarnesses!: TrackedServicesRuntimeFactory['cleanup'];

  beforeEach(() => {
    ({
      createTradingBotHarness,
      cleanup: cleanupTradingBotHarnesses,
    } = createManagedTrackedServicesBotRuntime());
    ({
      createRuntimeFactoryHarness,
      cleanup: cleanupRuntimeFactoryHarnesses,
    } = createManagedTrackedServicesRuntimeFactory());
  });

  afterEach(async () => {
    await cleanupTradingBotHarnesses();
    await cleanupRuntimeFactoryHarnesses();
    jest.restoreAllMocks();
  });

  test('builds a tracked bot/runtime pair with one explicit web API adapter for runtime consumers', () => {
    const webApiAdapterSpy = jest.spyOn(webApiAdapterModule, 'createWebApiAdapter');
    const { runtime, services, bot } = createTradingBotHarness();

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
    const { runtime, bot } = createTradingBotHarness();

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
    const { runtimeFactory, runtimeDependencies, runtimeBundle, services, exchange, telegram } =
      createRuntimeFactoryHarness();

    expect(runtimeFactory.runtimeSource).toBe(services);
    expect(runtimeFactory.runtimeSource.bybitService).toBe(exchange);
    expect(runtimeFactory.runtimeSource.coreServices.telegram).toBe(telegram);
    expect(runtimeFactory.runtimeBundle).toBe(runtimeBundle);
    expect(runtimeFactory.runtimeBundle.runtimeDependencies).toBe(runtimeDependencies);
    expect(runtimeFactory.runtimeBundle.runtimeDependencies.readAdapters.balanceReader).toBe(exchange);
    expect(runtimeFactory.runtimeBundle.webApiAdapter).toBe(
      runtimeFactory.runtimeBundle.runtimeDependencies.readAdapters.webApiAdapter,
    );
    expect('bot' in (runtimeFactory as unknown as Record<string, unknown>)).toBe(false);
    expect(webApiAdapterSpy).toHaveBeenCalledTimes(1);
  });

  test('createTradingBotRuntimeFromFactoryRuntime materializes the public web API handoff from grouped read adapters', () => {
    const { runtimeFactory } = createRuntimeFactoryHarness();
    const groupedReadAdapter = runtimeFactory.runtimeBundle.runtimeDependencies.readAdapters.webApiAdapter;
    const duplicatedBundleAdapter = { kind: 'duplicated-bundle-adapter' } as never;

    runtimeFactory.runtimeBundle.webApiAdapter = duplicatedBundleAdapter;

    const runtime = runtimeFactoryModule.createTradingBotRuntimeFromFactoryRuntime(
      runtimeFactory,
      createRuntimeDefaultLifecycleConfig(),
    );

    expect(runtime.webApiAdapter).toBe(groupedReadAdapter);
    expect(runtime.webApiAdapter).not.toBe(duplicatedBundleAdapter);
  });

  test('tracked runtime construction stays side-effect free until start is called', () => {
    const harness = createTradingBotHarness();
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
