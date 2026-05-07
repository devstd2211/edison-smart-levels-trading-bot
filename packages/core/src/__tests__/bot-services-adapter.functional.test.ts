import { TradingBot } from '../bot';
import { BotInitializer } from '../services/bot-initializer';
import {
  createBotInitializerServices,
} from '../services/bot-services-adapter';
import { createWebApiReadServiceDeps } from '../services/containers/web-api-read-services';
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
    const { config, runtimeDependencies, services } = context.createRuntimeBundleHarness();
    const {
      tradingBotServices,
      webApiServices,
      initializerServices,
      eventHandlerServices,
    } = runtimeDependencies;

    expect(tradingBotServices.coreServices).toBe(services.coreServices);
    expect(tradingBotServices.executionServices.positionManager).toBe(services.executionServices.positionManager);
    expect(tradingBotServices.executionServices.positionMonitor).toBe(services.executionServices.positionMonitor);
    expect(tradingBotServices.executionServices.tradingOrchestrator).toBe(services.executionServices.tradingOrchestrator);
    expect(tradingBotServices.monitoringServices.dashboard).toBe(services.monitoringServices.dashboard);

    const expectedWebApiServices = createWebApiReadServiceDeps(services);

    expect(webApiServices).toEqual(expectedWebApiServices);
    expect(webApiServices).not.toBe(expectedWebApiServices);
    expect(webApiServices.logger).toBe(services.coreServices.logger);
    expect(webApiServices.candleProvider).toBe(services.webApiServices.marketDataServices.candleProvider);
    expect(webApiServices.orderbookManager).toBe(services.webApiServices.marketDataServices.orderbookManager);
    expect(webApiServices.indicatorCache).toBe(services.webApiServices.marketDataServices.indicatorCache);
    expect(webApiServices.journal).toBe(services.webApiServices.journal);
    expect(webApiServices.bybitService).toBe(services.webApiServices.bybitService);
    expect(webApiServices.indicatorPreferences).toBe(services.webApiServices.indicatorPreferences);

    expect(initializerServices.marketDataServices.publicWebSocket).toBe(services.marketDataServices.publicWebSocket);
    expect(initializerServices.resilienceServices?.rateLimiter).toBe(services.rateLimiter);
    expect(initializerServices.exchangeRuntime.current).toBe(services.bybitService);
    expect(initializerServices.btcMarketState.btcCandles1m).toBe(services.btcCandles1m);
    expect('bybitService' in initializerServices.marketDataServices).toBe(false);

    expect(eventHandlerServices.marketDataServices.publicWebSocket).toBe(services.marketDataServices.publicWebSocket);
    expect(eventHandlerServices.executionServices.positionMonitor).toBe(services.executionServices.positionMonitor);
    expect('bybitService' in eventHandlerServices.marketDataServices).toBe(false);
    expect('positionExitingService' in eventHandlerServices.executionServices).toBe(false);
    expect('orderStateMachine' in eventHandlerServices.executionServices).toBe(false);

    expect('positionMonitor' in (tradingBotServices as unknown as Record<string, unknown>)).toBe(false);
    expect('positionManager' in (tradingBotServices as unknown as Record<string, unknown>)).toBe(false);
    expect('tradingOrchestrator' in (tradingBotServices as unknown as Record<string, unknown>)).toBe(false);
    expect('publicWebSocket' in (tradingBotServices as unknown as Record<string, unknown>)).toBe(false);
    expect('candleProvider' in (tradingBotServices as unknown as Record<string, unknown>)).toBe(false);
    expect('journal' in (tradingBotServices as unknown as Record<string, unknown>)).toBe(false);
    expect('bybitService' in (tradingBotServices as unknown as Record<string, unknown>)).toBe(false);

    expect(() => new TradingBot(runtimeDependencies, config)).not.toThrow();
    expect(() => new BotInitializer(initializerServices, config)).not.toThrow();
  });

  test('initializer adapter keeps monitoring and resilience lifecycle inputs on the narrow contract', () => {
    const { config, services } = context.createInitializerHarness();
    const initializerServices = createBotInitializerServices(services);

    expect(initializerServices.monitoringServices?.dashboard).toBe(
      services.monitoringServices.dashboard,
    );
    expect(initializerServices.resilienceServices?.retryPolicy).toBe(services.retryPolicy);
    expect(initializerServices.resilienceServices?.bulkhead).toBe(services.bulkhead);
    expect(() => new BotInitializer(initializerServices, config)).not.toThrow();
  });

  test('bundle-created consumers reuse the same grouped runtime services', () => {
    const { bot, config, runtimeDependencies } = context.createTradingBotHarness();
    const initializer = new BotInitializer(runtimeDependencies.initializerServices, config);

    expect(bot.getStatus()).toEqual({
      isRunning: false,
      hasPosition: false,
      position: null,
    });
    expect(bot.getWebApiAdapter()).toBe(bot.getWebApiAdapter());
    expect(initializer).toBeInstanceOf(BotInitializer);
  });
});
