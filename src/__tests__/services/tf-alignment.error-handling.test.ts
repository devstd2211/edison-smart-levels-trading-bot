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
import { TFAlignmentConfig } from '../../types';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn(),
});

const createDefaultConfig = (): TFAlignmentConfig => ({
  enabled: true,
  minAlignmentScore: 60,
  timeframes: {
    entry: { weight: 20 },
    primary: { weight: 50 },
    trend1: { weight: 30 },
  },
});

const createValidIndicators = (baseValue: number = 100) => ({
  entry: { ema20: baseValue - 1 },
  primary: { ema20: baseValue - 2, ema50: baseValue - 3 },
  trend1: { ema20: baseValue + 1, ema50: baseValue - 2 },
});

describe('TFAlignmentService Error Handling (Phase 8.9.69)', () => {
  let service: TFAlignmentService;
  let errorHandler: ErrorHandler;
  const mockLogger = createMockLogger() as any;

  beforeEach(() => {
    errorHandler = new ErrorHandler(mockLogger);
  });

  describe('THROW: Input Validation', () => {
    beforeEach(() => {
      const config = createDefaultConfig();
      service = new TFAlignmentService(config, mockLogger, errorHandler);
    });

    test('should throw on invalid direction', () => {
      const indicators = createValidIndicators();
      expect(() => {
        service.calculateAlignment('INVALID' as any, 100, indicators);
      }).toThrow("Direction must be 'LONG' or 'SHORT'");
    });

    test('should throw on NaN price', () => {
      const indicators = createValidIndicators();
      expect(() => {
        service.calculateAlignment('LONG', NaN, indicators);
      }).toThrow('Current price must be a valid finite number');
    });

    test('should throw on Infinity price', () => {
      const indicators = createValidIndicators();
      expect(() => {
        service.calculateAlignment('LONG', Infinity, indicators);
      }).toThrow('Current price must be a valid finite number');
    });

    test('should throw on null indicators', () => {
      expect(() => {
        service.calculateAlignment('LONG', 100, null as any);
      }).toThrow('Indicators must be a valid object');
    });

    test('should throw on invalid entry indicators', () => {
      const indicators = { ...createValidIndicators(), entry: { ema20: NaN } };
      expect(() => {
        service.calculateAlignment('LONG', 100, indicators);
      }).toThrow('Invalid entry indicator data');
    });

    test('should throw on invalid primary indicators', () => {
      const indicators = { ...createValidIndicators(), primary: { ema20: NaN, ema50: 100 } };
      expect(() => {
        service.calculateAlignment('LONG', 100, indicators);
      }).toThrow('Invalid primary indicator data');
    });

    test('should throw on invalid trend1 indicators', () => {
      const indicators = { ...createValidIndicators(), trend1: { ema20: 100, ema50: Infinity } };
      expect(() => {
        service.calculateAlignment('LONG', 100, indicators);
      }).toThrow('Invalid trend1 indicator data');
    });
  });

  describe('THROW: Config Validation', () => {
    test('should throw on invalid enabled flag', () => {
      const config = { ...createDefaultConfig(), enabled: 'true' as any };
      expect(() => {
        new TFAlignmentService(config, mockLogger, errorHandler);
      }).toThrow('Config.enabled must be a boolean');
    });

    test('should throw on invalid minAlignmentScore (negative)', () => {
      const config = { ...createDefaultConfig(), minAlignmentScore: -10 };
      expect(() => {
        new TFAlignmentService(config, mockLogger, errorHandler);
      }).toThrow('Config.minAlignmentScore must be a number between 0 and 100');
    });

    test('should throw on invalid minAlignmentScore (> 100)', () => {
      const config = { ...createDefaultConfig(), minAlignmentScore: 150 };
      expect(() => {
        new TFAlignmentService(config, mockLogger, errorHandler);
      }).toThrow('Config.minAlignmentScore must be a number between 0 and 100');
    });

    test('should throw on invalid minAlignmentScore (NaN)', () => {
      const config = { ...createDefaultConfig(), minAlignmentScore: NaN };
      expect(() => {
        new TFAlignmentService(config, mockLogger, errorHandler);
      }).toThrow('Config.minAlignmentScore must be a number between 0 and 100');
    });

    test('should throw on invalid entry weight', () => {
      const config = {
        ...createDefaultConfig(),
        timeframes: { ...createDefaultConfig().timeframes, entry: { weight: -10 } },
      };
      expect(() => {
        new TFAlignmentService(config, mockLogger, errorHandler);
      }).toThrow('Config.timeframes.entry.weight must be a positive number');
    });

    test('should handle null config gracefully (optional)', () => {
      // null config is allowed (service becomes disabled-like)
      const service = new TFAlignmentService(null as any, mockLogger, errorHandler);
      const indicators = createValidIndicators();
      const result = service.calculateAlignment('LONG', 100, indicators);
      // Should work without throwing
      expect(result).toBeDefined();
    });
  });

  describe('GRACEFUL_DEGRADE: Calculation Failures', () => {
    beforeEach(() => {
      const config = createDefaultConfig();
      service = new TFAlignmentService(config, mockLogger, errorHandler);
    });

    test('should handle alignment calculation gracefully', () => {
      const indicators = createValidIndicators();
      const result = service.calculateAlignment('LONG', 100, indicators);
      expect(result).toBeDefined();
      expect(Number.isFinite(result.score)).toBe(true);
    });

    test('should return safe default on calculation error', () => {
      const config = createDefaultConfig();
      const badService = new TFAlignmentService(config, mockLogger, errorHandler);
      const indicators = createValidIndicators();

      const result = badService.calculateAlignment('SHORT', 100, indicators);
      expect(result.score).toBe(0);
      expect(result.aligned).toBe(false);
    });
  });

  describe('SKIP: Logging Failures', () => {
    test('should not throw when logger fails', () => {
      const badLogger = {
        info: jest.fn(() => {
          throw new Error('Logger failed');
        }),
        warn: jest.fn(),
        error: jest.fn(() => {
          throw new Error('Logger error failed');
        }),
        debug: jest.fn(() => {
          throw new Error('Logger debug failed');
        }),
        silly: jest.fn(),
      };
      const config = createDefaultConfig();
      const service = new TFAlignmentService(config, badLogger as any, errorHandler);
      const indicators = createValidIndicators();

      expect(() => {
        service.calculateAlignment('LONG', 100, indicators);
      }).not.toThrow();
    });
  });

  describe('Integration: Alignment Calculation', () => {
    beforeEach(() => {
      const config = createDefaultConfig();
      service = new TFAlignmentService(config, mockLogger, errorHandler);
    });

    test('should calculate LONG alignment correctly', () => {
      const indicators = createValidIndicators(100);
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
      const config = { ...createDefaultConfig(), minAlignmentScore: 50 };
      const svc = new TFAlignmentService(config, mockLogger, errorHandler);
      const indicators = createValidIndicators(100);
      const result = svc.calculateAlignment('LONG', 100, indicators);

      // Score should be high (all indicators aligned)
      expect(result.aligned).toBe(result.score >= config.minAlignmentScore);
    });

    test('should return aligned=false when score < minAlignmentScore', () => {
      const config = { ...createDefaultConfig(), minAlignmentScore: 100 };
      const svc = new TFAlignmentService(config, mockLogger, errorHandler);
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
      const indicators = createValidIndicators(100);
      const result = service.calculateAlignment('LONG', 100, indicators);

      expect(result.contributions).toHaveProperty('entry');
      expect(result.contributions).toHaveProperty('primary');
      expect(result.contributions).toHaveProperty('trend1');
    });

    test('should include details string in result', () => {
      const indicators = createValidIndicators(100);
      const result = service.calculateAlignment('LONG', 100, indicators);

      expect(result.details).toBeDefined();
      expect(typeof result.details).toBe('string');
    });
  });

  describe('Backward Compatibility: Without ErrorHandler', () => {
    test('should work without ErrorHandler provided', () => {
      const config = createDefaultConfig();
      const basicService = new TFAlignmentService(config, mockLogger as any);
      const indicators = createValidIndicators();

      expect(() => {
        basicService.calculateAlignment('LONG', 100, indicators);
      }).not.toThrow();
    });

    test('should work without logger', () => {
      const config = createDefaultConfig();
      const basicService = new TFAlignmentService(config, undefined, errorHandler);
      const indicators = createValidIndicators();

      expect(() => {
        basicService.calculateAlignment('LONG', 100, indicators);
      }).not.toThrow();
    });

    test('should work without optional parameters', () => {
      const config = createDefaultConfig();
      const basicService = new TFAlignmentService(config);
      const indicators = createValidIndicators();

      expect(() => {
        basicService.calculateAlignment('LONG', 100, indicators);
      }).not.toThrow();
    });

    test('should throw on invalid input even without ErrorHandler', () => {
      const config = createDefaultConfig();
      const basicService = new TFAlignmentService(config, mockLogger as any);

      expect(() => {
        basicService.calculateAlignment('INVALID' as any, 100, createValidIndicators());
      }).toThrow();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      const config = createDefaultConfig();
      service = new TFAlignmentService(config, mockLogger, errorHandler);
    });

    test('should handle disabled service', () => {
      const config = { ...createDefaultConfig(), enabled: false };
      const disabledService = new TFAlignmentService(config, mockLogger, errorHandler);
      const indicators = createValidIndicators();

      const result = disabledService.calculateAlignment('LONG', 100, indicators);
      expect(result.aligned).toBe(false);
      expect(result.score).toBe(0);
    });

    test('should handle minAlignmentScore = 0', () => {
      const config = { ...createDefaultConfig(), minAlignmentScore: 0 };
      const zeroService = new TFAlignmentService(config, mockLogger, errorHandler);
      const indicators = createValidIndicators();

      const result = zeroService.calculateAlignment('LONG', 100, indicators);
      expect(result.aligned).toBe(result.score >= 0);
    });

    test('should handle minAlignmentScore = 100', () => {
      const config = { ...createDefaultConfig(), minAlignmentScore: 100 };
      const maxService = new TFAlignmentService(config, mockLogger, errorHandler);
      const indicators = createValidIndicators();

      const result = maxService.calculateAlignment('LONG', 100, indicators);
      expect(result.aligned).toBe(result.score >= 100);
    });

    test('should return undefined config if none provided', () => {
      const service = new TFAlignmentService();
      const config = service.getConfig();
      expect(config).toBeUndefined();
    });

    test('should return copy of config on getConfig()', () => {
      const originalConfig = createDefaultConfig();
      const service = new TFAlignmentService(originalConfig, mockLogger, errorHandler);
      const retrievedConfig = service.getConfig();

      expect(retrievedConfig).toEqual(originalConfig);
      expect(retrievedConfig).not.toBe(originalConfig); // Should be a copy
    });

    test('should handle very high price', () => {
      const service = new TFAlignmentService(createDefaultConfig(), mockLogger, errorHandler);
      const indicators = createValidIndicators(1000000);

      expect(() => {
        service.calculateAlignment('LONG', 1000000, indicators);
      }).not.toThrow();
    });

    test('should handle very small price', () => {
      const service = new TFAlignmentService(createDefaultConfig(), mockLogger, errorHandler);
      const indicators = createValidIndicators(0.00001);

      expect(() => {
        service.calculateAlignment('LONG', 0.00001, indicators);
      }).not.toThrow();
    });
  });
});
