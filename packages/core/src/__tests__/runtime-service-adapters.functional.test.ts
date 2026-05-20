import { TradingBot } from '../bot';
import { BotInitializer } from '../services/bot-initializer';
import {
  createBotInitializerServices,
} from '../services/runtime-service-adapters';
import { selectWebApiReadServices } from '../services/containers/web-api-read-services';
import {
  createManagedTrackedServicesBotRuntime,
  createManagedTrackedServicesInitializerRuntime,
  createManagedTrackedServicesRuntimeBundleRuntime,
  type TrackedServicesBotRuntime,
  type TrackedServicesInitializerRuntime,
  type TrackedServicesRuntimeBundleRuntime,
} from './helpers/service-lifecycle-test.utils';

describe('runtime dependency adapter boundary', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('runtime bundle adapter shell', () => {
    let createRuntimeBundleHarness!: TrackedServicesRuntimeBundleRuntime['createRuntimeBundleHarness'];
    let cleanup!: TrackedServicesRuntimeBundleRuntime['cleanup'];

    beforeEach(() => {
      ({
        createRuntimeBundleHarness,
        cleanup,
      } = createManagedTrackedServicesRuntimeBundleRuntime());
    });

    afterEach(async () => {
      await cleanup();
    });

    test('creates a narrow bundle backed by grouped service containers', () => {
      const { config, runtimeDependencies, services } = createRuntimeBundleHarness();
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
      expect(tradingBotServices.executionServices).not.toBe(services.executionServices);
      expect(tradingBotServices.monitoringServices).not.toBe(services.monitoringServices);

      const expectedWebApiServices = selectWebApiReadServices(services);

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
      expect(initializerServices.marketDataServices).not.toBe(services.marketDataServices);
      expect(initializerServices.executionServices).not.toBe(services.executionServices);
      expect(initializerServices.monitoringServices).not.toBe(services.monitoringServices);
      expect('bybitService' in initializerServices.marketDataServices).toBe(false);

      expect(eventHandlerServices.marketDataServices.publicWebSocket).toBe(services.marketDataServices.publicWebSocket);
      expect(eventHandlerServices.executionServices.positionMonitor).toBe(services.executionServices.positionMonitor);
      expect(eventHandlerServices.marketDataServices).not.toBe(services.marketDataServices);
      expect(eventHandlerServices.executionServices).not.toBe(services.executionServices);
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
  });

  describe('initializer adapter shell', () => {
    let createInitializerHarness!: TrackedServicesInitializerRuntime['createInitializerHarness'];
    let cleanup!: TrackedServicesInitializerRuntime['cleanup'];

    beforeEach(() => {
      ({
        createInitializerHarness,
        cleanup,
      } = createManagedTrackedServicesInitializerRuntime());
    });

    afterEach(async () => {
      await cleanup();
    });

    test('keeps exchange runtime mutation local to the adapter shell', () => {
      const { services } = createInitializerHarness();
      const initializerServices = createBotInitializerServices(services);
      const replacementExchange = {
        ...services.bybitService,
        name: 'ReplacementExchange',
      };

      initializerServices.exchangeRuntime.setCurrent(replacementExchange);

      expect(initializerServices.exchangeRuntime.current).toBe(replacementExchange);
      expect(services.bybitService).not.toBe(replacementExchange);
      expect(services.marketDataServices.bybitService).not.toBe(replacementExchange);
    });

    test('keeps monitoring and resilience lifecycle inputs on the narrow contract', () => {
      const { config, services } = createInitializerHarness();
      const initializerServices = createBotInitializerServices(services);

      expect(initializerServices.monitoringServices?.dashboard).toBe(
        services.monitoringServices.dashboard,
      );
      expect(initializerServices.resilienceServices?.retryPolicy).toBe(services.retryPolicy);
      expect(initializerServices.resilienceServices?.bulkhead).toBe(services.bulkhead);
      expect(initializerServices.resilienceServices).not.toBe(services);
      expect(() => new BotInitializer(initializerServices, config)).not.toThrow();
    });

    test('omits resilience shell when no resilience services exist', () => {
      const { services } = createInitializerHarness();
      const initializerServices = createBotInitializerServices({
        ...services,
        rateLimiter: undefined,
        retryPolicy: undefined,
        bulkhead: undefined,
      });

      expect(initializerServices.resilienceServices).toBeUndefined();
    });
  });

  describe('trading bot consumer shell', () => {
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

    test('bundle-created consumers reuse the same grouped runtime services', () => {
      const { bot, config, runtimeDependencies } = createTradingBotHarness();
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
});
