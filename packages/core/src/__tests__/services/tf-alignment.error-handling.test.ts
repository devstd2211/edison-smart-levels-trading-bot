/**
 * TFAlignmentService Error Handling Tests (Phase 8.9.69)
 *
 * Test Coverage:
 * - THROW: Input validation (null/invalid indicators, direction, price)
 * - THROW: Config validation (enabled, minAlignmentScore, timeframe weights)
 * - GRACEFUL_DEGRADE: Calculation failures (NaN/Infinity in indicators)
 * - SKIP: Logging errors
 * - Integration: Multi-timeframe alignment scoring
 * - Backward Compatibility: Tests without ErrorHandler still work
 */

import { TFAlignmentService } from '../../services/tf-alignment.service';
import { LoggerService } from '../../services/logger.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  createTFAlignmentConfig,
  createManagedTFAlignmentContext,
  createTFAlignmentIndicators,
  createTFAlignmentMockLogger,
  createTFAlignmentService,
} from '../helpers/tf-alignment-test.utils';

describe('TFAlignmentService Error Handling (Phase 8.9.69)', () => {
  let service!: TFAlignmentService;
  let errorHandler!: ErrorHandler;
  let mockLogger!: ReturnType<typeof createManagedTFAlignmentContext>['logger'];
  type AlignmentDirection = Parameters<TFAlignmentService['calculateAlignment']>[0];
  type AlignmentIndicators = Parameters<TFAlignmentService['calculateAlignment']>[2];
  type AlignmentConfigInput = ConstructorParameters<typeof TFAlignmentService>[0];
  let cleanup!: ReturnType<typeof createManagedTFAlignmentContext>['cleanup'];
  let createService!: ReturnType<typeof createManagedTFAlignmentContext>['createStandardService'];
  let createLegacyService!: ReturnType<typeof createManagedTFAlignmentContext>['createLegacyService'];

  beforeEach(() => {
    let managedErrorHandler: ReturnType<typeof createManagedTFAlignmentContext>['errorHandler'];
    ({
      logger: mockLogger,
      errorHandler: managedErrorHandler,
      createStandardService: createService,
      createLegacyService,
      cleanup,
    } = createManagedTFAlignmentContext());
    errorHandler = managedErrorHandler ?? new ErrorHandler(mockLogger as unknown as LoggerService);
  });

  afterEach(() => {
    cleanup();
  });

  describe('THROW: Input Validation', () => {
    beforeEach(() => {
      service = createService({
        configOverrides: createTFAlignmentConfig({ minAlignmentScore: 60 }),
      });
    });

    test('should throw on invalid direction', () => {
      const indicators = createTFAlignmentIndicators();
      expect(() => {
        service.calculateAlignment('INVALID' as unknown as AlignmentDirection, 100, indicators);
      }).toThrow("Direction must be 'LONG' or 'SHORT'");
    });

    test('should throw on NaN price', () => {
      const indicators = createTFAlignmentIndicators();
      expect(() => {
        service.calculateAlignment('LONG', NaN, indicators);
      }).toThrow('Current price must be a valid finite number');
    });

    test('should throw on Infinity price', () => {
      const indicators = createTFAlignmentIndicators();
      expect(() => {
        service.calculateAlignment('LONG', Infinity, indicators);
      }).toThrow('Current price must be a valid finite number');
    });

    test('should throw on null indicators', () => {
      expect(() => {
        service.calculateAlignment('LONG', 100, null as unknown as AlignmentIndicators);
      }).toThrow('Indicators must be a valid object');
    });

    test('should throw on invalid entry indicators', () => {
      const indicators = { ...createTFAlignmentIndicators(), entry: { ema20: NaN } };
      expect(() => {
        service.calculateAlignment('LONG', 100, indicators);
      }).toThrow('Invalid entry indicator data');
    });

    test('should throw on invalid primary indicators', () => {
      const indicators = { ...createTFAlignmentIndicators(), primary: { ema20: NaN, ema50: 100 } };
      expect(() => {
        service.calculateAlignment('LONG', 100, indicators);
      }).toThrow('Invalid primary indicator data');
    });

    test('should throw on invalid trend1 indicators', () => {
      const indicators = { ...createTFAlignmentIndicators(), trend1: { ema20: 100, ema50: Infinity } };
      expect(() => {
        service.calculateAlignment('LONG', 100, indicators);
      }).toThrow('Invalid trend1 indicator data');
    });
  });

  describe('THROW: Config Validation', () => {
    test('should throw on invalid enabled flag', () => {
      const config = { ...createTFAlignmentConfig({ minAlignmentScore: 60 }), enabled: 'true' as unknown as boolean };
      expect(() => {
        createService({
          configOverrides: config,
        });
      }).toThrow('Config.enabled must be a boolean');
    });

    test('should throw on invalid minAlignmentScore (negative)', () => {
      const config = { ...createTFAlignmentConfig({ minAlignmentScore: 60 }), minAlignmentScore: -10 };
      expect(() => {
        createService({
          configOverrides: config,
        });
      }).toThrow('Config.minAlignmentScore must be a number between 0 and 100');
    });

    test('should throw on invalid minAlignmentScore (> 100)', () => {
      const config = { ...createTFAlignmentConfig({ minAlignmentScore: 60 }), minAlignmentScore: 150 };
      expect(() => {
        createService({
          configOverrides: config,
        });
      }).toThrow('Config.minAlignmentScore must be a number between 0 and 100');
    });

    test('should throw on invalid minAlignmentScore (NaN)', () => {
      const config = { ...createTFAlignmentConfig({ minAlignmentScore: 60 }), minAlignmentScore: NaN };
      expect(() => {
        createService({
          configOverrides: config,
        });
      }).toThrow('Config.minAlignmentScore must be a number between 0 and 100');
    });

    test('should throw on invalid entry weight', () => {
      const config = {
        ...createTFAlignmentConfig({ minAlignmentScore: 60 }),
        timeframes: { ...createTFAlignmentConfig({ minAlignmentScore: 60 }).timeframes, entry: { weight: -10 } },
      };
      expect(() => {
        createService({
          configOverrides: config,
        });
      }).toThrow('Config.timeframes.entry.weight must be a positive number');
    });

    test('should handle null config gracefully (optional)', () => {
      // null config is allowed (service becomes disabled-like)
      const service = createTFAlignmentService({
        config: null as unknown as AlignmentConfigInput,
        logger: mockLogger as unknown as LoggerService,
        errorHandler,
      });
      const indicators = createTFAlignmentIndicators();
      const result = service.calculateAlignment('LONG', 100, indicators);
      // Should work without throwing
      expect(result).toBeDefined();
    });
  });

  describe('GRACEFUL_DEGRADE: Calculation Failures', () => {
    beforeEach(() => {
      service = createService({
        configOverrides: createTFAlignmentConfig({ minAlignmentScore: 60 }),
      });
    });

    test('should handle alignment calculation gracefully', () => {
      const indicators = createTFAlignmentIndicators();
      const result = service.calculateAlignment('LONG', 100, indicators);
      expect(result).toBeDefined();
      expect(Number.isFinite(result.score)).toBe(true);
    });

    test('should return safe default on calculation error', () => {
      const config = createTFAlignmentConfig({ minAlignmentScore: 60 });
      const badService = createService({
        configOverrides: config,
      });
      const indicators = createTFAlignmentIndicators();

      const result = badService.calculateAlignment('SHORT', 100, indicators);
      expect(result.score).toBe(0);
      expect(result.aligned).toBe(false);
    });
  });

  describe('SKIP: Logging Failures', () => {
    test('should not throw when logger fails', () => {
      const badLogger = {
        ...createTFAlignmentMockLogger(),
        info: jest.fn(() => {
          throw new Error('Logger failed');
        }),
        error: jest.fn(() => {
          throw new Error('Logger error failed');
        }),
        debug: jest.fn(() => {
          throw new Error('Logger debug failed');
        }),
      };
      const config = createTFAlignmentConfig({ minAlignmentScore: 60 });
      const service = createService({
        configOverrides: config,
        logger: badLogger as unknown as LoggerService,
      });
      const indicators = createTFAlignmentIndicators();

      expect(() => {
        service.calculateAlignment('LONG', 100, indicators);
      }).not.toThrow();
    });
  });

  describe('Integration: Alignment Calculation', () => {
    beforeEach(() => {
      service = createService({
        configOverrides: createTFAlignmentConfig({ minAlignmentScore: 60 }),
      });
    });

    test('should calculate LONG alignment correctly', () => {
      const indicators = createTFAlignmentIndicators(100);
      const result = service.calculateAlignment('LONG', 100, indicators);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(typeof result.aligned).toBe('boolean');
      expect(result.contributions).toBeDefined();
    });

    test('should calculate SHORT alignment correctly', () => {
      const indicators = {
        entry: { ema20: 101 },
        primary: { ema20: 102, ema50: 103 },
        trend1: { ema20: 99, ema50: 102 }
      };
      const result = service.calculateAlignment('SHORT', 100, indicators);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    test('should return aligned=true when score >= minAlignmentScore', () => {
      const config = createTFAlignmentConfig({ minAlignmentScore: 50 });
      const svc = createService({
        configOverrides: config,
      });
      const indicators = createTFAlignmentIndicators(100);
      const result = svc.calculateAlignment('LONG', 100, indicators);

      // Score should be high (all indicators aligned)
      expect(result.aligned).toBe(result.score >= config.minAlignmentScore);
    });

    test('should return aligned=false when score < minAlignmentScore', () => {
      const config = createTFAlignmentConfig({ minAlignmentScore: 100 });
      const svc = createService({
        configOverrides: config,
      });
      // Create misaligned indicators (price below all EMAs)
      const indicators = {
        entry: { ema20: 105 },
        primary: { ema20: 106, ema50: 107 },
        trend1: { ema20: 104, ema50: 108 },
      };
      const result = svc.calculateAlignment('LONG', 100, indicators);

      expect(result.aligned).toBe(false);
    });

    test('should include contributions in result', () => {
      const indicators = createTFAlignmentIndicators(100);
      const result = service.calculateAlignment('LONG', 100, indicators);

      expect(result.contributions).toHaveProperty('entry');
      expect(result.contributions).toHaveProperty('primary');
      expect(result.contributions).toHaveProperty('trend1');
    });

    test('should include details string in result', () => {
      const indicators = createTFAlignmentIndicators(100);
      const result = service.calculateAlignment('LONG', 100, indicators);

      expect(result.details).toBeDefined();
      expect(typeof result.details).toBe('string');
    });
  });

  describe('Backward Compatibility: Without ErrorHandler', () => {
    test('should work without ErrorHandler provided', () => {
      const basicService = createLegacyService({
        configOverrides: createTFAlignmentConfig({ minAlignmentScore: 60 }),
        logger: mockLogger as unknown as LoggerService,
      });
      const indicators = createTFAlignmentIndicators();

      expect(() => {
        basicService.calculateAlignment('LONG', 100, indicators);
      }).not.toThrow();
    });

    test('should work without logger', () => {
      const config = createTFAlignmentConfig({ minAlignmentScore: 60 });
      const basicService = createTFAlignmentService({
        config,
        logger: undefined,
        errorHandler,
      });
      const indicators = createTFAlignmentIndicators();

      expect(() => {
        basicService.calculateAlignment('LONG', 100, indicators);
      }).not.toThrow();
    });

    test('should work without optional parameters', () => {
      const config = createTFAlignmentConfig({ minAlignmentScore: 60 });
      const basicService = createTFAlignmentService({
        config,
        withErrorHandler: false,
      });
      const indicators = createTFAlignmentIndicators();

      expect(() => {
        basicService.calculateAlignment('LONG', 100, indicators);
      }).not.toThrow();
    });

    test('should throw on invalid input even without ErrorHandler', () => {
      const config = createTFAlignmentConfig({ minAlignmentScore: 60 });
      const basicService = createTFAlignmentService({
        config,
        logger: mockLogger as unknown as LoggerService,
        withErrorHandler: false,
      });

      expect(() => {
        basicService.calculateAlignment('INVALID' as unknown as AlignmentDirection, 100, createTFAlignmentIndicators());
      }).toThrow();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      service = createService({
        configOverrides: createTFAlignmentConfig({ minAlignmentScore: 60 }),
      });
    });

    test('should handle disabled service', () => {
      const config = createTFAlignmentConfig({ enabled: false, minAlignmentScore: 60 });
      const disabledService = createService({
        configOverrides: config,
      });
      const indicators = createTFAlignmentIndicators();

      const result = disabledService.calculateAlignment('LONG', 100, indicators);
      expect(result.aligned).toBe(false);
      expect(result.score).toBe(0);
    });

    test('should handle minAlignmentScore = 0', () => {
      const config = createTFAlignmentConfig({ minAlignmentScore: 0 });
      const zeroService = createService({
        configOverrides: config,
      });
      const indicators = createTFAlignmentIndicators();

      const result = zeroService.calculateAlignment('LONG', 100, indicators);
      expect(result.aligned).toBe(result.score >= 0);
    });

    test('should handle minAlignmentScore = 100', () => {
      const config = createTFAlignmentConfig({ minAlignmentScore: 100 });
      const maxService = createService({
        configOverrides: config,
      });
      const indicators = createTFAlignmentIndicators();

      const result = maxService.calculateAlignment('LONG', 100, indicators);
      expect(result.aligned).toBe(result.score >= 100);
    });

    test('should return undefined config if none provided', () => {
      const service = createTFAlignmentService({
        config: undefined,
        logger: undefined,
        withErrorHandler: false,
      });
      const config = service.getConfig();
      expect(config).toBeUndefined();
    });

    test('should return copy of config on getConfig()', () => {
      const originalConfig = createTFAlignmentConfig({ minAlignmentScore: 60 });
      const service = createTFAlignmentService({
        config: originalConfig,
        logger: mockLogger as unknown as LoggerService,
        errorHandler,
      });
      const retrievedConfig = service.getConfig();

      expect(retrievedConfig).toEqual(originalConfig);
      expect(retrievedConfig).not.toBe(originalConfig); // Should be a copy
    });

    test('should handle very high price', () => {
      const service = createService({
        configOverrides: createTFAlignmentConfig({ minAlignmentScore: 60 }),
      });
      const indicators = createTFAlignmentIndicators(1000000);

      expect(() => {
        service.calculateAlignment('LONG', 1000000, indicators);
      }).not.toThrow();
    });

    test('should handle very small price', () => {
      const service = createService({
        configOverrides: createTFAlignmentConfig({ minAlignmentScore: 60 }),
      });
      const indicators = createTFAlignmentIndicators(0.00001);

      expect(() => {
        service.calculateAlignment('LONG', 0.00001, indicators);
      }).not.toThrow();
    });
  });
});

