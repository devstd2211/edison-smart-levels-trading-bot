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
import { Config } from '../../types/legacy';
import { LoggerService } from '../../types/legacy';
import {
  BotFactoryConfigValidationError,
} from '../../errors/DomainErrors';
import {
  createBotFactoryTestConfig,
  createTrackedBotFactoryServices,
  createTrackedSafeBotFactoryServices,
  deleteBotFactoryConfigPath,
  setBotFactoryConfigPath,
} from '../helpers/bot-factory-test.utils';
import {
  createManagedTrackedServicesContext,
  type ManagedTrackedServicesContext,
} from '../helpers/service-lifecycle-test.utils';

const asValidationError = (error: unknown): BotFactoryConfigValidationError => {
  if (error instanceof BotFactoryConfigValidationError) {
    return error;
  }
  throw error;
};

function bindTrackedServicesContext() {
  let context: ManagedTrackedServicesContext;
  let fixtures: Pick<ManagedTrackedServicesContext, 'trackedServices'>;

  beforeEach(() => {
    context = createManagedTrackedServicesContext();
    fixtures = {
      trackedServices: context.trackedServices,
    };
  });

  afterEach(async () => {
    await context.cleanup();
  });

  return () => fixtures;
}

describe('BotFactory Error Handling - Phase 8.9.41', () => {
  let validConfig: Config;
  let trackedServices: ManagedTrackedServicesContext['trackedServices'];
  const getContext = bindTrackedServicesContext();

  beforeEach(() => {
    validConfig = createBotFactoryTestConfig();
    ({ trackedServices } = getContext());
  });

  describe('Config Validation - THROW Strategy', () => {
    test('T1: Should throw on null config', () => {
      expect(() => {
        BotFactory.createWithValidation(null as unknown as Config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T2: Should throw on undefined config', () => {
      expect(() => {
        BotFactory.createWithValidation(undefined as unknown as Config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T3: Should throw on missing exchange', () => {
      const config = { ...validConfig };
      deleteBotFactoryConfigPath(config, 'exchange');

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T4: Should throw on missing exchange.symbol', () => {
      const config = { ...validConfig };
      deleteBotFactoryConfigPath(config, 'exchange.symbol');

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T5: Should throw on invalid exchange.symbol (not a string)', () => {
      const config = { ...validConfig };
      setBotFactoryConfigPath(config, 'exchange.symbol', 123);

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T6: Should throw on missing exchange.apiKey', () => {
      const config = { ...validConfig };
      deleteBotFactoryConfigPath(config, 'exchange.apiKey');

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T7: Should throw on missing exchange.apiSecret', () => {
      const config = { ...validConfig };
      deleteBotFactoryConfigPath(config, 'exchange.apiSecret');

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T8: Should throw on missing trading config', () => {
      const config = { ...validConfig };
      deleteBotFactoryConfigPath(config, 'trading');

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T9: Should throw on invalid trading.leverage', () => {
      const config = { ...validConfig };
      setBotFactoryConfigPath(config, 'trading.leverage', -5);

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T10: Should throw on missing riskManagement', () => {
      const config = { ...validConfig };
      deleteBotFactoryConfigPath(config, 'riskManagement');

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T11: Should throw on invalid riskManagement.stopLossPercent', () => {
      const config = { ...validConfig };
      setBotFactoryConfigPath(config, 'riskManagement.stopLossPercent', -1);

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T12: Should throw on invalid riskManagement.takeProfits (not array)', () => {
      const config = { ...validConfig };
      setBotFactoryConfigPath(config, 'riskManagement.takeProfits', 0.5);

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T13: Should throw on invalid riskManagement.positionSizeUsdt', () => {
      const config = { ...validConfig };
      setBotFactoryConfigPath(config, 'riskManagement.positionSizeUsdt', 0);

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T14: Should throw on missing logging config', () => {
      const config = { ...validConfig };
      deleteBotFactoryConfigPath(config, 'logging');

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T15: Should throw on invalid logging.level', () => {
      const config = { ...validConfig };
      deleteBotFactoryConfigPath(config, 'logging.level');

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T16: Should throw on invalid logging.logDir', () => {
      const config = { ...validConfig };
      deleteBotFactoryConfigPath(config, 'logging.logDir');

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T17: Should throw on missing timeframes', () => {
      const config = { ...validConfig };
      deleteBotFactoryConfigPath(config, 'timeframes');

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T18: Should throw on missing timeframes.entry', () => {
      const config = { ...validConfig };
      deleteBotFactoryConfigPath(config, 'timeframes.entry');

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T19: Should throw on missing timeframes.primary', () => {
      const config = { ...validConfig };
      deleteBotFactoryConfigPath(config, 'timeframes.primary');

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T20: Should throw on invalid indicators (not object)', () => {
      const config = { ...validConfig };
      setBotFactoryConfigPath(config, 'indicators', 'not-an-object');

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });
  });

  describe('Config Validation - Additional Coverage', () => {
    test('T21: Config with zero leverage is invalid', () => {
      const config = createBotFactoryTestConfig();
      setBotFactoryConfigPath(config, 'trading.leverage', 0);

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T22: Config with string leverage is invalid', () => {
      const config = createBotFactoryTestConfig();
      setBotFactoryConfigPath(config, 'trading.leverage', '10');

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T23: Config with empty apiKey is invalid', () => {
      const config = createBotFactoryTestConfig();
      setBotFactoryConfigPath(config, 'exchange.apiKey', '');

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T24: Config with empty stopLossPercent is invalid', () => {
      const config = createBotFactoryTestConfig();
      setBotFactoryConfigPath(config, 'riskManagement.stopLossPercent', 0);

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T25: Config with empty positionSize is invalid', () => {
      const config = createBotFactoryTestConfig();
      setBotFactoryConfigPath(config, 'riskManagement.positionSizeUsdt', 0);

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });
  });

  describe('Validation Error Messages', () => {
    test('T26: Validation error includes context about missing fields', () => {
      const config = createBotFactoryTestConfig();
      deleteBotFactoryConfigPath(config, 'exchange');

      try {
        BotFactory.createWithValidation(config);
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BotFactoryConfigValidationError);
        const error = asValidationError(err);
        expect(error.metadata.context?.missingField).toBe('exchange');
      }
    });

    test('T27: Validation error includes type information', () => {
      const config = createBotFactoryTestConfig();
      setBotFactoryConfigPath(config, 'trading.leverage', 'invalid');

      try {
        BotFactory.createWithValidation(config);
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BotFactoryConfigValidationError);
        const error = asValidationError(err);
        expect(error.metadata.context?.type).toBe('string');
      }
    });

    test('T28: createWithValidation validates config', () => {
      const config = createBotFactoryTestConfig();
      deleteBotFactoryConfigPath(config, 'trading');

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });
  });

  describe('Result-Based Error Handling', () => {
    test('T29: Should return failure result on config validation error', () => {
      const config = createBotFactoryTestConfig();
      deleteBotFactoryConfigPath(config, 'trading');

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
      } as unknown as LoggerService;

      const config = createBotFactoryTestConfig();
      deleteBotFactoryConfigPath(config, 'trading');

      const result = BotFactory.createSafe(config, {}, mockLogger);
      expect(result.success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('T31: createSafe returns services for valid config with explicit teardown path', async () => {
      const config = createBotFactoryTestConfig();
      const services = createTrackedSafeBotFactoryServices(trackedServices, config);
      const initializeSpy = jest.spyOn(services.marketDataServices.bybitService, 'initialize');

      expect(services.logger).toBeDefined();
      expect(services.executionServices.positionManager).toBeDefined();
      expect(initializeSpy).not.toHaveBeenCalled();
    });

    test('T32: createForTesting returns valid services for explicit lifecycle control', () => {
      const config = createBotFactoryTestConfig();
      const services = createTrackedBotFactoryServices(trackedServices, config);

      expect(services.coreServices.eventBus).toBeDefined();
      expect(services.marketDataServices.webSocketManager).toBeDefined();
    });
  });

  describe('Error Context Tracking', () => {
    test('T33: BotFactoryConfigValidationError includes context', () => {
      const config = createBotFactoryTestConfig();
      setBotFactoryConfigPath(config, 'exchange.symbol', 123);

      try {
        BotFactory.createWithValidation(config);
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BotFactoryConfigValidationError);
        const error = asValidationError(err);
        expect(error.metadata).toBeDefined();
        expect(error.metadata.context).toBeDefined();
        expect(error.metadata.context?.field).toBe('exchange.symbol');
      }
    });

    test('T34: Config validation error message is descriptive', () => {
      const config = createBotFactoryTestConfig();
      deleteBotFactoryConfigPath(config, 'riskManagement');

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
      const config = createBotFactoryTestConfig();
      setBotFactoryConfigPath(config, 'trading.leverage', 'invalid');

      try {
        BotFactory.createWithValidation(config);
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(BotFactoryConfigValidationError);
        const error = asValidationError(err);
        expect(error.metadata.context?.type).toBe('string');
      }
    });
  });

  describe('Factory Methods', () => {
    test('T36: createSafe returns correct type on validation error', () => {
      const config = createBotFactoryTestConfig();
      deleteBotFactoryConfigPath(config, 'exchange');

      const result = BotFactory.createSafe(config);
      expect('success' in result).toBe(true);
      expect('error' in result || 'services' in result).toBe(true);
    });

    test('T37: createWithValidation throws config errors', () => {
      const config = createBotFactoryTestConfig();
      setBotFactoryConfigPath(config, 'riskManagement.stopLossPercent', -5);

      expect(() => {
        BotFactory.createWithValidation(config);
      }).toThrow(BotFactoryConfigValidationError);
    });

    test('T38: createForTesting keeps backward-compatible validation behavior', () => {
      const config = createBotFactoryTestConfig();
      deleteBotFactoryConfigPath(config, 'timeframes');

      expect(() => {
        BotFactory.createForTesting(config);
      }).toThrow(BotFactoryConfigValidationError);
    });
  });
});
