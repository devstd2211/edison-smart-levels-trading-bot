/**
 * Phase 8.9.4: Event Handlers - ErrorHandler Integration Tests
 *
 * Tests ErrorHandler integration in Position & WebSocket event handlers with:
 * - SKIP strategy for non-critical logging
 * - GRACEFUL_DEGRADE strategy for state cleanup & position sync
 * - RETRY strategy for transient I/O failures
 * - FALLBACK strategy for alternate close methods
 * - THROW strategy for critical monitor errors
 * - End-to-end error recovery scenarios
 *
 * Total: 27 comprehensive tests
 * - 15 tests for PositionEventHandler
 * - 12 tests for WebSocketEventHandler
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { PositionEventHandler } from '../../services/handlers/position.handler';
import { WebSocketEventHandler } from '../../services/handlers/websocket.handler';
import { PositionLifecycleService } from '../../services/position-lifecycle.service';
import { PositionExitingService } from '../../services/position-exiting.service';
import { WebSocketManagerService } from '../../services/websocket-manager.service';
import { TradingJournalService } from '../../services/trading-journal.service';
import { TelegramService } from '../../services/telegram.service';
import { LoggerService, Position, PositionSide, ExitType, LogLevel } from '../../types/legacy';
import { StopLossHitEvent, TakeProfitHitEvent } from '../../types/legacy';
import { IExchange } from '../../interfaces/IExchange';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { PositionMonitoringError, ExchangeAPIError } from '../../errors/DomainErrors';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const createMockPosition = (overrides: Partial<Position> = {}): Position => ({
  id: 'pos-123',
  symbol: 'BTCUSDT',
  side: PositionSide.LONG,
  quantity: 0.1,
  entryPrice: 45000,
  leverage: 10,
  marginUsed: 450,
  unrealizedPnL: 500,
  status: 'OPEN',
  openedAt: Date.now() - 3600000,
  orderId: 'order-123',
  reason: 'test-position',
  takeProfits: [
    { level: 1, percent: 0.5, sizePercent: 50, price: 46000, hit: false, orderId: 'tp-order-1' },
    { level: 2, percent: 1.0, sizePercent: 30, price: 47000, hit: false, orderId: 'tp-order-2' },
    { level: 3, percent: 1.5, sizePercent: 20, price: 48000, hit: false, orderId: 'tp-order-3' },
  ],
  stopLoss: {
    price: 44000,
    initialPrice: 44000,
    isBreakeven: false,
    isTrailing: false,
    updatedAt: Date.now(),
  },
  ...overrides,
});

const createMockLogger = () => {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
  };
};

type PositionManagerInput = ConstructorParameters<typeof PositionEventHandler>[0];
type PositionExitingInput = ConstructorParameters<typeof PositionEventHandler>[1];
type ExchangeInput = ConstructorParameters<typeof PositionEventHandler>[2];
type TelegramInput = ConstructorParameters<typeof PositionEventHandler>[3];
type PositionLoggerInput = ConstructorParameters<typeof PositionEventHandler>[4];
type WebSocketManagerInput = ConstructorParameters<typeof WebSocketEventHandler>[3];
type JournalInput = ConstructorParameters<typeof WebSocketEventHandler>[4];
type TimeBasedExitInput = Parameters<PositionEventHandler['handleTimeBasedExit']>[0];
type OrderFilledInput = Parameters<WebSocketEventHandler['handleOrderFilled']>[0];
type StopLossFilledInput = Parameters<WebSocketEventHandler['handleStopLossFilled']>[0];

const asPositionManager = (value: unknown): PositionManagerInput => value as PositionManagerInput;
const asPositionExiting = (value: unknown): PositionExitingInput => value as PositionExitingInput;
const asExchange = (value: unknown): ExchangeInput => value as ExchangeInput;
const asTelegram = (value: unknown): TelegramInput => value as TelegramInput;
const asPositionLogger = (value: unknown): PositionLoggerInput => value as PositionLoggerInput;
const asWebSocketManager = (value: unknown): WebSocketManagerInput => value as WebSocketManagerInput;
const asJournal = (value: unknown): JournalInput => value as JournalInput;
const asTimeBasedExit = (value: unknown): TimeBasedExitInput => value as TimeBasedExitInput;
const asOrderFilled = (value: unknown): OrderFilledInput => value as OrderFilledInput;
const asStopLossFilled = (value: unknown): StopLossFilledInput => value as StopLossFilledInput;

type PositionManagerMock = {
  getCurrentPosition: jest.Mock;
  clearPosition: jest.Mock;
  syncWithWebSocket: jest.Mock;
  closePositionWithAtomicLock: jest.Mock;
};
type PositionExitingMock = {
  closeFullPosition: jest.Mock;
  onTakeProfitHit: jest.Mock;
};
type ExchangeMock = {
  closePosition?: jest.Mock;
  getCurrentPrice: jest.Mock;
};
type TelegramMock = {
  sendAlert: jest.Mock;
  notifyPositionClosed: jest.Mock;
};
type WebSocketManagerMock = {
  getLastCloseReason: jest.Mock;
  resetLastCloseReason: jest.Mock;
};
type JournalMock = {
  getTrade: jest.Mock;
  recordTrade: jest.Mock;
};
type LoggerMock = ReturnType<typeof createMockLogger>;

// ============================================================================
// TESTS: PositionEventHandler (15 tests)
// ============================================================================

describe('Phase 8.9.4: PositionEventHandler - Error Handling Integration', () => {
  let handler: PositionEventHandler;
  let mockPositionManager: PositionManagerMock;
  let mockPositionExitingService: PositionExitingMock;
  let mockBybitService: ExchangeMock;
  let mockTelegram: TelegramMock;
  let mockLogger: LoggerMock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPositionManager = {
      getCurrentPosition: jest.fn(),
      clearPosition: jest.fn(async () => {}),
      syncWithWebSocket: jest.fn(async () => {}),
      closePositionWithAtomicLock: jest.fn(),
    };

    mockPositionExitingService = {
      closeFullPosition: jest.fn(async () => {}),
      onTakeProfitHit: jest.fn(async () => {}),
    };

    mockBybitService = {
      closePosition: jest.fn(async () => {}),
      getCurrentPrice: jest.fn(),
    };

    mockTelegram = {
      sendAlert: jest.fn(async () => {}),
      notifyPositionClosed: jest.fn(async () => {}),
    };

    mockLogger = createMockLogger();

    handler = new PositionEventHandler(
      asPositionManager(mockPositionManager),
      asPositionExiting(mockPositionExitingService),
      asExchange(mockBybitService),
      asTelegram(mockTelegram),
      asPositionLogger(mockLogger as unknown as LoggerService),
    );
  });

  // =========================================================================
  // handleStopLossHit() Tests [3 tests]
  // =========================================================================

  describe('[SKIP] handleStopLossHit() - SL Event Logging (3 tests)', () => {
    it('test-8.9.4.1: Should skip when logger fails with non-blocking SKIP', async () => {
      const event: StopLossHitEvent = {
        position: createMockPosition(),
        currentPrice: 44000,
        reason: 'price below SL',
      };

      mockLogger.warn = jest.fn().mockImplementationOnce(() => {
        throw new Error('Logger service crashed');
      });

      // Should not throw, should skip and continue
      await expect(handler.handleStopLossHit(event)).resolves.not.toThrow();

      // Logger attempted to warn (initial + ErrorHandler.skipStrategy + onRecover)
      expect(mockLogger.warn).toHaveBeenCalled();
      // 3 calls: original warn + skipStrategy warn + onRecover warn
      expect(mockLogger.warn).toHaveBeenCalledTimes(3);
    });

    it('test-8.9.4.2: Should continue monitoring despite SL event logging failure', async () => {
      const event: StopLossHitEvent = {
        position: createMockPosition(),
        currentPrice: 44000,
        reason: 'price below SL',
      };

      mockLogger.warn = jest.fn().mockImplementationOnce(() => {
        throw new Error('Logger service down');
      });

      const result = await handler.handleStopLossHit(event);

      // Handler should complete without throwing
      expect(result).toBeUndefined();
      // Should have attempted logging and recovery
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('test-8.9.4.3: Should successfully log SL hit when logger works', async () => {
      const event: StopLossHitEvent = {
        position: createMockPosition(),
        currentPrice: 44000,
        reason: 'price below SL',
      };

      mockLogger.warn = jest.fn();
      mockLogger.info = jest.fn();

      await handler.handleStopLossHit(event);

      // Both warn and info should be called
      expect(mockLogger.warn).toHaveBeenCalledWith('🛑 STOP LOSS HIT (backup price detection)', expect.any(Object));
      expect(mockLogger.info).toHaveBeenCalledWith('SL hit detected via price check - waiting for WebSocket confirmation');
    });
  });

  // =========================================================================
  // handleTakeProfitHit() Tests [3 tests]
  // =========================================================================

  describe('[SKIP] handleTakeProfitHit() - TP Event Logging (3 tests)', () => {
    it('test-8.9.4.4: Should skip when logger fails for TP event', async () => {
      const event: TakeProfitHitEvent = {
        position: createMockPosition(),
        currentPrice: 46000,
        tpLevel: 1,
        reason: 'price above TP1',
      };

      mockLogger.info = jest.fn().mockImplementationOnce(() => {
        throw new Error('Logger service down');
      });

      await expect(handler.handleTakeProfitHit(event)).resolves.not.toThrow();

      // Logger was attempted and failed
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('test-8.9.4.5: Should continue monitoring despite TP event logging failure', async () => {
      const event: TakeProfitHitEvent = {
        position: createMockPosition(),
        currentPrice: 47000,
        tpLevel: 2,
        reason: 'price above TP2',
      };

      mockLogger.info = jest.fn().mockImplementationOnce(() => {
        throw new Error('Logging failed');
      });

      const result = await handler.handleTakeProfitHit(event);

      expect(result).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('test-8.9.4.6: Should successfully log TP hit when logger works', async () => {
      const event: TakeProfitHitEvent = {
        position: createMockPosition(),
        currentPrice: 48000,
        tpLevel: 3,
        reason: 'price above TP3',
      };

      mockLogger.info = jest.fn();

      await handler.handleTakeProfitHit(event);

      expect(mockLogger.info).toHaveBeenCalledWith('TAKE PROFIT 3 HIT', expect.any(Object));
    });
  });

  // =========================================================================
  // handlePositionClosedExternally() Tests [3 tests]
  // =========================================================================

  describe('[GRACEFUL_DEGRADE + SKIP] handlePositionClosedExternally() (3 tests)', () => {
    it('test-8.9.4.7: Should GRACEFUL_DEGRADE when clearPosition fails', async () => {
      const position = createMockPosition();

      mockPositionManager.clearPosition = jest.fn(async () => {
        throw new Error('Position not found in memory');
      });

      await expect(handler.handlePositionClosedExternally(position)).resolves.not.toThrow();

      // Should have attempted clearPosition
      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
      // Should still try to send Telegram despite clearPosition failure
      expect(mockTelegram.sendAlert).toHaveBeenCalled();
    });

    it('test-8.9.4.8: Should SKIP Telegram notification on failure', async () => {
      const position = createMockPosition();

      mockPositionManager.clearPosition = jest.fn(async () => {});
      mockTelegram.sendAlert = jest.fn(async () => {
        throw new Error('Telegram API timeout');
      });

      await expect(handler.handlePositionClosedExternally(position)).resolves.not.toThrow();

      // clearPosition should succeed
      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
      // Telegram should have failed but handler continues
      expect(mockTelegram.sendAlert).toHaveBeenCalled();
    });

    it('test-8.9.4.9: Should successfully handle external close when dependencies work', async () => {
      const position = createMockPosition();

      mockPositionManager.clearPosition = jest.fn(async () => {});
      mockTelegram.sendAlert = jest.fn(async () => {});

      await handler.handlePositionClosedExternally(position);

      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
      expect(mockTelegram.sendAlert).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // handleTimeBasedExit() Tests [4 tests]
  // =========================================================================

  describe('[RETRY + FALLBACK] handleTimeBasedExit() (4 tests)', () => {
    it('test-8.9.4.10: Should RETRY on exchange API failure (transient)', async () => {
      const position = createMockPosition();
      const event = asTimeBasedExit({
        position,
        reason: 'duration exceeded',
        openedMinutes: 120,
        pnlPercent: 0.5,
      });

      // First 2 attempts fail, third succeeds
      let callCount = 0;
      mockBybitService.closePosition = jest.fn(async () => {
        callCount++;
        if (callCount === 1) throw new ExchangeAPIError('API timeout', { endpoint: '/v5/position/close' });
        if (callCount === 2) throw new ExchangeAPIError('Connection reset', { endpoint: '/v5/position/close' });
        return undefined;
      });

      await handler.handleTimeBasedExit(event);

      // Should have retried multiple times (RETRY strategy with 3 maxAttempts)
      expect(mockBybitService.closePosition).toHaveBeenCalledTimes(3);
      // No fallback needed since retry succeeded
      expect(mockPositionExitingService.closeFullPosition).not.toHaveBeenCalled();
    });

    it('test-8.9.4.11: Should FALLBACK to PositionExitingService after retries exhausted', async () => {
      const position = createMockPosition();
      const event = asTimeBasedExit({
        position,
        reason: 'time limit',
        openedMinutes: 90,
        pnlPercent: 0.3,
      });

      // All retries fail
      mockBybitService.closePosition = jest.fn(async () => {
        throw new Error('API permanently down');
      });

      mockPositionExitingService.closeFullPosition = jest.fn(async () => {});
      mockPositionManager.clearPosition = jest.fn(async () => {});

      await handler.handleTimeBasedExit(event);

      // Retries exhausted
      expect(mockBybitService.closePosition).toHaveBeenCalled();
      // Fallback to PositionExitingService
      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalled();
      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
    });

    it('test-8.9.4.12: Should use exponential backoff in RETRY attempts', async () => {
      const position = createMockPosition();
      const event = asTimeBasedExit({
        position,
        reason: 'max duration',
        openedMinutes: 60,
        pnlPercent: 0.2,
      });

      jest.useFakeTimers();

      let callCount = 0;
      mockBybitService.closePosition = jest.fn(async () => {
        callCount++;
        if (callCount === 1) throw new ExchangeAPIError('Network error', { endpoint: '/v5/position/close' });
        return undefined;
      });

      const promise = handler.handleTimeBasedExit(event);

      // Initial attempt fails immediately
      await jest.advanceTimersByTimeAsync(50);
      expect(mockBybitService.closePosition).toHaveBeenCalledTimes(1);

      // Advance through the full retry sequence with exponential backoff
      // Initial delay: 200ms, backoff: 2x, so second attempt at 200ms
      await jest.advanceTimersByTimeAsync(300);

      // Wait for promise to complete
      await promise;

      // Both initial attempt and retry should have happened
      expect(mockBybitService.closePosition).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('test-8.9.4.13: Should successfully close position when exchange API works', async () => {
      const position = createMockPosition();
      const event = asTimeBasedExit({
        position,
        reason: 'time-based rule',
        openedMinutes: 45,
        pnlPercent: 0.5,
      });

      mockBybitService.closePosition = jest.fn(async () => {});

      await handler.handleTimeBasedExit(event);

      expect(mockBybitService.closePosition).toHaveBeenCalledWith({
        positionId: 'pos-123',
        percentage: 100,
      });
    });
  });

  // =========================================================================
  // handleMonitorError() Tests [2 tests]
  // =========================================================================

  describe('[THROW] handleMonitorError() - Critical Errors (2 tests)', () => {
    it('test-8.9.4.14: Should THROW on position monitor error', async () => {
      const monitorError = new Error('Monitor service crashed');

      // Should wrap error in PositionMonitoringError and throw
      await expect(handler.handleMonitorError(monitorError)).rejects.toThrow();
    });

    it('test-8.9.4.15: Should log critical error before throwing', async () => {
      const monitorError = new Error('Critical monitor failure');

      mockLogger.error = jest.fn();

      try {
        await handler.handleMonitorError(monitorError);
      } catch {
        // Expected to throw
      }

      // Error should be logged
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// TESTS: WebSocketEventHandler (12 tests)
// ============================================================================

describe('Phase 8.9.4: WebSocketEventHandler - Error Handling Integration', () => {
  let handler: WebSocketEventHandler;
  let mockPositionManager: PositionManagerMock;
  let mockPositionExitingService: PositionExitingMock;
  let mockBybitService: ExchangeMock;
  let mockWebSocketManager: WebSocketManagerMock;
  let mockJournal: JournalMock;
  let mockTelegram: TelegramMock;
  let mockLogger: LoggerMock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPositionManager = {
      getCurrentPosition: jest.fn(),
      clearPosition: jest.fn(async () => {}),
      syncWithWebSocket: jest.fn(),
      closePositionWithAtomicLock: jest.fn(
        async (...args: unknown[]) => {
          const callback = args[1] as () => Promise<void>;
          await callback();
        },
      ),
    };

    mockPositionExitingService = {
      closeFullPosition: jest.fn(async () => {}),
      onTakeProfitHit: jest.fn(async () => {}),
    };

    mockBybitService = {
      getCurrentPrice: jest.fn(async () => 45500),
    };

    mockWebSocketManager = {
      getLastCloseReason: jest.fn(() => 'TP'),
      resetLastCloseReason: jest.fn(),
    };

    mockJournal = {
      getTrade: jest.fn(() => null),
      recordTrade: jest.fn(),
    };

    mockTelegram = {
      notifyPositionClosed: jest.fn(async () => {}),
      sendAlert: jest.fn(),
    };

    mockLogger = createMockLogger();

    handler = new WebSocketEventHandler(
      asPositionManager(mockPositionManager),
      asPositionExiting(mockPositionExitingService),
      asExchange(mockBybitService),
      asWebSocketManager(mockWebSocketManager),
      asJournal(mockJournal),
      asTelegram(mockTelegram),
      asPositionLogger(mockLogger as unknown as LoggerService),
    );
  });

  // =========================================================================
  // handlePositionClosed() Tests [4 tests]
  // =========================================================================

  describe('[RETRY + GRACEFUL_DEGRADE + SKIP] handlePositionClosed() (4 tests)', () => {
    it('test-8.9.4.16: Should RETRY on journal getTrade failure', async () => {
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition = jest.fn().mockReturnValue(position);

      // First call fails, second succeeds
      mockJournal.getTrade = jest
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('Journal file locked');
        })
        .mockReturnValueOnce(null);

      await handler.handlePositionClosed();

      // Should have retried journal lookup
      expect(mockJournal.getTrade).toHaveBeenCalled();
      // Should still record position close
      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalled();
    });

    it('test-8.9.4.17: Should GRACEFUL_DEGRADE when journal always fails', async () => {
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition = jest.fn().mockReturnValue(position);

      // Journal always fails
      mockJournal.getTrade = jest.fn().mockImplementation(() => {
        throw new Error('Persistent journal error');
      });

      mockPositionExitingService.closeFullPosition = jest.fn(async () => {});

      await expect(handler.handlePositionClosed()).resolves.not.toThrow();

      // Should degrade and continue without journal check
      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalled();
    });

    it('test-8.9.4.18: Should SKIP Telegram notification on failure', async () => {
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition = jest.fn().mockReturnValue(position);

      mockPositionExitingService.closeFullPosition = jest.fn(async () => {});
      mockTelegram.notifyPositionClosed = jest.fn(async () => {
        throw new Error('Telegram API error');
      });

      await expect(handler.handlePositionClosed()).resolves.not.toThrow();

      // Position should still be closed despite telegram failure
      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalled();
      expect(mockTelegram.notifyPositionClosed).toHaveBeenCalled();
    });

    it('test-8.9.4.19: Should use atomic lock to prevent concurrent closes', async () => {
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition = jest.fn().mockReturnValue(position);

      mockPositionExitingService.closeFullPosition = jest.fn(async () => {});

      await handler.handlePositionClosed();

      // Atomic lock should have been used
      expect(mockPositionManager.closePositionWithAtomicLock).toHaveBeenCalledWith(
        'EXTERNAL_CLOSE',
        expect.any(Function),
      );
    });
  });

  // =========================================================================
  // handleOrderFilled() Tests [2 tests]
  // =========================================================================

  describe('[SKIP] handleOrderFilled() - Order Logging (2 tests)', () => {
    it('test-8.9.4.20: Should SKIP on logger failure for order fill', async () => {
      mockLogger.info = jest.fn().mockImplementationOnce(() => {
        throw new Error('Logger crashed');
      });

      const order = { orderId: 'order-1', qty: 0.1, price: 45000 };
      await expect(handler.handleOrderFilled(asOrderFilled(order))).resolves.not.toThrow();

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('test-8.9.4.21: Should successfully log order fill when logger works', async () => {
      mockLogger.info = jest.fn();

      const order = { orderId: 'order-1', qty: 0.1, price: 45000 };
      await handler.handleOrderFilled(asOrderFilled(order));

      expect(mockLogger.info).toHaveBeenCalledWith('WebSocket: Order filled', expect.any(Object));
    });
  });

  // =========================================================================
  // handleStopLossFilled() Tests [2 tests]
  // =========================================================================

  describe('[SKIP] handleStopLossFilled() - SL Logging (2 tests)', () => {
    it('test-8.9.4.22: Should SKIP on logger failure for SL fill', async () => {
      mockLogger.info = jest.fn().mockImplementationOnce(() => {
        throw new Error('Logger unavailable');
      });

      const event = { orderId: 'sl-order-1', avgPrice: 44000, cumExecQty: 0.1 };
      await expect(handler.handleStopLossFilled(asStopLossFilled(event))).resolves.not.toThrow();

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('test-8.9.4.23: Should successfully log SL fill when logger works', async () => {
      mockLogger.info = jest.fn();

      const event = { orderId: 'sl-order-1', avgPrice: 44000, cumExecQty: 0.1 };
      await handler.handleStopLossFilled(asStopLossFilled(event));

      expect(mockLogger.info).toHaveBeenCalledWith('WebSocket: Stop Loss filled', expect.any(Object));
    });
  });

  // =========================================================================
  // handleError() Tests [2 tests]
  // =========================================================================

  describe('[SKIP] handleError() - WebSocket Error Logging (2 tests)', () => {
    it('test-8.9.4.24: Should SKIP on logger failure for WebSocket error', async () => {
      mockLogger.error = jest.fn().mockImplementationOnce(() => {
        throw new Error('Logger down');
      });

      const wsError = new Error('WebSocket disconnected');
      await expect(handler.handleError(wsError)).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('test-8.9.4.25: Should log WebSocket error when logger works', async () => {
      mockLogger.error = jest.fn();

      const wsError = new Error('Connection lost');
      await handler.handleError(wsError);

      expect(mockLogger.error).toHaveBeenCalledWith('WebSocket error', expect.any(Object));
    });
  });

  // =========================================================================
  // Integration & E2E Tests [2 tests]
  // =========================================================================

  describe('End-to-End Error Recovery Scenarios (2 tests)', () => {
    it('test-8.9.4.26: Should handle cascading failures gracefully', async () => {
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition = jest.fn().mockReturnValue(position);

      // Journal fails
      mockJournal.getTrade = jest.fn().mockImplementation(() => {
        throw new Error('Journal locked');
      });

      // Position exiting fails
      mockPositionExitingService.closeFullPosition = jest.fn(async () => {
        throw new Error('Database error');
      });

      // Telegram fails
      mockTelegram.notifyPositionClosed = jest.fn(async () => {
        throw new Error('Telegram timeout');
      });

      // Position clear fails
      mockPositionManager.clearPosition = jest.fn(async () => {
        throw new Error('Memory error');
      });

      // Despite all failures, handler should complete without throwing
      await expect(handler.handlePositionClosed()).resolves.not.toThrow();

      // All services should have been attempted
      expect(mockJournal.getTrade).toHaveBeenCalled();
      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalled();
      expect(mockTelegram.notifyPositionClosed).toHaveBeenCalled();
      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
    });

    it('test-8.9.4.27: Should recover after transient failures', async () => {
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition = jest.fn().mockReturnValue(position);

      let callCount = 0;
      // getTrade should fail once with a retryable error, then succeed
      mockJournal.getTrade = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Use ExchangeAPIError which is retryable
          throw new ExchangeAPIError('Journal lock timeout', { endpoint: '/journal/get' });
        }
        return null;
      });

      mockPositionExitingService.closeFullPosition = jest.fn(async () => {});

      await handler.handlePositionClosed();

      // Should have retried and succeeded
      expect(mockJournal.getTrade).toHaveBeenCalledTimes(2);
      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalled();
    });
  });
});
