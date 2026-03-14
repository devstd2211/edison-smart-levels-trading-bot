/**
 * WhaleWallTPService Error Handling Tests (Phase 8.9.74)
 *
 * Test Coverage:
 * - THROW: Config and input validation
 * - GRACEFUL_DEGRADE: Adjustment failures
 * - SKIP: Logging failures
 * - Backward Compatibility: Tests without ErrorHandler still work
 */

import { WhaleWallTPService } from '../../services/whale-wall-tp.service';
import { SignalDirection } from '../../types/legacy';
import { LoggerService } from '../../services/logger.service';
import type { TakeProfit } from '../../types/legacy';
import {
  createWhaleWallTPConfig as createValidConfig,
  createWhaleWallTPConfigWithQuality as createConfigWithQualityValidation,
  createWhaleWallTPConfigWithTargeting as createConfigWithTPTargeting,
  createWhaleWallTPErrorHandler,
  createWhaleWallTPHarness,
  createWhaleWallTPMockLogger as createMockLogger,
  createWhaleWallTPService,
  createWhaleWallTPWalls as createValidWalls,
} from '../helpers/whale-wall-tp-test.utils';

describe('WhaleWallTPService Error Handling (Phase 8.9.74)', () => {
  // ============================================================================
  // THROW: Config Validation (5 tests)
  // ============================================================================

  describe('THROW: Config Validation', () => {
    const mockLogger = createMockLogger();

    test('should throw on invalid minWallPercent (> 100)', () => {
      const errorHandler = createWhaleWallTPErrorHandler(mockLogger);
      expect(() => {
        createWhaleWallTPService({
          logger: mockLogger as unknown as LoggerService,
          config: { minWallPercent: 150 },
          errorHandler,
        });
      }).toThrow('minWallPercent must be between 0 and 100');
    });

    test('should throw on negative maxDistancePercent', () => {
      const errorHandler = createWhaleWallTPErrorHandler(mockLogger);
      expect(() => {
        createWhaleWallTPService({
          logger: mockLogger as unknown as LoggerService,
          config: { maxDistancePercent: -1 },
          errorHandler,
        });
      }).toThrow('maxDistancePercent must be positive number');
    });

    test('should throw on invalid alignmentThresholdPercent', () => {
      const errorHandler = createWhaleWallTPErrorHandler(mockLogger);
      expect(() => {
        createWhaleWallTPService({
          logger: mockLogger as unknown as LoggerService,
          config: createConfigWithTPTargeting({ alignmentThresholdPercent: 150 }),
          errorHandler,
        });
      }).toThrow('tpTargeting.alignmentThresholdPercent must be between 0 and 100');
    });

    test('should throw on invalid minStrength (> 1)', () => {
      const errorHandler = createWhaleWallTPErrorHandler(mockLogger);
      expect(() => {
        createWhaleWallTPService({
          logger: mockLogger as unknown as LoggerService,
          config: createConfigWithQualityValidation({ minStrength: 1.5 }),
          errorHandler,
        });
      }).toThrow('qualityValidation.minStrength must be between 0 and 1');
    });

    test('should throw on invalid icebergBoostFactor', () => {
      const errorHandler = createWhaleWallTPErrorHandler(mockLogger);
      expect(() => {
        createWhaleWallTPService({
          logger: mockLogger as unknown as LoggerService,
          config: createConfigWithQualityValidation({ icebergBoostFactor: 0 }),
          errorHandler,
        });
      }).toThrow('qualityValidation.icebergBoostFactor must be positive number');
    });
  });

  // ============================================================================
  // THROW: Input Validation (5 tests)
  // ============================================================================

  describe('THROW: Input Validation', () => {
    const mockLogger = createMockLogger();
    let service: WhaleWallTPService;
    type WallsInput = Parameters<WhaleWallTPService['adjustTPSL']>[0];

    beforeEach(() => {
      ({ service } = createWhaleWallTPHarness({
        logger: mockLogger as unknown as LoggerService,
        config: createValidConfig(),
      }));
    });

    test('should throw on null walls array', () => {
      expect(() => {
        service.adjustTPSL(null as unknown as WallsInput, 50000, SignalDirection.LONG, 51000, 49000);
      }).toThrow('Walls must be a valid array');
    });

    test('should throw on invalid entry price (NaN)', () => {
      expect(() => {
        service.adjustTPSL(createValidWalls(), NaN, SignalDirection.LONG, 51000, 49000);
      }).toThrow('Entry price must be a finite number');
    });

    test('should throw on negative entry price', () => {
      expect(() => {
        service.adjustTPSL(createValidWalls(), -50000, SignalDirection.LONG, 51000, 49000);
      }).toThrow('Entry price must be positive');
    });

    test('should throw on invalid original TP (Infinity)', () => {
      expect(() => {
        service.adjustTPSL(createValidWalls(), 50000, SignalDirection.LONG, Infinity, 49000);
      }).toThrow('Original TP must be a finite number');
    });

    test('should throw on invalid original SL', () => {
      expect(() => {
        service.adjustTPSL(createValidWalls(), 50000, SignalDirection.LONG, 51000, NaN);
      }).toThrow('Original SL must be a finite number');
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE: Adjustment Failures (4 tests)
  // ============================================================================

  describe('GRACEFUL_DEGRADE: Adjustment Failures', () => {
    const mockLogger = createMockLogger();
    const errorHandler = createWhaleWallTPErrorHandler(mockLogger);
    let service: WhaleWallTPService;

    beforeEach(() => {
      ({ service } = createWhaleWallTPHarness({
        logger: mockLogger as unknown as LoggerService,
        config: createValidConfig(),
      }));
    });

    test('should handle valid adjustment request', () => {
      const result = service.adjustTPSL(createValidWalls(), 50000, SignalDirection.LONG, 51000, 49000);
      expect(result).toBeDefined();
      expect(typeof result.wallsAnalyzed).toBe('number');
      expect(typeof result.qualifiedWalls).toBe('number');
    });

    test('should handle empty walls array gracefully', () => {
      const result = service.adjustTPSL([], 50000, SignalDirection.LONG, 51000, 49000);
      expect(result).toBeDefined();
      expect(result.tpAdjusted).toBe(false);
      expect(result.slAdjusted).toBe(false);
    });

    test('should handle SHORT direction correctly', () => {
      const result = service.adjustTPSL(createValidWalls(), 50000, SignalDirection.SHORT, 49000, 51000);
      expect(result).toBeDefined();
      expect(result.wallsAnalyzed >= 0).toBe(true);
    });

    test('should handle config disabled gracefully', () => {
      const disabledService = createWhaleWallTPService({
        logger: mockLogger as unknown as LoggerService,
        config: { ...createValidConfig(), enabled: false },
        errorHandler,
      });
      const result = disabledService.adjustTPSL(createValidWalls(), 50000, SignalDirection.LONG, 51000, 49000);
      expect(result.tpAdjusted).toBe(false);
      expect(result.slAdjusted).toBe(false);
    });
  });

  // ============================================================================
  // SKIP: Logging Failures (2 tests)
  // ============================================================================

  describe('SKIP: Logging Failures', () => {
    test('should not throw when debug logs fail', () => {
      const mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(() => {
          throw new Error('Debug failed');
        }),
        silly: jest.fn(),
      };
      const errorHandler = createWhaleWallTPErrorHandler(
        mockLogger as unknown as LoggerService,
      );
      const service = createWhaleWallTPService({
        logger: mockLogger as unknown as LoggerService,
        config: createValidConfig(),
        errorHandler,
      });

      expect(() => {
        service.adjustTPSL(createValidWalls(), 50000, SignalDirection.LONG, 51000, 49000);
      }).not.toThrow();
    });

    test('should not throw when info logs fail', () => {
      const mockLogger = {
        info: jest.fn(() => {
          throw new Error('Info failed');
        }),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        silly: jest.fn(),
      };
      const errorHandler = createWhaleWallTPErrorHandler(
        mockLogger as unknown as LoggerService,
      );
      const service = createWhaleWallTPService({
        logger: mockLogger as unknown as LoggerService,
        config: createValidConfig(),
        errorHandler,
      });

      expect(() => {
        service.adjustTPSL(createValidWalls(), 50000, SignalDirection.LONG, 51000, 49000);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Integration: Adjustment Operations (2 tests)
  // ============================================================================

  describe('Integration: Adjustment Operations', () => {
    const mockLogger = createMockLogger();
    let service: WhaleWallTPService;

    beforeEach(() => {
      ({ service } = createWhaleWallTPHarness({
        logger: mockLogger as unknown as LoggerService,
        config: createValidConfig(),
      }));
    });

    test('should handle multiple sequential adjustments', () => {
      for (let i = 0; i < 3; i++) {
        const result = service.adjustTPSL(
          createValidWalls(),
          50000 + i * 100,
          i % 2 === 0 ? SignalDirection.LONG : SignalDirection.SHORT,
          51000 + i * 100,
          49000 - i * 100
        );
        expect(result).toBeDefined();
        expect(result.wallsAnalyzed >= 0).toBe(true);
      }
    });

    test('should apply TP adjustments to array', () => {
      const result = service.adjustTPSL(createValidWalls(), 50000, SignalDirection.LONG, 51000, 49000);
      const takeProfits = [
        { price: 51000, percent: 2, level: 1, sizePercent: 30, hit: false },
        { price: 52000, percent: 3, level: 2, sizePercent: 40, hit: false },
      ] as TakeProfit[];

      const adjusted = service.applyTPAdjustment(takeProfits, result, 50000, SignalDirection.LONG);
      expect(Array.isArray(adjusted)).toBe(true);
    });
  });

  // ============================================================================
  // Backward Compatibility: Without ErrorHandler (2 tests)
  // ============================================================================

  describe('Backward Compatibility: Without ErrorHandler', () => {
    const mockLogger = createMockLogger();

    test('should work without ErrorHandler', () => {
      const { service } = createWhaleWallTPHarness({
        logger: mockLogger as unknown as LoggerService,
        config: createValidConfig(),
        withErrorHandler: false,
      });
      const result = service.adjustTPSL(createValidWalls(), 50000, SignalDirection.LONG, 51000, 49000);
      expect(result).toBeDefined();
    });

    test('should throw on invalid input even without ErrorHandler', () => {
      const { service } = createWhaleWallTPHarness({
        logger: mockLogger as unknown as LoggerService,
        config: createValidConfig(),
        withErrorHandler: false,
      });
      expect(() => {
        service.adjustTPSL(createValidWalls(), NaN, SignalDirection.LONG, 51000, 49000);
      }).toThrow('Entry price must be a finite number');
    });
  });

  // ============================================================================
  // Edge Cases (2 tests)
  // ============================================================================

  describe('Edge Cases', () => {
    const mockLogger = createMockLogger();
    const errorHandler = createWhaleWallTPErrorHandler(mockLogger);
    let service: WhaleWallTPService;

    beforeEach(() => {
      ({ service } = createWhaleWallTPHarness({
        logger: mockLogger as unknown as LoggerService,
        config: createValidConfig(),
      }));
    });

    test('should handle zero minWallPercent', () => {
      const zeroService = createWhaleWallTPService({
        logger: mockLogger as unknown as LoggerService,
        config: { ...createValidConfig(), minWallPercent: 0 },
        errorHandler,
      });
      const result = zeroService.adjustTPSL(createValidWalls(), 50000, SignalDirection.LONG, 51000, 49000);
      expect(result).toBeDefined();
    });

    test('should handle high minStrength value', () => {
      const highStrengthService = createWhaleWallTPService({
        logger: mockLogger as unknown as LoggerService,
        config: createConfigWithQualityValidation({ minStrength: 1.0 }),
        errorHandler,
      });
      const result = highStrengthService.adjustTPSL(createValidWalls(), 50000, SignalDirection.LONG, 51000, 49000);
      expect(result).toBeDefined();
    });
  });
});
