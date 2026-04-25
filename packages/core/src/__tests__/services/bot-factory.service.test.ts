/**
 * BotFactory Unit Tests
 * Phase 5: Dependency Injection Enhancement
 *
 * Tests verify that BotFactory correctly manages service creation and DI
 */

import { createServices, type BotFactoryOptions } from '../../services/bot-factory.service';
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
} from '../helpers/service-lifecycle-test.utils';

type BotFactoryTrackedServicesContext = ReturnType<typeof createManagedTrackedServicesContext>;

describe('BotFactory - DI Container for BotServices state', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let config: Config;
  let trackedServices: BotFactoryTrackedServicesContext['trackedServices'];
  let cleanup: BotFactoryTrackedServicesContext['cleanup'];

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
      expect(services.logger).toBeDefined();
    });

    test('T2: Should create multiple independent instances', () => {
      const services1 = createTrackedServices(trackedServices, config);
      const services2 = createTrackedServices(trackedServices, config);

      expect(services1).not.toBe(services2);
      expect(services1.logger).not.toBe(services2.logger);
    });

    test('T3: Should initialize all required services', () => {
      const services = createTrackedServices(trackedServices, config);

      expect(services.logger).toBeDefined();
      expect(services.coreServices.eventBus).toBeDefined();
      expect(services.marketDataServices.bybitService).toBeDefined();
      expect(services.webApiServices.journal).toBeDefined();
      expect(services.executionServices.positionManager).toBeDefined();
    });

    test('T4: Should have proper service type structure', () => {
      const services = createTrackedServices(trackedServices, config);

      // Check function types
      expect(typeof services.logger.info).toBe('function');
      expect(typeof services.executionServices.positionManager.getCurrentPosition).toBe('function');
      expect(typeof services.executionServices.positionExitingService.executeExitAction).toBe('function');
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
  });

  describe('Factory Helper Methods', () => {
    test('T9: createServices should support test-time overrides', () => {
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

    test('T10: createServices with empty options creates normal services', () => {
      const services = createTrackedBotFactoryServices(trackedServices, config);

      expect(services).toBeDefined();
      expect(services.logger).toBeDefined();
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
        trackCreatedServices(trackedServices, config, createServices(config, {}));
      }).not.toThrow();
    });

    test('T15: Should handle undefined overrides', () => {
      expect(() => {
        trackCreatedServices(trackedServices, config, createServices(config, undefined));
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
