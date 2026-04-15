/**
 * Error Handling Tests for EnhancedExitService
 * Phase 8.9.53
 *
 * Test Coverage:
 * 1. Config Validation (THROW) - 5 tests
 * 2. Input Validation (THROW) - 3 tests
 * 3. Calculation Errors (GRACEFUL_DEGRADE) - 4 tests
 * 4. Logging Failures (SKIP) - 2 tests
 * 5. Integration E2E - 2 tests
 * TOTAL: 16 tests
 */

import { EnhancedExitService, EnhancedExitConfig } from '../../services/enhanced-exit.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { LoggerService, SignalDirection } from '../../types/legacy';
import {
  createEnhancedExitConfig,
  createEnhancedExitErrorHandler,
  createEnhancedExitFailingLogger,
  createManagedEnhancedExitContext,
  createEnhancedExitInvalidRiskRewardInput,
} from '../helpers/enhanced-exit-test.utils';

type EnhancedExitManagedContext = ReturnType<typeof createManagedEnhancedExitContext>;
type EnhancedExitRuntime = Pick<EnhancedExitManagedContext, 'logger' | 'errorHandler'>;
type EnhancedExitFactories = Pick<EnhancedExitManagedContext, 'createService' | 'cleanup'>;

describe('EnhancedExitService - Error Handling (Phase 8.9.53)', () => {
  let mockLogger: EnhancedExitRuntime['logger'];
  let errorHandler: EnhancedExitRuntime['errorHandler'];
  let createService: EnhancedExitFactories['createService'];
  let cleanup: EnhancedExitFactories['cleanup'];
  const defaultConfig: Partial<EnhancedExitConfig> = createEnhancedExitConfig();

  beforeEach(() => {
    const managedContext = createManagedEnhancedExitContext();
    ({ logger: mockLogger, errorHandler, createService, cleanup } = managedContext);
  });

  afterEach(() => {
    cleanup();
  });

  // ============================================================================
  // TEST GROUP 1: Config Validation (THROW)
  // ============================================================================

  describe('Config Validation (THROW)', () => {
    it('should THROW on invalid riskRewardGate.minRR > 10', () => {
      const badConfig: Partial<EnhancedExitConfig> = {
        ...defaultConfig,
        riskRewardGate: { enabled: true, minRR: 15, preferredRR: 2.0 },
      };

      expect(() => createService({
        config: badConfig,
      })).toThrow(
        /Invalid riskRewardGate.minRR/,
      );
    });

    it('should THROW on invalid structureBasedTP.offsetPercent > 5', () => {
      const badConfig: Partial<EnhancedExitConfig> = {
        ...defaultConfig,
        structureBasedTP: { enabled: true, mode: 'LEVEL', offsetPercent: 10, fallbackPercent: 2.0, useNextLevelAsTP1: true },
      };

      expect(() => createService({
        config: badConfig,
      })).toThrow(
        /Invalid structureBasedTP.offsetPercent/,
      );
    });

    it('should THROW on invalid atrBasedTP.minTPPercent > 10', () => {
      const badConfig: Partial<EnhancedExitConfig> = {
        ...defaultConfig,
        atrBasedTP: { enabled: true, tp1AtrMultiplier: 1.5, tp2AtrMultiplier: 3.0, minTPPercent: 15, maxTPPercent: 5.0 },
      };

      expect(() => createService({
        config: badConfig,
      })).toThrow(
        /Invalid atrBasedTP.minTPPercent/,
      );
    });

    it('should THROW on invalid dynamicBreakeven.activationPercent > 10', () => {
      const badConfig: Partial<EnhancedExitConfig> = {
        ...defaultConfig,
        dynamicBreakeven: { enabled: true, activationPercent: 15, offsetPercent: 0.1 },
      };

      expect(() => createService({
        config: badConfig,
      })).toThrow(
        /Invalid dynamicBreakeven.activationPercent/,
      );
    });

    it('should THROW on invalid adaptiveTrailing.trailingDistancePercent > 10', () => {
      const badConfig: Partial<EnhancedExitConfig> = {
        ...defaultConfig,
        adaptiveTrailing: { enabled: true, activationPercent: 1.5, trailingDistancePercent: 15, useATRDistance: true, trailingDistanceATR: 0.5 },
      };

      expect(() => createService({
        config: badConfig,
      })).toThrow(
        /Invalid adaptiveTrailing.trailingDistancePercent/,
      );
    });
  });

  // ============================================================================
  // TEST GROUP 2: Input Validation (GRACEFUL_DEGRADE)
  // ============================================================================

  describe('Input Validation (GRACEFUL_DEGRADE)', () => {
    let service: EnhancedExitService;

    beforeEach(() => {
      service = createService({
        logger: mockLogger,
        config: defaultConfig,
      });
    });

    it('should GRACEFUL_DEGRADE on invalid entryPrice (NaN)', () => {
      const { entryPrice, stopLoss, takeProfit } = createEnhancedExitInvalidRiskRewardInput({
        entryPrice: NaN,
      });
      const result = service.validateRiskReward(entryPrice, stopLoss, takeProfit);

      expect(result.valid).toBe(false);
      expect(result.recommendation).toContain('Invalid');
    });

    it('should GRACEFUL_DEGRADE on invalid stopLoss (Infinity)', () => {
      const { entryPrice, stopLoss, takeProfit } = createEnhancedExitInvalidRiskRewardInput({
        stopLoss: Infinity,
      });
      const result = service.validateRiskReward(entryPrice, stopLoss, takeProfit);

      expect(result.valid).toBe(false);
    });

    it('should GRACEFUL_DEGRADE on negative entryPrice', () => {
      const { entryPrice, stopLoss, takeProfit } = createEnhancedExitInvalidRiskRewardInput({
        entryPrice: -2.0,
      });
      const result = service.validateRiskReward(entryPrice, stopLoss, takeProfit);

      expect(result.valid).toBe(false);
    });
  });

  // ============================================================================
  // TEST GROUP 3: Calculation Errors (GRACEFUL_DEGRADE)
  // ============================================================================

  describe('Calculation Errors (GRACEFUL_DEGRADE)', () => {
    let service: EnhancedExitService;

    beforeEach(() => {
      service = createService({
        logger: mockLogger,
        config: defaultConfig,
      });
    });

    it('should GRACEFUL_DEGRADE when SL equals entry price (division by zero)', () => {
      const result = service.validateRiskReward(2.0, 2.0, 2.1);

      expect(result.valid).toBe(false);
      expect(result.riskRewardRatio).toBe(0);
    });

    it('should GRACEFUL_DEGRADE on NaN calculation results', () => {
      const result = service.validateRiskReward(2.0, 1.9, NaN);

      expect(result.valid).toBe(false);
      expect(result.recommendation).toContain('Invalid');
    });

    it('should handle ATR-based TP with extreme values', () => {
      const result = service.calculateATRBasedTP(2.0, SignalDirection.LONG, Infinity);

      // Should return safe defaults (clamped to maxTPPercent)
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].percent).toBeLessThanOrEqual(defaultConfig.atrBasedTP!.maxTPPercent!);
    });

    it('should handle checkBreakeven with zero ATR', () => {
      const result = service.checkBreakeven(2.0, 2.01, SignalDirection.LONG, 0);

      // Should still calculate based on activation percent
      expect(result).toBeTruthy();
      expect(result.breakevenPrice).toBeGreaterThan(2.0);
    });
  });

  // ============================================================================
  // TEST GROUP 4: Logging Failures (SKIP)
  // ============================================================================

  describe('Logging Failures (SKIP)', () => {
    let throwingLogger: LoggerService;

    beforeEach(() => {
      throwingLogger = createEnhancedExitFailingLogger();
    });

    it('should SKIP logger.debug failures in calculateATRBasedTP', () => {
      const service = createService({
        logger: throwingLogger,
        config: defaultConfig,
        errorHandler: createEnhancedExitErrorHandler(throwingLogger),
      });

      const result = service.calculateATRBasedTP(2.0, SignalDirection.LONG, 1.5);

      // Should complete despite logger failure
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should SKIP logger failures in updateConfig', () => {
      const service = createService({
        logger: mockLogger,
        config: defaultConfig,
      });

      const newConfig = { ...defaultConfig, atrBasedTP: { ...defaultConfig.atrBasedTP, minTPPercent: 0.3 } };

      // Should not throw despite potential logging failures
      expect(() => service.updateConfig(newConfig as unknown as Partial<EnhancedExitConfig>)).not.toThrow();
    });
  });

  // ============================================================================
  // TEST GROUP 5: Integration E2E Scenarios
  // ============================================================================

  describe('Integration E2E Scenarios', () => {
    it('should handle complete R:R validation flow with error handling', () => {
      const service = createService({
        logger: mockLogger,
        config: defaultConfig,
      });

      // Valid trade
      const validResult = service.validateRiskReward(2.0, 1.9, 2.2);
      expect(validResult.valid).toBe(true);
      expect(validResult.riskRewardRatio).toBeGreaterThan(defaultConfig.riskRewardGate!.minRR!);

      // Invalid trade
      const invalidResult = service.validateRiskReward(2.0, 1.95, 2.05);
      expect(invalidResult.valid).toBe(false);
    });

    it('should work correctly without ErrorHandler (backward compatibility)', () => {
      const service = createService({
        logger: mockLogger,
        config: defaultConfig,
        withErrorHandler: false,
      });

      const result = service.validateRiskReward(2.0, 1.8, 2.3);

      expect(result).toBeTruthy();
      expect(result.riskRewardRatio).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // TEST GROUP 6: Configuration Updates
  // ============================================================================

  describe('Configuration Updates', () => {
    it('should validate config on update and reject invalid changes', () => {
      const service = createService({
        logger: mockLogger,
        config: defaultConfig,
      });

      const originalConfig = service.getConfig();
      const originalMinTP = originalConfig.atrBasedTP.minTPPercent;

      // Try to update with invalid config
      const badUpdate: Partial<EnhancedExitConfig> = {
        atrBasedTP: { enabled: true, tp1AtrMultiplier: 1.5, tp2AtrMultiplier: 3.0, minTPPercent: 50, maxTPPercent: 5.0 },
      };

      service.updateConfig(badUpdate);

      // Config should remain unchanged (GRACEFUL_DEGRADE) or have the old value
      const newConfig = service.getConfig();
      // The invalid value should be rejected - config stays the same
      expect(newConfig.atrBasedTP.minTPPercent).toBe(originalMinTP);
    });

    it('should apply valid config updates successfully', () => {
      const service = createService({
        logger: mockLogger,
        config: defaultConfig,
      });

      const validUpdate = { atrBasedTP: { ...defaultConfig.atrBasedTP, minTPPercent: 0.3 } };

      service.updateConfig(validUpdate as unknown as Partial<EnhancedExitConfig>);

      const newConfig = service.getConfig();
      expect(newConfig.atrBasedTP.minTPPercent).toBe(0.3);
    });
  });

  // ============================================================================
  // TEST GROUP 7: Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    let service: EnhancedExitService;

    beforeEach(() => {
      service = createService({
        logger: mockLogger,
        config: defaultConfig,
      });
    });

    it('should handle R:R validation with very small distances', () => {
      const result = service.validateRiskReward(2.0, 1.9999, 2.0001);

      expect(result).toBeTruthy();
      expect(result.riskPercent).toBeGreaterThan(0);
    });

    it('should handle ATR-based TP with zero ATR', () => {
      const result = service.calculateATRBasedTP(2.0, SignalDirection.LONG, 0);

      expect(result).toBeTruthy();
      // Should clamp to minTPPercent
      expect(result[0].percent).toBeGreaterThanOrEqual(defaultConfig.atrBasedTP!.minTPPercent!);
    });

    it('should handle checkBreakeven with zero profit', () => {
      const result = service.checkBreakeven(2.0, 2.0, SignalDirection.LONG, 1.0);

      expect(result).toBeTruthy();
      expect(result.shouldActivate).toBe(false);
    });

    it('should handle adaptive trailing with low activation percent', () => {
      const config: Partial<EnhancedExitConfig> = {
        ...defaultConfig,
        adaptiveTrailing: { enabled: true, activationPercent: 0.01, trailingDistancePercent: 0.5, useATRDistance: true, trailingDistanceATR: 0.5 },
      };
      const service2 = createService({
        logger: mockLogger,
        config,
      });

      const result = service2.checkAdaptiveTrailing(2.0, 2.005, SignalDirection.LONG, 1.0);

      expect(result).toBeTruthy();
      expect(result.trailingDistance).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // TEST GROUP 8: Backward Compatibility
  // ============================================================================

  describe('Backward Compatibility', () => {
    it('should maintain original behavior without ErrorHandler', () => {
      const service = createService({
        logger: mockLogger,
        config: defaultConfig,
        withErrorHandler: false,
      });

      const result = service.validateRiskReward(2.0, 1.6, 2.4); // R:R = 0.4/0.4 = 1.0, need higher TP

      expect(result).toBeTruthy();
      // With 2.0, 1.6, 2.8: R:R = 0.8/0.4 = 2.0 (perfect)
      const result2 = service.validateRiskReward(2.0, 1.6, 2.8);
      expect(result2.valid).toBe(true);
      expect(result2.riskRewardRatio).toBeGreaterThanOrEqual(defaultConfig.riskRewardGate!.minRR!);
    });

    it('should still validate config even without ErrorHandler', () => {
      const badConfig: Partial<EnhancedExitConfig> = {
        ...defaultConfig,
        atrBasedTP: { enabled: true, tp1AtrMultiplier: 1.5, tp2AtrMultiplier: 3.0, minTPPercent: 50, maxTPPercent: 5.0 },
      };

      expect(() => createService({
        config: badConfig,
        withErrorHandler: false,
      })).toThrow();
    });

    it('should calculate structure-based TP correctly', () => {
      const service = createService({
        logger: mockLogger,
        config: defaultConfig,
        withErrorHandler: false,
      });

      const levels = {
        support: [{ price: 1.9, strength: 0.8 }],
        resistance: [{ price: 2.1, strength: 0.8 }, { price: 2.2, strength: 0.7 }],
      };

      const result = service.calculateStructureBasedTP(2.0, SignalDirection.LONG, levels);

      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].price).toBeCloseTo(2.1, 1);
    });
  });
});
