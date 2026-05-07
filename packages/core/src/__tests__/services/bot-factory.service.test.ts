/**
 * BotFactory Unit Tests
 * Phase 5: Dependency Injection Enhancement
 *
 * Tests verify that BotFactory correctly manages service creation and DI
 */

import { createBotFactoryServiceState, type BotFactoryOptions } from '../../services/bot-factory.service';
import type { BotServiceState } from '../../services/bot-services.builder';
import { selectWebApiReadServices } from '../../services/containers/web-api-read-services';
import { Config } from '../../types/legacy';
import type { IExchange } from '../../interfaces/IExchange';
import {
  createBotFactoryTestConfig,
  createTrackedBotFactoryServices,
} from '../helpers/bot-factory-test.utils';
import {
  createManagedTrackedServicesContext,
  createTrackedServices,
  trackCreatedServices,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';

describe('BotFactory - DI container for bot service state', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let config: Config;
  let trackedServices!: TrackedServicesState['trackedServices'];
  let cleanup!: TrackedServicesState['cleanup'];

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

  beforeEach(() => {
    ({ trackedServices, cleanup } = createManagedTrackedServicesContext());
  });

  afterEach(async () => {
    await cleanup();
  });

  beforeEach(() => {
    // Always use minimal config for backward compatibility with legacy tests
    // Error handling tests use their own config validation
    config = createBotFactoryTestConfig();
  });

  describe('Basic Factory Operations', () => {
    test('T1: Should create services state', () => {
      const services = createTrackedServices(trackedServices, config);
      expect(services).toBeDefined();
      expect(services.coreServices.logger).toBeDefined();
    });

    test('T2: Should create multiple independent instances', () => {
      const services1 = createTrackedServices(trackedServices, config);
      const services2 = createTrackedServices(trackedServices, config);

      expect(services1).not.toBe(services2);
      expect(services1.coreServices.logger).not.toBe(services2.coreServices.logger);
    });

    test('T3: Should initialize all required services', () => {
      const services = createTrackedServices(trackedServices, config);

      expect(services.coreServices.logger).toBeDefined();
      expect(services.coreServices.eventBus).toBeDefined();
      expect(services.marketDataServices.bybitService).toBeDefined();
      expect(services.webApiServices.journal).toBeDefined();
      expect(services.executionServices.positionManager).toBeDefined();
    });

    test('T4: Should have proper service type structure', () => {
      const services = createTrackedServices(trackedServices, config);

      // Check function types
      expect(typeof services.coreServices.logger.info).toBe('function');
      expect(typeof services.executionServices.positionManager.getCurrentPosition).toBe('function');
      expect(typeof services.executionServices.positionExitingService.executeExitAction).toBe('function');
    });

    test('T4b: Should keep runtime and market-data bootstrap boundaries wired through the state factory', () => {
      const services = createTrackedServices(trackedServices, config);
      const serviceState = services as BotServiceState;
      const webApiReadServices = selectWebApiReadServices(serviceState);

      expect(services.coreServices.telegram).toBeDefined();
      expect(services.coreServices.timeService).toBeDefined();
      expect(services.exchangeFactory).toBeDefined();
      expect(services.webApiServices.journal).toBeDefined();
      expect(services.marketDataServices.candleProvider).toBeDefined();
      expect(services.marketDataServices.webSocketManager).toBe(serviceState.webSocketManager);
      expect(services.marketDataServices.publicWebSocket).toBe(serviceState.publicWebSocket);
      expect(serviceState.indicatorCache).toBeDefined();
      expect(serviceState.indicatorPreCalc).toBeDefined();
      expect(services.monitoringServices.metrics).toBe(serviceState.metrics);
      expect(serviceState.riskServices.riskManager).toBe(serviceState.riskManager);
      expect(services.webApiServices.bybitService).toBe(serviceState.bybitService);
      expect(webApiReadServices.bybitService).toBe(serviceState.bybitService);
      expect(webApiReadServices.logger).toBe(services.coreServices.logger);
      expect(serviceState.eventHandlerServices.positionEventHandler).toBe(
        serviceState.positionEventHandler,
      );
      expect(serviceState.eventHandlerServices.webSocketEventHandler).toBe(
        serviceState.webSocketEventHandler,
      );
    });
  });

  describe('Dependency Injection - Service Override', () => {
    const mockExchange = {
      name: 'MockExchange',
      isConnected: jest.fn(() => true),
      healthCheck: jest.fn(async () => true),
    };

    const mockTelegram = {
      notifyBotStarted: jest.fn().mockResolvedValue(undefined),
      notifyBotStopped: jest.fn().mockResolvedValue(undefined),
    };

    test('T5: Should allow exchange service override', () => {
      const services = createTrackedServices(trackedServices, config, {
        bybitService: mockExchange as unknown as IExchange,
      });

      expect(services.marketDataServices.bybitService).toBe(mockExchange);
      expect(services.marketDataServices.bybitService.isConnected()).toBe(true);
    });

    test('T6: Should allow telegram service override', () => {
      const services = createTrackedServices(trackedServices, config, {
        telegram: mockTelegram as unknown as BotFactoryOptions['telegram'],
      });

      expect(services.coreServices.telegram).toBe(mockTelegram);
      expect(services.coreServices.telegram.notifyBotStopped).toBeDefined();
    });

    test('T7: Should allow multiple service overrides', () => {
      const services = createTrackedServices(trackedServices, config, {
        bybitService: mockExchange as unknown as IExchange,
        telegram: mockTelegram as unknown as BotFactoryOptions['telegram'],
      });

      expect(services.marketDataServices.bybitService).toBe(mockExchange);
      expect(services.coreServices.telegram).toBe(mockTelegram);
    });

    test('T8: Override should not affect other instances', () => {
      const services1 = createTrackedServices(trackedServices, config, {
        telegram: mockTelegram as unknown as BotFactoryOptions['telegram'],
      });

      const services2 = createTrackedServices(trackedServices, config, {});

      expect(services1.coreServices.telegram).toBe(mockTelegram);
      expect(services2.coreServices.telegram).not.toBe(mockTelegram);
    });

    test('T8b: logger override refreshes the narrowed core services boundary', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as unknown as BotFactoryOptions['logger'];

      const services = createTrackedServices(trackedServices, config, {
        logger: mockLogger,
      });

      expect(services.coreServices.logger).toBe(mockLogger);
      expect(selectWebApiReadServices(services as BotServiceState).logger).toBe(mockLogger);
    });
  });

  describe('Factory Helper Methods', () => {
    test('T9: createBotFactoryServiceState should support test-time overrides', () => {
      const mockExchange = {
        name: 'TestExchange',
        isConnected: jest.fn(() => true),
      };

      const services = createTrackedServices(trackedServices, config, {
        bybitService: mockExchange as unknown as IExchange,
      });

      expect(services).toBeDefined();
      expect(services.marketDataServices.bybitService).toBe(mockExchange);
    });

    test('T10: createBotFactoryServiceState with empty options creates normal services', () => {
      const services = createTrackedBotFactoryServices(trackedServices, config);

      expect(services).toBeDefined();
      expect(services.coreServices.logger).toBeDefined();
    });
  });

  describe('DI Container Benefits', () => {
    test('T11: Enables service mocking for unit tests', () => {
      const mockExchange = {
        name: 'MockExchange',
        openPosition: jest.fn(async () => ({
          id: 'test-pos-123',
          symbol: 'XRPUSDT',
          side: 'Buy',
          quantity: 100,
          entryPrice: 0.5,
          leverage: 10,
          stopLoss: 0.49,
          unrealizedPnL: 5,
          unrealizedPnLPercent: 1.0,
        })),
      };

      const services = createTrackedServices(trackedServices, config, {
        bybitService: mockExchange as unknown as IExchange,
      });

      expect(services.marketDataServices.bybitService.openPosition).toBeDefined();
    });

    test('T12: Supports service swappability', () => {
      const exchangeA = { name: 'BybitMock', isConnected: jest.fn(() => true) };
      const exchangeB = { name: 'BinanceMock', isConnected: jest.fn(() => true) };

      const servicesA = createTrackedServices(trackedServices, config, {
        bybitService: exchangeA as unknown as IExchange,
      });

      const servicesB = createTrackedServices(trackedServices, config, {
        bybitService: exchangeB as unknown as IExchange,
      });

      expect(servicesA.marketDataServices.bybitService.name).toBe('BybitMock');
      expect(servicesB.marketDataServices.bybitService.name).toBe('BinanceMock');
    });

    test('T13: Maintains service independence', () => {
      const mockExchange1 = { name: 'Exchange1' };
      const mockExchange2 = { name: 'Exchange2' };

      const services1 = createTrackedServices(trackedServices, config, {
        bybitService: mockExchange1 as unknown as IExchange,
      });

      const services2 = createTrackedServices(trackedServices, config, {
        bybitService: mockExchange2 as unknown as IExchange,
      });

      expect(services1.marketDataServices.bybitService.name).toBe('Exchange1');
      expect(services2.marketDataServices.bybitService.name).toBe('Exchange2');
    });
  });

  describe('Error Handling', () => {
    test('T14: Should handle empty override options', () => {
      expect(() => {
        trackCreatedServices(trackedServices, config, createBotFactoryServiceState(config, {}));
      }).not.toThrow();
    });

    test('T15: Should handle undefined overrides', () => {
      expect(() => {
        trackCreatedServices(trackedServices, config, createBotFactoryServiceState(config, undefined));
      }).not.toThrow();
    });

    test('T16: Should create valid services with partial overrides', () => {
      const mockExchange = { name: 'MockExchange' };

      const services = createTrackedServices(trackedServices, config, {
        bybitService: mockExchange as unknown as IExchange,
      });

      expect(services).toBeDefined();
      expect(services.executionServices.positionManager).toBeDefined();
      expect(services.webApiServices.journal).toBeDefined();
    });
  });
});
