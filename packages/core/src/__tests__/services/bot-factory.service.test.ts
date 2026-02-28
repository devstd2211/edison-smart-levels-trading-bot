/**
 * BotFactory Unit Tests
 * Phase 5: Dependency Injection Enhancement
 *
 * Tests verify that BotFactory correctly manages service creation and DI
 */

import { BotFactory } from '../../services/bot-factory.service';
import { Config } from '../../types/legacy';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Get minimal config for testing
 */
function getMinimalConfig(): Config {
  return {
    exchange: {
      name: 'bybit',
      symbol: 'XRPUSDT',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      demo: true,
    },
    trading: { leverage: 10, marginType: 'CROSS' },
    riskManagement: {
      stopLossPercent: 2,
      takeProfits: [0.5, 1, 1.5],
      positionSizeUsdt: 100,
    },
    logging: { level: 'info', logDir: './logs' },
    telegram: { enabled: false },
    timeframes: {
      entry: { interval: '1', candleLimit: 1000, enabled: true },
      primary: { interval: '5', candleLimit: 500, enabled: true },
    },
    dataSubscriptions: { candles: { enabled: true } },
    system: { timeSyncIntervalMs: 60000, timeSyncMaxFailures: 3 },
    indicators: { rsiPeriod: 14, slowEmaPeriod: 50 },
    // Required by BotServices builder
    entryConfig: {
      divergenceDetector: false,
    },
    strategy: {
      priceAction: false,
    },
    strategies: {},
    analyzers: [],
  } as any;
}

describe('BotFactory - DI Container for BotServices state', () => {
  let config: Config;

  beforeAll(() => {
    // Always use minimal config for backward compatibility with legacy tests
    // Error handling tests use their own config validation
    config = getMinimalConfig();
  });

  describe('Basic Factory Operations', () => {
    test('T1: Should create services state', () => {
      const services = BotFactory.create(config);
      expect(services).toBeDefined();
      expect(services.logger).toBeDefined();
    });

    test('T2: Should create multiple independent instances', () => {
      const services1 = BotFactory.create(config);
      const services2 = BotFactory.create(config);

      expect(services1).not.toBe(services2);
      expect(services1.logger).not.toBe(services2.logger);
    });

    test('T3: Should initialize all required services', () => {
      const services = BotFactory.create(config);

      expect(services.logger).toBeDefined();
      expect(services.coreServices.eventBus).toBeDefined();
      expect(services.marketDataServices.bybitService).toBeDefined();
      expect(services.webApiServices.journal).toBeDefined();
      expect(services.executionServices.positionManager).toBeDefined();
    });

    test('T4: Should have proper service type structure', () => {
      const services = BotFactory.create(config);

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
      notifyBotStarted: jest.fn(),
      notifyBotStopped: jest.fn(),
    };

    test('T5: Should allow exchange service override', () => {
      const services = BotFactory.create(config, {
        bybitService: mockExchange as any,
      });

      expect(services.marketDataServices.bybitService).toBe(mockExchange);
      expect(services.marketDataServices.bybitService.isConnected()).toBe(true);
    });

    test('T6: Should allow telegram service override', () => {
      const services = BotFactory.create(config, {
        telegram: mockTelegram as any,
      });

      expect(services.coreServices.telegram).toBe(mockTelegram);
      expect(services.coreServices.telegram.notifyBotStopped).toBeDefined();
    });

    test('T7: Should allow multiple service overrides', () => {
      const services = BotFactory.create(config, {
        bybitService: mockExchange as any,
        telegram: mockTelegram as any,
      });

      expect(services.marketDataServices.bybitService).toBe(mockExchange);
      expect(services.coreServices.telegram).toBe(mockTelegram);
    });

    test('T8: Override should not affect other instances', () => {
      const services1 = BotFactory.create(config, {
        telegram: mockTelegram as any,
      });

      const services2 = BotFactory.create(config, {});

      expect(services1.coreServices.telegram).toBe(mockTelegram);
      expect(services2.coreServices.telegram).not.toBe(mockTelegram);
    });
  });

  describe('Factory Helper Methods', () => {
    test('T9: createForTesting should work like create', () => {
      const mockExchange = {
        name: 'TestExchange',
        isConnected: jest.fn(() => true),
      };

      const services = BotFactory.createForTesting(config, {
        bybitService: mockExchange as any,
      });

      expect(services).toBeDefined();
      expect(services.marketDataServices.bybitService).toBe(mockExchange);
    });

    test('T10: createForTesting with empty options creates normal services', () => {
      const services = BotFactory.createForTesting(config);

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
          side: 'LONG' as any,
          quantity: 100,
          entryPrice: 0.5,
          leverage: 10,
          stopLoss: 0.49,
          unrealizedPnL: 5,
          unrealizedPnLPercent: 1.0,
        })),
      };

      const services = BotFactory.create(config, {
        bybitService: mockExchange as any,
      });

      expect(services.marketDataServices.bybitService.openPosition).toBeDefined();
    });

    test('T12: Supports service swappability', () => {
      const exchangeA = { name: 'BybitMock', isConnected: jest.fn(() => true) };
      const exchangeB = { name: 'BinanceMock', isConnected: jest.fn(() => true) };

      const servicesA = BotFactory.create(config, {
        bybitService: exchangeA as any,
      });

      const servicesB = BotFactory.create(config, {
        bybitService: exchangeB as any,
      });

      expect(servicesA.marketDataServices.bybitService.name).toBe('BybitMock');
      expect(servicesB.marketDataServices.bybitService.name).toBe('BinanceMock');
    });

    test('T13: Maintains service independence', () => {
      const mockExchange1 = { name: 'Exchange1' };
      const mockExchange2 = { name: 'Exchange2' };

      const services1 = BotFactory.create(config, {
        bybitService: mockExchange1 as any,
      });

      const services2 = BotFactory.create(config, {
        bybitService: mockExchange2 as any,
      });

      expect((services1.marketDataServices.bybitService as any).name).toBe('Exchange1');
      expect((services2.marketDataServices.bybitService as any).name).toBe('Exchange2');
    });
  });

  describe('Error Handling', () => {
    test('T14: Should handle empty override options', () => {
      expect(() => {
        BotFactory.create(config, {});
      }).not.toThrow();
    });

    test('T15: Should handle undefined overrides', () => {
      expect(() => {
        BotFactory.create(config, undefined);
      }).not.toThrow();
    });

    test('T16: Should create valid services with partial overrides', () => {
      const mockExchange = { name: 'MockExchange' };

      const services = BotFactory.create(config, {
        bybitService: mockExchange as any,
      });

      expect(services).toBeDefined();
      expect(services.executionServices.positionManager).toBeDefined();
      expect(services.webApiServices.journal).toBeDefined();
    });
  });
});
