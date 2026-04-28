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
import type { TakeProfit } from '../../types/legacy';
import {
  createWhaleWallTPConfig as createValidConfig,
  createWhaleWallTPConfigWithQuality as createConfigWithQualityValidation,
  createWhaleWallTPConfigWithTargeting as createConfigWithTPTargeting,
  createManagedWhaleWallTPContext,
  createWhaleWallTPMockLogger as createMockLogger,
  createWhaleWallTPMockLoggerService,
  createWhaleWallTPTakeProfits,
  createWhaleWallTPWalls as createValidWalls,
} from '../helpers/whale-wall-tp-test.utils';

describe('WhaleWallTPService Error Handling (Phase 8.9.74)', () => {
  let createStandardService:
    ReturnType<typeof createManagedWhaleWallTPContext>['createStandardService'];
  let createLegacyService:
    ReturnType<typeof createManagedWhaleWallTPContext>['createLegacyService'];
  let cleanup: ReturnType<typeof createManagedWhaleWallTPContext>['cleanup'];

  beforeEach(() => {
    ({ cleanup, createStandardService, createLegacyService } = createManagedWhaleWallTPContext());
  });

  afterEach(() => {
    cleanup();
  });

  // ============================================================================
  // THROW: Config Validation (5 tests)
  // ============================================================================

  describe('THROW: Config Validation', () => {
    const mockLogger = createMockLogger();

    test('should throw on invalid minWallPercent (> 100)', () => {
      expect(() => {
        createStandardService({
          logger: createWhaleWallTPMockLoggerService(mockLogger),
          config: { minWallPercent: 150 },
        });
      }).toThrow('minWallPercent must be between 0 and 100');
    });

    test('should throw on negative maxDistancePercent', () => {
      expect(() => {
        createStandardService({
          logger: createWhaleWallTPMockLoggerService(mockLogger),
          config: { maxDistancePercent: -1 },
        });
      }).toThrow('maxDistancePercent must be positive number');
    });

    test('should throw on invalid alignmentThresholdPercent', () => {
      expect(() => {
        createStandardService({
          logger: createWhaleWallTPMockLoggerService(mockLogger),
          config: createConfigWithTPTargeting({ alignmentThresholdPercent: 150 }),
        });
      }).toThrow('tpTargeting.alignmentThresholdPercent must be between 0 and 100');
    });

    test('should throw on invalid minStrength (> 1)', () => {
      expect(() => {
        createStandardService({
          logger: createWhaleWallTPMockLoggerService(mockLogger),
          config: createConfigWithQualityValidation({ minStrength: 1.5 }),
        });
      }).toThrow('qualityValidation.minStrength must be between 0 and 1');
    });

    test('should throw on invalid icebergBoostFactor', () => {
      expect(() => {
        createStandardService({
          logger: createWhaleWallTPMockLoggerService(mockLogger),
          config: createConfigWithQualityValidation({ icebergBoostFactor: 0 }),
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
      service = createStandardService({
        logger: createWhaleWallTPMockLoggerService(mockLogger),
        config: createValidConfig(),
      });
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
    let service: WhaleWallTPService;

    beforeEach(() => {
      service = createStandardService({
        logger: createWhaleWallTPMockLoggerService(mockLogger),
        config: createValidConfig(),
      });
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
      const disabledService = createStandardService({
        logger: createWhaleWallTPMockLoggerService(mockLogger),
        config: { ...createValidConfig(), enabled: false },
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
      const logger = createWhaleWallTPMockLoggerService({
        debug: jest.fn(() => {
          throw new Error('Debug failed');
        }),
      });
      const service = createStandardService({
        logger,
        config: createValidConfig(),
      });

      expect(() => {
        service.adjustTPSL(createValidWalls(), 50000, SignalDirection.LONG, 51000, 49000);
      }).not.toThrow();
    });

    test('should not throw when info logs fail', () => {
      const logger = createWhaleWallTPMockLoggerService({
        info: jest.fn(() => {
          throw new Error('Info failed');
        }),
      });
      const service = createStandardService({
        logger,
        config: createValidConfig(),
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
      service = createStandardService({
        logger: createWhaleWallTPMockLoggerService(mockLogger),
        config: createValidConfig(),
      });
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
      const takeProfits = createWhaleWallTPTakeProfits([51000, 52000], [30, 40]).map((tp, index) => ({
        ...tp,
        percent: index === 0 ? 2 : 3,
      })) as TakeProfit[];

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
      const service = createLegacyService({
        logger: createWhaleWallTPMockLoggerService(mockLogger),
        config: createValidConfig(),
      });
      const result = service.adjustTPSL(createValidWalls(), 50000, SignalDirection.LONG, 51000, 49000);
      expect(result).toBeDefined();
    });

    test('should throw on invalid input even without ErrorHandler', () => {
      const service = createLegacyService({
        logger: createWhaleWallTPMockLoggerService(mockLogger),
        config: createValidConfig(),
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
    let service: WhaleWallTPService;

    beforeEach(() => {
      service = createStandardService({
        logger: createWhaleWallTPMockLoggerService(mockLogger),
        config: createValidConfig(),
      });
    });

    test('should handle zero minWallPercent', () => {
      const zeroService = createStandardService({
        logger: createWhaleWallTPMockLoggerService(mockLogger),
        config: { ...createValidConfig(), minWallPercent: 0 },
      });
      const result = zeroService.adjustTPSL(createValidWalls(), 50000, SignalDirection.LONG, 51000, 49000);
      expect(result).toBeDefined();
    });

    test('should handle high minStrength value', () => {
      const highStrengthService = createStandardService({
        logger: createWhaleWallTPMockLoggerService(mockLogger),
        config: createConfigWithQualityValidation({ minStrength: 1.0 }),
      });
      const result = highStrengthService.adjustTPSL(createValidWalls(), 50000, SignalDirection.LONG, 51000, 49000);
      expect(result).toBeDefined();
    });
  });
});
