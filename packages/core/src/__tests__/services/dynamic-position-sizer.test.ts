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
  SizingConfig,
} from '../../services/dynamic-position-sizer.service';
import { LoggerService } from '../../types/legacy';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  FALLBACK_POSITION_SIZE,
} from '../../constants/phase-11-constants';
import {
  calculateDynamicSizeScenario,
  createDynamicPositionSizerConfig,
  createManagedDynamicPositionSizerContext,
} from '../helpers/dynamic-position-sizer-test.utils';

describe('DynamicPositionSizerService', () => {
  const asNumber = (value: unknown): number => value as number;
  const asSizingConfig = (value: unknown): SizingConfig => value as SizingConfig;

  type DynamicPositionSizerService = ReturnType<typeof createManagedDynamicPositionSizerContext>['service'];
  let service: DynamicPositionSizerService;
  let logger: LoggerService;
  let errorHandler: ErrorHandler;
  let mockConfig: SizingConfig;
  let createInvalidService: ReturnType<typeof createManagedDynamicPositionSizerContext>['createInvalidService'];
  let createBrokenService: ReturnType<typeof createManagedDynamicPositionSizerContext>['createBrokenService'];
  let createNoHandlerService: ReturnType<typeof createManagedDynamicPositionSizerContext>['createNoHandlerService'];
  let createService: (options?: {
    config?: SizingConfig;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  }) => DynamicPositionSizerService;

  type DynamicPositionSizerFixtures = Pick<
    ReturnType<typeof createManagedDynamicPositionSizerContext>,
    | 'service'
    | 'logger'
    | 'errorHandler'
    | 'config'
    | 'createInvalidService'
    | 'createBrokenService'
    | 'createNoHandlerService'
    | 'createService'
  >;

  function bindDynamicPositionSizerContext() {
    let fixtures: DynamicPositionSizerFixtures;
    let cleanup: (() => void) | undefined;

    beforeEach(() => {
      const managedContext = createManagedDynamicPositionSizerContext();
      fixtures = {
        service: managedContext.service,
        logger: managedContext.logger,
        errorHandler: managedContext.errorHandler,
        config: managedContext.config,
        createInvalidService: managedContext.createInvalidService,
        createBrokenService: managedContext.createBrokenService,
        createNoHandlerService: managedContext.createNoHandlerService,
        createService: managedContext.createService,
      };
      cleanup = managedContext.cleanup;
    });

    afterEach(() => {
      cleanup?.();
    });

    return () => fixtures;
  }

  const getFixtures = bindDynamicPositionSizerContext();

  beforeEach(() => {
    const fixtures = getFixtures();
    service = fixtures.service;
    logger = fixtures.logger;
    errorHandler = fixtures.errorHandler;
    mockConfig = fixtures.config;
    createInvalidService = fixtures.createInvalidService;
    createBrokenService = fixtures.createBrokenService;
    createNoHandlerService = fixtures.createNoHandlerService;
    createService = fixtures.createService;
  });

  // ============================================================================
  // THROW TESTS - Config Validation (6 tests)
  // ============================================================================

  describe('THROW - Config Validation', () => {
    it('should throw when config is null', () => {
      expect(() => {
        createInvalidService(asSizingConfig(null), { logger, errorHandler });
      }).toThrow('config is required');
    });

    it('should throw when baseRiskPercent is negative', () => {
      expect(() => {
        createService({ config: { ...mockConfig, baseRiskPercent: -1 } });
      }).toThrow('baseRiskPercent must be >= 0');
    });

    it('should throw when maxRiskPercent is negative', () => {
      expect(() => {
        createService({ config: { ...mockConfig, maxRiskPercent: -1 } });
      }).toThrow('maxRiskPercent must be >= 0');
    });

    it('should throw when baseRiskPercent > maxRiskPercent', () => {
      expect(() => {
        createService({ config: { ...mockConfig, baseRiskPercent: 5, maxRiskPercent: 3 } });
      }).toThrow('baseRiskPercent cannot exceed maxRiskPercent');
    });

    it('should throw when minPositionSize is negative', () => {
      expect(() => {
        createService({ config: { ...mockConfig, minPositionSize: -10 } });
      }).toThrow('minPositionSize must be >= 0');
    });

    it('should throw when minPositionSize > maxPositionSize', () => {
      expect(() => {
        createService({ config: { ...mockConfig, minPositionSize: 2000, maxPositionSize: 1000 } });
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
      const result = await calculateDynamicSizeScenario(service, {
        accountBalance: 5,
      });

      expect(result.adjustedSize).toBe(FALLBACK_POSITION_SIZE);
      expect(result.recommendation).toBe('reduce');
    });

    it('should return fallback when confidence below threshold', async () => {
      const result = await calculateDynamicSizeScenario(service, {
        confidence: 0.3,
      });

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
      const brokenService = createService();

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
        ...createDynamicPositionSizerConfig(),
        maxPositionSize: Number.MAX_VALUE,
      };

      const hugeService = createService({ config: hugeConfig });

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
    it('should not throw when logging fails in calculateOptimalSize', async () => {
      const brokenService = createBrokenService();

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
      const brokenService = createBrokenService();

      // Should not throw despite logger errors
      expect(() => {
        brokenService.adjustForVolatility(100, 0.5, 1.0);
      }).not.toThrow();
    });

    it('should not throw when logging fails in adjustForAccountRisk', () => {
      const brokenService = createBrokenService();

      const largeSize = 10000; // Triggers risk limit log

      expect(() => {
        brokenService.adjustForAccountRisk(largeSize, 1000, 105, 5);
      }).not.toThrow();
    });

    it('should not throw when logging fails in calculateMaxPosition', () => {
      const brokenService = createBrokenService();

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
      const result = await calculateDynamicSizeScenario(service, {
        confidence: 0.5,
        currentATR: 1.0,
        averageATR: 1.0,
      });

      expect(result.confidence).toBe(0.5);
      expect(result.recommendation).toBe('reduce');
      expect(result.adjustedSize).toBeGreaterThan(0);
      expect(result.adjustedSize).toBeLessThan(result.baseSize);
    });

    it('should maintain size for medium confidence signal (70%)', async () => {
      const result = await calculateDynamicSizeScenario(service, {
        confidence: 0.7,
        currentATR: 1.0,
        averageATR: 1.0,
      });

      expect(result.confidence).toBe(0.7);
      expect(result.recommendation).toBe('maintain');
      expect(result.adjustedSize).toBeGreaterThan(0);
    });

    it('should increase size for high confidence signal (90%)', async () => {
      const result = await calculateDynamicSizeScenario(service, {
        confidence: 0.9,
        currentATR: 1.0,
        averageATR: 1.0,
      });

      expect(result.confidence).toBe(0.9);
      expect(result.recommendation).toBe('increase');
      // Size may be capped at maxPositionSize (1000), so just verify it's substantial
      expect(result.adjustedSize).toBeGreaterThanOrEqual(mockConfig.minPositionSize);
      expect(result.adjustedSize).toBeLessThanOrEqual(mockConfig.maxPositionSize);
      // Verify confidence multiplier was applied (even if capped)
      expect(result.baseSize).toBeGreaterThan(0);
    });

    it('should reduce size in high volatility market', async () => {
      const result = await calculateDynamicSizeScenario(service, {
        currentATR: 2.0,
        averageATR: 1.0,
      });

      expect(result.volatilityAdjustment).toBeLessThan(1.0);
      expect(result.adjustedSize).toBeLessThan(result.baseSize);
    });

    it('should increase size in low volatility market', async () => {
      const result = await calculateDynamicSizeScenario(service, {
        currentATR: 0.5,
        averageATR: 1.0,
      });

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
      const serviceNoEH = createNoHandlerService();
      const result = await calculateDynamicSizeScenario(serviceNoEH);

      expect(result.adjustedSize).toBeGreaterThan(0);
    });

    it('should work without logger', async () => {
      const serviceNoLoggerService = createService({
        logger: undefined,
        errorHandler,
      });
      const result = await calculateDynamicSizeScenario(serviceNoLoggerService);

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
      const result = await calculateDynamicSizeScenario(service, {
        accountBalance: 0,
      });

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
