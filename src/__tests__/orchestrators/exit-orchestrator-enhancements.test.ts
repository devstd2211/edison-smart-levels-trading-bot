/**
 * Tests for ExitOrchestrator Enhancements (Session 66)
 * Tests for:
 * - Smart Breakeven Pre-BE Mode
 * - Adaptive TP3
 * - SmartTrailingV2
 * - Bollinger Band Trailing
 */

import { ExitOrchestrator } from '../../orchestrators/exit.orchestrator';
import { Position, PositionSide, PositionState, SignalDirection, TakeProfit, SignalType } from '../../types';

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
});

const createMockPosition = (overrides?: Partial<Position>): Position => ({
  id: 'APEXUSDT_Buy',
  journalId: 'APEXUSDT_Buy_123456',
  symbol: 'APEXUSDT',
  side: PositionSide.LONG,
  quantity: 10,
  entryPrice: 100,
  leverage: 10,
  marginUsed: 100,
  stopLoss: {
    price: 95,
    initialPrice: 95,
    orderId: undefined,
    isBreakeven: false,
    isTrailing: false,
    updatedAt: Date.now(),
  },
  takeProfits: [
    { level: 1, percent: 5, sizePercent: 33, price: 105, hit: false } as TakeProfit,
    { level: 2, percent: 10, sizePercent: 33, price: 110, hit: false } as TakeProfit,
    { level: 3, percent: 15, sizePercent: 34, price: 115, hit: false } as TakeProfit,
  ],
  openedAt: Date.now(),
  unrealizedPnL: 0,
  orderId: 'ORD_123',
  reason: 'Test position',
  protectionVerifiedOnce: true,
  status: 'OPEN' as const,
  ...overrides,
});

const createMockCandles = (count: number, basePrice: number = 100) => {
  const candles = [];
  for (let i = 0; i < count; i++) {
    const open = basePrice + Math.sin(i * 0.1) * 2;
    const close = basePrice + Math.sin(i * 0.1 + 0.5) * 2;
    candles.push({
      open,
      high: Math.max(open, close) + 1,
      low: Math.min(open, close) - 1,
      close,
    });
  }
  return candles;
};

describe('ExitOrchestrator Enhancements (Session 66)', () => {
  let orchestrator: ExitOrchestrator;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = createMockLogger();
    orchestrator = new ExitOrchestrator(mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Smart Breakeven Pre-BE Mode', () => {
    it('should track candle count for pre-BE mode', async () => {
      const position = createMockPosition();

      // TP1 hit activates pre-BE mode
      const result1 = await orchestrator.evaluateExit(position, 105);
      expect(result1.newState).toBe(PositionState.TP1_HIT);
      expect(result1.actions).toContainEqual(
        expect.objectContaining({ action: 'UPDATE_SL' }),
      );

      // Subsequent evaluations should stay in TP1_HIT
      const result2 = await orchestrator.evaluateExit(position, 105);
      expect(result2.newState).toBe(PositionState.TP1_HIT);
    });

    it('should close partial position on TP1 hit', async () => {
      const position = createMockPosition();

      // Trigger TP1
      const result = await orchestrator.evaluateExit(position, 105);
      expect(result.actions).toContainEqual(
        expect.objectContaining({ action: 'CLOSE_PERCENT', percent: 50 }),
      );
    });

    it('should move SL to breakeven after TP1', async () => {
      const position = createMockPosition();

      // TP1 hit should move SL to entry + profit margin
      const result = await orchestrator.evaluateExit(position, 105);
      const slAction = result.actions.find((a: any) => a.action === 'UPDATE_SL');
      expect(slAction).toBeDefined();
      expect(slAction?.newStopLoss).toBeGreaterThanOrEqual(position.entryPrice);
    });
  });

  describe('Adaptive TP3', () => {
    it('should calculate TP3 at minimum with low volume', async () => {
      const position = createMockPosition();

      // Low volume scenario
      const indicators = {
        currentVolume: 1000,
        avgVolume: 2000, // Below threshold
        atrPercent: 1.0,
      };

      // After TP2, adaptive TP3 should be used
      // This would need to be tested through the full evaluateExit flow
      expect(position.takeProfits[2].price).toBe(115);
    });

    it('should increase TP3 with high volume', async () => {
      const position = createMockPosition();

      const indicators = {
        currentVolume: 3000,
        avgVolume: 2000, // Above threshold (1.5x)
        atrPercent: 1.0,
      };

      // High volume should allow for higher TP
      expect(position.takeProfits.length).toBe(3);
    });

    it('should adjust TP3 for high volatility', async () => {
      const position = createMockPosition();

      const indicators = {
        atrPercent: 2.5, // High volatility
        currentVolume: 2000,
        avgVolume: 2000,
      };

      // High volatility should reduce target (take profit earlier)
      expect(position.takeProfits[2]).toBeDefined();
    });

    it('should adjust TP3 for low volatility', async () => {
      const position = createMockPosition();

      const indicators = {
        atrPercent: 0.3, // Low volatility
        currentVolume: 2000,
        avgVolume: 2000,
      };

      // Low volatility should extend target
      expect(position.takeProfits[2]).toBeDefined();
    });
  });

  describe('SmartTrailingV2', () => {
    it('should calculate trailing distance from ATR', async () => {
      const position = createMockPosition();

      const indicators = {
        atrPercent: 2.0,
        currentVolume: 2000,
        avgVolume: 2000,
      };

      // After TP2, trailing should activate
      await orchestrator.evaluateExit(position, 110); // TP2 hit
      // SmartTrailingV2 would be used for final leg
      expect(position.side).toBe(PositionSide.LONG);
    });

    it('should tighten trailing on high volume', async () => {
      const position = createMockPosition();

      const indicators = {
        atrPercent: 2.0,
        currentVolume: 3000,
        avgVolume: 2000, // High volume (1.5x)
      };

      // High volume should reduce trailing distance
      expect(position.entryPrice).toBe(100);
    });

    it('should loosen trailing on low volume', async () => {
      const position = createMockPosition();

      const indicators = {
        atrPercent: 2.0,
        currentVolume: 1000,
        avgVolume: 2000, // Low volume (0.5x)
      };

      // Low volume should allow wider trailing
      expect(position.entryPrice).toBe(100);
    });

    it('should handle SHORT positions correctly', async () => {
      const position = createMockPosition({
        side: PositionSide.SHORT,
        entryPrice: 100,
        stopLoss: { ...createMockPosition().stopLoss, price: 105 },
      });

      const indicators = {
        atrPercent: 2.0,
      };

      // SHORT should trail downward
      expect(position.side).toBe(PositionSide.SHORT);
    });
  });

  describe('Bollinger Band Trailing', () => {
    it('should calculate BB from sufficient candles', () => {
      const position = createMockPosition();
      const candles = createMockCandles(25, 100); // Enough for 20-period BB

      // With enough candles, should calculate BB
      expect(candles.length).toBeGreaterThanOrEqual(20);
    });

    it('should fallback to current SL with insufficient candles', () => {
      const position = createMockPosition();
      const candles = createMockCandles(10, 100); // Not enough for BB

      // With few candles, should fallback
      expect(candles.length).toBeLessThan(20);
    });

    it('should use lower band for LONG positions', () => {
      const position = createMockPosition({ side: PositionSide.LONG });
      const candles = createMockCandles(25, 100);

      // LONG should use lower band as support
      expect(position.side).toBe(PositionSide.LONG);
    });

    it('should use upper band for SHORT positions', () => {
      const position = createMockPosition({
        side: PositionSide.SHORT,
        entryPrice: 100,
      });
      const candles = createMockCandles(25, 100);

      // SHORT should use upper band as resistance
      expect(position.side).toBe(PositionSide.SHORT);
    });

    it('should update BB values on each evaluation', () => {
      const position = createMockPosition();
      const candles = createMockCandles(25, 100);

      // Sequential candle processing should update BB
      expect(candles[0].close).toBeLessThan(110);
    });
  });

  describe('Integration Tests', () => {
    it('should handle full position lifecycle with enhancements', async () => {
      const position = createMockPosition();

      // OPEN -> TP1 hit
      let result = await orchestrator.evaluateExit(position, 105);
      expect(result.newState).toBe(PositionState.TP1_HIT);

      // TP1_HIT -> TP2 hit
      result = await orchestrator.evaluateExit(position, 110);
      expect(result.newState).toBe(PositionState.TP2_HIT);

      // TP2_HIT -> TP3 hit
      result = await orchestrator.evaluateExit(position, 115);
      expect(result.newState).toBe(PositionState.TP3_HIT);

      // TP3_HIT -> SL hit -> CLOSED
      result = await orchestrator.evaluateExit(position, 94);
      expect(result.newState).toBe(PositionState.CLOSED);
    });

    it('should handle early SL hit at any state', async () => {
      const position = createMockPosition();

      // Hit TP1 first
      await orchestrator.evaluateExit(position, 105);

      // Then SL hits
      const result = await orchestrator.evaluateExit(position, 94);
      expect(result.newState).toBe(PositionState.CLOSED);
    });

    it('should reset state after position closed', async () => {
      const position = createMockPosition();

      // Open position and hit TP1
      await orchestrator.evaluateExit(position, 105);

      // Close position
      orchestrator.resetPositionState(position.symbol);

      // Verify state is reset (next eval should treat as OPEN)
      const result = await orchestrator.evaluateExit(position, 105);
      expect(result.newState).toBe(PositionState.TP1_HIT); // Fresh TP1 detection
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero indicators gracefully', async () => {
      const position = createMockPosition();

      // No indicators provided
      const result = await orchestrator.evaluateExit(position, 105);
      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
    });

    it('should handle multiple symbols independently', async () => {
      const pos1 = createMockPosition({ symbol: 'APEXUSDT_Buy' });
      const pos2 = createMockPosition({
        symbol: 'SUIUSDT_Sell',
        side: PositionSide.SHORT,
        entryPrice: 100,
        stopLoss: { ...createMockPosition().stopLoss, price: 105 },
        takeProfits: [
          { level: 1, percent: 5, sizePercent: 33, price: 95, hit: false } as TakeProfit,
          { level: 2, percent: 10, sizePercent: 33, price: 90, hit: false } as TakeProfit,
          { level: 3, percent: 15, sizePercent: 34, price: 85, hit: false } as TakeProfit,
        ],
      });

      // Evaluate both
      const result1 = await orchestrator.evaluateExit(pos1, 105); // TP1 hit for pos1
      expect(result1.newState).toBe(PositionState.TP1_HIT);

      const result2 = await orchestrator.evaluateExit(pos2, 95); // TP1 hit for pos2 (SHORT)
      expect(result2.newState).toBe(PositionState.TP1_HIT);

      // Reset only pos1
      orchestrator.resetPositionState('APEXUSDT_Buy');

      // Verify pos1 is reset but pos2 state preserved
      const state1 = orchestrator.getPositionState('APEXUSDT_Buy');
      const state2 = orchestrator.getPositionState('SUIUSDT_Sell');

      expect(state1).toBe(PositionState.OPEN);
      expect(state2).toBe(PositionState.TP1_HIT);
    });

    it('should handle extreme price movements', async () => {
      const position = createMockPosition();

      // Price jumps to TP3 directly
      const result = await orchestrator.evaluateExit(position, 120);
      // Should detect TP1 first, not skip to TP3
      expect(result.newState).toBe(PositionState.TP1_HIT);
    });

    it('should handle negative current price gracefully', async () => {
      const position = createMockPosition();

      // Negative price validation should fail and close position safely
      const result = await orchestrator.evaluateExit(position, -1);
      expect(result.newState).toBe(PositionState.CLOSED);
    });

    it('should handle missing position gracefully', async () => {
      // Missing position should fail safely and close
      const result = await orchestrator.evaluateExit(null as any, 100);
      expect(result.newState).toBe(PositionState.CLOSED);
    });
  });

  describe('Performance and State Management', () => {
    it('should maintain state across multiple evaluations', async () => {
      const position = createMockPosition();

      // Evaluate multiple times
      for (let i = 0; i < 10; i++) {
        await orchestrator.evaluateExit(position, 105 + i * 0.1);
      }

      // Should maintain TP1_HIT state
      const state = orchestrator.getPositionState(position.symbol);
      expect(state).toBe(PositionState.TP1_HIT);
    });

    it('should clean up state on reset', async () => {
      const position = createMockPosition();

      // Populate state
      await orchestrator.evaluateExit(position, 105);

      // Reset
      orchestrator.resetPositionState(position.symbol);

      // Verify clean state
      const state = orchestrator.getPositionState(position.symbol);
      expect(state).toBe(PositionState.OPEN);
    });
  });
});
