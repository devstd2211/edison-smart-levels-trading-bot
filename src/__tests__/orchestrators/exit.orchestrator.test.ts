/**
 * ExitOrchestrator Unit Tests
 *
 * Tests all position exit logic:
 * - State transitions (OPEN → TP1_HIT → TP2_HIT → TP3_HIT → CLOSED)
 * - Stop Loss detection (ANY state → CLOSED)
 * - Take Profit hit detection
 * - Breakeven logic
 * - Trailing stop activation
 * - Edge cases and error handling
 */

import { ExitOrchestrator } from '../../orchestrators/exit.orchestrator';
import {
  Position,
  PositionState,
  ExitAction,
  PositionSide,
  LogLevel,
  TakeProfit,
} from '../../types';
import { LoggerService } from '../../services/logger.service';

// Test utilities
class TestLogger extends LoggerService {
  constructor() {
    super(LogLevel.INFO, './logs', false);
  }
}

function createPosition(
  side: PositionSide = PositionSide.LONG,
  entryPrice: number = 100,
  quantity: number = 1,
): Position {
  const tpPercents = [0.5, 1.0, 2.0];
  const takeProfits: TakeProfit[] = tpPercents.map((percent, index) => ({
    level: index + 1,
    percent,
    sizePercent: index === 0 ? 50 : index === 1 ? 30 : 20,
    price: side === PositionSide.LONG ? entryPrice * (1 + percent / 100) : entryPrice * (1 - percent / 100),
    hit: false,
  }));

  const slPrice = side === PositionSide.LONG ? entryPrice * 0.98 : entryPrice * 1.02;

  return {
    id: 'test-position-1',
    symbol: 'BTCUSDT',
    side,
    quantity,
    entryPrice,
    exitPrice: 0,
    leverage: 1,
    marginUsed: quantity * entryPrice,
    entryCondition: { signal: {}, indicators: {} } as any,
    openedAt: Date.now(),
    unrealizedPnL: 0,
    orderId: 'test-order-1',
    status: 'OPEN' as const,
    reason: 'test position',
    closedAt: 0,
    takeProfits,
    stopLoss: {
      price: slPrice,
      initialPrice: slPrice,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
  } as unknown as Position;
}

describe('ExitOrchestrator', () => {
  let orchestrator: ExitOrchestrator;
  let logger: TestLogger;

  beforeEach(() => {
    logger = new TestLogger();
    orchestrator = new ExitOrchestrator(logger);
  });

  describe('Basic Functionality', () => {
    it('should return OPEN state for position with no exit conditions', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      const result = await orchestrator.evaluateExit(position, 100.2); // Price slightly up, no TP/SL hit

      expect(result.newState).toBe(PositionState.OPEN);
      expect(result.actions.length).toBe(0);
    });

    it('should close position when Stop Loss hit', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      const result = await orchestrator.evaluateExit(position, position.stopLoss.price - 0.01); // Below SL

      expect(result.newState).toBe(PositionState.CLOSED);
      expect(result.actions).toContainEqual({ action: ExitAction.CLOSE_ALL });
    });

    it('should detect when TP1 is hit for LONG position', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);
      const tp1Price = position.takeProfits[0].price;

      const result = await orchestrator.evaluateExit(position, tp1Price + 0.01); // Above TP1

      expect(result.newState).toBe(PositionState.TP1_HIT);
      expect(result.actions).toContainEqual({ action: ExitAction.CLOSE_PERCENT, percent: 50 });
    });

    it('should detect when TP1 is hit for SHORT position', async () => {
      const position = createPosition(PositionSide.SHORT, 100, 1);
      const tp1Price = position.takeProfits[0].price;

      const result = await orchestrator.evaluateExit(position, tp1Price - 0.01); // Below TP1

      expect(result.newState).toBe(PositionState.TP1_HIT);
      expect(result.actions).toContainEqual({ action: ExitAction.CLOSE_PERCENT, percent: 50 });
    });
  });

  describe('State Transitions', () => {
    it('should transition from OPEN to TP1_HIT', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);
      const tp1Price = position.takeProfits[0].price;

      const result = await orchestrator.evaluateExit(position, tp1Price + 0.01);

      expect(result.newState).toBe(PositionState.TP1_HIT);
      expect(result.stateTransition).toContain('OPEN → TP1_HIT');
    });

    it('should transition from TP1_HIT to TP2_HIT', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);
      const tp1Price = position.takeProfits[0].price;
      const tp2Price = position.takeProfits[1].price;

      // First hit TP1
      await orchestrator.evaluateExit(position, tp1Price + 0.01);

      // Then hit TP2
      const result = await orchestrator.evaluateExit(position, tp2Price + 0.01);

      expect(result.newState).toBe(PositionState.TP2_HIT);
      expect(result.stateTransition).toContain('TP1_HIT → TP2_HIT');
    });

    it('should transition from TP2_HIT to TP3_HIT', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);
      const tp1Price = position.takeProfits[0].price;
      const tp2Price = position.takeProfits[1].price;
      const tp3Price = position.takeProfits[2].price;

      // Progress through states
      await orchestrator.evaluateExit(position, tp1Price + 0.01);
      await orchestrator.evaluateExit(position, tp2Price + 0.01);

      // Hit TP3
      const result = await orchestrator.evaluateExit(position, tp3Price + 0.01);

      expect(result.newState).toBe(PositionState.TP3_HIT);
      expect(result.stateTransition).toContain('TP2_HIT → TP3_HIT');
    });

    it('should handle full position lifecycle (OPEN → TP1 → TP2 → TP3)', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      // Hit TP1
      let result = await orchestrator.evaluateExit(position, position.takeProfits[0].price + 0.01);
      expect(result.newState).toBe(PositionState.TP1_HIT);
      expect(result.actions).toContainEqual({ action: ExitAction.CLOSE_PERCENT, percent: 50 });

      // Hit TP2
      result = await orchestrator.evaluateExit(position, position.takeProfits[1].price + 0.01);
      expect(result.newState).toBe(PositionState.TP2_HIT);
      expect(result.actions).toContainEqual({ action: ExitAction.CLOSE_PERCENT, percent: 30 });

      // Hit TP3
      result = await orchestrator.evaluateExit(position, position.takeProfits[2].price + 0.01);
      expect(result.newState).toBe(PositionState.TP3_HIT);
      expect(result.actions).toContainEqual({ action: ExitAction.CLOSE_PERCENT, percent: 20 });
    });
  });

  describe('Stop Loss Priority', () => {
    it('should close position on SL hit even if TP1 not yet reached', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      const result = await orchestrator.evaluateExit(position, position.stopLoss.price - 0.01);

      expect(result.newState).toBe(PositionState.CLOSED);
      expect(result.stateTransition).toContain('CLOSED (SL HIT)');
    });

    it('should close position on SL hit even after TP1 reached', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      // First hit TP1
      await orchestrator.evaluateExit(position, position.takeProfits[0].price + 0.01);

      // Then SL hit
      const result = await orchestrator.evaluateExit(position, position.stopLoss.price - 0.01);

      expect(result.newState).toBe(PositionState.CLOSED);
    });

    it('should close on SL for SHORT position', async () => {
      const position = createPosition(PositionSide.SHORT, 100, 1);

      const result = await orchestrator.evaluateExit(position, position.stopLoss.price + 0.01);

      expect(result.newState).toBe(PositionState.CLOSED);
    });
  });

  describe('Breakeven Logic', () => {
    it('should move SL to breakeven when TP1 hit', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      const result = await orchestrator.evaluateExit(position, position.takeProfits[0].price + 0.01);

      expect(result.actions).toContainEqual(
        expect.objectContaining({ action: ExitAction.UPDATE_SL })
      );

      const updateSLAction = result.actions.find(a => a.action === ExitAction.UPDATE_SL);
      expect(updateSLAction?.newStopLoss).toBeGreaterThan(position.entryPrice);
      expect(updateSLAction?.newStopLoss).toBeLessThan(position.takeProfits[0].price);
    });

    it('should lock in small profit on breakeven', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      const result = await orchestrator.evaluateExit(position, position.takeProfits[0].price + 0.01);

      const updateSLAction = result.actions.find(a => a.action === ExitAction.UPDATE_SL);
      const newSL = updateSLAction?.newStopLoss || 0;

      // Should be slightly above entry price for LONG
      expect(newSL).toBeGreaterThan(position.entryPrice);
    });
  });

  describe('Trailing Stop', () => {
    it('should activate trailing stop when TP2 hit', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      // Hit TP1 first
      await orchestrator.evaluateExit(position, position.takeProfits[0].price + 0.01);

      // Then hit TP2
      const result = await orchestrator.evaluateExit(position, position.takeProfits[1].price + 0.01);

      expect(result.actions).toContainEqual(
        expect.objectContaining({ action: ExitAction.ACTIVATE_TRAILING })
      );
    });

    it('should calculate trailing distance based on ATR (SmartTrailingV2)', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      // Hit TP1
      await orchestrator.evaluateExit(position, position.takeProfits[0].price + 0.01);

      // Hit TP2 with ATR provided
      const result = await orchestrator.evaluateExit(position, position.takeProfits[1].price + 0.01, {
        atrPercent: 2.0, // 2% ATR
      });

      const trailingAction = result.actions.find(a => a.action === ExitAction.ACTIVATE_TRAILING);
      expect(trailingAction?.trailingDistance).toBeGreaterThan(0);
      // SmartTrailingV2 with 2% ATR should produce ~2.0 distance (2% of 100 entry price)
      // Min ATR is 1.5%, so minimum distance ~1.5
      // Max ATR is 3%, so maximum distance ~3.0
      expect(trailingAction?.trailingDistance).toBeLessThanOrEqual(3.5);
      expect(trailingAction?.trailingDistance).toBeGreaterThanOrEqual(1.5);
    });
  });

  describe('Close Percentages', () => {
    it('should close 50% on TP1 hit', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      const result = await orchestrator.evaluateExit(position, position.takeProfits[0].price + 0.01);

      const closeAction = result.actions.find(a => a.action === ExitAction.CLOSE_PERCENT);
      expect(closeAction?.percent).toBe(50);
    });

    it('should close 30% on TP2 hit', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      await orchestrator.evaluateExit(position, position.takeProfits[0].price + 0.01);
      const result = await orchestrator.evaluateExit(position, position.takeProfits[1].price + 0.01);

      const closeAction = result.actions.find(a => a.action === ExitAction.CLOSE_PERCENT);
      expect(closeAction?.percent).toBe(30);
    });

    it('should close 20% on TP3 hit', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      await orchestrator.evaluateExit(position, position.takeProfits[0].price + 0.01);
      await orchestrator.evaluateExit(position, position.takeProfits[1].price + 0.01);
      const result = await orchestrator.evaluateExit(position, position.takeProfits[2].price + 0.01);

      const closeAction = result.actions.find(a => a.action === ExitAction.CLOSE_PERCENT);
      expect(closeAction?.percent).toBe(20);
    });
  });

  describe('Input Validation - FAST FAIL', () => {
    it('should return CLOSED on invalid position (null)', async () => {
      const result = await orchestrator.evaluateExit(null as any, 100);

      expect(result.newState).toBe(PositionState.CLOSED);
      expect(result.actions).toContainEqual({ action: ExitAction.CLOSE_ALL });
    });

    it('should return CLOSED on invalid price (0)', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      const result = await orchestrator.evaluateExit(position, 0);

      expect(result.newState).toBe(PositionState.CLOSED);
    });

    it('should return CLOSED on negative price', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      const result = await orchestrator.evaluateExit(position, -100);

      expect(result.newState).toBe(PositionState.CLOSED);
    });
  });

  describe('Position State Management', () => {
    it('should reset position state when closed', () => {
      orchestrator.getPositionState('BTCUSDT'); // Initialize

      orchestrator.resetPositionState('BTCUSDT');

      expect(orchestrator.getPositionState('BTCUSDT')).toBe(PositionState.OPEN);
    });

    it('should track state for different positions separately', async () => {
      const position1 = createPosition(PositionSide.LONG, 100, 1);
      position1.symbol = 'BTCUSDT';

      const position2 = createPosition(PositionSide.SHORT, 50, 1);
      position2.symbol = 'ETHUSDT';

      // Progress position1
      await orchestrator.evaluateExit(position1, position1.takeProfits[0].price + 0.01);

      // Position2 stays at OPEN
      const result2 = await orchestrator.evaluateExit(position2, 50.5);

      expect(orchestrator.getPositionState('BTCUSDT')).toBe(PositionState.TP1_HIT);
      expect(orchestrator.getPositionState('ETHUSDT')).toBe(PositionState.OPEN);
      expect(result2.newState).toBe(PositionState.OPEN);
    });
  });

  describe('Edge Cases', () => {
    it('should handle exact price match on TP level', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);
      const tp1Price = position.takeProfits[0].price;

      const result = await orchestrator.evaluateExit(position, tp1Price); // Exact match

      expect(result.newState).toBe(PositionState.TP1_HIT);
    });

    it('should handle exact price match on SL', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);
      const slPrice = position.stopLoss.price;

      const result = await orchestrator.evaluateExit(position, slPrice); // Exact match

      expect(result.newState).toBe(PositionState.CLOSED);
    });

    it('should handle position with missing take profit levels', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);
      position.takeProfits = [];

      const result = await orchestrator.evaluateExit(position, 110);

      expect(result.newState).toBe(PositionState.OPEN);
      expect(result.actions.length).toBe(0);
    });

    it('should handle multiple TPs at same price (edge case)', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);
      position.takeProfits[1].price = position.takeProfits[0].price; // Same TP levels

      const result = await orchestrator.evaluateExit(position, position.takeProfits[0].price + 0.01);

      // Should hit the first one
      expect(result.newState).toBe(PositionState.TP1_HIT);
    });

    it('should handle very large position quantities', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1000000);

      const result = await orchestrator.evaluateExit(position, position.takeProfits[0].price + 0.01);

      expect(result.newState).toBe(PositionState.TP1_HIT);
      expect(result.actions).toContainEqual({ action: ExitAction.CLOSE_PERCENT, percent: 50 });
    });

    it('should handle very small position prices', async () => {
      const position = createPosition(PositionSide.LONG, 0.00001, 1);

      const result = await orchestrator.evaluateExit(position, position.takeProfits[0].price + 0.000001);

      expect(result.newState).toBe(PositionState.TP1_HIT);
    });
  });

  describe('Logging & Debugging', () => {
    it('should log state transitions', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      const result = await orchestrator.evaluateExit(position, position.takeProfits[0].price + 0.01);

      expect(result.stateTransition).toBeDefined();
      expect(result.stateTransition).toContain('→');
    });

    it('should include actions in result for debugging', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      const result = await orchestrator.evaluateExit(position, position.takeProfits[0].price + 0.01);

      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);
    });
  });
});
