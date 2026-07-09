import { PositionExitingService } from '../../services/position-exiting.service';
import { Position, TakeProfit } from '../../types/legacy';
import {
  analyzeWebSocketEntryPriceUpdates,
  createBreakevenInspection,
  createEntryPriceState,
  createRealScenarioPartialClose,
  createRealScenarioTakeProfitManager,
  createManagedRealScenarioPositionExitingContext,
  createRealScenarioPosition,
  createWebSocketBugScenario,
  formatPositionExitingTrace,
  parseWebSocketEntryPrice,
  type RealScenarioPositionExitingRuntime,
} from '../helpers/position-exiting-test.utils';

describe('PositionExitingService INTEGRATION: TP1 Bug Reproduction', () => {
  let service: PositionExitingService;
  let mockBybitService: RealScenarioPositionExitingRuntime['mockBybit'];
  let mockLogger: RealScenarioPositionExitingRuntime['mockLogger'];
  let mockTakeProfitManager: ReturnType<typeof createRealScenarioTakeProfitManager>;
  let cleanup: RealScenarioPositionExitingRuntime['cleanup'];

  beforeEach(() => {
    const runtime: RealScenarioPositionExitingRuntime = createManagedRealScenarioPositionExitingContext();
    service = runtime.service;
    mockLogger = runtime.mockLogger;
    mockBybitService = runtime.mockBybit;
    mockTakeProfitManager =
      runtime.mockTakeProfitManager as ReturnType<typeof createRealScenarioTakeProfitManager>;
    cleanup = runtime.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  describe('Real scenario: TP1 close + recordPartialClose', () => {
    it('Should correctly record TP1 partial close with valid entryPrice', () => {
      const { tpLevel, partialQuantity, exitPrice } = createRealScenarioPartialClose();

      const partialClose = mockTakeProfitManager.recordPartialClose(
        tpLevel,
        partialQuantity,
        exitPrice,
      );

      console.log(formatPositionExitingTrace('PARTIAL CLOSE RESULT', [
        ['Level', partialClose.level],
        ['Quantity', partialClose.quantity],
        ['Exit Price', partialClose.exitPrice],
        ['PnL Gross', partialClose.pnlGross],
        ['PnL Net', partialClose.pnlNet],
        ['Is NaN?', isNaN(partialClose.pnlNet)],
      ]));

      expect(isNaN(partialClose.pnlNet)).toBe(false);
      expect(partialClose.pnlNet).toBeGreaterThan(0);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('CRITICAL: What happens if TakeProfitManager entryPrice becomes NaN?', () => {
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

      console.log(formatPositionExitingTrace('CORRUPTED ENTRY PRICE', [
        ['config.entryPrice', entryState.entryPrice],
        ['Recorded pnlNet', partialClose.pnlNet],
        ['Is NaN?', !entryState.isValid],
      ]));

      expect(isNaN(partialClose.pnlNet)).toBe(true);
    });

    it('Should NOT corrupt entryPrice during position update', async () => {
      const position: Position = createRealScenarioPosition();
      const originalEntryPrice = position.entryPrice;

      position.quantity = position.quantity * 0.67;
      position.takeProfits[0].hit = true;

      console.log(formatPositionExitingTrace('POSITION STATE AFTER TP1', [
        ['Entry Price Before', originalEntryPrice],
        ['Entry Price After', position.entryPrice],
        ['Entry Price Corrupted?', position.entryPrice !== originalEntryPrice],
      ]));

      expect(position.entryPrice).toBe(originalEntryPrice);
      expect(isNaN(position.entryPrice)).toBe(false);
    });

    it('INVESTIGATION: Where does entryPrice come from in handleTP1Hit?', async () => {
      const position: Position = {
        ...createRealScenarioPosition(),
        takeProfits: [
          { level: 1, percent: 0.5, sizePercent: 33, price: 1.9203, hit: false } as TakeProfit,
        ],
        openedAt: Date.now(),
      };

      const entryState = createEntryPriceState(position);
      const { offset, breakevenPrice } = createBreakevenInspection({
        entryPrice: position.entryPrice,
        offsetPercent: 0.3,
      });

      console.log(formatPositionExitingTrace('BREAKEVEN CALCULATION', [
        ['Position entryPrice', entryState.entryPrice],
        ['Is NaN?', !entryState.isValid],
        ['Calculated Breakeven', breakevenPrice],
        ['Is Breakeven NaN?', breakevenPrice !== undefined ? isNaN(breakevenPrice) : 'undefined'],
      ]));

      if (offset === undefined || breakevenPrice === undefined) {
        throw new Error('Expected numeric breakeven values for valid integration scenario');
      }

      expect(isNaN(breakevenPrice)).toBe(false);

      position.entryPrice = NaN;
      const { breakevenPrice: breakevenPrice2 } = createBreakevenInspection({
        entryPrice: position.entryPrice,
        offsetPercent: 0.3,
      });

      console.log(formatPositionExitingTrace('AFTER CORRUPTION', [
        ['Position entryPrice', position.entryPrice],
        ['Is NaN?', isNaN(position.entryPrice)],
        ['Calculated Breakeven', breakevenPrice2],
        ['Is Breakeven NaN?', breakevenPrice2 !== undefined ? isNaN(breakevenPrice2) : 'undefined'],
      ]));

      if (breakevenPrice2 === undefined) {
        throw new Error('Expected NaN breakeven value for corrupted integration scenario');
      }

      expect(isNaN(breakevenPrice2)).toBe(true);
    });
  });

  describe('WebSocket Update Impact', () => {
    it('BUGGY: Old code - Empty string causes NaN', () => {
      const posData = createWebSocketBugScenario();
      const oldBuggyCode = parseFloat(posData.entryPrice ?? posData.avgPrice ?? '0');

      console.log(formatPositionExitingTrace('OLD BUGGY CODE', [
        ['entryPrice', `"${posData.entryPrice}"`],
        ['avgPrice', `"${posData.avgPrice}"`],
        ['Result', oldBuggyCode],
        ['Is NaN?', isNaN(oldBuggyCode)],
      ]));

      expect(isNaN(oldBuggyCode)).toBe(true);
    });

    it('FIXED: New code - Properly handles empty strings', () => {
      const posData = createWebSocketBugScenario();
      const newFixedCode = parseWebSocketEntryPrice(posData.entryPrice, posData.avgPrice);

      console.log(formatPositionExitingTrace('NEW FIXED CODE', [
        ['entryPrice', `"${posData.entryPrice}" (empty, skipped)`],
        ['avgPrice', `"${posData.avgPrice}" (valid, used)`],
        ['Result', newFixedCode],
        ['Is NaN?', isNaN(newFixedCode)],
      ]));

      expect(isNaN(newFixedCode)).toBe(false);
      expect(newFixedCode).toBe(1.9203);
    });

    it('VERIFIED: Sequence of WebSocket updates', () => {
      const results = analyzeWebSocketEntryPriceUpdates();

      console.log(formatPositionExitingTrace(
        'WEBSOCKET UPDATE SEQUENCE',
        results.map((result) => [
          result.label,
          `entryPrice="${result.entryPrice}", avgPrice="${result.avgPrice}" -> Parsed: ${result.parsed}`,
        ]),
      ));

      expect(isNaN(results[0].parsed)).toBe(false);
      expect(isNaN(results[1].parsed)).toBe(false);
      expect(results[0].parsed).toBe(1.892);
      expect(results[1].parsed).toBe(1.9203);
    });
  });
});
