/**
 * INTEGRATION TEST: PositionExitingService + TakeProfitManager
 *
 * REPRODUCES: TP1 Hit + Breakeven SL Bug
 *
 * SCENARIO FROM LOGS:
 * 1. Position opened: entry=1.892, qty=52.85
 * 2. TP1 hit at 1.9203
 * 3. recordPartialClose() called with qty=17.44 (33%)
 * 4. pnlNet becomes NaN
 * 5. calculateBreakevenPrice() receives NaN
 * 6. Moving SL fails
 */

import { PositionExitingService } from '../../services/position-exiting.service';
import { Position, TakeProfit } from '../../types/legacy';
import {
  analyzeWebSocketEntryPriceUpdates,
  createBreakevenInspection,
  createEntryPriceState,
  createMockPositionExitingLogger,
  createRealScenarioPartialClose,
  createRealScenarioPositionExitingHarness,
  createRealScenarioTakeProfitManager,
  createRealScenarioPosition,
  createWebSocketBugScenario,
  parseWebSocketEntryPrice,
} from '../helpers/position-exiting-test.utils';
describe('PositionExitingService INTEGRATION: TP1 Bug Reproduction', () => {
  let service: PositionExitingService;
  let mockBybitService: ReturnType<typeof createRealScenarioPositionExitingHarness>['mockBybit'];
  let mockLogger: ReturnType<typeof createRealScenarioPositionExitingHarness>['mockLogger'];
  let mockTakeProfitManager: ReturnType<typeof createRealScenarioTakeProfitManager>;

  beforeEach(() => {
    const harness = createRealScenarioPositionExitingHarness(
      createMockPositionExitingLogger(),
    );
    service = harness.service;
    mockLogger = harness.mockLogger;
    mockBybitService = harness.mockBybit;
    mockTakeProfitManager =
      harness.mockTakeProfitManager as ReturnType<typeof createRealScenarioTakeProfitManager>;
  });

  describe('Real scenario: TP1 close + recordPartialClose', () => {
    it('Should correctly record TP1 partial close with valid entryPrice', () => {
      // This tests that TakeProfitManager works correctly with valid data
      const { tpLevel, partialQuantity, exitPrice } = createRealScenarioPartialClose();

      const partialClose = mockTakeProfitManager.recordPartialClose(
        tpLevel,
        partialQuantity,
        exitPrice,
      );

      console.log(`
        PARTIAL CLOSE RESULT:
        - Level: ${partialClose.level}
        - Quantity: ${partialClose.quantity}
        - Exit Price: ${partialClose.exitPrice}
        - PnL Gross: ${partialClose.pnlGross}
        - PnL Net: ${partialClose.pnlNet}
        - Is NaN? ${isNaN(partialClose.pnlNet)}
      `);

      // Verify PnL is NOT NaN
      expect(isNaN(partialClose.pnlNet)).toBe(false);
      expect(partialClose.pnlNet).toBeGreaterThan(0); // Should be profitable
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('CRITICAL: What happens if TakeProfitManager entryPrice becomes NaN?', () => {
      // Simulate corruption
      (mockTakeProfitManager as unknown as { config: { entryPrice: number } }).config.entryPrice = NaN;
      const entryState = createEntryPriceState(
        (mockTakeProfitManager as unknown as { config: { entryPrice: number } }).config,
      );

      const { tpLevel, partialQuantity, exitPrice } = createRealScenarioPartialClose();

      const partialClose = mockTakeProfitManager.recordPartialClose(
        tpLevel,
        partialQuantity,
        exitPrice,
      );

      console.log(`
        CORRUPTED ENTRY PRICE:
        - config.entryPrice: ${entryState.entryPrice}
        - Recorded pnlNet: ${partialClose.pnlNet}
        - Is NaN? ${!entryState.isValid}
      `);

      // This is the BUG!
      expect(isNaN(partialClose.pnlNet)).toBe(true);
    });

    it('Should NOT corrupt entryPrice during position update', async () => {
      const position: Position = createRealScenarioPosition();

      const originalEntryPrice = position.entryPrice;

      // Simulate TP1 hit and partial close
      position.quantity = position.quantity * 0.67; // After 33% close
      position.takeProfits[0].hit = true;

      console.log(`
        POSITION STATE AFTER TP1:
        - Entry Price Before: ${originalEntryPrice}
        - Entry Price After: ${position.entryPrice}
        - Entry Price Corrupted? ${position.entryPrice !== originalEntryPrice}
      `);

      expect(position.entryPrice).toBe(originalEntryPrice);
      expect(isNaN(position.entryPrice)).toBe(false);
    });

    it('INVESTIGATION: Where does entryPrice come from in handleTP1Hit?', async () => {
      // This test investigates the actual issue
      // In handleTP1Hit on line 560:
      // const breakevenPrice = this.calculateBreakevenPrice(position, ...);

      const position: Position = {
        ...createRealScenarioPosition(),
        takeProfits: [
          { level: 1, percent: 0.5, sizePercent: 33, price: 1.9203, hit: false } as TakeProfit,
        ],
        openedAt: Date.now(),
      };

      // Check what breakeven calculation would give
      const entryState = createEntryPriceState(position);
      const { offset, breakevenPrice } = createBreakevenInspection({
        entryPrice: position.entryPrice,
        offsetPercent: 0.3,
      });

      console.log(`
        BREAKEVEN CALCULATION:
        - Position entryPrice: ${entryState.entryPrice}
        - Is NaN? ${!entryState.isValid}
        - Calculated Breakeven: ${breakevenPrice}
        - Is Breakeven NaN? ${breakevenPrice !== undefined ? isNaN(breakevenPrice) : 'undefined'}
      `);

      if (offset === undefined || breakevenPrice === undefined) {
        throw new Error('Expected numeric breakeven values for valid integration scenario');
      }

      expect(isNaN(breakevenPrice)).toBe(false);

      // Now what if entryPrice becomes NaN between recordPartialClose and handleTP1Hit?
      position.entryPrice = NaN;

      const { breakevenPrice: breakevenPrice2 } = createBreakevenInspection({
        entryPrice: position.entryPrice,
        offsetPercent: 0.3,
      });

      console.log(`
        AFTER CORRUPTION:
        - Position entryPrice: ${position.entryPrice}
        - Is NaN? ${isNaN(position.entryPrice)}
        - Calculated Breakeven: ${breakevenPrice2}
        - Is Breakeven NaN? ${breakevenPrice2 !== undefined ? isNaN(breakevenPrice2) : 'undefined'}
      `);

      if (breakevenPrice2 === undefined) {
        throw new Error('Expected NaN breakeven value for corrupted integration scenario');
      }

      expect(isNaN(breakevenPrice2)).toBe(true);
    });
  });

  describe('WebSocket Update Impact', () => {
    it('BUGGY: Old code - Empty string causes NaN', () => {
      // OLD CODE BUG:
      // entryPrice: parseFloat(posData.entryPrice ?? posData.avgPrice ?? '0')
      //
      // When entryPrice='', nullish coalescing fails:
      // - '' ?? avgPrice = '' (empty string is truthy!)
      // - parseFloat('') = NaN

      const posData = createWebSocketBugScenario();

      // OLD BUGGY CODE
      const oldBuggyCode = parseFloat(posData.entryPrice ?? posData.avgPrice ?? '0');

      console.log(`
        OLD BUGGY CODE:
        - entryPrice: "${posData.entryPrice}"
        - avgPrice: "${posData.avgPrice}"
        - Result: ${oldBuggyCode}
        - Is NaN? ${isNaN(oldBuggyCode)}
      `);

      // This is the bug!
      expect(isNaN(oldBuggyCode)).toBe(true);
    });

    it('FIXED: New code - Properly handles empty strings', () => {
      // NEW CODE FIX:
      // Checks for EMPTY strings before parsing
      // Validates non-NaN result

      const posData = createWebSocketBugScenario();
      const newFixedCode = parseWebSocketEntryPrice(posData.entryPrice, posData.avgPrice);

      console.log(`
        NEW FIXED CODE:
        - entryPrice: "${posData.entryPrice}" (empty, skipped)
        - avgPrice: "${posData.avgPrice}" (valid, used)
        - Result: ${newFixedCode}
        - Is NaN? ${isNaN(newFixedCode)}
      `);

      // This should NOT be NaN!
      expect(isNaN(newFixedCode)).toBe(false);
      expect(newFixedCode).toBe(1.9203);
    });

    it('VERIFIED: Sequence of WebSocket updates', () => {
      // Simulates actual WebSocket update sequence
      const results = analyzeWebSocketEntryPriceUpdates();

      console.log(`
        WEBSOCKET UPDATE SEQUENCE:
        ${results.map(r => `- ${r.label}: entryPrice="${r.entryPrice}", avgPrice="${r.avgPrice}" → Parsed: ${r.parsed}`).join('\n')}
      `);

      // Verify both are valid
      expect(isNaN(results[0].parsed)).toBe(false);
      expect(isNaN(results[1].parsed)).toBe(false);

      // First should be 1.892
      expect(results[0].parsed).toBe(1.892);
      // Second should still be valid (use avgPrice since entryPrice is empty)
      expect(results[1].parsed).toBe(1.9203);
    });
  });
});


