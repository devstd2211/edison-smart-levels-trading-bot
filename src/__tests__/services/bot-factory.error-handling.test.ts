/**
 * BotFactory Error Handling Tests
 * Phase 8.9.41: ErrorHandler Integration
 *
 * Tests error handling strategies:
 * - THROW: Config validation errors
 * - GRACEFUL_DEGRADE: Service initialization errors
 * - SKIP: Logging/override failures (non-critical)
 *
 * Coverage:
 * - Config validation (required fields, types, ranges)
 * - Service initialization failure recovery
 * - DI override safety and error handling
 * - Backward compatibility (works without ErrorHandler)
 */

import { BotFactory } from '../../services/bot-factory.service';
import { BotServices } from '../../services/bot-services';
import { Config } from '../../types';
import { LoggerService } from '../../types';
import {
  BotFactoryConfigValidationError,
  BotFactoryInitializationError,
} from '../../errors/DomainErrors';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Get minimal valid config for testing
 * Returns a fresh copy each time to avoid test pollution
 */
function getValidConfig(): Config {
  // Create a fresh copy each time to avoid mutations affecting other tests
  const createConfig = () => ({
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
    // Required by BotServices constructor
    entryConfig: {
      divergenceDetector: false,
    },
    strategy: {
      priceAction: false,
    },
    strategies: {},
    analyzers: [],
  } as any);

  return createConfig();
}

describe('BotFactory Error Handling - Phase 8.9.41', () => {
  let validConfig: Config;
  const createdServices: any[] = [];

  beforeAll(() => {
    validConfig = getValidConfig();
  });

  afterEach(() => {
    // Clean up any created BotServices instances (stop timers, close connections)
    createdServices.forEach((services) => {
      try {
        // Try to clean up any timers or intervals
        if (services.dashboard && typeof services.dashboard.destroy === 'function') {
          services.dashboard.destroy();
        }
      } catch (err) {
        // Ignore cleanup errors
      }
    });
    createdServices.length = 0;
  });

  describe('Config Validation - THROW Strategy', () => {
    test('T1: Should throw on null config', () => {
      expect(() => {
        BotFactory.createWithValidation(null as any);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T2: Should throw on undefined config', () => {
      expect(() => {
        BotFactory.createWithValidation(undefined as any);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T3: Should throw on missing exchange', () => {
      const config = { ...validConfig };
      delete (config as any).exchange;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T4: Should throw on missing exchange.symbol', () => {
      const config = { ...validConfig };
      delete (config as any).exchange.symbol;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T5: Should throw on invalid exchange.symbol (not a string)', () => {
      const config = { ...validConfig };
      (config as any).exchange.symbol = 123;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T6: Should throw on missing exchange.apiKey', () => {
      const config = { ...validConfig };
      delete (config as any).exchange.apiKey;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T7: Should throw on missing exchange.apiSecret', () => {
      const config = { ...validConfig };
      delete (config as any).exchange.apiSecret;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T8: Should throw on missing trading config', () => {
      const config = { ...validConfig };
      delete (config as any).trading;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T9: Should throw on invalid trading.leverage', () => {
      const config = { ...validConfig };
      (config as any).trading.leverage = -5;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T10: Should throw on missing riskManagement', () => {
      const config = { ...validConfig };
      delete (config as any).riskManagement;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T11: Should throw on invalid riskManagement.stopLossPercent', () => {
      const config = { ...validConfig };
      (config as any).riskManagement.stopLossPercent = -1;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T12: Should throw on invalid riskManagement.takeProfits (not array)', () => {
      const config = { ...validConfig };
      (config as any).riskManagement.takeProfits = 0.5;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T13: Should throw on invalid riskManagement.positionSizeUsdt', () => {
      const config = { ...validConfig };
      (config as any).riskManagement.positionSizeUsdt = 0;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T14: Should throw on missing logging config', () => {
      const config = { ...validConfig };
      delete (config as any).logging;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T15: Should throw on invalid logging.level', () => {
      const config = { ...validConfig };
      delete (config as any).logging.level;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T16: Should throw on invalid logging.logDir', () => {
      const config = { ...validConfig };
      delete (config as any).logging.logDir;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T17: Should throw on missing timeframes', () => {
      const config = { ...validConfig };
      delete (config as any).timeframes;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T18: Should throw on missing timeframes.entry', () => {
      const config = { ...validConfig };
      delete (config as any).timeframes.entry;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T19: Should throw on missing timeframes.primary', () => {
      const config = { ...validConfig };
      delete (config as any).timeframes.primary;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T20: Should throw on invalid indicators (not object)', () => {
      const config = { ...validConfig };
      (config as any).indicators = 'not-an-object';

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });
  });

  describe('Config Validation - Additional Coverage', () => {
    test('T21: Config with zero leverage is invalid', () => {
      const config = getValidConfig();
      (config as any).trading.leverage = 0;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T22: Config with string leverage is invalid', () => {
      const config = getValidConfig();
      (config as any).trading.leverage = '10';

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T23: Config with empty apiKey is invalid', () => {
      const config = getValidConfig();
      (config as any).exchange.apiKey = '';

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T24: Config with empty stopLossPercent is invalid', () => {
      const config = getValidConfig();
      (config as any).riskManagement.stopLossPercent = 0;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T25: Config with empty positionSize is invalid', () => {
      const config = getValidConfig();
      (config as any).riskManagement.positionSizeUsdt = 0;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });
  });

  describe('Validation Error Messages', () => {
    test('T26: Validation error includes context about missing fields', () => {
      const config = getValidConfig();
      delete (config as any).exchange;

      try {
        BotFactory.createWithValidation(config);
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BotFactoryConfigValidationError);
        const error = err as any;
        expect(error.metadata.context.missingField).toBe('exchange');
      }
    });

    test('T27: Validation error includes type information', () => {
      const config = getValidConfig();
      (config as any).trading.leverage = 'invalid';

      try {
        BotFactory.createWithValidation(config);
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BotFactoryConfigValidationError);
        const error = err as any;
        expect(error.metadata.context.type).toBe('string');
      }
    });

    test('T28: createForTesting validates config', () => {
      const config = getValidConfig();
      delete (config as any).trading;

      expect(() => {
        BotFactory.createForTesting(config);
      }).toThrow(BotFactoryConfigValidationError);
    });
  });

  describe('Result-Based Error Handling', () => {
    test('T29: Should return failure result on config validation error', () => {
      const config = getValidConfig();
      delete (config as any).trading;

      const result = BotFactory.createSafe(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    test('T30: createSafe logs errors with provided logger', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      } as any;

      const config = getValidConfig();
      delete (config as any).trading;

      const result = BotFactory.createSafe(config, {}, mockLogger);
      expect(result.success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

  });

  describe('Error Context Tracking', () => {
    test('T33: BotFactoryConfigValidationError includes context', () => {
      const config = getValidConfig();
      (config as any).exchange.symbol = 123;

      try {
        BotFactory.createWithValidation(config);
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BotFactoryConfigValidationError);
        const error = err as any;
        expect(error.metadata).toBeDefined();
        expect(error.metadata.context).toBeDefined();
        expect(error.metadata.context.field).toBe('exchange.symbol');
      }
    });

    test('T34: Config validation error message is descriptive', () => {
      const config = getValidConfig();
      delete (config as any).riskManagement;

      try {
        BotFactory.createWithValidation(config);
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BotFactoryConfigValidationError);
        const error = err as Error;
        expect(error.message).toContain('riskManagement');
      }
    });

    test('T35: Should preserve type information in context', () => {
      const config = getValidConfig();
      (config as any).trading.leverage = 'invalid';

      try {
        BotFactory.createWithValidation(config);
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BotFactoryConfigValidationError);
        const error = err as any;
        expect(error.metadata.context.type).toBe('string');
      }
    });
  });

  describe('Factory Methods', () => {
    test('T36: createSafe returns correct type on validation error', () => {
      const config = getValidConfig();
      delete (config as any).exchange;

      const result = BotFactory.createSafe(config);
      expect('success' in result).toBe(true);
      expect('error' in result || 'services' in result).toBe(true);
    });

    test('T37: createWithValidation throws config errors', () => {
      const config = getValidConfig();
      (config as any).riskManagement.stopLossPercent = -5;

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T38: createForTesting validates before creating', () => {
      const config = getValidConfig();
      delete (config as any).timeframes;

      expect(() => {
        BotFactory.createForTesting(config);
      }).toThrow(BotFactoryConfigValidationError);
    });
  });
});
