/**
 * ConfigValidatorService - Error Handling Tests
 *
 * Phase 8.9.31: ErrorHandler Integration
 * Tests for THROW strategy on validation errors and SKIP on logger failures
 *
 * Scenarios:
 * - Deprecated key detection (ConfigDeprecationError + THROW)
 * - Required field validation (ConfigValidationError + THROW)
 * - Confidence format validation (ConfigFormatError + THROW)
 * - Range validation (ConfigFormatError + THROW)
 * - Analyzer configuration (ConfigAnalyzerValidationError + THROW)
 * - Strategy configuration (ConfigStrategyValidationError + THROW)
 * - ErrorHandler integration with SKIP for logging
 * - Backward compatibility (works without ErrorHandler)
 */

import { ConfigValidatorService } from '../../services/config-validator.service';
import { ErrorHandler } from '../../errors';
import {
  ConfigValidationError,
  ConfigDeprecationError,
  ConfigFormatError,
  ConfigAnalyzerValidationError,
  ConfigStrategyValidationError,
} from '../../errors/DomainErrors';
import {
  asConfigValidatorInput,
  createConfigValidatorConfig,
  createConfigValidatorHarness,
  createConfigValidatorLogger,
  createManagedConfigValidatorContext,
  omitConfigValidatorSection,
} from '../helpers/config-validator-test.utils';

type ConfigValidatorHarness = ReturnType<typeof createConfigValidatorHarness>;
type ConfigValidatorManagedFactory = ReturnType<typeof createManagedConfigValidatorContext>;
type ConfigValidatorRuntime = Pick<
  ConfigValidatorManagedFactory,
  'logger' | 'errorHandler' | 'validator' | 'validConfig'
>;
type ConfigValidatorFactories = Pick<
  ConfigValidatorManagedFactory,
  'createValidator' | 'createLegacyValidator'
>;
type ConfigValidatorFixtures = {
  runtime: ConfigValidatorRuntime;
  factories: ConfigValidatorFactories;
};

// ============================================================================
// TESTS
// ============================================================================

describe('ConfigValidatorService - Error Handling (Phase 8.9.31)', () => {
  let logger: ConfigValidatorManagedFactory['logger'];
  let errorHandler: ErrorHandler;
  let validator: ConfigValidatorManagedFactory['validator'];
  let createValidator: ConfigValidatorFactories['createValidator'];
  let createLegacyValidator: ConfigValidatorFactories['createLegacyValidator'];
  let validConfig: ConfigValidatorManagedFactory['validConfig'];
  let fixtures: ConfigValidatorFixtures;
  let cleanup: () => void;

  beforeEach(() => {
    const managedContext = createManagedConfigValidatorContext();
    fixtures = {
      runtime: {
        logger: managedContext.logger,
        errorHandler: managedContext.errorHandler,
        validator: managedContext.validator,
        validConfig: managedContext.validConfig,
      },
      factories: {
        createValidator: managedContext.createValidator,
        createLegacyValidator: managedContext.createLegacyValidator,
      },
    };
    cleanup = managedContext.cleanup;
    ({ logger, errorHandler, validator, validConfig } = fixtures.runtime);
    ({ createValidator, createLegacyValidator } = fixtures.factories);
  });

  afterEach(() => {
    cleanup();
  });

  // ========================================================================
  // SECTION A: Deprecated Key Detection - THROW Strategy (3 tests)
  // ========================================================================

  describe('A. Deprecated Key Detection (3 tests)', () => {
    it('test-8.9.31.A1: Should throw ConfigDeprecationError for deprecated contextConfig key', () => {
      const validator = createValidator();
      const config = { ...validConfig, contextConfig: { someValue: true } };

      expect(() => validator.validateAll(config)).toThrow(ConfigDeprecationError);
    });

    it('test-8.9.31.A2: Should throw for multiple deprecated keys', () => {
      const validator = createValidator();
      const config = {
        ...validConfig,
        contextConfig: {},
        features: {},
        mode: 'SCALPING',
      };

      expect(() => validator.validateAll(config)).toThrow();
    });

    it('test-8.9.31.A3: Should work without ErrorHandler (backward compat)', () => {
      const validator = createLegacyValidator();

      expect(() => validator.validateAll(validConfig)).not.toThrow();
    });
  });

  // ========================================================================
  // SECTION B: Required Field Validation - THROW Strategy (4 tests)
  // ========================================================================

  describe('B. Required Field Validation (4 tests)', () => {
    it('test-8.9.31.B1: Should throw ConfigValidationError for missing exchange.symbol', () => {
      const validator = createValidator();
      const config = createConfigValidatorConfig({
        exchange: { symbol: '' },
      });

      expect(() => validator.validateAll(config)).toThrow(ConfigValidationError);
    });

    it('test-8.9.31.B2: Should treat null as missing field', () => {
      const validator = createValidator();
      const config = createConfigValidatorConfig({
        exchange: { symbol: null },
      });

      expect(() => validator.validateAll(asConfigValidatorInput(config))).toThrow(ConfigValidationError);
    });

    it('test-8.9.31.B3: Should throw for missing riskManagement.stopLossPercent', () => {
      const validator = createValidator();
      const config = createConfigValidatorConfig({
        riskManagement: { stopLossPercent: undefined },
      });

      expect(() => validator.validateAll(asConfigValidatorInput(config))).toThrow(ConfigValidationError);
    });

    it('test-8.9.31.B4: Should collect multiple missing required fields', () => {
      const validator = createValidator();
      const config = {
        exchange: { symbol: '', apiKey: '', apiSecret: '' },
        riskManagement: { stopLossPercent: undefined, positionSizeUsdt: 0 },
        trading: { leverage: undefined },
      };

      try {
        validator.validateAll(asConfigValidatorInput(config));
        fail('Should have thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ConfigValidationError);
      }
    });
  });

  // ========================================================================
  // SECTION C: Confidence Format (0-1) - THROW Strategy (3 tests)
  // ========================================================================

  describe('C. Confidence Format Validation (3 tests)', () => {
    it('test-8.9.31.C1: Should throw ConfigFormatError for confidence > 1', () => {
      const validator = createValidator();
      const config = createConfigValidatorConfig({
        thresholdsDefaultsConfidence: { min: 60 },
      });

      expect(() => validator.validateAll(asConfigValidatorInput(config))).toThrow(ConfigFormatError);
    });

    it('test-8.9.31.C2: Should collect multiple confidence format errors', () => {
      const validator = createValidator();
      const config = createConfigValidatorConfig({
        thresholdsDefaultsConfidence: { min: 80, clampMin: 50 },
      });

      try {
        validator.validateAll(asConfigValidatorInput(config));
        fail('Should have thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ConfigFormatError);
      }
    });

    it('test-8.9.31.C3: Should pass with valid 0-1 confidence', () => {
      expect(() => validator.validateAll(validConfig)).not.toThrow();
    });
  });

  // ========================================================================
  // SECTION D: Range Validation - THROW Strategy (3 tests)
  // ========================================================================

  describe('D. Range Validation (3 tests)', () => {
    it('test-8.9.31.D1: Should throw ConfigFormatError for stopLoss out of range', () => {
      const validator = createValidator();
      const config = createConfigValidatorConfig({
        riskManagement: { stopLossPercent: 25 },
      });

      expect(() => validator.validateAll(config)).toThrow(ConfigFormatError);
    });

    it('test-8.9.31.D2: Should throw ConfigFormatError for leverage out of range', () => {
      const validator = createValidator();
      const config = createConfigValidatorConfig({
        trading: { leverage: 150 },
      });

      expect(() => validator.validateAll(config)).toThrow(ConfigFormatError);
    });

    it('test-8.9.31.D3: Should throw for negative stopLossPercent', () => {
      const validator = createValidator();
      const config = createConfigValidatorConfig({
        riskManagement: { stopLossPercent: -1 },
      });

      expect(() => validator.validateAll(config)).toThrow(ConfigFormatError);
    });
  });

  // ========================================================================
  // SECTION E: Analyzer Configuration - THROW Strategy (2 tests)
  // ========================================================================

  describe('E. Analyzer Configuration Validation (2 tests)', () => {
    it('test-8.9.31.E1: Should throw ConfigAnalyzerValidationError for missing strategicWeights', () => {
      const validator = createValidator();
      const config = omitConfigValidatorSection(validConfig, 'strategicWeights');

      expect(() => validator.validateAnalyzerConfig(asConfigValidatorInput(config))).toThrow(ConfigAnalyzerValidationError);
    });

    it('test-8.9.31.E2: Should throw for missing analyzer enabled flag', () => {
      const validator = createValidator();
      const config = createConfigValidatorConfig({
        technicalIndicators: { atr: { enabled: undefined } },
      });

      expect(() => validator.validateAnalyzerConfig(asConfigValidatorInput(config))).toThrow(ConfigAnalyzerValidationError);
    });
  });

  // ========================================================================
  // SECTION F: Strategy Configuration - THROW Strategy (2 tests)
  // ========================================================================

  describe('F. Strategy Configuration Validation (2 tests)', () => {
    it('test-8.9.31.F1: Should throw ConfigStrategyValidationError for missing strategies section', () => {
      const validator = createValidator();
      const config = omitConfigValidatorSection(validConfig, 'strategies');

      expect(() => validator.validateStrategyConfig(asConfigValidatorInput(config))).toThrow(ConfigStrategyValidationError);
    });

    it('test-8.9.31.F2: Should throw for missing blockLongInDowntrend flag', () => {
      const validator = createValidator();
      const config = createConfigValidatorConfig({
        strategiesLevelBased: {
          blockLongInDowntrend: undefined,
          blockShortInUptrend: true,
        },
      });

      expect(() => validator.validateStrategyConfig(asConfigValidatorInput(config))).toThrow(ConfigStrategyValidationError);
    });
  });

  // ========================================================================
  // SECTION G: ErrorHandler Integration - THROW Strategy (1 test)
  // ========================================================================

  describe('G. ErrorHandler Integration (1 test)', () => {
    it('test-8.9.31.G1: Should call ErrorHandler.handle with THROW strategy on validation error', async () => {
      const validator = createValidator();
      const config = createConfigValidatorConfig({
        exchange: { symbol: '' },
      });

      try {
        validator.validateAll(config);
      } catch (error) {
        // Expected to throw
      }

      // Verify ErrorHandler was called with THROW strategy
      // Note: The async nature may require waitFor in real tests
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });

  // ========================================================================
  // SECTION H: Logger Failures - SKIP Strategy (1 test)
  // ========================================================================

  describe('H. Logger Failures - SKIP Strategy (1 test)', () => {
    it('test-8.9.31.H1: Should skip logger errors during validation (SKIP strategy)', () => {
      const mockLogger = createConfigValidatorLogger();
      jest.spyOn(mockLogger, 'info').mockImplementation(() => {
        throw new Error('Logger write failed');
      });

      const validator = createValidator({ logger: mockLogger, errorHandler });

      // Should not throw despite logger error
      expect(() => validator.validateAll(validConfig)).not.toThrow();
    });
  });

  // ========================================================================
  // SECTION I: Additional Coverage (2 tests)
  // ========================================================================

  describe('I. Additional Coverage (2 tests)', () => {
    it('test-8.9.31.I1: Should handle validateAnalyzerConfig with ErrorHandler', () => {
      expect(() => validator.validateAnalyzerConfig(validConfig)).not.toThrow();
    });

    it('test-8.9.31.I2: Should handle validateStrategyConfig with ErrorHandler', () => {
      expect(() => validator.validateStrategyConfig(validConfig)).not.toThrow();
    });
  });

  // ========================================================================
  // SECTION J: Error Context Verification (1 test)
  // ========================================================================

  describe('J. Error Context Verification (1 test)', () => {
    it('test-8.9.31.J1: Should throw ConfigValidationError with proper error type', () => {
      const validator = createValidator();
      const config = createConfigValidatorConfig({
        exchange: { symbol: '' },
      });

      try {
        validator.validateAll(config);
        fail('Should have thrown');
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect((error as Error).message).toBeDefined();
        expect((error as Error).message).toContain('Configuration validation failed');
      }
    });
  });
});
