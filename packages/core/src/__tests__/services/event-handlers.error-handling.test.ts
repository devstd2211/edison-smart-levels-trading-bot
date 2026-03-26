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
import type { LoggerService, Position, StopLossHitEvent, TakeProfitHitEvent } from '../../types/legacy';
import { ExchangeAPIError } from '../../errors/DomainErrors';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  createEventHandlersMockPosition,
  createManagedEventHandlersWebSocketContext,
  createManagedPositionEventHandlerContext,
  type EventHandlersExchangeMock,
  type EventHandlersJournalMock,
  type EventHandlersLoggerMock,
  type ManagedPositionEventHandlerContext,
  type ManagedWebSocketEventHandlerContext,
  type EventHandlersPositionExitingMock,
  type EventHandlersPositionManagerMock,
  type EventHandlersTelegramMock,
  type EventHandlersWebSocketManagerMock,
} from '../helpers/event-handlers-test.utils';

type TimeBasedExitInput = Parameters<PositionEventHandler['handleTimeBasedExit']>[0];
type OrderFilledInput = Parameters<WebSocketEventHandler['handleOrderFilled']>[0];
type StopLossFilledInput = Parameters<WebSocketEventHandler['handleStopLossFilled']>[0];

const asTimeBasedExit = (value: unknown): TimeBasedExitInput => value as TimeBasedExitInput;
const asOrderFilled = (value: unknown): OrderFilledInput => value as OrderFilledInput;
const asStopLossFilled = (value: unknown): StopLossFilledInput => value as StopLossFilledInput;

describe('Phase 8.9.4: PositionEventHandler - Error Handling Integration', () => {
  let handler: PositionEventHandler;
  let mockPositionManager: EventHandlersPositionManagerMock;
  let mockPositionExitingService: EventHandlersPositionExitingMock;
  let mockBybitService: EventHandlersExchangeMock;
  let mockTelegram: EventHandlersTelegramMock;
  let mockLogger: EventHandlersLoggerMock;
  let context: ManagedPositionEventHandlerContext;

  beforeEach(() => {
    context = createManagedPositionEventHandlerContext();
    mockPositionManager = context.mockPositionManager;
    mockPositionExitingService = context.mockPositionExitingService;
    mockBybitService = context.mockBybitService;
    mockTelegram = context.mockTelegram;
    mockLogger = context.mockLogger;
    handler = context.createStandardHandler();
  });

  afterEach(() => {
    context.cleanup();
  });

  describe('[SKIP] handleStopLossHit() - SL Event Logging (3 tests)', () => {
    it('test-8.9.4.1: Should skip when logger fails with non-blocking SKIP', async () => {
      const event: StopLossHitEvent = {
        position: createEventHandlersMockPosition(),
        currentPrice: 44000,
        reason: 'price below SL',
      };

      mockLogger.warn = jest.fn().mockImplementationOnce(() => {
        throw new Error('Logger service crashed');
      });

      await expect(handler.handleStopLossHit(event)).resolves.not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledTimes(3);
    });

    it('test-8.9.4.2: Should continue monitoring despite SL event logging failure', async () => {
      const event: StopLossHitEvent = {
        position: createEventHandlersMockPosition(),
        currentPrice: 44000,
        reason: 'price below SL',
      };

      mockLogger.warn = jest.fn().mockImplementationOnce(() => {
        throw new Error('Logger service down');
      });

      const result = await handler.handleStopLossHit(event);
      expect(result).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('test-8.9.4.3: Should successfully log SL hit when logger works', async () => {
      const event: StopLossHitEvent = {
        position: createEventHandlersMockPosition(),
        currentPrice: 44000,
        reason: 'price below SL',
      };

      mockLogger.warn = jest.fn();
      mockLogger.info = jest.fn();

      await handler.handleStopLossHit(event);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '🛑 STOP LOSS HIT (backup price detection)',
        expect.any(Object),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'SL hit detected via price check - waiting for WebSocket confirmation',
      );
    });
  });

  describe('[SKIP] handleTakeProfitHit() - TP Event Logging (3 tests)', () => {
    it('test-8.9.4.4: Should skip when logger fails for TP event', async () => {
      const event: TakeProfitHitEvent = {
        position: createEventHandlersMockPosition(),
        currentPrice: 46000,
        tpLevel: 1,
        reason: 'price above TP1',
      };

      mockLogger.info = jest.fn().mockImplementationOnce(() => {
        throw new Error('Logger service down');
      });

      await expect(handler.handleTakeProfitHit(event)).resolves.not.toThrow();
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('test-8.9.4.5: Should continue monitoring despite TP event logging failure', async () => {
      const event: TakeProfitHitEvent = {
        position: createEventHandlersMockPosition(),
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
        position: createEventHandlersMockPosition(),
        currentPrice: 48000,
        tpLevel: 3,
        reason: 'price above TP3',
      };

      mockLogger.info = jest.fn();

      await handler.handleTakeProfitHit(event);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'TAKE PROFIT 3 HIT',
        expect.any(Object),
      );
    });
  });

  describe('[GRACEFUL_DEGRADE + SKIP] handlePositionClosedExternally() (3 tests)', () => {
    it('test-8.9.4.7: Should GRACEFUL_DEGRADE when clearPosition fails', async () => {
      const position = createEventHandlersMockPosition();

      mockPositionManager.clearPosition = jest.fn(async () => {
        throw new Error('Position not found in memory');
      });

      await expect(handler.handlePositionClosedExternally(position)).resolves.not.toThrow();

      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
      expect(mockTelegram.sendAlert).toHaveBeenCalled();
    });

    it('test-8.9.4.8: Should SKIP Telegram notification on failure', async () => {
      const position = createEventHandlersMockPosition();

      mockPositionManager.clearPosition = jest.fn(async () => {});
      mockTelegram.sendAlert = jest.fn(async () => {
        throw new Error('Telegram API timeout');
      });

      await expect(handler.handlePositionClosedExternally(position)).resolves.not.toThrow();

      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
      expect(mockTelegram.sendAlert).toHaveBeenCalled();
    });

    it('test-8.9.4.9: Should successfully handle external close when dependencies work', async () => {
      const position = createEventHandlersMockPosition();

      mockPositionManager.clearPosition = jest.fn(async () => {});
      mockTelegram.sendAlert = jest.fn(async () => {});

      await handler.handlePositionClosedExternally(position);

      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
      expect(mockTelegram.sendAlert).toHaveBeenCalled();
    });
  });

  describe('[RETRY + FALLBACK] handleTimeBasedExit() (4 tests)', () => {
    it('test-8.9.4.10: Should RETRY on exchange API failure (transient)', async () => {
      const position = createEventHandlersMockPosition();
      const event = asTimeBasedExit({
        position,
        reason: 'duration exceeded',
        openedMinutes: 120,
        pnlPercent: 0.5,
      });

      let callCount = 0;
      mockBybitService.closePosition = jest.fn(async () => {
        callCount++;
        if (callCount === 1) {
          throw new ExchangeAPIError('API timeout', { endpoint: '/v5/position/close' });
        }
        if (callCount === 2) {
          throw new ExchangeAPIError('Connection reset', { endpoint: '/v5/position/close' });
        }
        return undefined;
      });

      await handler.handleTimeBasedExit(event);

      expect(mockBybitService.closePosition).toHaveBeenCalledTimes(3);
      expect(mockPositionExitingService.closeFullPosition).not.toHaveBeenCalled();
    });

    it('test-8.9.4.11: Should FALLBACK to PositionExitingService after retries exhausted', async () => {
      const position = createEventHandlersMockPosition();
      const event = asTimeBasedExit({
        position,
        reason: 'time limit',
        openedMinutes: 90,
        pnlPercent: 0.3,
      });

      mockBybitService.closePosition = jest.fn(async () => {
        throw new Error('API permanently down');
      });

      mockPositionExitingService.closeFullPosition = jest.fn(async () => {});
      mockPositionManager.clearPosition = jest.fn(async () => {});

      await handler.handleTimeBasedExit(event);

      expect(mockBybitService.closePosition).toHaveBeenCalled();
      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalled();
      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
    });

    it('test-8.9.4.12: Should use exponential backoff in RETRY attempts', async () => {
      const position = createEventHandlersMockPosition();
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
        if (callCount === 1) {
          throw new ExchangeAPIError('Network error', { endpoint: '/v5/position/close' });
        }
        return undefined;
      });

      const promise = handler.handleTimeBasedExit(event);

      await jest.advanceTimersByTimeAsync(50);
      expect(mockBybitService.closePosition).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(300);
      await promise;

      expect(mockBybitService.closePosition).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('test-8.9.4.13: Should successfully close position when exchange API works', async () => {
      const position = createEventHandlersMockPosition();
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

  describe('[THROW] handleMonitorError() - Critical Errors (2 tests)', () => {
    it('test-8.9.4.14: Should THROW on position monitor error', async () => {
      await expect(handler.handleMonitorError(new Error('Monitor service crashed'))).rejects.toThrow();
    });

    it('test-8.9.4.15: Should log critical error before throwing', async () => {
      mockLogger.error = jest.fn();

      try {
        await handler.handleMonitorError(new Error('Critical monitor failure'));
      } catch {
        // expected
      }

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});

describe('Phase 8.9.4: WebSocketEventHandler - Error Handling Integration', () => {
  let handler: WebSocketEventHandler;
  let mockPositionManager: EventHandlersPositionManagerMock;
  let mockPositionExitingService: EventHandlersPositionExitingMock;
  let mockBybitService: EventHandlersExchangeMock;
  let mockWebSocketManager: EventHandlersWebSocketManagerMock;
  let mockJournal: EventHandlersJournalMock;
  let mockTelegram: EventHandlersTelegramMock;
  let mockLogger: EventHandlersLoggerMock;
  let context: ManagedWebSocketEventHandlerContext;

  beforeEach(() => {
    context = createManagedEventHandlersWebSocketContext();
    ({
      handler,
      mockPositionManager,
      mockPositionExitingService,
      mockBybitService,
      mockWebSocketManager,
      mockJournal,
      mockTelegram,
      mockLogger,
    } = context);
  });

  afterEach(() => {
    context.cleanup();
  });

  describe('[RETRY + GRACEFUL_DEGRADE + SKIP] handlePositionClosed() (4 tests)', () => {
    it('test-8.9.4.16: Should RETRY on journal getTrade failure', async () => {
      const position = createEventHandlersMockPosition();
      mockPositionManager.getCurrentPosition = jest.fn().mockReturnValue(position);

      mockJournal.getTrade = jest
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('Journal file locked');
        })
        .mockReturnValueOnce(null);

      await handler.handlePositionClosed();

      expect(mockJournal.getTrade).toHaveBeenCalled();
      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalled();
    });

    it('test-8.9.4.17: Should GRACEFUL_DEGRADE when journal always fails', async () => {
      const position = createEventHandlersMockPosition();
      mockPositionManager.getCurrentPosition = jest.fn().mockReturnValue(position);

      mockJournal.getTrade = jest.fn().mockImplementation(() => {
        throw new Error('Persistent journal error');
      });
      mockPositionExitingService.closeFullPosition = jest.fn(async () => {});

      await expect(handler.handlePositionClosed()).resolves.not.toThrow();
      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalled();
    });

    it('test-8.9.4.18: Should SKIP Telegram notification on failure', async () => {
      const position = createEventHandlersMockPosition();
      mockPositionManager.getCurrentPosition = jest.fn().mockReturnValue(position);

      mockPositionExitingService.closeFullPosition = jest.fn(async () => {});
      mockTelegram.notifyPositionClosed = jest.fn(async () => {
        throw new Error('Telegram API error');
      });

      await expect(handler.handlePositionClosed()).resolves.not.toThrow();

      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalled();
      expect(mockTelegram.notifyPositionClosed).toHaveBeenCalled();
    });

    it('test-8.9.4.19: Should use atomic lock to prevent concurrent closes', async () => {
      const position = createEventHandlersMockPosition();
      mockPositionManager.getCurrentPosition = jest.fn().mockReturnValue(position);
      mockPositionExitingService.closeFullPosition = jest.fn(async () => {});

      await handler.handlePositionClosed();

      expect(mockPositionManager.closePositionWithAtomicLock).toHaveBeenCalledWith(
        'EXTERNAL_CLOSE',
        expect.any(Function),
      );
    });
  });

  describe('[SKIP] handleOrderFilled() - Order Logging (2 tests)', () => {
    it('test-8.9.4.20: Should SKIP on logger failure for order fill', async () => {
      mockLogger.info = jest.fn().mockImplementationOnce(() => {
        throw new Error('Logger crashed');
      });

      await expect(
        handler.handleOrderFilled(asOrderFilled({ orderId: 'order-1', qty: 0.1, price: 45000 })),
      ).resolves.not.toThrow();

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('test-8.9.4.21: Should successfully log order fill when logger works', async () => {
      mockLogger.info = jest.fn();

      await handler.handleOrderFilled(
        asOrderFilled({ orderId: 'order-1', qty: 0.1, price: 45000 }),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'WebSocket: Order filled',
        expect.any(Object),
      );
    });
  });

  describe('[SKIP] handleStopLossFilled() - SL Logging (2 tests)', () => {
    it('test-8.9.4.22: Should SKIP on logger failure for SL fill', async () => {
      mockLogger.info = jest.fn().mockImplementationOnce(() => {
        throw new Error('Logger unavailable');
      });

      await expect(
        handler.handleStopLossFilled(
          asStopLossFilled({ orderId: 'sl-order-1', avgPrice: 44000, cumExecQty: 0.1 }),
        ),
      ).resolves.not.toThrow();

      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('test-8.9.4.23: Should successfully log SL fill when logger works', async () => {
      mockLogger.info = jest.fn();

      await handler.handleStopLossFilled(
        asStopLossFilled({ orderId: 'sl-order-1', avgPrice: 44000, cumExecQty: 0.1 }),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'WebSocket: Stop Loss filled',
        expect.any(Object),
      );
    });
  });

  describe('[SKIP] handleError() - WebSocket Error Logging (2 tests)', () => {
    it('test-8.9.4.24: Should SKIP on logger failure for WebSocket error', async () => {
      mockLogger.error = jest.fn().mockImplementationOnce(() => {
        throw new Error('Logger down');
      });

      await expect(handler.handleError(new Error('WebSocket disconnected'))).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('test-8.9.4.25: Should log WebSocket error when logger works', async () => {
      mockLogger.error = jest.fn();

      await handler.handleError(new Error('Connection lost'));

      expect(mockLogger.error).toHaveBeenCalledWith(
        'WebSocket error',
        expect.any(Object),
      );
    });
  });

  describe('End-to-End Error Recovery Scenarios (2 tests)', () => {
    it('test-8.9.4.26: Should handle cascading failures gracefully', async () => {
      const position = createEventHandlersMockPosition();
      mockPositionManager.getCurrentPosition = jest.fn().mockReturnValue(position);

      mockJournal.getTrade = jest.fn().mockImplementation(() => {
        throw new Error('Journal locked');
      });
      mockPositionExitingService.closeFullPosition = jest.fn(async () => {
        throw new Error('Database error');
      });
      mockTelegram.notifyPositionClosed = jest.fn(async () => {
        throw new Error('Telegram timeout');
      });
      mockPositionManager.clearPosition = jest.fn(async () => {
        throw new Error('Memory error');
      });

      await expect(handler.handlePositionClosed()).resolves.not.toThrow();

      expect(mockJournal.getTrade).toHaveBeenCalled();
      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalled();
      expect(mockTelegram.notifyPositionClosed).toHaveBeenCalled();
      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
    });

    it('test-8.9.4.27: Should recover after transient failures', async () => {
      const position = createEventHandlersMockPosition();
      mockPositionManager.getCurrentPosition = jest.fn().mockReturnValue(position);

      let callCount = 0;
      mockJournal.getTrade = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new ExchangeAPIError('Journal lock timeout', { endpoint: '/journal/get' });
        }
        return null;
      });

      mockPositionExitingService.closeFullPosition = jest.fn(async () => {});

      await handler.handlePositionClosed();

      expect(mockJournal.getTrade).toHaveBeenCalledTimes(2);
      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalled();
    });
  });
});
