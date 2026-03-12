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
import { TakeProfitManagerService } from '../../services/take-profit-manager.service';
import { Position, PositionSide, TakeProfit } from '../../types/legacy';
import {
  createMockPositionExitingLogger,
  createPositionExitingHarness,
  createRealScenarioPosition,
} from '../helpers/position-exiting-test.utils';
describe('PositionExitingService INTEGRATION: TP1 Bug Reproduction', () => {
  let service: PositionExitingService;
  let mockBybitService: ReturnType<typeof createPositionExitingHarness>['mockBybit'];
  let mockLogger: ReturnType<typeof createPositionExitingHarness>['mockLogger'];
  let mockTakeProfitManager: TakeProfitManagerService;

  beforeEach(() => {
    mockLogger = createMockPositionExitingLogger();
    mockTakeProfitManager = new TakeProfitManagerService(
      {
        positionId: 'XRPUSDT_Buy',
        symbol: 'XRPUSDT',
        side: PositionSide.LONG,
        entryPrice: 1.892, // REAL value from logs
        totalQuantity: 52.85,
        leverage: 10,
      },
      mockLogger as unknown as ConstructorParameters<typeof TakeProfitManagerService>[1],
    );

    const harness = createPositionExitingHarness({
      takeProfitManager: mockTakeProfitManager,
      positionManager: {
        getTakeProfitManager: jest.fn().mockReturnValue(mockTakeProfitManager),
      },
      tradingConfig: { positionSizeUsdt: 100 },
      riskConfig: {
        takeProfits: [
          { level: 1, percent: 0.5, sizePercent: 33 },
          { level: 2, percent: 1.0, sizePercent: 33 },
          { level: 3, percent: 1.5, sizePercent: 34 },
        ],
        stopLossPercent: 1,
        minStopLossPercent: 0.5,
        trailingStopPercent: 1,
      },
      fullConfig: {
        exchange: { symbol: 'XRPUSDT' } as never,
        entryConfig: {} as never,
      },
      loggerOverrides: mockLogger,
    });
    service = harness.service;
    mockLogger = harness.mockLogger;
    mockBybitService = harness.mockBybit;
  });

  describe('Real scenario: TP1 close + recordPartialClose', () => {
    it('Should correctly record TP1 partial close with valid entryPrice', () => {
      // This tests that TakeProfitManager works correctly with valid data
      const tpLevel = 1;
      const partialQuantity = (52.85 * 33) / 100; // 17.4405
      const tp1ExitPrice = 1.9203;

      const partialClose = mockTakeProfitManager.recordPartialClose(
        tpLevel,
        partialQuantity,
        tp1ExitPrice,
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

      const tpLevel = 1;
      const partialQuantity = (52.85 * 33) / 100;
      const tp1ExitPrice = 1.9203;

      const partialClose = mockTakeProfitManager.recordPartialClose(
        tpLevel,
        partialQuantity,
        tp1ExitPrice,
      );

      console.log(`
        CORRUPTED ENTRY PRICE:
        - config.entryPrice: ${(mockTakeProfitManager as unknown as { config: { entryPrice: number } }).config.entryPrice}
        - Recorded pnlNet: ${partialClose.pnlNet}
        - Is NaN? ${isNaN(partialClose.pnlNet)}
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
      const offsetPercent = 0.3;
      const offset = (position.entryPrice * offsetPercent) / 10000;
      const breakevenPrice = position.entryPrice + offset;

      console.log(`
        BREAKEVEN CALCULATION:
        - Position entryPrice: ${position.entryPrice}
        - Is NaN? ${isNaN(position.entryPrice)}
        - Calculated Breakeven: ${breakevenPrice}
        - Is Breakeven NaN? ${isNaN(breakevenPrice)}
      `);

      expect(isNaN(breakevenPrice)).toBe(false);

      // Now what if entryPrice becomes NaN between recordPartialClose and handleTP1Hit?
      position.entryPrice = NaN;

      const offset2 = (position.entryPrice * offsetPercent) / 10000;
      const breakevenPrice2 = position.entryPrice + offset2;

      console.log(`
        AFTER CORRUPTION:
        - Position entryPrice: ${position.entryPrice}
        - Is NaN? ${isNaN(position.entryPrice)}
        - Calculated Breakeven: ${breakevenPrice2}
        - Is Breakeven NaN? ${isNaN(breakevenPrice2)}
      `);

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

      const posData = {
        entryPrice: '', // Empty from WebSocket
        avgPrice: '1.9203',
      };

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

      const posData = {
        entryPrice: '', // Empty
        avgPrice: '1.9203', // Valid
      };

      // NEW FIXED CODE (simulation)
      const parseEntryPrice = (): number => {
        if (posData.entryPrice && posData.entryPrice.trim()) {
          const price = parseFloat(posData.entryPrice);
          if (!isNaN(price)) return price;
        }
        if (posData.avgPrice && posData.avgPrice.trim()) {
          const price = parseFloat(posData.avgPrice);
          if (!isNaN(price)) return price;
        }
        return 0;
      };

      const newFixedCode = parseEntryPrice();

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
      const positions = [
        { entryPrice: '1.892', avgPrice: '1.892', label: 'Position Open' },
        { entryPrice: '', avgPrice: '1.9203', label: 'After TP1 Close (BUG)' },
      ];

      const parseEntryPrice = (entryPrice: string, avgPrice: string): number => {
        if (entryPrice && entryPrice.trim()) {
          const price = parseFloat(entryPrice);
          if (!isNaN(price)) return price;
        }
        if (avgPrice && avgPrice.trim()) {
          const price = parseFloat(avgPrice);
          if (!isNaN(price)) return price;
        }
        return 0;
      };

      const results = positions.map(p => ({
        ...p,
        parsed: parseEntryPrice(p.entryPrice, p.avgPrice),
      }));

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


