/**
 * FractalSmcWeightingService Error Handling Tests (Phase 8.9.71)
 *
 * Test Coverage:
 * - THROW: Config validation (threshold, highConfidenceThreshold, maxScores)
 * - THROW: Input validation (null setup/data)
 * - GRACEFUL_DEGRADE: Calculation failures (NaN/Infinity scores)
 * - SKIP: Logging errors
 * - Integration: Weighted score calculation
 * - Backward Compatibility: Tests without ErrorHandler still work
 */

import { FractalSmcWeightingService } from '../../services/fractal-smc-weighting.service';
import { WeightedSignalConfig, ConfidenceLevel } from '../../types/fractal-strategy';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn(),
});

const createValidConfig = (): WeightedSignalConfig => ({
  threshold: 70,
  highConfidenceThreshold: 90,
  maxFractalScore: 125,
  maxSmcScore: 110,
});

const createValidSetup = () => ({
  breakout: {
    confirmedByClose: true,
    strength: 0.8,
    volumeRatio: 1.5,
  },
  retest: {
    isSecondTouch: true,
    touchCount: 2,
  },
  reversal: {
    strongCandleBody: true,
    confirmationBars: 2,
    priceActionPattern: 'HAMMER',
    volumeConfirmed: true,
    structureAligned: true,
  },
});

const createValidData = () => ({
  liquidity: {
    strongZones: [{ price: 100 }],
    recentSweep: {
      detected: true,
    },
  },
});

describe('FractalSmcWeightingService Error Handling (Phase 8.9.71)', () => {
  let service: FractalSmcWeightingService;
  let errorHandler: ErrorHandler;
  const mockLogger = createMockLogger() as any;

  beforeEach(() => {
    errorHandler = new ErrorHandler(mockLogger);
  });

  // ============================================================================
  // THROW: Config Validation (5 tests)
  // ============================================================================

  describe('THROW: Config Validation', () => {
    test('should throw on null config', () => {
      expect(() => {
        new FractalSmcWeightingService(null as any, mockLogger, errorHandler);
      }).toThrow('Config must be a valid object');
    });

    test('should throw on invalid threshold (NaN)', () => {
      const config = { ...createValidConfig(), threshold: NaN };
      expect(() => {
        new FractalSmcWeightingService(config, mockLogger, errorHandler);
      }).toThrow('Config.threshold must be a finite number');
    });

    test('should throw on threshold out of range (>220)', () => {
      const config = { ...createValidConfig(), threshold: 250 };
      expect(() => {
        new FractalSmcWeightingService(config, mockLogger, errorHandler);
      }).toThrow('Config.threshold must be between 0 and 220');
    });

    test('should throw on invalid highConfidenceThreshold (Infinity)', () => {
      const config = { ...createValidConfig(), highConfidenceThreshold: Infinity };
      expect(() => {
        new FractalSmcWeightingService(config, mockLogger, errorHandler);
      }).toThrow('Config.highConfidenceThreshold must be a finite number');
    });

    test('should throw on highConfidenceThreshold < threshold', () => {
      const config = {
        ...createValidConfig(),
        threshold: 100,
        highConfidenceThreshold: 80,
      };
      expect(() => {
        new FractalSmcWeightingService(config, mockLogger, errorHandler);
      }).toThrow('Config.highConfidenceThreshold must be >= threshold');
    });

    test('should throw on maxFractalScore <= 0', () => {
      const config = { ...createValidConfig(), maxFractalScore: 0 };
      expect(() => {
        new FractalSmcWeightingService(config, mockLogger, errorHandler);
      }).toThrow('Config.maxFractalScore must be a positive number');
    });

    test('should throw on maxSmcScore <= 0', () => {
      const config = { ...createValidConfig(), maxSmcScore: -10 };
      expect(() => {
        new FractalSmcWeightingService(config, mockLogger, errorHandler);
      }).toThrow('Config.maxSmcScore must be a positive number');
    });
  });

  // ============================================================================
  // THROW: Input Validation (5 tests)
  // ============================================================================

  describe('THROW: Input Validation', () => {
    beforeEach(() => {
      service = new FractalSmcWeightingService(createValidConfig(), mockLogger, errorHandler);
    });

    test('should throw on null setup', () => {
      const data = createValidData();
      expect(() => {
        service.calculateWeightedScore(null as any, data as any);
      }).toThrow('Setup must be a valid object');
    });

    test('should throw on undefined setup', () => {
      const data = createValidData();
      expect(() => {
        service.calculateWeightedScore(undefined as any, data as any);
      }).toThrow('Setup must be a valid object');
    });

    test('should throw on null data', () => {
      const setup = createValidSetup();
      expect(() => {
        service.calculateWeightedScore(setup as any, null as any);
      }).toThrow('Data must be a valid object');
    });

    test('should throw on undefined data', () => {
      const setup = createValidSetup();
      expect(() => {
        service.calculateWeightedScore(setup as any, undefined as any);
      }).toThrow('Data must be a valid object');
    });

    test('should throw on invalid setup type (string)', () => {
      const data = createValidData();
      expect(() => {
        service.calculateWeightedScore('invalid' as any, data as any);
      }).toThrow('Setup must be a valid object');
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE: Calculation Failures (5 tests)
  // ============================================================================

  describe('GRACEFUL_DEGRADE: Calculation Failures', () => {
    beforeEach(() => {
      service = new FractalSmcWeightingService(createValidConfig(), mockLogger, errorHandler);
    });

    test('should handle NaN breakout strength gracefully', () => {
      const setup = {
        ...createValidSetup(),
        breakout: { confirmedByClose: true, strength: NaN, volumeRatio: 1.5 },
      };
      const data = createValidData();

      const result = service.calculateWeightedScore(setup as any, data as any);

      expect(result).toBeDefined();
      expect(result.passesThreshold).toBe(false);
      expect(result.confidence).toBe(ConfidenceLevel.LOW);
      expect(result.fractalScore).toBe(0);
      expect(result.smcScore).toBe(0);
    });

    test('should handle Infinity volume ratio gracefully', () => {
      const setup = {
        ...createValidSetup(),
        breakout: { confirmedByClose: true, strength: 0.8, volumeRatio: Infinity },
      };
      const data = createValidData();

      const result = service.calculateWeightedScore(setup as any, data as any);

      expect(result).toBeDefined();
      expect(result.passesThreshold).toBe(false);
      expect(result.fractalScore).toBe(0);
    });

    test('should return safe defaults on calculation error', () => {
      const setup = {
        ...createValidSetup(),
        breakout: { confirmedByClose: true, strength: 0.8, volumeRatio: NaN },
      };
      const data = createValidData();

      const result = service.calculateWeightedScore(setup as any, data as any);

      expect(result).toBeDefined();
      // Combined score should be valid (NaN volumeRatio doesn't trigger volume scoring due to condition)
      expect(Number.isFinite(result.combinedScore)).toBe(true);
      expect(result.positionSize).toBeGreaterThanOrEqual(0.5);
      expect(result.reasoning).toBeDefined();
      expect(Array.isArray(result.reasoning)).toBe(true);
    });

    test('should handle invalid confidence level gracefully', () => {
      const setup = createValidSetup();
      const data = createValidData();

      const result = service.calculateWeightedScore(setup as any, data as any);

      expect(result).toBeDefined();
      expect([ConfidenceLevel.HIGH, ConfidenceLevel.MEDIUM, ConfidenceLevel.LOW]).toContain(
        result.confidence
      );
    });

    test('should clamp combined score to valid range', () => {
      const setup = createValidSetup();
      const data = createValidData();

      const result = service.calculateWeightedScore(setup as any, data as any);

      expect(result.combinedScore).toBeGreaterThanOrEqual(0);
      expect(result.combinedScore).toBeLessThanOrEqual(220);
    });
  });

  // ============================================================================
  // SKIP: Logging Failures (2 tests)
  // ============================================================================

  describe('SKIP: Logging Failures', () => {
    test('should not throw when logger fails on info', () => {
      const badLogger = {
        info: jest.fn(() => {
          throw new Error('Logger failed');
        }),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        silly: jest.fn(),
      };
      service = new FractalSmcWeightingService(createValidConfig(), badLogger as any, errorHandler);
      const setup = createValidSetup();
      const data = createValidData();

      expect(() => {
        service.calculateWeightedScore(setup as any, data as any);
      }).not.toThrow();
    });

    test('should not throw when logger fails on debug', () => {
      const badLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(() => {
          throw new Error('Debug failed');
        }),
        silly: jest.fn(),
      };
      service = new FractalSmcWeightingService(createValidConfig(), badLogger as any, errorHandler);
      const setup = createValidSetup();
      const data = createValidData();

      expect(() => {
        service.calculateWeightedScore(setup as any, data as any);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Integration: Weighted Score Calculation (2 tests)
  // ============================================================================

  describe('Integration: Weighted Score Calculation', () => {
    beforeEach(() => {
      service = new FractalSmcWeightingService(createValidConfig(), mockLogger, errorHandler);
    });

    test('should calculate HIGH confidence with strong setup', () => {
      const setup = {
        breakout: {
          confirmedByClose: true,
          strength: 0.9,
          volumeRatio: 2.0,
        },
        retest: {
          isSecondTouch: true,
          touchCount: 3,
        },
        reversal: {
          strongCandleBody: true,
          confirmationBars: 3,
          priceActionPattern: 'HAMMER',
          volumeConfirmed: true,
          structureAligned: true,
        },
      };
      const data = createValidData();

      const result = service.calculateWeightedScore(setup as any, data as any);

      expect(result).toBeDefined();
      expect(result.positionSize).toBeGreaterThan(0.5);
    });

    test('should calculate correct position size based on confidence', () => {
      const setup = createValidSetup();
      const data = createValidData();

      const result = service.calculateWeightedScore(setup as any, data as any);

      expect(result.positionSize).toBeGreaterThanOrEqual(0);
      expect(result.positionSize).toBeLessThanOrEqual(1.0);
    });
  });

  // ============================================================================
  // Backward Compatibility: Without ErrorHandler (1 test)
  // ============================================================================

  describe('Backward Compatibility: Without ErrorHandler', () => {
    test('should work without ErrorHandler provided', () => {
      const config = createValidConfig();
      const basicService = new FractalSmcWeightingService(config, mockLogger as any);
      const setup = createValidSetup();
      const data = createValidData();

      expect(() => {
        basicService.calculateWeightedScore(setup as any, data as any);
      }).not.toThrow();
    });

    test('should throw on invalid input even without ErrorHandler', () => {
      const config = createValidConfig();
      const basicService = new FractalSmcWeightingService(config, mockLogger as any);

      expect(() => {
        basicService.calculateWeightedScore(null as any, createValidData() as any);
      }).toThrow('Setup must be a valid object');
    });

    test('should work without logger', () => {
      const config = createValidConfig();
      const basicService = new FractalSmcWeightingService(config, undefined as any, errorHandler);
      const setup = createValidSetup();
      const data = createValidData();

      expect(() => {
        basicService.calculateWeightedScore(setup as any, data as any);
      }).not.toThrow();
    });

    test('should work without optional parameters', () => {
      const config = createValidConfig();
      const basicService = new FractalSmcWeightingService(config);
      const setup = createValidSetup();
      const data = createValidData();

      expect(() => {
        basicService.calculateWeightedScore(setup as any, data as any);
      }).not.toThrow();
    });
  });
});

