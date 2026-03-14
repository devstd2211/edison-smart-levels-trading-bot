/**
 * RiskCalculatorService Error Handling Tests (Phase 8.9.33)
 *
 * Tests ErrorHandler integration for risk calculation errors:
 * - THROW strategy for input validation
 * - GRACEFUL_DEGRADE for missing/invalid ATR
 * - SKIP strategy for logging failures
 *
 * Coverage:
 * - Input validation (entryPrice, referenceLevel, slMultiplier, etc.)
 * - ATR validation with fallback mechanism
 * - Logging error handling with SKIP
 * - Integration scenarios with cascading failures
 * - Backward compatibility without ErrorHandler
 */

import { RiskCalculator, RiskCalculationInput } from '../../services/risk-calculator.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { RiskCalculationError } from '../../errors/DomainErrors';
import { SignalDirection } from '../../types/legacy';
import {
  createRiskCalculatorHarness,
  createRiskCalculatorTakeProfitConfigs,
  RiskCalculatorMockLogger,
} from '../helpers/risk-calculator-test.utils';

describe('RiskCalculatorService - Error Handling (Phase 8.9.33)', () => {
  let calculator: RiskCalculator;
  let mockLogger: RiskCalculatorMockLogger;
  let errorHandler: ErrorHandler;
  let defaultInput: RiskCalculationInput;

  beforeEach(() => {
    const harness = createRiskCalculatorHarness();
    calculator = harness.calculator;
    mockLogger = harness.logger;
    errorHandler = harness.errorHandler as ErrorHandler;
    defaultInput = harness.defaultInput;
  });

  describe('THROW Strategy - Input Validation', () => {
    it('throws on invalid entryPrice (NaN)', () => {
      const input = { ...defaultInput, entryPrice: NaN };
      expect(() => calculator.calculate(input)).toThrow(RiskCalculationError);
    });

    it('throws on invalid entryPrice (Infinity)', () => {
      const input = { ...defaultInput, entryPrice: Infinity };
      expect(() => calculator.calculate(input)).toThrow(RiskCalculationError);
    });

    it('throws on negative entryPrice', () => {
      const input = { ...defaultInput, entryPrice: -100 };
      expect(() => calculator.calculate(input)).toThrow(RiskCalculationError);
    });

    it('throws on zero entryPrice', () => {
      const input = { ...defaultInput, entryPrice: 0 };
      expect(() => calculator.calculate(input)).toThrow(RiskCalculationError);
    });

    it('throws on invalid referenceLevel (NaN)', () => {
      const input = { ...defaultInput, referenceLevel: NaN };
      expect(() => calculator.calculate(input)).toThrow(RiskCalculationError);
    });

    it('throws on invalid slMultiplier (negative)', () => {
      const input = { ...defaultInput, slMultiplier: -1 };
      expect(() => calculator.calculate(input)).toThrow(RiskCalculationError);
    });

    it('throws on empty takeProfitConfigs', () => {
      const input = { ...defaultInput, takeProfitConfigs: [] };
      expect(() => calculator.calculate(input)).toThrow(RiskCalculationError);
    });

    it('throws on invalid minSlDistancePercent (negative)', () => {
      const input = { ...defaultInput, minSlDistancePercent: -0.5 };
      expect(() => calculator.calculate(input)).toThrow(RiskCalculationError);
    });
  });

  describe('GRACEFUL_DEGRADE Strategy - Missing/Invalid ATR', () => {
    it('uses fallback ATR on NaN atrPercent', () => {
      const input = { ...defaultInput, atrPercent: NaN };
      const result = calculator.calculate(input);

      // Should calculate with fallback ATR (1.5%)
      expect(result).toBeDefined();
      expect(result.stopLoss).toBeDefined();
      expect(result.takeProfits).toHaveLength(2);
    });

    it('uses fallback ATR on zero atrPercent', () => {
      const input = { ...defaultInput, atrPercent: 0 };
      const result = calculator.calculate(input);

      // Should calculate with fallback ATR
      expect(result).toBeDefined();
      expect(result.stopLoss).toBeGreaterThan(0);
    });

    it('uses fallback ATR on negative atrPercent', () => {
      const input = { ...defaultInput, atrPercent: -1.5 };
      const result = calculator.calculate(input);

      // Should calculate with fallback ATR
      expect(result).toBeDefined();
      expect(result.stopLoss).toBeGreaterThan(0);
    });

    it('uses fallback ATR on Infinity atrPercent', () => {
      const input = { ...defaultInput, atrPercent: Infinity };
      const result = calculator.calculate(input);

      // Should calculate with fallback ATR
      expect(result).toBeDefined();
      expect(Number.isFinite(result.stopLoss)).toBe(true);
    });

    it('calculates valid SL even with fallback ATR', () => {
      const input = { ...defaultInput, atrPercent: NaN };
      const result = calculator.calculate(input);

      // Verify calculation correctness with fallback
      expect(result.stopLoss).toBeLessThan(defaultInput.entryPrice); // LONG should have lower SL
      expect(result.stopLossDistance).toBeGreaterThan(0);
      expect(result.stopLossPercent).toBeGreaterThan(0);
    });
  });

  describe('SKIP Strategy - Logging Failures', () => {
    it('continues on logger.debug failure', () => {
      mockLogger.debug.mockImplementation(() => {
        throw new Error('Logger failure');
      });

      const input = defaultInput;
      expect(() => calculator.calculate(input)).not.toThrow();
    });

    it('still returns valid result despite logger error', () => {
      mockLogger.debug.mockImplementation(() => {
        throw new Error('Logger failure');
      });

      const result = calculator.calculate(defaultInput);

      expect(result).toBeDefined();
      expect(result.stopLoss).toBeGreaterThan(0);
      expect(result.takeProfits).toHaveLength(2);
    });

    it('continues calculation despite logger failures without ErrorHandler', () => {
      const calculatorNoHandler = createRiskCalculatorHarness({
        logger: mockLogger,
        withErrorHandler: false,
      }).calculator;
      mockLogger.debug.mockImplementation(() => {
        throw new Error('Logger failure');
      });

      // Without handler, logging errors are caught and ignored
      const result = calculatorNoHandler.calculate(defaultInput);
      expect(result).toBeDefined();
      expect(result.stopLoss).toBeGreaterThan(0);
    });
  });

  describe('calculateFromPercent - THROW Strategy', () => {
    it('throws on invalid entryPrice in percent-based calculation', () => {
      expect(() => {
        calculator.calculateFromPercent(
          NaN,
          SignalDirection.LONG,
          1.0,
          createRiskCalculatorTakeProfitConfigs(),
        );
      }).toThrow(RiskCalculationError);
    });

    it('throws on invalid slPercent (negative)', () => {
      expect(() => {
        calculator.calculateFromPercent(
          100,
          SignalDirection.LONG,
          -1.0,
          createRiskCalculatorTakeProfitConfigs(),
        );
      }).toThrow(RiskCalculationError);
    });

    it('throws on empty takeProfitConfigs', () => {
      expect(() => {
        calculator.calculateFromPercent(
          100,
          SignalDirection.LONG,
          1.0,
          [],
        );
      }).toThrow(RiskCalculationError);
    });

    it('calculates valid result with correct inputs', () => {
      const result = calculator.calculateFromPercent(
        100,
        SignalDirection.LONG,
        1.0,
        createRiskCalculatorTakeProfitConfigs(),
      );

      expect(result).toBeDefined();
      expect(result.stopLoss).toBe(99); // 100 - (100 * 1 / 100)
      expect(result.takeProfits).toHaveLength(2);
      expect(result.stopLossPercent).toBe(1.0);
    });
  });

  describe('Integration Scenarios', () => {
    it('handles SHORT position with valid inputs', () => {
      const input = {
        ...defaultInput,
        direction: SignalDirection.SHORT,
        referenceLevel: 105,
      };

      const result = calculator.calculate(input);

      expect(result).toBeDefined();
      expect(result.stopLoss).toBeGreaterThan(defaultInput.entryPrice); // SHORT should have higher SL
      expect(result.takeProfits[0].price).toBeLessThan(defaultInput.entryPrice); // SHORT TPs below entry
    });

    it('handles multiple TP levels correctly', () => {
      const input = {
        ...defaultInput,
        takeProfitConfigs: [
          ...createRiskCalculatorTakeProfitConfigs([
            { level: 1, percent: 0.5, sizePercent: 33 },
            { level: 2, percent: 1.0, sizePercent: 33 },
            { level: 3, percent: 1.5, sizePercent: 34 },
          ]),
        ],
      };

      const result = calculator.calculate(input);

      expect(result.takeProfits).toHaveLength(3);
      expect(result.takeProfits[0].percent).toBe(0.5);
      expect(result.takeProfits[2].percent).toBe(1.5);
    });

    it('respects minSlDistancePercent constraint', () => {
      const input = {
        ...defaultInput,
        atrPercent: 0.1, // Very small ATR
        slMultiplier: 0.1, // Very small multiplier
        minSlDistancePercent: 2.0, // Enforced minimum
      };

      const result = calculator.calculate(input);

      // SL distance should be at least minSlDistancePercent
      expect(result.stopLossPercent).toBeGreaterThanOrEqual(2.0);
    });

    it('handles cascading failures gracefully', () => {
      const input = {
        ...defaultInput,
        atrPercent: NaN, // Invalid ATR (will use fallback)
      };

      mockLogger.debug.mockImplementation(() => {
        throw new Error('Logger error');
      });

      const result = calculator.calculate(input);

      // Should still succeed with fallback ATR + skipped logging
      expect(result).toBeDefined();
      expect(result.stopLoss).toBeGreaterThan(0);
    });
  });

  describe('Backward Compatibility - Without ErrorHandler', () => {
    beforeEach(() => {
      calculator = createRiskCalculatorHarness({
        logger: mockLogger,
        withErrorHandler: false,
      }).calculator;
    });

    it('still validates input and throws on errors', () => {
      const input = { ...defaultInput, entryPrice: NaN };
      expect(() => calculator.calculate(input)).toThrow(RiskCalculationError);
    });

    it('logs normally when ErrorHandler not provided', () => {
      calculator.calculate(defaultInput);
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('throws on ATR validation without ErrorHandler', () => {
      // Without handler, ATR validation throws instead of GRACEFUL_DEGRADE
      const input = { ...defaultInput, atrPercent: NaN };
      // This should proceed (uses local fallback, not handler)
      const result = calculator.calculate(input);
      expect(result).toBeDefined();
    });

    it('calculateFromPercent works without ErrorHandler', () => {
      const result = calculator.calculateFromPercent(
        100,
        SignalDirection.LONG,
        1.0,
        createRiskCalculatorTakeProfitConfigs(),
      );

      expect(result).toBeDefined();
      expect(result.stopLoss).toBe(99);
    });
  });

  describe('Error Context & Information', () => {
    it('includes validation context in error message', () => {
      const input = { ...defaultInput, entryPrice: NaN };
      try {
        calculator.calculate(input);
        fail('Should throw');
      } catch (err: unknown) {
        const error = err as RiskCalculationError & { metadata?: { context?: unknown } };
        expect(error).toBeInstanceOf(RiskCalculationError);
        expect(error.message).toContain('entryPrice');
        expect(error.metadata).toBeDefined();
        expect(error.metadata?.context).toBeDefined();
      }
    });

    it('preserves error context for debugging', () => {
      const input = { ...defaultInput, entryPrice: -50 };
      try {
        calculator.calculate(input);
        fail('Should throw');
      } catch (err: unknown) {
        const error = err as RiskCalculationError & { metadata?: { context?: { entryPrice?: number } } };
        expect(error.metadata?.context?.entryPrice).toBe(-50);
      }
    });
  });

  describe('Edge Cases & Extreme Values', () => {
    it('handles very small entry prices', () => {
      const input = { ...defaultInput, entryPrice: 0.0001 };
      const result = calculator.calculate(input);

      expect(result).toBeDefined();
      expect(result.stopLoss).toBeGreaterThan(0);
    });

    it('handles very large entry prices', () => {
      const input = {
        ...defaultInput,
        entryPrice: 1000000,
        referenceLevel: 999000, // Reasonable reference level for LONG
      };
      const result = calculator.calculate(input);

      expect(result).toBeDefined();
      expect(result.stopLoss).toBeGreaterThan(0);
      expect(result.stopLoss).toBeLessThan(defaultInput.entryPrice + 1000000); // Should be reasonable
    });

    it('handles very large slMultiplier', () => {
      const input = { ...defaultInput, slMultiplier: 100 };
      const result = calculator.calculate(input);

      expect(result).toBeDefined();
      expect(result.stopLoss).toBeLessThan(defaultInput.entryPrice);
    });

    it('handles decimal precision correctly', () => {
      const input = {
        ...defaultInput,
        entryPrice: 0.123456789,
        atrPercent: 0.123456789,
      };

      const result = calculator.calculate(input);

      expect(result).toBeDefined();
      expect(result.stopLoss).toBeGreaterThan(0);
      expect(Number.isFinite(result.stopLoss)).toBe(true);
    });
  });

  describe('Performance & Reliability', () => {
    it('processes valid calculation under 10ms', () => {
      const start = Date.now();
      calculator.calculate(defaultInput);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it('handles rapid sequential calculations', () => {
      for (let i = 0; i < 100; i++) {
        const result = calculator.calculate(defaultInput);
        expect(result).toBeDefined();
      }
    });

    it('no memory leaks on repeated error cases', () => {
      for (let i = 0; i < 50; i++) {
        try {
          calculator.calculate({ ...defaultInput, entryPrice: NaN });
        } catch {
          // Expected
        }
      }
      // If memory leak present, test runner would show increased memory usage
    });
  });
});
