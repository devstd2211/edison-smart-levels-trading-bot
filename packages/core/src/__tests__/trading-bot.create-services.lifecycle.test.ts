import * as runtimeFactoryModule from '../factories/create-trading-bot-runtime';
import {
  createManagedTrackedServicesBotRuntime,
  createManagedTrackedServicesState,
  createRuntimeDefaultLifecycleConfig,
  createTrackedServices,
  spyOnTrackedServiceLifecycle,
  type TrackedServicesBotRuntime,
} from './helpers/service-lifecycle-test.utils';

describe('TradingBot + createServices lifecycle orchestration', () => {
  let createTradingBotHarness!: TrackedServicesBotRuntime['createTradingBotHarness'];
  let cleanup!: TrackedServicesBotRuntime['cleanup'];

  beforeEach(() => {
    ({
      createTradingBotHarness,
      cleanup,
    } = createManagedTrackedServicesBotRuntime());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('services are idle before start and explicitly stopped via bot.stop()', async () => {
    const harness = createTradingBotHarness();
    const serviceState = harness.services;
    const bot = harness.bot;
    const lifecycle = spyOnTrackedServiceLifecycle(serviceState);

    expect(harness.exchange.initialize).not.toHaveBeenCalled();
    expect(lifecycle.journalStartSpy).not.toHaveBeenCalled();
    expect(lifecycle.sessionInitSpy).not.toHaveBeenCalled();
    expect(lifecycle.syncSpy).not.toHaveBeenCalled();
    expect(lifecycle.wsStartSpy).not.toHaveBeenCalled();
    expect(lifecycle.publicStartSpy).not.toHaveBeenCalled();
    expect(lifecycle.monitorStartSpy).not.toHaveBeenCalled();
    expect(bot.isRunning).toBe(false);

    try {
      await bot.start();
      expect(bot.isRunning).toBe(true);
      expect(harness.exchange.initialize).toHaveBeenCalledTimes(1);
      expect(lifecycle.journalStartSpy).toHaveBeenCalledTimes(1);
      expect(lifecycle.sessionInitSpy).toHaveBeenCalledTimes(1);
      expect(lifecycle.syncSpy).toHaveBeenCalled();
      expect(lifecycle.wsStartSpy).toHaveBeenCalledTimes(1);
      expect(lifecycle.publicStartSpy).toHaveBeenCalledTimes(1);
      expect(lifecycle.monitorStartSpy).toHaveBeenCalledTimes(1);
      expect(harness.telegram.notifyBotStarted).toHaveBeenCalledTimes(1);
    } finally {
      await bot.stop();
    }

    expect(bot.isRunning).toBe(false);
    expect(lifecycle.wsStopSpy).toHaveBeenCalledTimes(1);
    expect(lifecycle.publicStopSpy).toHaveBeenCalledTimes(1);
    expect(lifecycle.monitorStopSpy).toHaveBeenCalledTimes(1);
    expect(lifecycle.sessionEndSpy).toHaveBeenCalledTimes(1);
    expect(harness.telegram.notifyBotStopped).toHaveBeenCalledTimes(1);
  });

  test('reuses an existing runtime source when materializing the bot lifecycle handoff', async () => {
    const runtimeFactorySpy = jest.spyOn(runtimeFactoryModule, 'createTradingBotFactoryRuntime');
    const managedState = createManagedTrackedServicesState();
    const config = createRuntimeDefaultLifecycleConfig();
    const runtimeSource = createTrackedServices(managedState.trackedServices, config);

    try {
      const harness = createTradingBotHarness({
        config,
        runtimeSource,
      });

      expect(runtimeFactorySpy).not.toHaveBeenCalled();
      expect(harness.services).toBe(runtimeSource);
      expect(harness.runtime.runtimeSource).toBe(runtimeSource);
    } finally {
      await managedState.cleanup();
    }
  });
});
