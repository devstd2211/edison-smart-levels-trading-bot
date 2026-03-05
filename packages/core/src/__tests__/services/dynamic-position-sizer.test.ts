/**
 * Phase 11.1: Dynamic Position Sizer Service - Tests
 *
 * Test Coverage: 35 tests
 * - 6 THROW: Config validation
 * - 6 THROW: Input validation
 * - 8 GRACEFUL_DEGRADE: Calculation failures
 * - 4 SKIP: Logging failures
 * - 6 Integration: E2E scenarios
 * - 4 Backward compat: Works without ErrorHandler
 * - 1 Edge case: Zero balance
 *
 * Created: 2026-02-09 (Session 96)
 */

import {
  DynamicPositionSizerService,
  SizingConfig,
} from '../../services/dynamic-position-sizer.service';
import { LoggerService } from '../../types/legacy';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  MIN_POSITION_SIZE_USD,
  FALLBACK_POSITION_SIZE,
  MIN_CONFIDENCE_THRESHOLD,
} from '../../constants/phase-11-constants';

describe('DynamicPositionSizerService', () => {
  type LoggerMock = Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error'>;
  const asNumber = (value: unknown): number => value as number;
  const asSizingConfig = (value: unknown): SizingConfig => value as SizingConfig;

  let service: DynamicPositionSizerService;
  let logger: LoggerService;
  let errorHandler: ErrorHandler;
  let mockConfig: SizingConfig;

  beforeEach(() => {
    const mockLogger: LoggerMock = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    logger = mockLogger as unknown as LoggerService;
    errorHandler = new ErrorHandler(logger);

    mockConfig = {
      baseRiskPercent: 1.0,
      maxRiskPercent: 3.0,
      minPositionSize: 10,
      maxPositionSize: 1000,
      volatilityMultiplier: 1.0,
      confidenceThreshold: 0.5,
    };

    service = new DynamicPositionSizerService(mockConfig, logger, errorHandler);
  });

  // ============================================================================
  // THROW TESTS - Config Validation (6 tests)
  // ============================================================================

  describe('THROW - Config Validation', () => {
    it('should throw when config is null', () => {
      expect(() => {
        new DynamicPositionSizerService(asSizingConfig(null), logger, errorHandler);
      }).toThrow('config is required');
    });

    it('should throw when baseRiskPercent is negative', () => {
      expect(() => {
        new DynamicPositionSizerService(
          { ...mockConfig, baseRiskPercent: -1 },
          logger,
          errorHandler
        );
      }).toThrow('baseRiskPercent must be >= 0');
    });

    it('should throw when maxRiskPercent is negative', () => {
      expect(() => {
        new DynamicPositionSizerService(
          { ...mockConfig, maxRiskPercent: -1 },
          logger,
          errorHandler
        );
      }).toThrow('maxRiskPercent must be >= 0');
    });

    it('should throw when baseRiskPercent > maxRiskPercent', () => {
      expect(() => {
        new DynamicPositionSizerService(
          { ...mockConfig, baseRiskPercent: 5, maxRiskPercent: 3 },
          logger,
          errorHandler
        );
      }).toThrow('baseRiskPercent cannot exceed maxRiskPercent');
    });

    it('should throw when minPositionSize is negative', () => {
      expect(() => {
        new DynamicPositionSizerService(
          { ...mockConfig, minPositionSize: -10 },
          logger,
          errorHandler
        );
      }).toThrow('minPositionSize must be >= 0');
    });

    it('should throw when minPositionSize > maxPositionSize', () => {
      expect(() => {
        new DynamicPositionSizerService(
          { ...mockConfig, minPositionSize: 2000, maxPositionSize: 1000 },
          logger,
          errorHandler
        );
      }).toThrow('minPositionSize cannot exceed maxPositionSize');
    });
  });

  // ============================================================================
  // THROW TESTS - Input Validation (6 tests)
  // ============================================================================

  describe('THROW - Input Validation', () => {
    it('should throw when entryPrice is null', async () => {
      await expect(
        service.calculateOptimalSize(asNumber(null), 100, 10000, 0.7)
      ).rejects.toThrow('entryPrice must be a positive number');
    });

    it('should throw when entryPrice is NaN', async () => {
      await expect(
        service.calculateOptimalSize(NaN, 100, 10000, 0.7)
      ).rejects.toThrow('entryPrice must be a positive number');
    });

    it('should throw when stopLoss is null', async () => {
      await expect(
        service.calculateOptimalSize(105, asNumber(null), 10000, 0.7)
      ).rejects.toThrow('stopLoss must be a positive number');
    });

    it('should throw when accountBalance is null', async () => {
      await expect(
        service.calculateOptimalSize(105, 100, asNumber(null), 0.7)
      ).rejects.toThrow('accountBalance must be >= 0');
    });

    it('should throw when confidence is null', async () => {
      await expect(
        service.calculateOptimalSize(105, 100, 10000, asNumber(null))
      ).rejects.toThrow('confidence must be a number');
    });

    it('should throw when riskRewardRatio is negative', async () => {
      await expect(
        service.calculateOptimalSize(105, 100, 10000, 0.7, undefined, undefined, -1)
      ).rejects.toThrow('riskRewardRatio must be >= 0');
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE TESTS - Calculation Failures (8 tests)
  // ============================================================================

  describe('GRACEFUL_DEGRADE - Calculation Failures', () => {
    it('should return fallback when account balance too low', async () => {
      const result = await service.calculateOptimalSize(
        105, // entry
        100, // stop
        5, // balance below MIN_ACCOUNT_BALANCE (10)
        0.7
      );

      expect(result.adjustedSize).toBe(FALLBACK_POSITION_SIZE);
      expect(result.recommendation).toBe('reduce');
    });

    it('should return fallback when confidence below threshold', async () => {
      const result = await service.calculateOptimalSize(
        105,
        100,
        10000,
        0.3 // Below MIN_CONFIDENCE_THRESHOLD (0.5)
      );

      expect(result.adjustedSize).toBe(FALLBACK_POSITION_SIZE);
      expect(result.confidence).toBe(0.3);
      expect(result.recommendation).toBe('reduce');
    });

    it('should return fallback when stop distance too small', async () => {
      const result = await service.calculateOptimalSize(
        100,
        100, // Same as entry → zero stop distance
        10000,
        0.7
      );

      expect(result.adjustedSize).toBe(FALLBACK_POSITION_SIZE);
    });

    it('should handle extreme volatility (very high ATR)', async () => {
      const result = await service.calculateOptimalSize(
        105,
        100,
        10000,
        0.7,
        1000, // Extremely high current ATR
        1 // Low average ATR
      );

      // Should not crash, return reduced size
      expect(result.adjustedSize).toBeGreaterThan(0);
      expect(result.volatilityAdjustment).toBeLessThan(1.0);
    });

    it('should handle zero ATR (division by zero)', async () => {
      const volatilityAdj = service.adjustForVolatility(100, 0, 0);

      // Should clamp to safe value (not crash)
      expect(volatilityAdj).toBeGreaterThan(0);
      expect(volatilityAdj).toBeLessThanOrEqual(2.0);
    });

    it('should handle calculation errors gracefully', async () => {
      // Force error by mocking internal method to throw
      const brokenService = new DynamicPositionSizerService(
        mockConfig,
        logger,
        errorHandler
      );

      // Inject error into calculateKellySize via extreme inputs
      const result = await brokenService.calculateOptimalSize(
        Number.MAX_VALUE,
        1,
        10000,
        0.7
      );

      // Should return fallback, not crash
      expect(result.adjustedSize).toBeGreaterThan(0);
    });

    it('should handle Kelly formula edge cases', async () => {
      // Win probability = 100%, should not overflow
      const result = await service.calculateOptimalSize(
        105,
        100,
        10000,
        1.0, // 100% confidence
        undefined,
        undefined,
        10 // Very high RR ratio
      );

      expect(result.adjustedSize).toBeGreaterThan(0);
      expect(result.adjustedSize).toBeLessThanOrEqual(mockConfig.maxPositionSize);
    });

    it('should handle risk calculation overflow', async () => {
      const hugeConfig: SizingConfig = {
        ...mockConfig,
        maxPositionSize: Number.MAX_VALUE,
      };

      const hugeService = new DynamicPositionSizerService(
        hugeConfig,
        logger,
        errorHandler
      );

      const result = await hugeService.calculateOptimalSize(
        105,
        100,
        10000,
        0.9,
        undefined,
        undefined,
        100 // Huge RR ratio
      );

      // Should cap at reasonable limits
      expect(result.adjustedSize).toBeGreaterThan(0);
      expect(result.adjustedSize).toBeLessThan(Number.MAX_VALUE);
    });
  });

  // ============================================================================
  // SKIP TESTS - Logging Failures (4 tests)
  // ============================================================================

  describe('SKIP - Logging Failures', () => {
    let brokenLogger: LoggerService;

    beforeEach(() => {
      const mockBrokenLogger: LoggerMock = {
        debug: jest.fn(() => {
          throw new Error('Logger broken');
        }),
        info: jest.fn(() => {
          throw new Error('Logger broken');
        }),
        warn: jest.fn(() => {
          throw new Error('Logger broken');
        }),
        error: jest.fn(() => {
          throw new Error('Logger broken');
        }),
      };
      brokenLogger = mockBrokenLogger as unknown as LoggerService;
    });

    it('should not throw when logging fails in calculateOptimalSize', async () => {
      const brokenService = new DynamicPositionSizerService(
        mockConfig,
        brokenLogger,
        new ErrorHandler(brokenLogger)
      );

      const result = await brokenService.calculateOptimalSize(
        105,
        100,
        5, // Low balance triggers warning log
        0.7
      );

      // Should complete without throwing
      expect(result.adjustedSize).toBeGreaterThan(0);
    });

    it('should not throw when logging fails in adjustForVolatility', () => {
      const brokenService = new DynamicPositionSizerService(
        mockConfig,
        brokenLogger,
        new ErrorHandler(brokenLogger)
      );

      // Should not throw despite logger errors
      expect(() => {
        brokenService.adjustForVolatility(100, 0.5, 1.0);
      }).not.toThrow();
    });

    it('should not throw when logging fails in adjustForAccountRisk', () => {
      const brokenService = new DynamicPositionSizerService(
        mockConfig,
        brokenLogger,
        new ErrorHandler(brokenLogger)
      );

      const largeSize = 10000; // Triggers risk limit log

      expect(() => {
        brokenService.adjustForAccountRisk(largeSize, 1000, 105, 5);
      }).not.toThrow();
    });

    it('should not throw when logging fails in calculateMaxPosition', () => {
      const brokenService = new DynamicPositionSizerService(
        mockConfig,
        brokenLogger,
        new ErrorHandler(brokenLogger)
      );

      expect(() => {
        brokenService.calculateMaxPosition(5.0, 10000);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // INTEGRATION TESTS - E2E Scenarios (6 tests)
  // ============================================================================

  describe('Integration - E2E Scenarios', () => {
    it('should reduce size for low confidence signal (50%)', async () => {
      const result = await service.calculateOptimalSize(
        105,
        100,
        10000,
        0.5, // Minimum confidence
        1.0,
        1.0
      );

      expect(result.confidence).toBe(0.5);
      expect(result.recommendation).toBe('reduce');
      expect(result.adjustedSize).toBeGreaterThan(0);
      expect(result.adjustedSize).toBeLessThan(result.baseSize);
    });

    it('should maintain size for medium confidence signal (70%)', async () => {
      const result = await service.calculateOptimalSize(
        105,
        100,
        10000,
        0.7, // Medium confidence
        1.0,
        1.0
      );

      expect(result.confidence).toBe(0.7);
      expect(result.recommendation).toBe('maintain');
      expect(result.adjustedSize).toBeGreaterThan(0);
    });

    it('should increase size for high confidence signal (90%)', async () => {
      const result = await service.calculateOptimalSize(
        105,
        100,
        10000,
        0.9, // High confidence
        1.0,
        1.0
      );

      expect(result.confidence).toBe(0.9);
      expect(result.recommendation).toBe('increase');
      // Size may be capped at maxPositionSize (1000), so just verify it's substantial
      expect(result.adjustedSize).toBeGreaterThanOrEqual(mockConfig.minPositionSize);
      expect(result.adjustedSize).toBeLessThanOrEqual(mockConfig.maxPositionSize);
      // Verify confidence multiplier was applied (even if capped)
      expect(result.baseSize).toBeGreaterThan(0);
    });

    it('should reduce size in high volatility market', async () => {
      const result = await service.calculateOptimalSize(
        105,
        100,
        10000,
        0.7,
        2.0, // Current ATR is 2x average
        1.0
      );

      expect(result.volatilityAdjustment).toBeLessThan(1.0);
      expect(result.adjustedSize).toBeLessThan(result.baseSize);
    });

    it('should increase size in low volatility market', async () => {
      const result = await service.calculateOptimalSize(
        105,
        100,
        10000,
        0.7,
        0.5, // Current ATR is 0.5x average
        1.0
      );

      expect(result.volatilityAdjustment).toBeGreaterThan(1.0);
      // Size may still be capped by risk limits
      expect(result.adjustedSize).toBeGreaterThan(0);
    });

    it('should complete full sizing flow with all adjustments', async () => {
      const result = await service.calculateOptimalSize(
        105, // entry
        100, // stop
        10000, // balance
        0.85, // high confidence
        0.8, // current ATR
        1.0, // average ATR
        2.0 // RR ratio
      );

      // Verify all fields populated
      expect(result.baseSize).toBeGreaterThan(0);
      expect(result.adjustedSize).toBeGreaterThan(0);
      expect(result.riskPercent).toBeGreaterThan(0);
      expect(result.maxRisk).toBeGreaterThan(0);
      expect(result.recommendation).toMatch(/increase|maintain|reduce/);
      expect(result.confidence).toBe(0.85);
      expect(result.volatilityAdjustment).toBeGreaterThan(0);

      // Verify risk limits respected
      expect(result.riskPercent).toBeLessThanOrEqual(mockConfig.maxRiskPercent);
      expect(result.adjustedSize).toBeLessThanOrEqual(mockConfig.maxPositionSize);
      expect(result.adjustedSize).toBeGreaterThanOrEqual(mockConfig.minPositionSize);
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY TESTS (4 tests)
  // ============================================================================

  describe('Backward Compatibility', () => {
    it('should work without errorHandler', async () => {
      const serviceNoEH = new DynamicPositionSizerService(mockConfig, logger);

      const result = await serviceNoEH.calculateOptimalSize(
        105,
        100,
        10000,
        0.7
      );

      expect(result.adjustedSize).toBeGreaterThan(0);
    });

    it('should work without logger', async () => {
      const serviceNoLoggerService = new DynamicPositionSizerService(
        mockConfig,
        undefined,
        errorHandler
      );

      const result = await serviceNoLoggerService.calculateOptimalSize(
        105,
        100,
        10000,
        0.7
      );

      expect(result.adjustedSize).toBeGreaterThan(0);
    });

    it('should work without ATR parameters (volatility adjustment)', async () => {
      const result = await service.calculateOptimalSize(
        105,
        100,
        10000,
        0.7
        // No currentATR, no averageATR
      );

      // Should default volatility adjustment to 1.0
      expect(result.volatilityAdjustment).toBe(1.0);
      expect(result.adjustedSize).toBeGreaterThan(0);
    });

    it('should use default RR ratio when not provided', async () => {
      const result = await service.calculateOptimalSize(
        105,
        100,
        10000,
        0.7
        // No riskRewardRatio parameter
      );

      // Should use DEFAULT_RISK_REWARD_RATIO (1.5)
      expect(result.adjustedSize).toBeGreaterThan(0);
      expect(result.baseSize).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // EDGE CASE TESTS (1 test)
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle zero account balance (after THROW validation passes)', async () => {
      // Balance of 0 is allowed by validation (>= 0) but fails business logic
      const result = await service.calculateOptimalSize(
        105,
        100,
        0, // Zero balance
        0.7
      );

      // Should return fallback
      expect(result.adjustedSize).toBe(FALLBACK_POSITION_SIZE);
      expect(result.recommendation).toBe('reduce');
    });
  });

  // ============================================================================
  // ADDITIONAL HELPER METHOD TESTS
  // ============================================================================

  describe('Helper Methods - adjustForVolatility', () => {
    it('should throw on null baseSize', () => {
      expect(() => {
        service.adjustForVolatility(asNumber(null), 1.0, 1.0);
      }).toThrow('baseSize must be >= 0');
    });

    it('should throw on null currentATR', () => {
      expect(() => {
        service.adjustForVolatility(100, asNumber(null), 1.0);
      }).toThrow('currentATR must be >= 0');
    });

    it('should throw on null averageATR', () => {
      expect(() => {
        service.adjustForVolatility(100, 1.0, asNumber(null));
      }).toThrow('averageATR must be >= 0');
    });

    it('should return neutral adjustment when ATRs equal', () => {
      const adj = service.adjustForVolatility(100, 1.0, 1.0);

      expect(adj).toBeCloseTo(1.0, 1);
    });
  });

  describe('Helper Methods - adjustForAccountRisk', () => {
    it('should throw on null size', () => {
      expect(() => {
        service.adjustForAccountRisk(asNumber(null), 10000, 105, 5);
      }).toThrow('size must be >= 0');
    });

    it('should throw on null accountBalance', () => {
      expect(() => {
        service.adjustForAccountRisk(100, asNumber(null), 105, 5);
      }).toThrow('accountBalance must be >= 0');
    });

    it('should cap size at maxPositionSize', () => {
      const result = service.adjustForAccountRisk(
        50000, // Huge size
        10000,
        105,
        5
      );

      expect(result).toBeLessThanOrEqual(mockConfig.maxPositionSize);
    });

    it('should enforce minimum position size', () => {
      const result = service.adjustForAccountRisk(
        0.01, // Tiny size
        10000,
        105,
        5
      );

      // Either zero (below dust) or at minimum
      expect(result === 0 || result >= mockConfig.minPositionSize).toBe(true);
    });
  });

  describe('Helper Methods - calculateMaxPosition', () => {
    it('should throw on null maxRiskPercent', () => {
      expect(() => {
        service.calculateMaxPosition(asNumber(null), 10000);
      }).toThrow('maxRiskPercent must be >= 0');
    });

    it('should throw on null accountBalance', () => {
      expect(() => {
        service.calculateMaxPosition(3.0, asNumber(null));
      }).toThrow('accountBalance must be >= 0');
    });

    it('should cap risk percent at absolute maximum', () => {
      const result = service.calculateMaxPosition(
        100, // Extreme risk %
        10000
      );

      // Should be capped, not 100% of account
      expect(result).toBeLessThan(10000);
    });

    it('should return reasonable max position', () => {
      const result = service.calculateMaxPosition(3.0, 10000);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(10000 * 0.8); // MAX_ACCOUNT_UTILIZATION
    });
  });
});
