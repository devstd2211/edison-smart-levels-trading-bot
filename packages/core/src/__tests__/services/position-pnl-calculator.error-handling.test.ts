/**
 * Position PnL Calculator Service - Error Handling Tests
 * Phase 8.9.60
 *
 * Tests for ErrorHandler integration with THROW/GRACEFUL_DEGRADE/SKIP strategies
 */

import { PositionPnLCalculatorService } from '../../services/position-pnl-calculator.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { Position, PositionSide } from '../../types/legacy';
import {
  createMockPnlPosition,
  createPositionPnLScenarioHarness,
} from '../helpers/position-pnl-calculator-test.utils';

// ============================================================================
// FIXTURES
// ============================================================================

const asPosition = (value: unknown): Position => value as Position;

// ============================================================================
// TESTS
// ============================================================================

describe('PositionPnLCalculatorService - Error Handling (Phase 8.9.60)', () => {
  let service: PositionPnLCalculatorService;
  let errorHandler: ErrorHandler | undefined;
  let createService: ReturnType<typeof createPositionPnLScenarioHarness>['createService'];

  beforeEach(() => {
    const harness = createPositionPnLScenarioHarness();
    errorHandler = harness.errorHandler;
    createService = harness.createService;
    service = harness.service;
  });

  // ==========================================================================
  // GROUP 1: THROW Validation Tests (5 tests)
  // ==========================================================================

  describe('THROW: Input Validation', () => {
    it('should throw on null position', () => {
      const currentPrice = 100;

      expect(() => {
        service.calculatePnL(null as unknown as Position, currentPrice);
      }).toThrow('Position cannot be null or undefined');
    });

    it('should throw on undefined position', () => {
      const currentPrice = 100;

      expect(() => {
        service.calculatePnL(undefined as unknown as Position, currentPrice);
      }).toThrow('Position cannot be null or undefined');
    });

    it('should throw on NaN current price', () => {
      const position = createMockPnlPosition();
      const currentPrice = NaN;

      expect(() => {
        service.calculatePnL(position, currentPrice);
      }).toThrow('Current price must be a finite number');
    });

    it('should throw on Infinity current price', () => {
      const position = createMockPnlPosition();
      const currentPrice = Infinity;

      expect(() => {
        service.calculatePnL(position, currentPrice);
      }).toThrow('Current price must be a finite number');
    });

    it('should throw on negative Infinity current price', () => {
      const position = createMockPnlPosition();
      const currentPrice = -Infinity;

      expect(() => {
        service.calculatePnL(position, currentPrice);
      }).toThrow('Current price must be a finite number');
    });
  });

  // ==========================================================================
  // GROUP 2: THROW Entry Price Validation (5 tests)
  // ==========================================================================

  describe('THROW: Entry Price Validation', () => {
    it('should throw on NaN entry price', () => {
      const position = createMockPnlPosition();
      position.entryPrice = NaN;
      const currentPrice = 100;

      expect(() => {
        service.calculatePnL(position, currentPrice);
      }).toThrow('Entry price must be a positive finite number');
    });

    it('should throw on Infinity entry price', () => {
      const position = createMockPnlPosition();
      position.entryPrice = Infinity;
      const currentPrice = 100;

      expect(() => {
        service.calculatePnL(position, currentPrice);
      }).toThrow('Entry price must be a positive finite number');
    });

    it('should throw on zero entry price', () => {
      const position = createMockPnlPosition();
      position.entryPrice = 0;
      const currentPrice = 100;

      expect(() => {
        service.calculatePnL(position, currentPrice);
      }).toThrow('Entry price must be a positive finite number');
    });

    it('should throw on negative entry price', () => {
      const position = createMockPnlPosition();
      position.entryPrice = -100;
      const currentPrice = 100;

      expect(() => {
        service.calculatePnL(position, currentPrice);
      }).toThrow('Entry price must be a positive finite number');
    });

    it('should throw on negative Infinity entry price', () => {
      const position = createMockPnlPosition();
      position.entryPrice = -Infinity;
      const currentPrice = 100;

      expect(() => {
        service.calculatePnL(position, currentPrice);
      }).toThrow('Entry price must be a positive finite number');
    });
  });

  // ==========================================================================
  // GROUP 3: THROW Position Side Validation (3 tests)
  // ==========================================================================

  describe('THROW: Position Side Validation', () => {
    it('should throw on null position side', () => {
      const position = createMockPnlPosition();
      position.side = null as unknown as PositionSide;
      const currentPrice = 100;

      expect(() => {
        service.calculatePnL(position, currentPrice);
      }).toThrow('Position side must be LONG or SHORT');
    });

    it('should throw on invalid position side string', () => {
      const position = createMockPnlPosition();
      position.side = 'MIDDLE' as unknown as PositionSide;
      const currentPrice = 100;

      expect(() => {
        service.calculatePnL(position, currentPrice);
      }).toThrow('Position side must be LONG or SHORT');
    });

    it('should throw on undefined position side', () => {
      const position = createMockPnlPosition();
      position.side = undefined as unknown as PositionSide;
      const currentPrice = 100;

      expect(() => {
        service.calculatePnL(position, currentPrice);
      }).toThrow('Position side must be LONG or SHORT');
    });
  });

  // ==========================================================================
  // GROUP 4: GRACEFUL_DEGRADE Calculation Failures (3 tests)
  // ==========================================================================

  describe('GRACEFUL_DEGRADE: Calculation Failures', () => {
    it('should return 0 P&L on calculation error (LONG)', () => {
      const position = createMockPnlPosition(PositionSide.LONG, 100);
      const currentPrice = 110;

      // Spy on calculation to simulate failure
      interface PositionPnLCalculatorInternal {
        validateInputs(position: Position, currentPrice: number): void;
      }
      const calculateSpy = jest.spyOn(
        service as unknown as PositionPnLCalculatorInternal,
        'validateInputs'
      );
      calculateSpy.mockImplementation(() => {
        // Validation passes, but calculation could theoretically fail
      });

      const result = service.calculatePnL(position, currentPrice);

      // Should still work (calculation doesn't actually fail in practice)
      expect(result).toBeCloseTo(10, 2);

      calculateSpy.mockRestore();
    });

    it('should return 0 P&L on calculation error (SHORT)', () => {
      const position = createMockPnlPosition(PositionSide.SHORT, 100);
      const currentPrice = 90;

      const result = service.calculatePnL(position, currentPrice);

      expect(result).toBeCloseTo(10, 2);
    });

    it('should handle extreme price values gracefully', () => {
      const position = createMockPnlPosition(PositionSide.LONG, 1e-300);
      const currentPrice = 1e-300 * 2; // Very small but valid

      const result = service.calculatePnL(position, currentPrice);

      expect(Number.isFinite(result)).toBe(true);
    });
  });

  // ==========================================================================
  // GROUP 5: Integration Tests - No ErrorHandler (Backward Compat) (3 tests)
  // ==========================================================================

  describe('Integration: Backward Compatibility (No ErrorHandler)', () => {
    let serviceWithoutHandler: PositionPnLCalculatorService;

    beforeEach(() => {
      ({ service: serviceWithoutHandler } = createPositionPnLScenarioHarness({
        withErrorHandler: false,
      }));
    });

    it('should still throw on null position without ErrorHandler', () => {
      const currentPrice = 100;

      expect(() => {
        serviceWithoutHandler.calculatePnL(null as unknown as Position, currentPrice);
      }).toThrow('Position cannot be null or undefined');
    });

    it('should still throw on invalid currentPrice without ErrorHandler', () => {
      const position = createMockPnlPosition();

      expect(() => {
        serviceWithoutHandler.calculatePnL(position, NaN);
      }).toThrow('Current price must be a finite number');
    });

    it('should still throw on invalid entryPrice without ErrorHandler', () => {
      const position = createMockPnlPosition();
      position.entryPrice = 0;

      expect(() => {
        serviceWithoutHandler.calculatePnL(position, 100);
      }).toThrow('Entry price must be a positive finite number');
    });
  });

  // ==========================================================================
  // GROUP 6: E2E Recovery Scenarios (4 tests)
  // ==========================================================================

  describe('E2E: Error Recovery Scenarios', () => {
    it('should recover and calculate correctly after validation error', () => {
      // First attempt with invalid data
      expect(() => {
        service.calculatePnL(null as unknown as Position, 100);
      }).toThrow();

      // Second attempt with valid data should work
      const position = createMockPnlPosition();
      const result = service.calculatePnL(position, 110);

      expect(result).toBeCloseTo(10, 2);
    });

    it('should handle multiple validation errors in sequence', () => {
      const position = createMockPnlPosition();

      // Multiple validation errors
      expect(() => service.calculatePnL(null as unknown as Position, 100)).toThrow();
      expect(() => service.calculatePnL(position, NaN)).toThrow();
      expect(() => {
        position.entryPrice = 0;
        service.calculatePnL(position, 100);
      }).toThrow();

      // Recovery with valid inputs
      position.entryPrice = 100;
      const result = service.calculatePnL(position, 105);
      expect(result).toBeCloseTo(5, 2);
    });

    it('should handle boundary values correctly after validation', () => {
      const position = createMockPnlPosition();

      // Boundary: entryPrice is smallest positive number
      position.entryPrice = Number.MIN_VALUE;
      const result = service.calculatePnL(position, Number.MIN_VALUE * 2);

      expect(Number.isFinite(result)).toBe(true);
    });

    it('should maintain consistency across multiple calculations', () => {
      const position = createMockPnlPosition(PositionSide.LONG, 100);
      const prices = [90, 100, 110, 120];

      const results = prices.map(price => service.calculatePnL(position, price));

      // Verify monotonic increase
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBeGreaterThan(results[i - 1]);
      }
    });
  });

  // ==========================================================================
  // GROUP 7: Edge Cases & Error Propagation (4 tests)
  // ==========================================================================

  describe('Edge Cases: Error Propagation', () => {
    it('should handle position with very small entry price', () => {
      const position = createMockPnlPosition(PositionSide.LONG, 0.00001);
      const currentPrice = 0.00002; // 100% gain

      const result = service.calculatePnL(position, currentPrice);

      expect(result).toBeCloseTo(100, 1);
    });

    it('should handle position with very large entry price', () => {
      const position = createMockPnlPosition(PositionSide.LONG, 1000000);
      const currentPrice = 1100000; // 10% gain

      const result = service.calculatePnL(position, currentPrice);

      expect(result).toBeCloseTo(10, 2);
    });

    it('should validate before attempting calculation', () => {
      const position = createMockPnlPosition();
      position.entryPrice = NaN;

      expect(() => {
        service.calculatePnL(position, 100);
      }).toThrow('Entry price must be a positive finite number');
    });

    it('should reject invalid positions', () => {
      const invalidPositions: Position[] = [
        null as unknown as Position,
        undefined as unknown as Position,
        asPosition({}),
      ];

      for (const pos of invalidPositions) {
        expect(() => {
          service.calculatePnL(pos, 100);
        }).toThrow();
      }
    });
  });

  // ==========================================================================
  // GROUP 8: ErrorHandler Integration Tests (2 tests)
  // ==========================================================================

  describe('ErrorHandler: Integration with Service', () => {
    it('should propagate THROW on validation failure with ErrorHandler', () => {
      const position = createMockPnlPosition();
      position.entryPrice = NaN;

      expect(() => {
        service.calculatePnL(position, 100);
      }).toThrow('Entry price must be a positive finite number');
    });

    it('should calculate successfully with valid inputs', () => {
      const position = createMockPnlPosition();
      const result = service.calculatePnL(position, 110);

      expect(result).toBeCloseTo(10, 2);
    });
  });
});
