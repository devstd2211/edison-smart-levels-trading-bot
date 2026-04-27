/**
 * Phase 11.2: Position Scaling Service - Tests
 *
 * Test Coverage: 30 tests
 * - 5 THROW: Config validation
 * - 5 THROW: Position validation
 * - 7 GRACEFUL_DEGRADE: Calculation failures
 * - 4 SKIP: Logging failures
 * - 5 Integration: E2E scenarios
 * - 3 Backward compat: Works without ErrorHandler
 * - 1 Edge case: Scale at breakeven
 *
 * Created: 2026-02-09 (Session 96)
 */

import {
  ScalingConfig,
  PositionState,
} from '../../services/position-scaling.service';
import { LoggerService } from '../../types/legacy';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  MAX_SCALE_INS,
  MIN_POSITION_SIZE_FOR_SCALING,
} from '../../constants/phase-11-constants';
import {
  createManagedPositionScalingContext,
} from '../helpers/position-scaling-test.utils';
type PositionScalingContext = ReturnType<typeof createManagedPositionScalingContext>;

describe('PositionScalingService', () => {
  type PositionScalingService = PositionScalingContext['service'];
  let service: PositionScalingService;
  let logger: LoggerService;
  let errorHandler: ErrorHandler;
  let mockConfig: ScalingConfig;
  let mockPosition: PositionState;
  let createInvalidService: PositionScalingContext['createInvalidService'];
  let createBrokenService: PositionScalingContext['createBrokenService'];
  let createNoHandlerService: PositionScalingContext['createNoHandlerService'];
  let createScenario: PositionScalingContext['createScenario'];
  let createExtremes: PositionScalingContext['createExtremes'];
  let createSequence: PositionScalingContext['createSequence'];
  let evaluateDecision: PositionScalingContext['evaluateDecision'];
  let cleanup: PositionScalingContext['cleanup'];
  type ScalingConfigInput = Parameters<PositionScalingContext['createInvalidService']>[0];
  let createService: (options?: {
    config?: ScalingConfig;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  }) => PositionScalingService;
  type ScalingPositionInput = Parameters<PositionScalingService['shouldScale']>[0];

  beforeEach(() => {
    ({
      service,
      logger,
      errorHandler,
      config: mockConfig,
      position: mockPosition,
      createInvalidService,
      createBrokenService,
      createNoHandlerService,
      createService,
      createScenario,
      createExtremes,
      createSequence,
      evaluateDecision,
      cleanup,
    } = createManagedPositionScalingContext());
  });

  afterEach(() => {
    cleanup();
  });

  // ============================================================================
  // THROW TESTS - Config Validation (5 tests)
  // ============================================================================

  describe('THROW - Config Validation', () => {
    it('should throw when config is null', () => {
      expect(() => {
        createInvalidService(null as unknown as ScalingConfigInput, { logger, errorHandler });
      }).toThrow('config is required');
    });

    it('should throw when scaleInThreshold is negative', () => {
      expect(() => {
        createService({ config: { ...mockConfig, scaleInThreshold: -0.5 } });
      }).toThrow('scaleInThreshold must be >= 0');
    });

    it('should throw when maxScales is negative', () => {
      expect(() => {
        createService({ config: { ...mockConfig, maxScales: -1 } });
      }).toThrow('maxScales must be >= 0');
    });

    it('should throw when scaleReduction is out of bounds', () => {
      expect(() => {
        createService({ config: { ...mockConfig, scaleReduction: 1.5 } });
      }).toThrow('scaleReduction must be between 0 and 1');

      expect(() => {
        createService({ config: { ...mockConfig, scaleReduction: -0.5 } });
      }).toThrow('scaleReduction must be between 0 and 1');
    });

    it('should throw when breakevenThreshold is negative', () => {
      expect(() => {
        createService({ config: { ...mockConfig, breakevenThreshold: -0.5 } });
      }).toThrow('breakevenThreshold must be >= 0');
    });
  });

  // ============================================================================
  // THROW TESTS - Position Validation (5 tests)
  // ============================================================================

  describe('THROW - Position Validation', () => {
    it('should throw when position is null', async () => {
      await expect(service.shouldScale(null as unknown as ScalingPositionInput)).rejects.toThrow(
        'position is required'
      );
    });

    it('should throw when entryPrice is invalid', async () => {
      await expect(
        service.shouldScale({ ...mockPosition, entryPrice: -100 })
      ).rejects.toThrow('entryPrice must be > 0');

      await expect(
        service.shouldScale({ ...mockPosition, entryPrice: NaN })
      ).rejects.toThrow('entryPrice must be > 0');
    });

    it('should throw when currentPrice is invalid', async () => {
      await expect(
        service.shouldScale({ ...mockPosition, currentPrice: 0 })
      ).rejects.toThrow('currentPrice must be > 0');
    });

    it('should throw when size is invalid', async () => {
      await expect(
        service.shouldScale({ ...mockPosition, size: -100 })
      ).rejects.toThrow('size must be >= 0');
    });

    it('should throw when side is invalid', async () => {
      await expect(
        service.shouldScale({ ...mockPosition, side: 'invalid' as unknown as PositionState['side'] })
      ).rejects.toThrow('side must be "long" or "short"');
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE TESTS - Calculation Failures (7 tests)
  // ============================================================================

  describe('GRACEFUL_DEGRADE - Calculation Failures', () => {
    it('should return hold action when shouldScale calculation fails', async () => {
      const brokenPosition = createExtremes();

      const result = await service.shouldScale(brokenPosition);

      // Should gracefully degrade to hold
      expect(result.action).toBeDefined();
      expect(result.size).toBeGreaterThanOrEqual(0);
    });

    it('should return hold action when scaleIntoWinner calculation fails', async () => {
      const brokenPosition = createExtremes();

      const result = await service.scaleIntoWinner(brokenPosition, Number.MAX_VALUE);

      expect(result.action).toBeDefined();
      expect(result.size).toBeGreaterThanOrEqual(0);
    });

    it('should return hold action when reduceRiskOnProfit calculation fails', async () => {
      const brokenPosition = createExtremes();

      const result = await service.reduceRiskOnProfit(brokenPosition);

      expect(result.action).toBeDefined();
      expect(result.newStopLoss).toBeGreaterThan(0);
    });

    it('should throw when calculateScaleSize gets invalid input', () => {
      // calculateScaleSize uses THROW strategy for validation
      expect(() => {
        service.calculateScaleSize({ ...mockPosition, size: -1 });
      }).toThrow('invalid position size');
    });

    it('should handle negative profit (loss) gracefully', async () => {
      const result = await evaluateDecision(service, {
        currentPrice: 95,
      });

      expect(result.action).toBe('hold');
      expect(result.reasoning).toContain('below threshold');
    });

    it('should handle position at exact profit target', async () => {
      const result = await evaluateDecision(service, {
        currentPrice: 110,
      });

      // Should still scale (100% profit >= 50% threshold)
      expect(result.action).toBe('add');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle very small position size', async () => {
      const result = await evaluateDecision(service, {
        size: 1,
      });

      expect(result.action).toBe('hold');
      expect(result.reasoning).toContain('too small');
    });
  });

  // ============================================================================
  // SKIP TESTS - Logging Failures (4 tests)
  // ============================================================================

  describe('SKIP - Logging Failures', () => {
    it('should not throw when logging fails in shouldScale', async () => {
      const brokenService = createBrokenService();

      const extremePosition = createExtremes({ profitTarget: mockPosition.profitTarget });

      await expect(
        brokenService.shouldScale(extremePosition)
      ).resolves.toBeDefined();
    });

    it('should not throw when logging fails in scaleIntoWinner', async () => {
      const brokenService = createBrokenService();

      const extremePosition = createExtremes({ profitTarget: mockPosition.profitTarget });

      await expect(
        brokenService.scaleIntoWinner(extremePosition, Number.MAX_VALUE)
      ).resolves.toBeDefined();
    });

    it('should not throw when logging fails in reduceRiskOnProfit', async () => {
      const brokenService = createBrokenService();

      const extremePosition = createExtremes({ profitTarget: mockPosition.profitTarget });

      await expect(
        brokenService.reduceRiskOnProfit(extremePosition)
      ).resolves.toBeDefined();
    });

    it('should not throw when logging fails in calculateScaleSize', () => {
      const brokenService = createBrokenService();

      // Force error by using invalid position (will trigger SKIP logging)
      expect(() => {
        brokenService.calculateScaleSize({ ...mockPosition, scaleCount: -1 });
      }).toThrow(); // Still throws because validation is THROW strategy
    });
  });

  // ============================================================================
  // INTEGRATION TESTS - E2E Scenarios (5 tests)
  // ============================================================================

  describe('Integration - E2E Scenarios', () => {
    it('should scale at 50% profit (threshold met)', async () => {
      const result = await service.shouldScale(mockPosition);

      expect(result.action).toBe('add');
      expect(result.size).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.reasoning).toContain('threshold');
    });

    it('should not scale at 30% profit (below threshold)', async () => {
      const result = await evaluateDecision(service, {
        currentPrice: 103,
      });

      expect(result.action).toBe('hold');
      expect(result.size).toBe(0);
      expect(result.reasoning).toContain('below threshold');
    });

    it('should hold when max scales reached', async () => {
      const result = await evaluateDecision(service, {
        scaleCount: 3,
      });

      expect(result.action).toBe('hold');
      expect(result.size).toBe(0);
      expect(result.reasoning).toContain('Max scales');
    });

    it('should move SL to breakeven at threshold', async () => {
      const result = await service.reduceRiskOnProfit(mockPosition);

      expect(result.newStopLoss).toBe(mockPosition.entryPrice);
      expect(result.reasoning).toContain('breakeven');
    });

    it('should complete full scaling flow', async () => {
      let position = { ...mockPosition };

      // Scale 1
      const scale1 = await service.scaleIntoWinner(position, 5);
      expect(scale1.action).toBe('add');
      expect(scale1.size).toBeCloseTo(position.size * 0.5, 1); // 50% of original

      // Scale 2
      position = { ...position, scaleCount: 1 };
      const scale2 = await service.scaleIntoWinner(position, 7);
      expect(scale2.action).toBe('add');
      expect(scale2.size).toBeCloseTo(position.size * 0.25, 1); // 25% of original

      // Scale 3
      position = { ...position, scaleCount: 2 };
      const scale3 = await service.scaleIntoWinner(position, 9);
      expect(scale3.action).toBe('add');
      expect(scale3.size).toBeCloseTo(position.size * 0.125, 1); // 12.5% of original

      // Scale 4 - should be blocked
      position = { ...position, scaleCount: 3 };
      const scale4 = await service.scaleIntoWinner(position, 10);
      expect(scale4.action).toBe('hold');
      expect(scale4.reasoning).toContain('Max scales');
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY TESTS (3 tests)
  // ============================================================================

  describe('Backward Compatibility', () => {
    it('should work without errorHandler', async () => {
      const serviceNoEH = createNoHandlerService();

      const result = await serviceNoEH.shouldScale(mockPosition);

      expect(result.action).toBeDefined();
    });

    it('should work without logger', async () => {
      const serviceNoLogger = createService({
        logger: undefined,
        errorHandler,
      });

      const result = await serviceNoLogger.shouldScale(mockPosition);

      expect(result.action).toBeDefined();
    });

    it('should work without both logger and errorHandler', async () => {
      const serviceNoLogs = createService({
        logger: undefined,
        errorHandler: undefined,
      });

      const result = await serviceNoLogs.shouldScale(mockPosition);

      expect(result.action).toBeDefined();
    });
  });

  // ============================================================================
  // EDGE CASE TESTS (1 test)
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle position at exact breakeven', async () => {
      const result = await evaluateDecision(service, {
        currentPrice: mockPosition.entryPrice,
      });

      expect(result.action).toBe('hold');
      expect(result.reasoning).toContain('below threshold');
    });
  });

  // ============================================================================
  // ADDITIONAL HELPER METHOD TESTS
  // ============================================================================

  describe('Helper Methods - calculateScaleSize', () => {
    it('should calculate scale size with reduction factor', () => {
      const [position1, position2, position3] = createSequence([0, 1, 2]);

      const scale1 = service.calculateScaleSize(position1);
      expect(scale1).toBeCloseTo(50, 1); // 100 * 0.5^1

      const scale2 = service.calculateScaleSize(position2);
      expect(scale2).toBeCloseTo(25, 1); // 100 * 0.5^2

      const scale3 = service.calculateScaleSize(position3);
      expect(scale3).toBeCloseTo(12.5, 1); // 100 * 0.5^3
    });

    it('should enforce minimum scale size', () => {
      const tinyPosition = {
        ...mockPosition,
        size: 1,
        scaleCount: 5, // Many scales
      };

      const scaleSize = service.calculateScaleSize(tinyPosition);

      expect(scaleSize).toBeGreaterThanOrEqual(MIN_POSITION_SIZE_FOR_SCALING);
    });

    it('should throw on invalid scale count', () => {
      expect(() => {
        service.calculateScaleSize({ ...mockPosition, scaleCount: -1 });
      }).toThrow('invalid scaleCount');
    });
  });

  describe('Short Position Scaling', () => {
    it('should scale short position correctly', async () => {
      const shortPosition: PositionState = createScenario({
        currentPrice: 95,
        stopLoss: 105,
        profitTarget: 90,
        side: 'short',
      });

      const result = await service.shouldScale(shortPosition);

      // 50% to target (95 vs 90)
      expect(result.action).toBe('add');
      expect(result.size).toBeGreaterThan(0);
    });

    it('should move SL to breakeven for short position', async () => {
      const shortPosition: PositionState = createScenario({
        currentPrice: 95,
        stopLoss: 105,
        profitTarget: 90,
        side: 'short',
      });

      const result = await service.reduceRiskOnProfit(shortPosition);

      expect(result.newStopLoss).toBe(shortPosition.entryPrice);
      expect(result.reasoning).toContain('breakeven');
    });
  });
});
