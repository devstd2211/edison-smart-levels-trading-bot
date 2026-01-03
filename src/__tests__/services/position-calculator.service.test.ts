/**
 * Tests for PositionCalculatorService
 *
 * Critical service - all position sizing logic:
 * - Quantity calculations
 * - Rounding to exchange precision
 * - Validation against limits
 * - Edge cases (very high/low prices, different steps)
 */

import { PositionCalculatorService, ExchangeLimits } from '../../services/position-calculator.service';
import { LoggerService, LogLevel } from '../../types';

// ============================================================================
// HELPERS
// ============================================================================

const createLogger = (): LoggerService => {
  return new LoggerService(LogLevel.ERROR, './logs', false);
};

const createStandardLimits = (): ExchangeLimits => ({
  qtyStep: '0.1',        // APEXUSDT standard
  tickSize: '0.0001',
  minOrderQty: '0.1',
  maxOrderQty: '100000',
});

// ============================================================================
// TESTS
// ============================================================================

describe('PositionCalculatorService', () => {
  let calculator: PositionCalculatorService;
  let logger: LoggerService;

  beforeEach(() => {
    logger = createLogger();
    calculator = new PositionCalculatorService(logger);
  });

  describe('Quantity calculation', () => {
    it('should calculate quantity correctly with standard values', () => {
      const limits = createStandardLimits();

      const result = calculator.calculateQuantity(
        10,    // 10 USDT
        10,    // 10x leverage
        1.20,  // price
        limits,
      );

      // (10 * 10) / 1.20 = 83.333... → rounded to 83.3 (qtyStep = 0.1)
      expect(result.isValid).toBe(true);
      expect(result.roundedQuantity).toBe('83.3');
      expect(result.quantity).toBeCloseTo(83.333, 2);
      expect(result.marginUsed).toBeCloseTo(10, 2);
      expect(result.validationErrors).toHaveLength(0);
    });

    it('should handle different qtyStep precision (0.01)', () => {
      const limits: ExchangeLimits = {
        ...createStandardLimits(),
        qtyStep: '0.01', // BTCUSDT uses 0.01
      };

      const result = calculator.calculateQuantity(10, 10, 1.20, limits);

      // Should round to 2 decimals
      expect(result.roundedQuantity).toBe('83.33');
    });

    it('should handle integer qtyStep (1.0)', () => {
      const limits: ExchangeLimits = {
        ...createStandardLimits(),
        qtyStep: '1',
        minOrderQty: '1',
      };

      const result = calculator.calculateQuantity(10, 10, 1.20, limits);

      // Should round to integer
      expect(result.roundedQuantity).toBe('83');
    });

    it('should calculate margin correctly', () => {
      const limits = createStandardLimits();

      const result = calculator.calculateQuantity(10, 10, 1.20, limits);

      // Notional = 83.3 * 1.20 = 99.96
      // Margin = 99.96 / 10 = 9.996
      expect(result.notionalValue).toBeCloseTo(99.96, 1);
      expect(result.marginUsed).toBeCloseTo(9.996, 2);
    });
  });

  describe('Edge cases - price ranges', () => {
    it('should handle very low price (0.0001)', () => {
      const limits = createStandardLimits();

      const result = calculator.calculateQuantity(10, 10, 0.0001, limits);

      // (10 * 10) / 0.0001 = 1,000,000 → exceeds maxOrderQty (100,000)
      expect(result.isValid).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.validationErrors[0]).toContain('exceeds maximum');
    });

    it('should handle very high price (100000)', () => {
      const limits = createStandardLimits();

      const result = calculator.calculateQuantity(10, 10, 100000, limits);

      // (10 * 10) / 100000 = 0.001 → rounded to 0 (below minOrderQty)
      expect(result.isValid).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
    });

    it('should handle normal altcoin price (1.5)', () => {
      const limits = createStandardLimits();

      const result = calculator.calculateQuantity(10, 10, 1.5, limits);

      // (10 * 10) / 1.5 = 66.666... → 66.6
      expect(result.roundedQuantity).toBe('66.6');
      expect(result.isValid).toBe(true);
    });
  });

  describe('Edge cases - leverage', () => {
    it('should handle low leverage (1x)', () => {
      const limits = createStandardLimits();

      const result = calculator.calculateQuantity(10, 1, 1.20, limits);

      // (10 * 1) / 1.20 = 8.333... → 8.3
      expect(result.roundedQuantity).toBe('8.3');
      expect(result.marginUsed).toBeCloseTo(10, 1);
    });

    it('should handle high leverage (100x)', () => {
      const limits = createStandardLimits();

      const result = calculator.calculateQuantity(10, 100, 1.20, limits);

      // (10 * 100) / 1.20 = 833.333... → 833.3
      expect(result.roundedQuantity).toBe('833.3');
      expect(result.marginUsed).toBeCloseTo(10, 1);
    });
  });

  describe('Validation - quantity limits', () => {
    it('should reject quantity below minOrderQty', () => {
      const limits: ExchangeLimits = {
        qtyStep: '0.1',
        tickSize: '0.0001',
        minOrderQty: '100', // High minimum
      };

      const result = calculator.calculateQuantity(10, 10, 1.20, limits);

      // 83.3 < 100 (minimum)
      expect(result.isValid).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.validationErrors[0]).toContain('below minimum');
    });

    it('should reject quantity above maxOrderQty', () => {
      const limits: ExchangeLimits = {
        qtyStep: '0.1',
        tickSize: '0.0001',
        minOrderQty: '0.1',
        maxOrderQty: '50', // Low maximum
      };

      const result = calculator.calculateQuantity(10, 10, 1.20, limits);

      // 83.3 > 50 (maximum)
      expect(result.isValid).toBe(false);
      expect(result.validationErrors.length).toBeGreaterThan(0);
      expect(result.validationErrors[0]).toContain('exceeds maximum');
    });

    it('should accept quantity within limits', () => {
      const limits: ExchangeLimits = {
        qtyStep: '0.1',
        tickSize: '0.0001',
        minOrderQty: '0.1',
        maxOrderQty: '1000',
      };

      const result = calculator.calculateQuantity(10, 10, 1.20, limits);

      expect(result.isValid).toBe(true);
      expect(result.validationErrors).toHaveLength(0);
    });
  });

  describe('Validation - input errors', () => {
    it('should reject negative position size', () => {
      const limits = createStandardLimits();

      const result = calculator.calculateQuantity(-10, 10, 1.20, limits);

      expect(result.isValid).toBe(false);
      expect(result.validationErrors).toContain('Position size must be positive');
    });

    it('should reject zero leverage', () => {
      const limits = createStandardLimits();

      const result = calculator.calculateQuantity(10, 0, 1.20, limits);

      expect(result.isValid).toBe(false);
      expect(result.validationErrors).toContain('Leverage must be positive');
    });

    it('should reject negative price', () => {
      const limits = createStandardLimits();

      const result = calculator.calculateQuantity(10, 10, -1.20, limits);

      expect(result.isValid).toBe(false);
      expect(result.validationErrors).toContain('Price must be positive');
    });
  });

  describe('Rounding to step', () => {
    it('should round down to step (0.1)', () => {
      const result = calculator.roundToStep(83.577, '0.1');
      expect(result).toBe('83.5');
    });

    it('should round down to step (0.01)', () => {
      const result = calculator.roundToStep(83.577, '0.01');
      expect(result).toBe('83.57');
    });

    it('should round down to step (1.0)', () => {
      const result = calculator.roundToStep(83.577, '1');
      expect(result).toBe('83');
    });

    it('should handle exact multiples of step', () => {
      const result = calculator.roundToStep(83.5, '0.1');
      expect(result).toBe('83.5');
    });

    it('should throw on invalid step', () => {
      expect(() => {
        calculator.roundToStep(100, '0');
      }).toThrow('Invalid step size');
    });
  });

  describe('Price rounding', () => {
    it('should round price to tickSize (0.0001)', () => {
      const result = calculator.roundPrice(1.00249, '0.0001');

      expect(result.isValid).toBe(true);
      expect(result.roundedPrice).toBe('1.0024');
    });

    it('should round price to tickSize (0.01)', () => {
      const result = calculator.roundPrice(1.00249, '0.01');

      expect(result.isValid).toBe(true);
      expect(result.roundedPrice).toBe('1.00');
    });

    it('should handle invalid tickSize gracefully', () => {
      const result = calculator.roundPrice(1.00249, '0');

      expect(result.isValid).toBe(false);
      expect(result.roundedPrice).toBe('1.00249'); // Returns original
    });
  });

  describe('Position value calculations', () => {
    it('should calculate notional and margin correctly', () => {
      const result = calculator.calculatePositionValue(83.3, 1.20, 10);

      expect(result.notionalValue).toBeCloseTo(99.96, 2);
      expect(result.marginUsed).toBeCloseTo(9.996, 2);
    });

    it('should handle 1x leverage', () => {
      const result = calculator.calculatePositionValue(100, 50, 1);

      expect(result.notionalValue).toBe(5000);
      expect(result.marginUsed).toBe(5000);
    });

    it('should handle high leverage (100x)', () => {
      const result = calculator.calculatePositionValue(1000, 50, 100);

      expect(result.notionalValue).toBe(50000);
      expect(result.marginUsed).toBe(500);
    });
  });

  describe('Real-world scenarios', () => {
    it('should match yesterday successful order (APEXUSDT)', () => {
      // Real trade: qty=81.5, price=1.227
      const limits = createStandardLimits();

      const result = calculator.calculateQuantity(10, 10, 1.227, limits);

      // (10 * 10) / 1.227 = 81.499... → 81.4 (rounds DOWN)
      expect(result.roundedQuantity).toBe('81.4');
      expect(result.isValid).toBe(true);
    });

    it('should prevent today failed order (83.57 → 83.5)', () => {
      const limits = createStandardLimits();

      const result = calculator.calculateQuantity(10, 10, 1.1962, limits);

      // (10 * 10) / 1.1962 = 83.577... → 83.5 (NOT 83.57!)
      expect(result.roundedQuantity).toBe('83.5');
      expect(result.isValid).toBe(true);
    });

    it('should work for BTCUSDT (different qtyStep)', () => {
      const limits: ExchangeLimits = {
        qtyStep: '0.001',
        tickSize: '0.01',
        minOrderQty: '0.001',
        maxOrderQty: '100',
      };

      const result = calculator.calculateQuantity(10, 10, 50000, limits);

      // (10 * 10) / 50000 = 0.002 → 0.002
      expect(result.roundedQuantity).toBe('0.002');
      expect(result.isValid).toBe(true);
    });
  });
});
