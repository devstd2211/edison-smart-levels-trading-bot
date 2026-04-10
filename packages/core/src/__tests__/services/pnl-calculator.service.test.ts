/**
 * Tests for PnLCalculatorService
 */

import { PnLCalculatorService, BYBIT_TAKER_FEE } from '../../services/pnl-calculator.service';
import { PositionSide } from '../../types/legacy';
import {
  createManagedPnlCalculatorContext,
  createBybitPartialCloseSet,
  createBybitTradeValidationSet,
  createPartialCloseInput,
  createPnlTradeInput,
} from '../helpers/pnl-calculator-test.utils';

describe('PnLCalculatorService', () => {
  type PnlCalculatorFactories = {
    createTradeInput: ReturnType<typeof createManagedPnlCalculatorContext>['createTradeInput'];
    createPartialCloseInput: ReturnType<
      typeof createManagedPnlCalculatorContext
    >['createPartialCloseInput'];
    createPartialCloses: ReturnType<typeof createManagedPnlCalculatorContext>['createPartialCloses'];
    createTradeValidationSet: ReturnType<
      typeof createManagedPnlCalculatorContext
    >['createTradeValidationSet'];
  };
  type PnlCalculatorCleanup = ReturnType<typeof createManagedPnlCalculatorContext>['cleanup'];

  let createTradeInput: PnlCalculatorFactories['createTradeInput'];
  let createPartialCloseInputFromFixtures: PnlCalculatorFactories['createPartialCloseInput'];
  let createPartialCloses: PnlCalculatorFactories['createPartialCloses'];
  let createTradeValidationSet: PnlCalculatorFactories['createTradeValidationSet'];

  function bindPnlCalculatorFixtures() {
    let cleanup: PnlCalculatorCleanup;
    let factories: PnlCalculatorFactories;

    beforeEach(() => {
      const {
        createTradeInput,
        createPartialCloseInput,
        createPartialCloses,
        createTradeValidationSet,
        cleanup: managedCleanup,
      } = createManagedPnlCalculatorContext();
      factories = {
        createTradeInput,
        createPartialCloseInput,
        createPartialCloses,
        createTradeValidationSet,
      };
      cleanup = managedCleanup;
    });

    afterEach(() => {
      cleanup();
    });

    return () => factories;
  }

  const getFixtures = bindPnlCalculatorFixtures();

  beforeEach(() => {
    const factories = getFixtures();
    createTradeInput = factories.createTradeInput;
    createPartialCloseInputFromFixtures = factories.createPartialCloseInput;
    createPartialCloses = factories.createPartialCloses;
    createTradeValidationSet = factories.createTradeValidationSet;
  });

  describe('calculate', () => {
    it('should calculate PnL correctly for SHORT with profit', () => {
      const trade = createTradeInput({
        side: PositionSide.SHORT,
        entry: 1.1316,
        exit: 1.1428,
        quantity: 88.4,
      });
      const result = PnLCalculatorService.calculate(
        trade.side,
        trade.entry,
        trade.exit,
        trade.quantity,
        BYBIT_TAKER_FEE,
      );

      expect(result.pnlGross).toBeCloseTo(-0.9901, 3);
      expect(result.fees).toBeCloseTo(0.1106, 3);
      expect(result.pnlNet).toBeCloseTo(-1.1007, 3);
      expect(result.pnlPercent).toBeCloseTo(-0.99, 2);
    });

    it('should calculate PnL correctly for SHORT partial close (TP1)', () => {
      const trade = createTradeInput({
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
        BYBIT_TAKER_FEE,
      );

      expect(result.pnlGross).toBeCloseTo(0.2045, 3);
      expect(result.pnlNet).toBeGreaterThan(0.16);
      expect(result.pnlNet).toBeLessThan(0.21);
    });

    it('should calculate PnL correctly for SHORT partial close (TP3)', () => {
      const trade = createTradeInput({
        side: PositionSide.SHORT,
        entry: 1.1748,
        exit: 1.1363,
        quantity: 28.4,
      });
      const result = PnLCalculatorService.calculate(
        trade.side,
        trade.entry,
        trade.exit,
        trade.quantity,
        BYBIT_TAKER_FEE,
      );

      expect(result.pnlGross).toBeCloseTo(1.0934, 3);
      expect(result.pnlNet).toBeCloseTo(1.0573, 2);
    });

    it('should calculate PnL correctly for LONG with loss', () => {
      const trade = createTradeInput({
        side: PositionSide.LONG,
        entry: 1.1517,
        exit: 1.1492,
        quantity: 86.8,
      });
      const result = PnLCalculatorService.calculate(
        trade.side,
        trade.entry,
        trade.exit,
        trade.quantity,
        BYBIT_TAKER_FEE,
      );

      expect(result.pnlGross).toBeCloseTo(-0.217, 2);
      expect(result.pnlNet).toBeCloseTo(-0.328, 2);
      expect(result.pnlPercent).toBeLessThan(0);
    });

    it('should calculate PnL correctly for LONG with profit', () => {
      const trade = createTradeInput();
      const result = PnLCalculatorService.calculate(
        trade.side,
        trade.entry,
        trade.exit,
        trade.quantity,
        BYBIT_TAKER_FEE,
      );

      expect(result.pnlGross).toBeCloseTo(0.5, 2);
      expect(result.pnlNet).toBeLessThan(result.pnlGross);
      expect(result.pnlPercent).toBeGreaterThan(0);
    });

    it('should return zero PnL for same entry/exit price (before fees)', () => {
      const trade = createTradeInput({ exit: 1.15 });
      const result = PnLCalculatorService.calculate(
        trade.side,
        trade.entry,
        trade.exit,
        trade.quantity,
        BYBIT_TAKER_FEE,
      );

      expect(result.pnlGross).toBe(0);
      expect(result.pnlNet).toBeLessThan(0);
      expect(result.fees).toBeGreaterThan(0);
    });

    it('should handle zero fee rate', () => {
      const trade = createTradeInput({
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
        0,
      );

      expect(result.fees).toBe(0);
      expect(result.pnlNet).toBe(result.pnlGross);
    });
  });

  describe('calculatePartialCloses', () => {
    it('should sum PnL from multiple partial closes', () => {
      const result = PnLCalculatorService.calculatePartialCloses(
        PositionSide.SHORT,
        1.1748,
        createPartialCloses(),
        BYBIT_TAKER_FEE,
      );

      expect(result.pnlNet).toBeCloseTo(1.5607, 2);
      expect(result.pnlGross).toBeGreaterThan(result.pnlNet);
    });

    it('should calculate correct weighted average percentage', () => {
      const result = PnLCalculatorService.calculatePartialCloses(
        PositionSide.SHORT,
        1.1748,
        createPartialCloses(),
        BYBIT_TAKER_FEE,
      );

      expect(result.pnlPercent).toBeGreaterThan(0);
      expect(result.pnlPercent).toBeLessThan(5);
    });

    it('should handle single close', () => {
      const close = createPartialCloseInputFromFixtures({ quantity: 85.2, exitPrice: 1.1676 });
      const result = PnLCalculatorService.calculatePartialCloses(
        PositionSide.SHORT,
        1.1748,
        [close],
        BYBIT_TAKER_FEE,
      );

      const single = PnLCalculatorService.calculate(
        PositionSide.SHORT,
        1.1748,
        1.1676,
        85.2,
        BYBIT_TAKER_FEE,
      );

      expect(result.pnlNet).toBeCloseTo(single.pnlNet, 2);
    });
  });

  describe('calculateBreakeven', () => {
    it('should calculate breakeven price for LONG', () => {
      const entryPrice = 1.15;
      const breakeven = PnLCalculatorService.calculateBreakeven(
        PositionSide.LONG,
        entryPrice,
        BYBIT_TAKER_FEE,
      );

      expect(breakeven).toBeGreaterThan(entryPrice);

      const pnl = PnLCalculatorService.calculate(
        PositionSide.LONG,
        entryPrice,
        breakeven,
        100,
        BYBIT_TAKER_FEE,
      );

      expect(pnl.pnlNet).toBeCloseTo(0, 1);
    });

    it('should calculate breakeven price for SHORT', () => {
      const entryPrice = 1.15;
      const breakeven = PnLCalculatorService.calculateBreakeven(
        PositionSide.SHORT,
        entryPrice,
        BYBIT_TAKER_FEE,
      );

      expect(breakeven).toBeLessThan(entryPrice);

      const pnl = PnLCalculatorService.calculate(
        PositionSide.SHORT,
        entryPrice,
        breakeven,
        100,
        BYBIT_TAKER_FEE,
      );

      expect(pnl.pnlNet).toBeCloseTo(0, 1);
    });

    it('should handle zero fees', () => {
      const entryPrice = 1.15;
      const breakeven = PnLCalculatorService.calculateBreakeven(
        PositionSide.LONG,
        entryPrice,
        0,
      );

      expect(breakeven).toBe(entryPrice);
    });
  });

  describe('real-world validation', () => {
    it('should match all Bybit trades from today', () => {
      const trades = createTradeValidationSet();

      trades.forEach((trade) => {
        const result = PnLCalculatorService.calculate(
          trade.side,
          trade.entry,
          trade.exit,
          trade.quantity,
          BYBIT_TAKER_FEE,
        );

        expect(result.pnlNet).toBeCloseTo(trade.expectedPnL, 2);
      });
    });
  });
});
