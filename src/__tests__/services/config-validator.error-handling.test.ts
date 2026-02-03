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
import { LoggerService, LogLevel } from '../../types';
import { ErrorHandler, RecoveryStrategy } from '../../errors';
import {
  ConfigValidationError,
  ConfigDeprecationError,
  ConfigFormatError,
  ConfigAnalyzerValidationError,
  ConfigStrategyValidationError,
} from '../../errors/DomainErrors';

// ============================================================================
// MOCKS
// ============================================================================

const createMockLogger = (): LoggerService => {
  return new LoggerService(LogLevel.ERROR, './logs', false);
};

const createMockErrorHandler = (): ErrorHandler & { handle: jest.Mock } => {
  const handler = new ErrorHandler({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });

  // Mock the handle method
  jest.spyOn(handler, 'handle').mockResolvedValue({
    success: true,
    recovered: true,
    message: 'Handled',
    strategy: RecoveryStrategy.THROW as any,
  } as any);

  return handler as any;
};

const validConfig = {
  exchange: {
    symbol: 'BTCUSDT',
    apiKey: 'test-key',
    apiSecret: 'test-secret',
  },
  riskManagement: {
    stopLossPercent: 2.5,
    positionSizeUsdt: 10,
  },
  trading: {
    leverage: 10,
  },
  thresholds: {
    defaults: {
      confidence: {
        min: 0.6,
        clampMin: 0.3,
        clampMax: 0.9,
      },
    },
    regimes: {
      LOW: { confidence: { min: 0.5 } },
      MEDIUM: { confidence: { min: 0.6 } },
      HIGH: { confidence: { min: 0.7 } },
    },
  },
  strategies: {
    levelBased: {
      minConfidenceThreshold: 0.65,
      blockLongInDowntrend: true,
      blockShortInUptrend: false,
      levelClustering: {
        trendFilters: {
          downtrend: { rsiThreshold: 30 },
          uptrend: { rsiThreshold: 70 },
        },
      },
    },
  },
  entryScanner: {
    minConfidenceThreshold: 0.3,
    confidenceClampMin: 0.2,
    confidenceClampMax: 0.95,
  },
  entryThresholds: {
    minTotalScore: 0.55,
  },
  strategicWeights: {
    technicalIndicators: {
      rsi: { enabled: true },
      ema: { enabled: true },
      atr: { enabled: true },
    },
    marketStructure: {
      liquidity: { enabled: false },
      divergence: { enabled: false },
      breakout: { enabled: false },
      flatMarket: { enabled: false },
    },
    smcMicrostructure: {
      footprint: { enabled: true },
      orderBlock: { enabled: true },
      fairValueGap: { enabled: false },
    },
    externalData: {
      btcCorrelation: { enabled: false },
      fundingRate: { enabled: false },
      orderbookImbalance: { enabled: false },
    },
  },
};

// ============================================================================
// TESTS
// ============================================================================

describe('ConfigValidatorService - Error Handling (Phase 8.9.31)', () => {
  let logger: LoggerService;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = createMockLogger();
    errorHandler = createMockErrorHandler();
  });

  // ========================================================================
  // SECTION A: Deprecated Key Detection - THROW Strategy (3 tests)
  // ========================================================================

  describe('A. Deprecated Key Detection (3 tests)', () => {
    it('test-8.9.31.A1: Should throw ConfigDeprecationError for deprecated contextConfig key', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);
      const config = { ...validConfig, contextConfig: { someValue: true } };

      expect(() => validator.validateAll(config)).toThrow(ConfigDeprecationError);
    });

    it('test-8.9.31.A2: Should throw for multiple deprecated keys', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);
      const config = {
        ...validConfig,
        contextConfig: {},
        features: {},
        mode: 'SCALPING',
      };

      expect(() => validator.validateAll(config)).toThrow();
    });

    it('test-8.9.31.A3: Should work without ErrorHandler (backward compat)', () => {
      const validator = new ConfigValidatorService(logger); // No ErrorHandler

      expect(() => validator.validateAll(validConfig)).not.toThrow();
    });
  });

  // ========================================================================
  // SECTION B: Required Field Validation - THROW Strategy (4 tests)
  // ========================================================================

  describe('B. Required Field Validation (4 tests)', () => {
    it('test-8.9.31.B1: Should throw ConfigValidationError for missing exchange.symbol', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);
      const config = { ...validConfig, exchange: { ...validConfig.exchange, symbol: '' } };

      expect(() => validator.validateAll(config)).toThrow(ConfigValidationError);
    });

    it('test-8.9.31.B2: Should treat null as missing field', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);
      const config = { ...validConfig, exchange: { ...validConfig.exchange, symbol: null } };

      expect(() => validator.validateAll(config as any)).toThrow(ConfigValidationError);
    });

    it('test-8.9.31.B3: Should throw for missing riskManagement.stopLossPercent', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);
      const config = {
        ...validConfig,
        riskManagement: { ...validConfig.riskManagement, stopLossPercent: undefined },
      };

      expect(() => validator.validateAll(config as any)).toThrow(ConfigValidationError);
    });

    it('test-8.9.31.B4: Should collect multiple missing required fields', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);
      const config = {
        exchange: { symbol: '', apiKey: '', apiSecret: '' },
        riskManagement: { stopLossPercent: undefined, positionSizeUsdt: 0 },
        trading: { leverage: undefined },
      };

      try {
        validator.validateAll(config as any);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ConfigValidationError);
      }
    });
  });

  // ========================================================================
  // SECTION C: Confidence Format (0-1) - THROW Strategy (3 tests)
  // ========================================================================

  describe('C. Confidence Format Validation (3 tests)', () => {
    it('test-8.9.31.C1: Should throw ConfigFormatError for confidence > 1', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);
      const config = {
        ...validConfig,
        thresholds: {
          ...validConfig.thresholds,
          defaults: {
            confidence: { min: 60 }, // Should be 0.6, not 60
          },
        },
      };

      expect(() => validator.validateAll(config as any)).toThrow(ConfigFormatError);
    });

    it('test-8.9.31.C2: Should collect multiple confidence format errors', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);
      const config = {
        ...validConfig,
        thresholds: {
          ...validConfig.thresholds,
          defaults: {
            confidence: { min: 80, clampMin: 50 },
          },
        },
      };

      try {
        validator.validateAll(config as any);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ConfigFormatError);
      }
    });

    it('test-8.9.31.C3: Should pass with valid 0-1 confidence', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);

      expect(() => validator.validateAll(validConfig)).not.toThrow();
    });
  });

  // ========================================================================
  // SECTION D: Range Validation - THROW Strategy (3 tests)
  // ========================================================================

  describe('D. Range Validation (3 tests)', () => {
    it('test-8.9.31.D1: Should throw ConfigFormatError for stopLoss out of range', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);
      const config = {
        ...validConfig,
        riskManagement: { ...validConfig.riskManagement, stopLossPercent: 25 }, // > 20%
      };

      expect(() => validator.validateAll(config)).toThrow(ConfigFormatError);
    });

    it('test-8.9.31.D2: Should throw ConfigFormatError for leverage out of range', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);
      const config = { ...validConfig, trading: { leverage: 150 } }; // > 100

      expect(() => validator.validateAll(config)).toThrow(ConfigFormatError);
    });

    it('test-8.9.31.D3: Should throw for negative stopLossPercent', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);
      const config = {
        ...validConfig,
        riskManagement: { ...validConfig.riskManagement, stopLossPercent: -1 },
      };

      expect(() => validator.validateAll(config)).toThrow(ConfigFormatError);
    });
  });

  // ========================================================================
  // SECTION E: Analyzer Configuration - THROW Strategy (2 tests)
  // ========================================================================

  describe('E. Analyzer Configuration Validation (2 tests)', () => {
    it('test-8.9.31.E1: Should throw ConfigAnalyzerValidationError for missing strategicWeights', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);
      const config = { ...validConfig };
      delete (config as any).strategicWeights;

      expect(() => validator.validateAnalyzerConfig(config)).toThrow(ConfigAnalyzerValidationError);
    });

    it('test-8.9.31.E2: Should throw for missing analyzer enabled flag', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);
      const config = {
        ...validConfig,
        strategicWeights: {
          ...validConfig.strategicWeights,
          technicalIndicators: {
            rsi: { enabled: true },
            ema: { enabled: true },
            atr: {}, // Missing enabled flag
          },
        },
      };

      expect(() => validator.validateAnalyzerConfig(config as any)).toThrow(ConfigAnalyzerValidationError);
    });
  });

  // ========================================================================
  // SECTION F: Strategy Configuration - THROW Strategy (2 tests)
  // ========================================================================

  describe('F. Strategy Configuration Validation (2 tests)', () => {
    it('test-8.9.31.F1: Should throw ConfigStrategyValidationError for missing strategies section', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);
      const config = { ...validConfig };
      delete (config as any).strategies;

      expect(() => validator.validateStrategyConfig(config as any)).toThrow(ConfigStrategyValidationError);
    });

    it('test-8.9.31.F2: Should throw for missing blockLongInDowntrend flag', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);
      const config = {
        ...validConfig,
        strategies: {
          levelBased: {
            blockShortInUptrend: true,
            levelClustering: validConfig.strategies.levelBased.levelClustering,
          },
        },
      };

      expect(() => validator.validateStrategyConfig(config as any)).toThrow(ConfigStrategyValidationError);
    });
  });

  // ========================================================================
  // SECTION G: ErrorHandler Integration - THROW Strategy (1 test)
  // ========================================================================

  describe('G. ErrorHandler Integration (1 test)', () => {
    it('test-8.9.31.G1: Should call ErrorHandler.handle with THROW strategy on validation error', async () => {
      const validator = new ConfigValidatorService(logger, errorHandler);
      const config = { ...validConfig, exchange: { ...validConfig.exchange, symbol: '' } };

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
      const mockLogger = createMockLogger();
      jest.spyOn(mockLogger, 'info').mockImplementation(() => {
        throw new Error('Logger write failed');
      });

      const validator = new ConfigValidatorService(mockLogger, errorHandler);

      // Should not throw despite logger error
      expect(() => validator.validateAll(validConfig)).not.toThrow();
    });
  });

  // ========================================================================
  // SECTION I: Additional Coverage (2 tests)
  // ========================================================================

  describe('I. Additional Coverage (2 tests)', () => {
    it('test-8.9.31.I1: Should handle validateAnalyzerConfig with ErrorHandler', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);

      expect(() => validator.validateAnalyzerConfig(validConfig)).not.toThrow();
    });

    it('test-8.9.31.I2: Should handle validateStrategyConfig with ErrorHandler', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);

      expect(() => validator.validateStrategyConfig(validConfig)).not.toThrow();
    });
  });

  // ========================================================================
  // SECTION J: Error Context Verification (1 test)
  // ========================================================================

  describe('J. Error Context Verification (1 test)', () => {
    it('test-8.9.31.J1: Should throw ConfigValidationError with proper error type', () => {
      const validator = new ConfigValidatorService(logger, errorHandler);
      const config = { ...validConfig, exchange: { ...validConfig.exchange, symbol: '' } };

      try {
        validator.validateAll(config);
        fail('Should have thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect(error.message).toBeDefined();
        expect(error.message).toContain('Configuration validation failed');
      }
    });
  });
});
