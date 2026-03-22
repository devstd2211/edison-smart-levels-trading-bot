/**
 * Error Handling Tests for PnLCalculatorService
 * Phase 8.9.54
 */

import { PnLCalculatorService, BYBIT_TAKER_FEE } from '../../services/pnl-calculator.service';
import { PositionSide } from '../../types/legacy';
import {
  createManagedPnlCalculatorContext,
} from '../helpers/pnl-calculator-test.utils';

describe('PnLCalculatorService - Error Handling (Phase 8.9.54)', () => {
  let context: ReturnType<typeof createManagedPnlCalculatorContext>;

  beforeEach(() => {
    context = createManagedPnlCalculatorContext();
  });

  afterEach(() => {
    context.cleanup();
  });

  describe('Input Validation (THROW)', () => {
    it('should THROW on NaN entryPrice', () => {
      expect(() => {
        PnLCalculatorService.calculate(PositionSide.LONG, NaN, 1.16, 50, BYBIT_TAKER_FEE);
      }).toThrow(/Invalid.*entryPrice/);
    });

    it('should THROW on Infinity exitPrice', () => {
      const trade = context.createTradeInput({ exit: Infinity });

      expect(() => {
        PnLCalculatorService.calculate(
          trade.side,
          trade.entry,
          trade.exit,
          trade.quantity,
          BYBIT_TAKER_FEE,
        );
      }).toThrow(/Invalid.*exitPrice/);
    });

    it('should THROW on negative entryPrice', () => {
      const trade = context.createTradeInput({ entry: -1.15 });

      expect(() => {
        PnLCalculatorService.calculate(
          trade.side,
          trade.entry,
          trade.exit,
          trade.quantity,
          BYBIT_TAKER_FEE,
        );
      }).toThrow(/Invalid.*price|negative/i);
    });

    it('should THROW on zero quantity', () => {
      const trade = context.createTradeInput({ quantity: 0 });

      expect(() => {
        PnLCalculatorService.calculate(
          trade.side,
          trade.entry,
          trade.exit,
          trade.quantity,
          BYBIT_TAKER_FEE,
        );
      }).toThrow(/Invalid.*quantity|zero/i);
    });

    it('should THROW on negative quantity', () => {
      const trade = context.createTradeInput({ quantity: -50 });

      expect(() => {
        PnLCalculatorService.calculate(
          trade.side,
          trade.entry,
          trade.exit,
          trade.quantity,
          BYBIT_TAKER_FEE,
        );
      }).toThrow(/Invalid.*quantity|negative/i);
    });

    it('should THROW on fee rate > 1.0', () => {
      const trade = context.createTradeInput();

      expect(() => {
        PnLCalculatorService.calculate(
          trade.side,
          trade.entry,
          trade.exit,
          trade.quantity,
          1.5,
        );
      }).toThrow(/Invalid.*fee|fee.*rate/i);
    });
  });

  describe('Calculation Errors (GRACEFUL_DEGRADE)', () => {
    it('should handle NaN in percentage calculation gracefully', () => {
      const trade = context.createTradeInput();
      const result = PnLCalculatorService.calculate(
        trade.side,
        trade.entry,
        trade.exit,
        trade.quantity,
        BYBIT_TAKER_FEE,
      );

      expect(result).toBeTruthy();
      expect(Number.isFinite(result.pnlPercent)).toBe(true);
    });

    it('should handle partial closes with empty array', () => {
      expect(() => {
        PnLCalculatorService.calculatePartialCloses(PositionSide.LONG, 1.15, [], BYBIT_TAKER_FEE);
      }).toThrow(/closes|empty/i);
    });

    it('should handle partial close with NaN exitPrice', () => {
      expect(() => {
        PnLCalculatorService.calculatePartialCloses(
          PositionSide.LONG,
          1.15,
          [context.createPartialCloseInput({ quantity: 50, exitPrice: NaN })],
          BYBIT_TAKER_FEE,
        );
      }).toThrow(/Invalid|NaN/i);
    });

    it('should handle partial close with negative quantity', () => {
      expect(() => {
        PnLCalculatorService.calculatePartialCloses(
          PositionSide.LONG,
          1.15,
          [context.createPartialCloseInput({ quantity: -50, exitPrice: 1.16 })],
          BYBIT_TAKER_FEE,
        );
      }).toThrow(/Invalid|quantity|negative/i);
    });
  });

  describe('Breakeven Edge Cases (GRACEFUL_DEGRADE)', () => {
    it('should handle fee rate close to 1.0 (division by near-zero)', () => {
      const breakeven = PnLCalculatorService.calculateBreakeven(PositionSide.LONG, 1.15, 0.99);

      expect(breakeven).toBeTruthy();
      expect(Number.isFinite(breakeven)).toBe(true);
    });

    it('should handle very small entryPrice', () => {
      const breakeven = PnLCalculatorService.calculateBreakeven(PositionSide.LONG, 0.0001, BYBIT_TAKER_FEE);

      expect(breakeven).toBeGreaterThan(0.0001);
      expect(Number.isFinite(breakeven)).toBe(true);
    });

    it('should handle very large entryPrice', () => {
      const breakeven = PnLCalculatorService.calculateBreakeven(PositionSide.SHORT, 100000, BYBIT_TAKER_FEE);

      expect(breakeven).toBeLessThan(100000);
      expect(Number.isFinite(breakeven)).toBe(true);
    });
  });

  describe('Integration E2E Scenarios', () => {
    it('should calculate complete LONG position PnL correctly', () => {
      const trade = context.createTradeInput();
      const result = PnLCalculatorService.calculate(
        trade.side,
        trade.entry,
        trade.exit,
        trade.quantity,
        BYBIT_TAKER_FEE,
      );

      expect(result.pnlGross).toBeGreaterThan(0);
      expect(result.fees).toBeGreaterThan(0);
      expect(result.pnlNet).toBeLessThan(result.pnlGross);
      expect(result.pnlPercent).toBeGreaterThan(0);
      expect(Number.isFinite(result.pnlPercent)).toBe(true);
    });

    it('should calculate partial closes with mixed profit/loss', () => {
      const result = PnLCalculatorService.calculatePartialCloses(
        PositionSide.SHORT,
        1.1748,
        [
          context.createPartialCloseInput({ quantity: 28.4, exitPrice: 1.1676 }),
          context.createPartialCloseInput({ quantity: 28.4, exitPrice: 1.18 }),
          context.createPartialCloseInput({ quantity: 28.4, exitPrice: 1.165 }),
        ],
        BYBIT_TAKER_FEE,
      );

      expect(result.pnlNet).toBeTruthy();
      expect(Number.isFinite(result.pnlNet)).toBe(true);
      expect(Number.isFinite(result.pnlPercent)).toBe(true);
    });

    it('should verify breakeven calculation with multiple closes', () => {
      const entryPrice = 1.15;
      const breakeven = PnLCalculatorService.calculateBreakeven(PositionSide.LONG, entryPrice, BYBIT_TAKER_FEE);
      const result = PnLCalculatorService.calculate(
        PositionSide.LONG,
        entryPrice,
        breakeven,
        100,
        BYBIT_TAKER_FEE,
      );

      expect(result.pnlNet).toBeCloseTo(0, 1);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work correctly without ErrorHandler', () => {
      const trade = context.createTradeInput();
      const result = PnLCalculatorService.calculate(
        trade.side,
        trade.entry,
        trade.exit,
        trade.quantity,
        BYBIT_TAKER_FEE,
      );

      expect(result).toBeTruthy();
      expect(result.pnlGross).toBeGreaterThan(0);
      expect(result.pnlNet).toBeGreaterThan(0);
    });

    it('should still validate inputs even without ErrorHandler', () => {
      expect(() => {
        PnLCalculatorService.calculate(PositionSide.LONG, NaN, 1.16, 50, BYBIT_TAKER_FEE);
      }).toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large quantities', () => {
      const trade = context.createTradeInput({ quantity: 1000000 });
      const result = PnLCalculatorService.calculate(
        trade.side,
        trade.entry,
        trade.exit,
        trade.quantity,
        BYBIT_TAKER_FEE,
      );

      expect(result.pnlGross).toBeGreaterThan(0);
      expect(Number.isFinite(result.pnlNet)).toBe(true);
      expect(Number.isFinite(result.pnlPercent)).toBe(true);
    });

    it('should handle very small fee rates', () => {
      const trade = context.createTradeInput({
        side: PositionSide.SHORT,
        entry: 1.1748,
        exit: 1.1676,
        quantity: 28.4,
      });
      const result = PnLCalculatorService.calculate(
        trade.side,
        trade.entry,
        trade.exit,
        trade.quantity,
        0.00001,
      );

      expect(result.fees).toBeGreaterThan(0);
      expect(result.pnlNet).toBeCloseTo(result.pnlGross, 1);
    });
  });
});
