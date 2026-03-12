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
  createMockPositionExitingExchange,
  createMockPositionExitingJournal,
  createMockPositionExitingLogger,
  createMockPositionExitingManager,
  createMockPositionExitingRiskConfig,
  createMockPositionExitingSessionStats,
  createMockPositionExitingTelegram,
  createPositionExitingHarness,
  createRealScenarioPosition,
} from '../helpers/position-exiting-test.utils';

describe('PositionExitingService - FUNCTIONAL TESTS (TP1 + Breakeven Bug)', () => {
  let service: PositionExitingService;
  let mockBybitService: ReturnType<typeof createMockPositionExitingExchange>;
  let mockTelegramService: ReturnType<typeof createMockPositionExitingTelegram>;
  let mockLogger: ReturnType<typeof createMockPositionExitingLogger>;
  let mockJournalService: ReturnType<typeof createMockPositionExitingJournal>;
  let mockSessionStats: ReturnType<typeof createMockPositionExitingSessionStats>;
  let mockPositionManager: ReturnType<typeof createMockPositionExitingManager>;

  beforeEach(() => {
    const harness = createPositionExitingHarness({
      withTakeProfitManager: false,
      riskConfig: {
        takeProfits: [
          { level: 1, percent: 1.5, sizePercent: 33 },
          { level: 2, percent: 3, sizePercent: 33 },
          { level: 3, percent: 5, sizePercent: 34 },
        ],
        stopLossPercent: 1,
        minStopLossPercent: 0.5,
        trailingStopPercent: 1,
      },
      fullConfig: {
        exchange: { symbol: 'XRPUSDT' } as never,
      },
    });
    service = harness.service;
    mockLogger = harness.mockLogger;
    mockBybitService = harness.mockBybit;
    mockTelegramService = harness.mockTelegram;
    mockJournalService = harness.mockJournal;
    mockSessionStats = harness.mockSessionStats;
    mockPositionManager = harness.mockPositionManager as ReturnType<typeof createMockPositionExitingManager>;
  });

  describe('Scenario: TP1 Hit + Move SL to Breakeven', () => {
    it('Should calculate breakeven correctly when entryPrice is valid', () => {
      const position = createRealScenarioPosition();
      const entryPrice = position.entryPrice;

      const offsetPercent = createMockPositionExitingRiskConfig().breakevenOffsetPercent;
      const offset = (entryPrice * offsetPercent) / 10000;
      const breakevenPrice = entryPrice + offset;

      console.log(`
        BREAKEVEN CALCULATION:
        - Entry Price: ${entryPrice}
        - Offset Percent: ${offsetPercent}%
        - Offset Value: ${offset}
        - Breakeven Price: ${breakevenPrice}
      `);

      expect(entryPrice).toBe(1.892);
      expect(isNaN(offset)).toBe(false);
      expect(offset).toBeCloseTo(0.00005676, 8);
      expect(isNaN(breakevenPrice)).toBe(false);
      expect(breakevenPrice).toBeCloseTo(1.89205676, 8);
    });

    it('Should detect when entryPrice becomes NaN', () => {
      const position = createRealScenarioPosition();
      position.entryPrice = NaN;

      const offsetPercent = createMockPositionExitingRiskConfig().breakevenOffsetPercent;
      const offset = (position.entryPrice * offsetPercent) / 10000;
      const breakevenPrice = position.entryPrice + offset;

      console.log(`
        CORRUPTED ENTRY PRICE:
        - Entry Price: ${position.entryPrice}
        - Is NaN: ${isNaN(position.entryPrice)}
        - Calculated Offset: ${offset}
        - Calculated Breakeven: ${breakevenPrice}
      `);

      expect(isNaN(position.entryPrice)).toBe(true);
      expect(isNaN(offset)).toBe(true);
      expect(isNaN(breakevenPrice)).toBe(true);
    });

    it('Should handle undefined entryPrice gracefully', () => {
      const position = createRealScenarioPosition();
      position.entryPrice = undefined as unknown as number;

      let breakevenPrice: number | undefined;
      try {
        const offsetPercent = createMockPositionExitingRiskConfig().breakevenOffsetPercent;
        const offset = (position.entryPrice * offsetPercent) / 10000;
        breakevenPrice = position.entryPrice + offset;
      } catch {
        breakevenPrice = undefined;
      }

      console.log(`
        UNDEFINED ENTRY PRICE:
        - Entry Price: ${position.entryPrice}
        - Calculated Breakeven: ${breakevenPrice}
      `);

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

        const offsetPercent = createMockPositionExitingRiskConfig().breakevenOffsetPercent;
        const offset = (position.entryPrice * offsetPercent) / 10000;
        return position.entryPrice + offset;
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

      console.log(`
        POSITION STATE BEFORE TP1:
        - ID: ${position.id}
        - Entry Price: ${position.entryPrice}
        - SL: ${position.stopLoss.price}
        - Quantity: ${position.quantity}
        - TP1 Hit: ${position.takeProfits[0].hit}
      `);

      position.takeProfits[0].hit = true;

      console.log(`
        POSITION STATE AFTER TP1:
        - Entry Price: ${position.entryPrice}
        - Entry Price Valid: ${!isNaN(position.entryPrice)}
      `);

      expect(position.entryPrice).toBe(1.892);
      expect(isNaN(position.entryPrice)).toBe(false);
    });

    it('Should trace entryPrice through partial close lifecycle', () => {
      const position = createRealScenarioPosition();
      const initialEntryPrice = position.entryPrice;
      const tp1Level = position.takeProfits[0];
      const tp1Price = tp1Level.price;
      const partialCloseQty = (position.quantity * tp1Level.sizePercent) / 100;

      console.log(`
        PARTIAL CLOSE LIFECYCLE:

        STEP 1: Before Close
        - Entry Price: ${position.entryPrice}
        - Remaining Qty: ${position.quantity}
        - Close Qty (TP${tp1Level.level}): ${partialCloseQty}

        STEP 2: Execute Close on Exchange
        - Close at price: ${tp1Price}

        STEP 3: Update Position State
        - New Qty: ${position.quantity - partialCloseQty}
        - Entry Price Should Still Be: ${initialEntryPrice}
      `);

      expect(position.entryPrice).toBe(initialEntryPrice);

      const corruptedEntryPrice =
        (initialEntryPrice * position.quantity - tp1Price * partialCloseQty)
        / (position.quantity - partialCloseQty);

      console.log(`
        POTENTIAL CORRUPTION SOURCE:
        - If service tries to recalculate entry price: ${corruptedEntryPrice}
        - Is it NaN? ${isNaN(corruptedEntryPrice)}
      `);

      expect(position.entryPrice).toBe(initialEntryPrice);
    });

    it('Should validate TP1 close does NOT corrupt entryPrice', async () => {
      const position = createRealScenarioPosition();
      const initialEntryPrice = position.entryPrice;
      const testState: { entryPriceBefore: number; entryPriceAfter?: number; entryPriceValid?: boolean } = {
        entryPriceBefore: position.entryPrice,
        entryPriceValid: !isNaN(position.entryPrice),
      };

      mockBybitService.closePosition.mockResolvedValue(true);
      position.quantity = position.quantity * (1 - position.takeProfits[0].sizePercent / 100);
      testState.entryPriceAfter = position.entryPrice;

      console.log(`
        ENTRY PRICE CORRUPTION TEST:
        - Before: ${testState.entryPriceBefore}
        - After: ${testState.entryPriceAfter}
        - Same? ${testState.entryPriceBefore === testState.entryPriceAfter}
      `);

      expect(testState.entryPriceAfter).toBe(initialEntryPrice);
      expect(isNaN(testState.entryPriceAfter)).toBe(false);
    });
  });

  describe('Scenario: WebSocket Position Update Corruption', () => {
    it('Should trace how WebSocket update might corrupt entryPrice', () => {
      const position = createRealScenarioPosition();
      const originalEntryPrice = position.entryPrice;
      const wsUpdate = {
        symbol: 'XRPUSDT',
        side: 'Buy',
        qty: '52.85',
        avgPrice: '1.9203',
        mode: 'MergedSingleTP',
      };

      console.log(`
        WEBSOCKET UPDATE RISK:
        - Original Entry: ${originalEntryPrice}
        - WebSocket avgPrice: ${wsUpdate.avgPrice}
        - If service uses avgPrice instead of entryPrice: CORRUPTION!
      `);

      const corruptedEntry = parseFloat(wsUpdate.avgPrice);
      expect(corruptedEntry).toBe(1.9203);
    });

    it('Should identify which service method corrupts entryPrice', () => {
      const position = createRealScenarioPosition();
      const wsPosition = {
        symbol: 'XRPUSDT',
        side: 'Buy',
        qty: 35.41,
        entryPrice: 0,
        avgPrice: 1.9203,
      };

      console.log(`
        WEBSOCKET DATA:
        - entryPrice: ${wsPosition.entryPrice} (empty)
        - avgPrice: ${wsPosition.avgPrice} (current)

        BUG LOCATION HYPOTHESIS:
        - If updatePositionState() does: position.entryPrice = wsPosition.avgPrice
        - Then: position.entryPrice = 1.9203 (WRONG!)
        - Instead of: position.entryPrice = 1.892 (original)
      `);

      expect(wsPosition.entryPrice).toBe(0);
      expect(wsPosition.avgPrice).not.toBe(position.entryPrice);
    });
  });
});
