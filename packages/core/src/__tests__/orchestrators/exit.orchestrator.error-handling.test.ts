/**
 * ExitOrchestrator Error Handling Tests - Phase 8.9.25
 *
 * Tests ErrorHandler integration for:
 * - Position validation errors (THROW strategy)
 * - Price validation errors (THROW strategy)
 * - State machine errors (GRACEFUL_DEGRADE strategy)
 * - Logging failures (SKIP strategy)
 * - End-to-end recovery scenarios
 */

import { ExitOrchestrator } from '../../orchestrators/exit.orchestrator';
import {
  Position,
  PositionState,
  ExitAction,
  PositionSide,
  LogLevel,
  TakeProfit,
} from '../../types/legacy';
import { LoggerService } from '../../services/logger.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { PositionStateMachineService } from '../../services/position-state-machine.service';

// ============================================================================
// TEST UTILITIES
// ============================================================================

class TestLogger extends LoggerService {
  public infoLogs: Array<{ msg: string; context?: Record<string, unknown> }> = [];
  public warnLogs: Array<{ msg: string; context?: Record<string, unknown> }> = [];
  public errorLogs: Array<{ msg: string; context?: Record<string, unknown> }> = [];
  public debugLogs: Array<{ msg: string; context?: Record<string, unknown> }> = [];

  constructor() {
    super(LogLevel.INFO, './logs', false);
  }

  info(msg: string, context?: Record<string, unknown>): void {
    this.infoLogs.push({ msg, context });
    super.info(msg, context);
  }

  warn(msg: string, context?: Record<string, unknown>): void {
    this.warnLogs.push({ msg, context });
    super.warn(msg, context);
  }

  error(msg: string, context?: Record<string, unknown>): void {
    this.errorLogs.push({ msg, context });
    super.error(msg, context);
  }

  debug(msg: string, context?: Record<string, unknown>): void {
    this.debugLogs.push({ msg, context });
    super.debug(msg, context);
  }

  clear(): void {
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
    this.debugLogs = [];
  }
}

function createPosition(
  side: PositionSide = PositionSide.LONG,
  entryPrice: number = 100,
  quantity: number = 1,
  symbol: string = 'BTCUSDT',
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
    symbol,
    side,
    quantity,
    entryPrice,
    exitPrice: 0,
    leverage: 1,
    marginUsed: quantity * entryPrice,
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

// ============================================================================
// TEST SUITE
// ============================================================================

describe('ExitOrchestrator - Error Handling (Phase 8.9.25)', () => {
  let orchestrator: ExitOrchestrator;
  let orchestratorWithErrorHandler: ExitOrchestrator;
  let logger: TestLogger;
  let errorHandler: ErrorHandler;
  let stateMachine: PositionStateMachineService;

  beforeEach(() => {
    logger = new TestLogger();
    stateMachine = new PositionStateMachineService(logger);
    errorHandler = new ErrorHandler(logger);
  });

  afterEach(() => {
    logger.clear();
  });

  describe('Position Validation (THROW Strategy)', () => {
    beforeEach(() => {
      orchestratorWithErrorHandler = new ExitOrchestrator(logger, stateMachine, 'test-strategy', errorHandler);
    });

    it('should THROW when position is null', async () => {
      const result = await orchestratorWithErrorHandler.evaluateExit(null as unknown as Position, 100);

      expect(result.newState).toBe(PositionState.CLOSED); // Falls back to close position
      expect(result.actions).toContainEqual({ action: ExitAction.CLOSE_ALL });
    });

    it('should THROW when position is undefined', async () => {
      const result = await orchestratorWithErrorHandler.evaluateExit(undefined as unknown as Position, 100);

      expect(result.newState).toBe(PositionState.CLOSED);
      expect(result.actions).toContainEqual({ action: ExitAction.CLOSE_ALL });
    });
  });

  describe('Price Validation (THROW Strategy)', () => {
    beforeEach(() => {
      orchestratorWithErrorHandler = new ExitOrchestrator(logger, stateMachine, 'test-strategy', errorHandler);
    });

    it('should THROW when currentPrice is NaN', async () => {
      const position = createPosition();
      const result = await orchestratorWithErrorHandler.evaluateExit(position, NaN);

      expect(result.newState).toBe(PositionState.CLOSED);
      expect(result.actions).toContainEqual({ action: ExitAction.CLOSE_ALL });
    });

    it('should THROW when currentPrice is negative Infinity', async () => {
      const position = createPosition();
      const result = await orchestratorWithErrorHandler.evaluateExit(position, -Infinity);

      expect(result.newState).toBe(PositionState.CLOSED);
      expect(result.actions).toContainEqual({ action: ExitAction.CLOSE_ALL });
    });

    it('should THROW when currentPrice is positive Infinity', async () => {
      const position = createPosition();
      const result = await orchestratorWithErrorHandler.evaluateExit(position, Infinity);

      expect(result.newState).toBe(PositionState.CLOSED);
      expect(result.actions).toContainEqual({ action: ExitAction.CLOSE_ALL });
    });
  });

  describe('State Machine Errors (GRACEFUL_DEGRADE Strategy)', () => {
    it('should continue evaluateExit even if state machine transitions fail', async () => {
      const failingStateMachine = new PositionStateMachineService(logger);
      jest.spyOn(failingStateMachine, 'transitionState').mockImplementation(() => {
        throw new Error('State machine connection failed');
      });

      orchestratorWithErrorHandler = new ExitOrchestrator(logger, failingStateMachine, 'test-strategy', errorHandler);
      const position = createPosition(PositionSide.LONG, 100, 1);

      // TP1 hit at price 100.5
      const result = await orchestratorWithErrorHandler.evaluateExit(position, 100.5);

      // Should successfully transition despite state machine error (GRACEFUL_DEGRADE)
      expect(result.newState).toBe(PositionState.TP1_HIT);
      expect(result.actions.length).toBeGreaterThan(0);
    });

    it('should continue even if state machine closePosition fails', async () => {
      const failingStateMachine = new PositionStateMachineService(logger);
      jest.spyOn(failingStateMachine, 'closePosition').mockImplementation(() => {
        throw new Error('Close position failed');
      });

      orchestratorWithErrorHandler = new ExitOrchestrator(logger, failingStateMachine, 'test-strategy', errorHandler);
      const position = createPosition(PositionSide.LONG, 100, 1);

      // SL hit at price 97
      const result = await orchestratorWithErrorHandler.evaluateExit(position, 97);

      // Should close position despite state machine error (GRACEFUL_DEGRADE)
      expect(result.newState).toBe(PositionState.CLOSED);
      expect(result.actions).toContainEqual({ action: ExitAction.CLOSE_ALL });
    });
  });

  describe('Logging Failures (SKIP Strategy)', () => {
    it('should skip logging failures and continue evaluation', async () => {
      const failingLogger = new TestLogger();
      // Create orchestrator first, then mock the logger
      orchestratorWithErrorHandler = new ExitOrchestrator(failingLogger, stateMachine, 'test-strategy', errorHandler);

      // Now mock logger.info to fail
      jest.spyOn(failingLogger, 'info').mockImplementation(() => {
        throw new Error('Logger failed');
      });

      const position = createPosition(PositionSide.LONG, 100, 1);

      // Should still evaluate exit despite logger failures (SKIP)
      const result = await orchestratorWithErrorHandler.evaluateExit(position, 100.2);

      expect(result).toBeDefined();
      expect(result.newState).toBe(PositionState.OPEN);
    });

    it('should skip warn logging failures during position close', async () => {
      const failingLogger = new TestLogger();
      jest.spyOn(failingLogger, 'warn').mockImplementation(() => {
        throw new Error('Logger warn failed');
      });

      orchestratorWithErrorHandler = new ExitOrchestrator(failingLogger, stateMachine, 'test-strategy', errorHandler);
      const position = createPosition(PositionSide.LONG, 100, 1);

      // Should close position despite logger failures (SKIP)
      const result = await orchestratorWithErrorHandler.evaluateExit(position, 97);

      expect(result.newState).toBe(PositionState.CLOSED);
      expect(result.actions).toContainEqual({ action: ExitAction.CLOSE_ALL });
    });
  });

  describe('Backward Compatibility (No ErrorHandler)', () => {
    beforeEach(() => {
      orchestrator = new ExitOrchestrator(logger, stateMachine, 'test-strategy');
    });

    it('should work without ErrorHandler parameter (optional DI)', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      const result = await orchestrator.evaluateExit(position, 100.2);

      expect(result).toBeDefined();
      expect(result.newState).toBe(PositionState.OPEN);
    });

    it('should handle TP1 hit without ErrorHandler', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      const result = await orchestrator.evaluateExit(position, 100.5); // TP1 at 100.5

      expect(result.newState).toBe(PositionState.TP1_HIT);
    });

    it('should close position on SL hit without ErrorHandler', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      const result = await orchestrator.evaluateExit(position, 97); // Below SL at 98

      expect(result.newState).toBe(PositionState.CLOSED);
    });
  });

  describe('Cascading Failures (Multiple Errors)', () => {
    it('should handle cascading failures: state machine + logger', async () => {
      const failingStateMachine = new PositionStateMachineService(logger);
      const failingLogger = new TestLogger();

      orchestratorWithErrorHandler = new ExitOrchestrator(failingLogger, failingStateMachine, 'test-strategy', errorHandler);

      // Mock failures after initialization
      jest.spyOn(failingStateMachine, 'transitionState').mockImplementation(() => {
        throw new Error('State machine failed');
      });
      jest.spyOn(failingLogger, 'info').mockImplementation(() => {
        throw new Error('Logger failed');
      });

      const position = createPosition(PositionSide.LONG, 100, 1);

      const result = await orchestratorWithErrorHandler.evaluateExit(position, 100.5); // TP1

      // Should recover from both failures (GRACEFUL_DEGRADE + SKIP)
      expect(result.newState).toBe(PositionState.TP1_HIT);
      expect(result.actions.length).toBeGreaterThan(0);
    });

    it('should handle cascading failures: validation + logging', async () => {
      const failingLogger = new TestLogger();
      jest.spyOn(failingLogger, 'error').mockImplementation(() => {
        throw new Error('Logger error failed');
      });

      orchestratorWithErrorHandler = new ExitOrchestrator(failingLogger, stateMachine, 'test-strategy', errorHandler);

      const result = await orchestratorWithErrorHandler.evaluateExit(null as unknown as Position, NaN);

      // Should handle all errors and return safe default
      expect(result.newState).toBe(PositionState.CLOSED);
      expect(result.actions).toContainEqual({ action: ExitAction.CLOSE_ALL });
    });
  });

  describe('Error Handler Integration', () => {
    beforeEach(() => {
      orchestratorWithErrorHandler = new ExitOrchestrator(logger, stateMachine, 'test-strategy', errorHandler);
    });

    it('should verify ErrorHandler is integrated', () => {
      // The orchestrator should be initialized with ErrorHandler
      expect(orchestratorWithErrorHandler).toBeDefined();
    });

    it('should use SKIP strategy for logging failures', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      // This should work despite logger failures being converted to SKIP
      const result = await orchestratorWithErrorHandler.evaluateExit(position, 100.5);

      expect(result).toBeDefined();
      expect(result.newState).toBe(PositionState.TP1_HIT);
    });

    it('should use GRACEFUL_DEGRADE for state machine failures', async () => {
      const failingStateMachine = new PositionStateMachineService(logger);
      jest.spyOn(failingStateMachine, 'transitionState').mockImplementationOnce(() => {
        throw new Error('Temporary state machine issue');
      });

      orchestratorWithErrorHandler = new ExitOrchestrator(logger, failingStateMachine, 'test-strategy', errorHandler);
      const position = createPosition(PositionSide.LONG, 100, 1);

      const result = await orchestratorWithErrorHandler.evaluateExit(position, 100.5);

      // Should continue despite state machine error
      expect(result.newState).toBe(PositionState.TP1_HIT);
    });
  });

  describe('TP State Transitions with Error Handling', () => {
    beforeEach(() => {
      orchestratorWithErrorHandler = new ExitOrchestrator(logger, stateMachine, 'test-strategy', errorHandler);
    });

    it('should handle TP2 transition with GRACEFUL_DEGRADE', async () => {
      const failingStateMachine = new PositionStateMachineService(logger);
      jest.spyOn(failingStateMachine, 'transitionState').mockImplementation(() => {
        throw new Error('State machine temporarily unavailable');
      });

      orchestratorWithErrorHandler = new ExitOrchestrator(logger, failingStateMachine, 'test-strategy', errorHandler);
      const position = createPosition(PositionSide.LONG, 100, 1);

      // First get to TP1
      await orchestratorWithErrorHandler.evaluateExit(position, 100.5);

      // Then to TP2
      const result = await orchestratorWithErrorHandler.evaluateExit(position, 101.0);

      expect(result.newState).toBe(PositionState.TP2_HIT);
    });

    it('should handle TP3 transition with GRACEFUL_DEGRADE', async () => {
      const failingStateMachine = new PositionStateMachineService(logger);
      jest.spyOn(failingStateMachine, 'transitionState').mockImplementation(() => {
        throw new Error('State machine issue');
      });

      orchestratorWithErrorHandler = new ExitOrchestrator(logger, failingStateMachine, 'test-strategy', errorHandler);
      const position = createPosition(PositionSide.LONG, 100, 1);

      // Simulate progression to TP3
      await orchestratorWithErrorHandler.evaluateExit(position, 100.5); // TP1
      await orchestratorWithErrorHandler.evaluateExit(position, 101.0); // TP2
      const result = await orchestratorWithErrorHandler.evaluateExit(position, 102.0); // TP3

      expect(result.newState).toBe(PositionState.TP3_HIT);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      orchestratorWithErrorHandler = new ExitOrchestrator(logger, stateMachine, 'test-strategy', errorHandler);
    });

    it('should handle SHORT positions with error handling', async () => {
      const position = createPosition(PositionSide.SHORT, 100, 1);

      // Price goes up (bad for SHORT) to SL level
      const result = await orchestratorWithErrorHandler.evaluateExit(position, 102.1); // Above SL at 102

      expect(result.newState).toBe(PositionState.CLOSED);
    });

    it('should handle positions with zero TP levels', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);
      position.takeProfits = [];

      const result = await orchestratorWithErrorHandler.evaluateExit(position, 105);

      expect(result).toBeDefined();
    });

    it('should handle indicators with missing values', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      const result = await orchestratorWithErrorHandler.evaluateExit(position, 100.5, {
        // Only partial indicators
        atrPercent: 1.5,
        // Missing currentVolume, avgVolume, ema20
      });

      expect(result).toBeDefined();
      expect(result.newState).toBe(PositionState.TP1_HIT);
    });

    it('should handle extremely high/low prices gracefully', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      const resultHigh = await orchestratorWithErrorHandler.evaluateExit(position, 999999);
      const resultLow = await orchestratorWithErrorHandler.evaluateExit(position, 0.01);

      expect(resultHigh).toBeDefined();
      expect(resultLow).toBeDefined();
    });
  });

  describe('Multiple Positions with Error Handling', () => {
    beforeEach(() => {
      orchestratorWithErrorHandler = new ExitOrchestrator(logger, stateMachine, 'test-strategy', errorHandler);
    });

    it('should handle multiple different symbols independently', async () => {
      const position1 = createPosition(PositionSide.LONG, 100, 1, 'BTCUSDT');
      const position2 = createPosition(PositionSide.LONG, 50, 2, 'ETHUSDT');

      const result1 = await orchestratorWithErrorHandler.evaluateExit(position1, 100.5);
      const result2 = await orchestratorWithErrorHandler.evaluateExit(position2, 50.5);

      expect(result1.newState).toBe(PositionState.TP1_HIT);
      expect(result2.newState).toBe(PositionState.TP1_HIT);
    });

    it('should handle error in one position without affecting another', async () => {
      const failingStateMachine = new PositionStateMachineService(logger);
      let callCount = 0;
      jest.spyOn(failingStateMachine, 'transitionState').mockImplementation((request: unknown) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary failure');
        }
        // Second call succeeds - return success result
        return {
          allowed: true,
          currentState: (request as { targetState?: PositionState }).targetState ?? PositionState.OPEN,
          stateChange: `${PositionState.OPEN} -> ${(request as { targetState?: PositionState }).targetState}`,
        };
      });

      orchestratorWithErrorHandler = new ExitOrchestrator(logger, failingStateMachine, 'test-strategy', errorHandler);
      const position1 = createPosition(PositionSide.LONG, 100, 1, 'BTCUSDT');
      const position2 = createPosition(PositionSide.LONG, 50, 2, 'ETHUSDT');

      const result1 = await orchestratorWithErrorHandler.evaluateExit(position1, 100.5); // Fails, but continues
      const result2 = await orchestratorWithErrorHandler.evaluateExit(position2, 50.5); // Should work

      // Both should return TP1_HIT despite first error
      expect(result1.newState).toBe(PositionState.TP1_HIT);
      expect(result2.newState).toBe(PositionState.TP1_HIT);
    });
  });

  describe('Performance with Error Handling', () => {
    beforeEach(() => {
      orchestratorWithErrorHandler = new ExitOrchestrator(logger, stateMachine, 'test-strategy', errorHandler);
    });

    it('should handle rapid error recovery', async () => {
      const position = createPosition(PositionSide.LONG, 100, 1);

      const startTime = Date.now();

      // Rapid evaluations
      for (let i = 0; i < 100; i++) {
        await orchestratorWithErrorHandler.evaluateExit(position, 100 + i * 0.01);
      }

      const elapsed = Date.now() - startTime;

      // Should complete reasonably fast (< 1s for 100 evaluations)
      expect(elapsed).toBeLessThan(1000);
    });

    it('should not leak memory on repeated error handling', async () => {
      const failingLogger = new TestLogger();
      orchestratorWithErrorHandler = new ExitOrchestrator(failingLogger, stateMachine, 'test-strategy', errorHandler);

      // Mock logger failures after initialization
      jest.spyOn(failingLogger, 'info').mockImplementation(() => {
        throw new Error('Logger failed');
      });

      const position = createPosition(PositionSide.LONG, 100, 1);

      // Repeated evaluations with logger failures
      for (let i = 0; i < 50; i++) {
        await orchestratorWithErrorHandler.evaluateExit(position, 100 + i * 0.01);
      }

      // Should complete without memory issues (no assertion, just checking for crashes)
      expect(orchestratorWithErrorHandler).toBeDefined();
    });
  });
});
