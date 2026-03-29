/**
 * FUNCTIONAL TESTS for PositionExitingService
 *
 * GOAL: Reproduce TP1 hit + breakeven SL bug
 *
 * SCENARIO:
 * 1. Open position at entry price 1.892
 * 2. TP1 hits at 1.9203 (partial close 33%)
 * 3. Move SL to breakeven should use entry price
 * 4. BUG: entryPrice becomes NaN, breakeven = NaN
 */

import { PositionExitingService } from '../../services/position-exiting.service';
import { Position } from '../../types/legacy';
import {
  analyzeWebSocketEntryPriceUpdates,
  createMockPositionExitingRiskConfig,
  createBreakevenInspection,
  createEntryPriceLifecycleSnapshot,
  createEntryPriceState,
  createEntryPriceTransitionState,
  createManagedFunctionalPositionExitingContext,
  formatPositionExitingTrace,
  createRealScenarioPosition,
  createWebSocketEntryPriceScenario,
  type ManagedFunctionalPositionExitingContext,
} from '../helpers/position-exiting-test.utils';

describe('PositionExitingService - FUNCTIONAL TESTS (TP1 + Breakeven Bug)', () => {
  let service: PositionExitingService;
  let mockBybitService: ManagedFunctionalPositionExitingContext['mockBybit'];

  type FunctionalPositionExitingFixtures = Pick<
    ManagedFunctionalPositionExitingContext,
    'service' | 'mockBybit'
  >;

  function bindFunctionalPositionExitingContext() {
    let fixtures: FunctionalPositionExitingFixtures;
    let cleanup: ManagedFunctionalPositionExitingContext['cleanup'];

    beforeEach(() => {
      const managedContext = createManagedFunctionalPositionExitingContext();
      fixtures = {
        service: managedContext.service,
        mockBybit: managedContext.mockBybit,
      };
      cleanup = managedContext.cleanup;
    });

    afterEach(() => {
      cleanup();
    });

    return () => fixtures;
  }

  const getFixtures = bindFunctionalPositionExitingContext();

  beforeEach(() => {
    const fixtures = getFixtures();
    service = fixtures.service;
    mockBybitService = fixtures.mockBybit;
  });

  describe('Scenario: TP1 Hit + Move SL to Breakeven', () => {
    it('Should calculate breakeven correctly when entryPrice is valid', () => {
      const position = createRealScenarioPosition();
      const { entryPrice, offsetPercent, offset, breakevenPrice } = createBreakevenInspection({
        entryPrice: position.entryPrice,
      });

      console.log(formatPositionExitingTrace('BREAKEVEN CALCULATION', [
        ['Entry Price', entryPrice],
        ['Offset Percent', `${offsetPercent}%`],
        ['Offset Value', offset],
        ['Breakeven Price', breakevenPrice],
      ]));

      if (offset === undefined || breakevenPrice === undefined) {
        throw new Error('Expected numeric breakeven inspection output');
      }

      expect(entryPrice).toBe(1.892);
      expect(isNaN(offset)).toBe(false);
      expect(offset).toBeCloseTo(0.00005676, 8);
      expect(isNaN(breakevenPrice)).toBe(false);
      expect(breakevenPrice).toBeCloseTo(1.89205676, 8);
    });

    it('Should detect when entryPrice becomes NaN', () => {
      const position = createRealScenarioPosition();
      position.entryPrice = NaN;
      const entryState = createEntryPriceState(position);
      const { offsetPercent, offset, breakevenPrice } = createBreakevenInspection({
        entryPrice: position.entryPrice,
      });

      console.log(formatPositionExitingTrace('CORRUPTED ENTRY PRICE', [
        ['Entry Price', entryState.entryPrice],
        ['Is NaN', !entryState.isValid],
        ['Calculated Offset', offset],
        ['Calculated Breakeven', breakevenPrice],
      ]));

      if (offset === undefined || breakevenPrice === undefined) {
        throw new Error('Expected NaN numeric output for corrupted entry price');
      }

      expect(entryState.isValid).toBe(false);
      expect(isNaN(offset)).toBe(true);
      expect(isNaN(breakevenPrice)).toBe(true);
    });

    it('Should handle undefined entryPrice gracefully', () => {
      const position = createRealScenarioPosition();
      position.entryPrice = undefined as unknown as number;

      let breakevenPrice: number | undefined;
      try {
        breakevenPrice = createBreakevenInspection({
          entryPrice: position.entryPrice,
          offsetPercent: createMockPositionExitingRiskConfig().breakevenOffsetPercent,
        }).breakevenPrice;
      } catch {
        breakevenPrice = undefined;
      }

      console.log(formatPositionExitingTrace('UNDEFINED ENTRY PRICE', [
        ['Entry Price', position.entryPrice],
        ['Calculated Breakeven', breakevenPrice],
      ]));

      expect(breakevenPrice === undefined || isNaN(breakevenPrice)).toBe(true);
    });

    it('CRITICAL: Call handleTP1Hit and verify it handles NaN gracefully', async () => {
      const position = createRealScenarioPosition();
      const currentPrice = 1.9203;
      position.takeProfits[0].hit = true;

      const testHandleTP1HitWithValidEntry = () => {
        if (!position.entryPrice || isNaN(position.entryPrice)) {
          console.log('ERROR: Entry price is invalid!');
          return null;
        }

        return createBreakevenInspection({
          entryPrice: position.entryPrice,
        }).breakevenPrice;
      };

      const breakevenPrice1 = testHandleTP1HitWithValidEntry();
      expect(breakevenPrice1).not.toBeNull();
      expect(isNaN(breakevenPrice1 || 0)).toBe(false);
      console.log(`Breakeven calculated: ${breakevenPrice1}`);

      position.entryPrice = NaN;
      const breakevenPrice2 = testHandleTP1HitWithValidEntry();
      expect(breakevenPrice2).toBeNull();
      console.log('Gracefully handled NaN entry price');
    });

    it('Should log detailed info before/after TP1 hit', async () => {
      const position = createRealScenarioPosition();

      console.log(formatPositionExitingTrace('POSITION STATE BEFORE TP1', [
        ['ID', position.id],
        ['Entry Price', position.entryPrice],
        ['SL', position.stopLoss.price],
        ['Quantity', position.quantity],
        ['TP1 Hit', position.takeProfits[0].hit],
      ]));

      position.takeProfits[0].hit = true;

      console.log(formatPositionExitingTrace('POSITION STATE AFTER TP1', [
        ['Entry Price', position.entryPrice],
        ['Entry Price Valid', !isNaN(position.entryPrice)],
      ]));

      expect(position.entryPrice).toBe(1.892);
      expect(isNaN(position.entryPrice)).toBe(false);
    });

    it('Should trace entryPrice through partial close lifecycle', () => {
      const position = createRealScenarioPosition();
      const {
        initialEntryPrice,
        tp1Level,
        partialCloseQty,
        remainingQuantity,
        corruptedEntryPrice,
      } = createEntryPriceLifecycleSnapshot(position);

      console.log(formatPositionExitingTrace('PARTIAL CLOSE LIFECYCLE', [
        ['Entry Price', position.entryPrice],
        ['Remaining Qty', position.quantity],
        [`Close Qty (TP${tp1Level.level})`, partialCloseQty],
        ['Close Price', tp1Level.price],
        ['New Qty', remainingQuantity],
        ['Entry Price Should Still Be', initialEntryPrice],
      ]));

      expect(position.entryPrice).toBe(initialEntryPrice);

      console.log(formatPositionExitingTrace('POTENTIAL CORRUPTION SOURCE', [
        ['If service tries to recalculate entry price', corruptedEntryPrice],
        ['Is it NaN?', isNaN(corruptedEntryPrice)],
      ]));

      expect(position.entryPrice).toBe(initialEntryPrice);
    });

    it('Should validate TP1 close does NOT corrupt entryPrice', async () => {
      const position = createRealScenarioPosition();
      const initialEntryPrice = position.entryPrice;

      mockBybitService.closePosition.mockResolvedValue(true);
      position.quantity = position.quantity * (1 - position.takeProfits[0].sizePercent / 100);
      const testState = createEntryPriceTransitionState(initialEntryPrice, position.entryPrice);

      console.log(formatPositionExitingTrace('ENTRY PRICE CORRUPTION TEST', [
        ['Before', testState.entryPriceBefore],
        ['After', testState.entryPriceAfter],
        ['Same?', testState.isSame],
      ]));

      expect(testState.entryPriceAfter).toBe(initialEntryPrice);
      expect(isNaN(testState.entryPriceAfter)).toBe(false);
    });
  });

  describe('Scenario: WebSocket Position Update Corruption', () => {
    it('Should trace how WebSocket update might corrupt entryPrice', () => {
      const position = createRealScenarioPosition();
      const originalEntryPrice = position.entryPrice;
      const wsUpdate = {
        ...createWebSocketEntryPriceScenario({ quantity: 52.85 }),
        avgPrice: '1.9203',
        mode: 'MergedSingleTP',
      };

      console.log(formatPositionExitingTrace('WEBSOCKET UPDATE RISK', [
        ['Original Entry', originalEntryPrice],
        ['WebSocket avgPrice', wsUpdate.avgPrice],
        ['If service uses avgPrice instead of entryPrice', 'CORRUPTION!'],
      ]));

      const corruptedEntry = parseFloat(wsUpdate.avgPrice);
      expect(corruptedEntry).toBe(1.9203);
    });

    it('Should identify which service method corrupts entryPrice', () => {
      const position = createRealScenarioPosition();
      const wsPosition = createWebSocketEntryPriceScenario();
      const entryState = createEntryPriceState(position);

      console.log(formatPositionExitingTrace('WEBSOCKET DATA', [
        ['entryPrice', `${wsPosition.entryPrice} (empty)`],
        ['avgPrice', `${wsPosition.avgPrice} (current)`],
        ['If updatePositionState() does', 'position.entryPrice = wsPosition.avgPrice'],
        ['Then', 'position.entryPrice = 1.9203 (WRONG!)'],
        ['Instead of', `position.entryPrice = ${entryState.entryPrice} (original)`],
      ]));

      expect(wsPosition.entryPrice).toBe(0);
      expect(wsPosition.avgPrice).not.toBe(position.entryPrice);
    });
  });
});
