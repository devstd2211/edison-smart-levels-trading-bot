import { TradingBot } from '../bot';
import { BotInitializer } from '../services/bot-initializer';
import { createTradingBotServiceBundle } from '../services/bot-services-adapter';
import {
  createManagedTrackedServicesContext,
} from './helpers/service-lifecycle-test.utils';

describe('BotServices adapter boundary', () => {
  const context = createManagedTrackedServicesContext();

  afterEach(async () => {
    await context.cleanup();
    jest.restoreAllMocks();
  });

  test('creates a narrow bundle backed by grouped service containers', () => {
    const { config, services } = context.createInitializerHarness();

    const bundle = createTradingBotServiceBundle(services);

    expect(bundle.coreServices).toBe(services.coreServices);
    expect(bundle.executionServices.positionManager).toBe(services.executionServices.positionManager);
    expect(bundle.executionServices.positionMonitor).toBe(services.executionServices.positionMonitor);
    expect(bundle.executionServices.tradingOrchestrator).toBe(services.executionServices.tradingOrchestrator);
    expect(bundle.marketDataServices.publicWebSocket).toBe(services.marketDataServices.publicWebSocket);
    expect(bundle.monitoringServices.dashboard).toBe(services.monitoringServices.dashboard);
    expect(bundle.resilienceServices?.rateLimiter).toBe(services.rateLimiter);
    expect(bundle.btcCandles1m).toBe(services.btcCandles1m);

    expect('positionMonitor' in (bundle as unknown as Record<string, unknown>)).toBe(false);
    expect('positionManager' in (bundle as unknown as Record<string, unknown>)).toBe(false);
    expect('tradingOrchestrator' in (bundle as unknown as Record<string, unknown>)).toBe(false);
    expect('publicWebSocket' in (bundle as unknown as Record<string, unknown>)).toBe(false);

    expect(() => new TradingBot(bundle, config)).not.toThrow();
    expect(() => new BotInitializer(bundle, config)).not.toThrow();
  });

  test('bundle-created consumers reuse the same grouped runtime services', () => {
    const { config, services } = context.createTradingBotHarness();
    const bundle = createTradingBotServiceBundle(services);
    const bot = new TradingBot(bundle, config);
    const initializer = new BotInitializer(bundle, config);

    expect(bot.getStatus()).toEqual({
      isRunning: false,
      hasPosition: false,
      position: null,
    });
    expect(bot.getWebApiAdapter()).toBe(bot.getWebApiAdapter());
    expect(initializer).toBeInstanceOf(BotInitializer);
  });
});
