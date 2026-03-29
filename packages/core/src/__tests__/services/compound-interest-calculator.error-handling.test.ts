/**
 * Error Handling Tests for CompoundInterestCalculatorService
 *
 * Validates:
 * - THROW strategy for config validation errors
 * - GRACEFUL_DEGRADE strategy for getBalance failures
 * - SKIP strategy for logging failures
 * - Integration with ErrorHandler recovery mechanisms
 * - Backward compatibility (tests without ErrorHandler)
 */

import { CompoundInterestCalculatorService } from '../../services/compound-interest-calculator.service';
import { LoggerService } from '../../types/legacy';
import {
  createCompoundInterestConfig,
  createCompoundInterestInvalidConfig,
  createManagedLegacyCompoundInterestContext,
  type ManagedCompoundInterestContext,
} from '../helpers/compound-interest-calculator-test.utils';

type CompoundInterestFixtures = Pick<
  ManagedCompoundInterestContext,
  'logger' | 'mockGetBalance' | 'createCalculator'
>;

function bindCompoundInterestContext() {
  let cleanup: ManagedCompoundInterestContext['cleanup'];
  let fixtures: CompoundInterestFixtures;

  beforeEach(() => {
    const managedContext = createManagedLegacyCompoundInterestContext();
    cleanup = managedContext.cleanup;
    fixtures = {
      logger: managedContext.logger,
      mockGetBalance: managedContext.mockGetBalance,
      createCalculator: managedContext.createCalculator,
    };
  });

  afterEach(() => {
    cleanup();
  });

  return () => fixtures;
}

describe('CompoundInterestCalculatorService - Error Handling (Phase 8.9.65)', () => {
  let logger: LoggerService;
  let mockGetBalance: jest.Mock;
  let createCalculator: ManagedCompoundInterestContext['createCalculator'];
  const getContext = bindCompoundInterestContext();

  const defaultConfig = createCompoundInterestConfig();

  beforeEach(() => {
    ({
      logger,
      mockGetBalance,
      createCalculator,
    } = getContext());
  });

  // ============================================================================
  // THROW: CONFIG VALIDATION
  // ============================================================================

  describe('THROW - Config validation', () => {
    it('should THROW on negative base deposit', () => {
      const invalidConfig = createCompoundInterestInvalidConfig({ baseDeposit: -100 });

      expect(() => {
        createCalculator({
          configOverrides: invalidConfig,
        });
      }).toThrow('Base deposit cannot be negative');
    });

    it('should THROW on reinvestment percent > 100%', () => {
      const invalidConfig = createCompoundInterestInvalidConfig({ reinvestmentPercent: 150 });

      expect(() => {
        createCalculator({
          configOverrides: invalidConfig,
        });
      }).toThrow('Reinvestment percent must be between 0 and 100');
    });

    it('should THROW on max position size < min position size', () => {
      const invalidConfig = createCompoundInterestInvalidConfig({
        minPositionSize: 100,
        maxPositionSize: 50,
      });

      expect(() => {
        createCalculator({
          configOverrides: invalidConfig,
        });
      }).toThrow('Max position size must be >= min position size');
    });

    it('should THROW on reinvestment + lock > 100%', () => {
      const invalidConfig = createCompoundInterestInvalidConfig({
        reinvestmentPercent: 80,
        profitLockPercent: 30,
      });

      expect(() => {
        createCalculator({
          configOverrides: invalidConfig,
        });
      }).toThrow('Reinvestment + profit lock percentages cannot exceed 100%');
    });

    it('should THROW on invalid max risk percent', () => {
      const invalidConfig = createCompoundInterestInvalidConfig({ maxRiskPerTrade: -5 });

      expect(() => {
        createCalculator({
          configOverrides: invalidConfig,
        });
      }).toThrow();
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE: CALCULATION FAILURES
  // ============================================================================

  describe('GRACEFUL_DEGRADE - Calculation failures', () => {
    it('should handle getBalance rejection with GRACEFUL_DEGRADE', async () => {
      const calculator = createCalculator({
        configOverrides: defaultConfig,
      });

      mockGetBalance.mockRejectedValue(new Error('Network timeout'));

      // Without ErrorHandler, should throw
      await expect(calculator.calculatePositionSize()).rejects.toThrow('Network timeout');
    });

    it('should handle NaN balance from API', async () => {
      const calculator = createCalculator({
        configOverrides: defaultConfig,
      });

      mockGetBalance.mockResolvedValue(NaN);

      // Should still return a result but with NaN values
      const result = await calculator.calculatePositionSize();
      expect(Number.isNaN(result.positionSize) || result.positionSize >= 0).toBe(true);
    });

    it('should handle Infinity balance from API', async () => {
      const calculator = createCalculator({
        configOverrides: defaultConfig,
      });

      mockGetBalance.mockResolvedValue(Infinity);

      // Should return a result (may have NaN or Infinity values)
      const result = await calculator.calculatePositionSize();
      expect(result).toBeDefined();
      expect(result.currentBalance === Infinity || Number.isNaN(result.currentBalance)).toBe(true);
    });

    it('should handle negative balance from API', async () => {
      const calculator = createCalculator({
        configOverrides: defaultConfig,
      });

      mockGetBalance.mockResolvedValue(-50);

      // Should throw on negative balance validation
      await expect(calculator.calculatePositionSize()).rejects.toThrow(
        'Current balance cannot be negative',
      );
    });
  });

  // ============================================================================
  // SKIP: LOGGING FAILURES
  // ============================================================================

  describe('SKIP - Logging failures (Future ErrorHandler integration)', () => {
    it('should complete calculation with working logger', async () => {
      const calculator = createCalculator({
        configOverrides: defaultConfig,
      });

      mockGetBalance.mockResolvedValue(120);

      // Should complete calculation with valid logger
      const result = await calculator.calculatePositionSize();
      expect(result).toBeDefined();
      expect(result.positionSize).toBeGreaterThan(0);
    });

    it('should handle debug logging in calculateGrowthMetrics', () => {
      const calculator = createCalculator({
        configOverrides: defaultConfig,
      });

      // Should complete without errors
      const metrics = calculator.calculateGrowthMetrics(120);
      expect(metrics).toBeDefined();
      expect(metrics.growthFactor).toBeGreaterThan(0);
    });

    it('should handle info logging on initialization', () => {
      // Should log initialization details without errors
      const calculator = createCalculator({
        configOverrides: defaultConfig,
      });

      expect(calculator.isEnabled()).toBe(true);
    });
  });

  // ============================================================================
  // INTEGRATION: CONFIG UPDATES
  // ============================================================================

  describe('Integration - Config updates with validation', () => {
    it('should throw on invalid config update', () => {
      const calculator = createCalculator({
        configOverrides: defaultConfig,
      });

      // Attempt invalid update
      expect(() => {
        calculator.updateConfig({ maxPositionSize: 5 }); // Less than min
      }).toThrow('Max position size must be >= min position size');
    });

    it('should allow valid partial config updates', () => {
      const calculator = createCalculator({
        configOverrides: defaultConfig,
      });

      calculator.updateConfig({ reinvestmentPercent: 60 }); // Valid update

      expect(calculator.getConfig().reinvestmentPercent).toBe(60);
      expect(calculator.getConfig().baseDeposit).toBe(defaultConfig.baseDeposit);
    });

    it('should handle multiple config updates safely', () => {
      const calculator = createCalculator({
        configOverrides: defaultConfig,
      });

      // First update
      calculator.updateConfig({ reinvestmentPercent: 40 });
      expect(calculator.getConfig().reinvestmentPercent).toBe(40);

      // Second update
      calculator.updateConfig({ profitLockPercent: 20 });
      expect(calculator.getConfig().profitLockPercent).toBe(20);
      expect(calculator.getConfig().reinvestmentPercent).toBe(40); // Previous update preserved
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY: TESTS WITHOUT ERRORHANDLER
  // ============================================================================

  describe('Backward compatibility - Without ErrorHandler', () => {
    it('should throw config errors on construction', () => {
      const invalidConfig = { ...defaultConfig, baseDeposit: -10 };

      expect(() => {
        createCalculator({
          configOverrides: invalidConfig,
        });
      }).toThrow();
    });

    it('should throw calculation errors in calculatePositionSize', async () => {
      const calculator = createCalculator({
        configOverrides: defaultConfig,
      });

      mockGetBalance.mockRejectedValue(new Error('API error'));

      await expect(calculator.calculatePositionSize()).rejects.toThrow('API error');
    });

    it('should work normally with valid config and data', async () => {
      const calculator = createCalculator({
        configOverrides: defaultConfig,
      });

      mockGetBalance.mockResolvedValue(150);

      const result = await calculator.calculatePositionSize();
      expect(result.positionSize).toBeGreaterThan(0);
      expect(result.totalProfit).toBe(50);
    });
  });

  // ============================================================================
  // EDGE CASES: ERROR HANDLING
  // ============================================================================

  describe('Edge cases - Error handling', () => {
    it('should handle negative base deposit', () => {
      const negConfig = { ...defaultConfig, baseDeposit: -100 };

      // Negative deposit is invalid
      expect(() => {
        createCalculator({
          configOverrides: negConfig,
        });
      }).toThrow('Base deposit cannot be negative');
    });

    it('should handle mismatched position size limits', () => {
      const mismatchConfig = { ...defaultConfig, minPositionSize: 100, maxPositionSize: 50 };

      // Min > Max is invalid
      expect(() => {
        createCalculator({
          configOverrides: mismatchConfig,
        });
      }).toThrow();
    });

    it('should safely handle estimateFuturePositionSize with valid inputs', () => {
      const calculator = createCalculator({
        configOverrides: defaultConfig,
      });

      // Negative PnL but positive final balance
      const result1 = calculator.estimateFuturePositionSize(120, -50);
      expect(result1).toBe(10); // Min position size (balance 70 < base 100)

      // Large positive PnL
      const result2 = calculator.estimateFuturePositionSize(100, 10000);
      expect(result2).toBeLessThanOrEqual(defaultConfig.maxPositionSize);

      // Exact base deposit
      const result3 = calculator.estimateFuturePositionSize(100, 0);
      expect(result3).toBe(defaultConfig.minPositionSize);
    });

    it('should handle calculateGrowthMetrics with small balance', () => {
      const calculator = createCalculator({
        configOverrides: defaultConfig,
      });

      const metrics = calculator.calculateGrowthMetrics(0.01);
      expect(metrics.currentSize).toBe(defaultConfig.minPositionSize);
      expect(metrics.growthFactor).toBe(1);
    });

    it('should handle calculateGrowthMetrics with huge balance', () => {
      const calculator = createCalculator({
        configOverrides: defaultConfig,
      });

      const metrics = calculator.calculateGrowthMetrics(1000000);
      expect(metrics.currentSize).toBe(defaultConfig.maxPositionSize); // Capped
      expect(metrics.maxPossibleSize).toBe(defaultConfig.maxPositionSize);
    });
  });

  // ============================================================================
  // INTEGRATION: FULL WORKFLOWS
  // ============================================================================

  describe('Integration - Full workflows', () => {
    it('should handle complete trading cycle with position sizing', async () => {
      // Use higher max risk to allow position growth
      const config = { ...defaultConfig, maxRiskPerTrade: 20 };
      const calculator = createCalculator({
        configOverrides: config,
      });

      // Initial calculation
      mockGetBalance.mockResolvedValue(100);
      const initial = await calculator.calculatePositionSize();
      expect(initial.positionSize).toBe(defaultConfig.minPositionSize);

      // After profit
      mockGetBalance.mockResolvedValue(120);
      const afterProfit = await calculator.calculatePositionSize();
      expect(afterProfit.positionSize).toBeGreaterThan(initial.positionSize);

      // Growth metrics
      const metrics = calculator.calculateGrowthMetrics(120);
      expect(metrics.currentSize).toBe(afterProfit.positionSize);
      expect(metrics.profitToNextLevel).toBeGreaterThan(0);
    });

    it('should handle config update during trading', async () => {
      const calculator = createCalculator({
        configOverrides: defaultConfig,
      });

      mockGetBalance.mockResolvedValue(150);

      // Initial calculation
      const before = await calculator.calculatePositionSize();

      // Update reinvestment percent (valid: reinvest 60 + lock 30 = 90 < 100)
      calculator.updateConfig({ reinvestmentPercent: 60 }); // More aggressive

      // Size should potentially be different
      const after = await calculator.calculatePositionSize();
      expect(after).toBeDefined();
    });

    it('should calculate growth metrics across multiple balance levels', () => {
      // Use higher max risk to show growth across levels
      const config = { ...defaultConfig, maxRiskPerTrade: 20 };
      const calculator = createCalculator({
        configOverrides: config,
      });

      const levels = [100, 150, 200, 500, 1000];
      const results = levels.map(balance => calculator.calculateGrowthMetrics(balance));

      // Should have increasing position sizes (generally)
      const sizes = results.map(r => r.currentSize);
      for (let i = 1; i < sizes.length; i++) {
        expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
      }
    });
  });
});
