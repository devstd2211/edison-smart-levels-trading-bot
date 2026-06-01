/**
 * Event Handlers Tests
 *
 * Tests the extracted event handlers:
 * - PositionEventHandler
 * - WebSocketEventHandler
 */

import { PositionEventHandler } from '../services/handlers/position.handler';
import { WebSocketEventHandler } from '../services/handlers/websocket.handler';
import { Position, ExitType } from '../types/legacy';
import { StopLossHitEvent, TakeProfitHitEvent, TimeBasedExitEvent } from '../types/legacy';
import { PositionSide } from '../types/legacy';
import type { StopLossConfig } from '../types/legacy';
import { ICONS } from '../cli/cli-runtime';
import {
  createEventHandlersExchangeMock,
  createEventHandlersPositionExitingMock,
  createEventHandlersPositionManagerMock,
  createEventHandlersTelegramMock,
  createEventHandlersMockLogger,
  createManagedEventHandlersWebSocketContext,
  createManagedPositionEventHandlerContext,
  createEventHandlersMockPosition,
  type EventHandlersExchangeMock,
  type EventHandlersLoggerMock,
  type EventHandlersPositionExitingMock,
  type EventHandlersPositionManagerMock,
  type EventHandlersTelegramMock,
} from './helpers/event-handlers-test.utils';

const createStopLoss = (price: number): StopLossConfig => ({
  price,
  initialPrice: price,
  isBreakeven: false,
  isTrailing: false,
  updatedAt: Date.now(),
});

const createMockPosition = (): Position =>
  createEventHandlersMockPosition({
    journalId: 'j-123',
    symbol: 'XRPUSDT',
    entryPrice: 2.0,
    quantity: 100,
    leverage: 10,
    unrealizedPnL: 100,
    takeProfits: [
      { level: 1, percent: 0.6, price: 2.012, sizePercent: 25, hit: false, orderId: 'tp1-order' },
      { level: 2, percent: 1.2, price: 2.024, sizePercent: 35, hit: false, orderId: 'tp2-order' },
      { level: 3, percent: 2.0, price: 2.04, sizePercent: 40, hit: false, orderId: 'tp3-order' },
    ],
    stopLoss: createStopLoss(1.96),
    side: PositionSide.LONG,
  } as Partial<Position>);

describe('PositionEventHandler', () => {
  let handler: PositionEventHandler;
  let mockLogger: EventHandlersLoggerMock;
  let mockPositionManager: EventHandlersPositionManagerMock;
  let mockPositionExitingService: EventHandlersPositionExitingMock;
  let mockBybitService: EventHandlersExchangeMock;
  let mockTelegram: EventHandlersTelegramMock;
  let cleanup: () => void;

  beforeEach(() => {
    ({
      handler,
      mockPositionManager,
      mockPositionExitingService,
      mockBybitService,
      mockTelegram,
      mockLogger,
      cleanup,
    } = createManagedPositionEventHandlerContext({
      positionManager: createEventHandlersPositionManagerMock(),
      positionExitingService: createEventHandlersPositionExitingMock(),
      exchange: createEventHandlersExchangeMock({
        closePosition: jest.fn().mockResolvedValue({}),
        getCurrentPrice: jest.fn().mockResolvedValue(2.05),
      }),
      telegram: createEventHandlersTelegramMock(),
      logger: createEventHandlersMockLogger(),
    }));
  });

  afterEach(() => {
    cleanup();
  });

  describe('handleStopLossHit', () => {
    it('should log stop loss hit event', async () => {
      const position = createMockPosition();
      const event: StopLossHitEvent = {
        reason: 'Price below stop loss',
        currentPrice: 1.95,
        position,
      };

      await handler.handleStopLossHit(event);

      expect(mockLogger.warn).toHaveBeenCalledWith(`${ICONS.stop} STOP LOSS HIT (backup price detection)`, expect.any(Object));
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should not call recordPositionClose on SL hit', async () => {
      const position = createMockPosition();
      const event: StopLossHitEvent = {
        reason: 'Price below stop loss',
        currentPrice: 1.95,
        position,
      };

      await handler.handleStopLossHit(event);

      expect(mockPositionManager.recordPositionClose).not.toHaveBeenCalled();
    });
  });

  describe('handleTakeProfitHit', () => {
    it('should log take profit hit event', async () => {
      const position = createMockPosition();
      const event: TakeProfitHitEvent = {
        reason: 'Price reached TP1',
        tpLevel: 1,
        currentPrice: 2.012,
        position,
      };

      await handler.handleTakeProfitHit(event);

      expect(mockLogger.info).toHaveBeenCalledWith('TAKE PROFIT 1 HIT', expect.any(Object));
    });

    it('should log different TP levels', async () => {
      const position = createMockPosition();

      for (let level = 1; level <= 3; level++) {
        const event: TakeProfitHitEvent = {
          reason: `Price reached TP${level}`,
          tpLevel: level,
          currentPrice: 2.0 + (level * 0.012),
          position,
        };

        await handler.handleTakeProfitHit(event);

        expect(mockLogger.info).toHaveBeenCalledWith(`TAKE PROFIT ${level} HIT`, expect.any(Object));
      }
    });
  });

  describe('handlePositionClosedExternally', () => {
    it('should clear position and send telegram alert', async () => {
      const position = createMockPosition();

      await handler.handlePositionClosedExternally(position);

      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
      expect(mockTelegram.sendAlert).toHaveBeenCalledWith(expect.stringContaining('FALLBACK'));
    });

    it('should log warning about external closure', async () => {
      const position = createMockPosition();

      await handler.handlePositionClosedExternally(position);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Position closed externally'),
        expect.any(Object),
      );
    });
  });

  describe('handleTimeBasedExit', () => {
    it('should close position on exchange', async () => {
      const position = createMockPosition();
      const event: TimeBasedExitEvent = {
        reason: 'Position open > 24 hours',
        openedMinutes: 1440,
        pnlPercent: 2.5,
        position: {
          id: position.id,
          side: 'Buy',
          quantity: position.quantity,
          entryPrice: position.entryPrice,
        },
      };

      await handler.handleTimeBasedExit(event);

      expect(mockBybitService.closePosition).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('closed on exchange'), expect.any(Object));
    });

    it('should record close on exchange failure (fallback)', async () => {
      mockBybitService.closePosition.mockRejectedValueOnce(new Error('Exchange error'));

      const position = createMockPosition();
      const event: TimeBasedExitEvent = {
        reason: 'Position open > 24 hours',
        openedMinutes: 1440,
        pnlPercent: 2.5,
        position: {
          id: position.id,
          side: 'Buy',
          quantity: position.quantity,
          entryPrice: position.entryPrice,
        },
      };

      await handler.handleTimeBasedExit(event);

      // Verify fallback methods were called when exchange close fails
      expect(mockLogger.error).toHaveBeenCalledTimes(3); // ErrorHandler + fallback logs
      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalled();
      expect(mockPositionManager.clearPosition).toHaveBeenCalled();
    });

    it('should log time-based exit warning', async () => {
      const position = createMockPosition();
      const event: TimeBasedExitEvent = {
        reason: 'Position open > 24 hours',
        openedMinutes: 1440,
        pnlPercent: 2.5,
        position: {
          id: position.id,
          side: 'Buy',
          quantity: position.quantity,
          entryPrice: position.entryPrice,
        },
      };

      await handler.handleTimeBasedExit(event);

      expect(mockLogger.warn).toHaveBeenCalledWith(`${ICONS.alarm_clock} TIME-BASED EXIT triggered`, expect.any(Object));
    });
  });

  describe('handleMonitorError', () => {
    it('should throw monitor error', async () => {
      const error = new Error('Monitor error');

      // handleMonitorError uses THROW strategy, so it should rethrow
      await expect(handler.handleMonitorError(error)).rejects.toThrow();
    });
  });
});

describe('WebSocketEventHandler', () => {
  let handler: WebSocketEventHandler;
  let mockLogger: EventHandlersLoggerMock;
  let mockPositionManager: EventHandlersPositionManagerMock;
  let mockPositionExitingService: EventHandlersPositionExitingMock;
  let mockBybitService: EventHandlersExchangeMock;
  let mockWebSocketManager: {
    getLastCloseReason: jest.Mock;
    resetLastCloseReason: jest.Mock;
  };
  let mockJournal: {
    getTrade: jest.Mock;
  };
  let mockTelegram: {
    notifyPositionClosed: jest.Mock;
  };
  let cleanup: () => void;

  beforeEach(() => {
    ({
      handler,
      mockPositionManager,
      mockPositionExitingService,
      mockBybitService,
      mockWebSocketManager,
      mockJournal,
      mockTelegram,
      mockLogger,
      cleanup,
    } = createManagedEventHandlersWebSocketContext({
      positionManager: createEventHandlersPositionManagerMock({
        getCurrentPosition: jest.fn().mockReturnValue(createMockPosition()),
        closePositionWithAtomicLock: jest.fn().mockImplementation(
          async (_reason: string, callback?: () => Promise<void>) => {
            if (callback) {
              await callback();
              return;
            }
            return Promise.resolve();
          },
        ),
      }),
      positionExitingService: createEventHandlersPositionExitingMock(),
      exchange: createEventHandlersExchangeMock({
        getCurrentPrice: jest.fn().mockResolvedValue(2.05),
      }),
      logger: createEventHandlersMockLogger(),
    }));
  });

  afterEach(() => {
    cleanup();
  });

  describe('handlePositionUpdate', () => {
    it('should sync position with position manager', async () => {
      const position = createMockPosition();

      await handler.handlePositionUpdate(position);

      expect(mockPositionManager.syncWithWebSocket).toHaveBeenCalledWith(position);
    });

    it('should log position update', async () => {
      const position = createMockPosition();

      await handler.handlePositionUpdate(position);

      expect(mockLogger.debug).toHaveBeenCalledWith('WebSocket: Position update received');
    });
  });

  describe('handlePositionClosed', () => {
    it('should clear position on close', async () => {
      await handler.handlePositionClosed();

      // [P3] Now uses atomic lock which calls callback internally
      expect(mockPositionManager.closePositionWithAtomicLock).toHaveBeenCalled();
    });

    it('should record position close', async () => {
      mockWebSocketManager.getLastCloseReason.mockReturnValue('TP');

      await handler.handlePositionClosed();

      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalled();
    });

    it('should skip duplicate closes (already in journal)', async () => {
      mockJournal.getTrade.mockReturnValue({
        status: 'CLOSED',
        exitCondition: { exitType: ExitType.TAKE_PROFIT_1 },
      });

      await handler.handlePositionClosed();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('already closed in journal'),
        expect.any(Object),
      );
      expect(mockPositionExitingService.closeFullPosition).not.toHaveBeenCalled();
    });

    it('should determine exitType from lastCloseReason (TP)', async () => {
      mockWebSocketManager.getLastCloseReason.mockReturnValue('TP');
      const position = createMockPosition();
      position.takeProfits[0].hit = true;
      mockPositionManager.getCurrentPosition.mockReturnValue(position);

      await handler.handlePositionClosed();

      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Number),
        expect.any(String),
        ExitType.TAKE_PROFIT_1,
      );
    });

    it('should determine exitType from lastCloseReason (TRAILING)', async () => {
      mockWebSocketManager.getLastCloseReason.mockReturnValue('TRAILING');

      await handler.handlePositionClosed();

      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Number),
        expect.any(String),
        ExitType.TRAILING_STOP,
      );
    });

    it('should determine exitType from lastCloseReason (SL)', async () => {
      mockWebSocketManager.getLastCloseReason.mockReturnValue('SL');

      await handler.handlePositionClosed();

      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Number),
        expect.any(String),
        ExitType.STOP_LOSS,
      );
    });

    it('should reset lastCloseReason after processing', async () => {
      await handler.handlePositionClosed();

      expect(mockWebSocketManager.resetLastCloseReason).toHaveBeenCalled();
    });

    it('should send telegram notification', async () => {
      await handler.handlePositionClosed();

      expect(mockTelegram.notifyPositionClosed).toHaveBeenCalled();
    });

    it('should not send telegram if no active position', async () => {
      mockPositionManager.getCurrentPosition.mockReturnValue(null);

      await handler.handlePositionClosed();

      expect(mockTelegram.notifyPositionClosed).not.toHaveBeenCalled();
    });
  });

  describe('handleOrderFilled', () => {
    it('should log order filled event', async () => {
      const order = {
        orderId: 'order-123',
        price: 2.01,
        quantity: 50,
      };

      await handler.handleOrderFilled(order as unknown as Parameters<typeof handler.handleOrderFilled>[0]);

      expect(mockLogger.info).toHaveBeenCalledWith('WebSocket: Order filled', { orderId: 'order-123' });
    });
  });

  describe('handleTakeProfitFilled', () => {
    it('should match TP by OrderID (method 1 - most reliable)', async () => {
      const event = {
        orderId: 'tp1-order',
        avgPrice: 2.012,
        cumExecQty: 25,
      };

      await handler.handleTakeProfitFilled(event as unknown as Parameters<typeof handler.handleTakeProfitFilled>[0]);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Matched TP by OrderID (RELIABLE)'),
        expect.any(Object)
      );
      expect(mockPositionExitingService.onTakeProfitHit).toHaveBeenCalledWith(expect.any(Object), 1, 2.012);
    });

    it('should match TP by price (method 2 - fallback)', async () => {
      const event = {
        orderId: 'unknown-order',
        avgPrice: 2.0121, // Within 0.3% of 2.012
        cumExecQty: 25,
      };

      await handler.handleTakeProfitFilled(event as unknown as Parameters<typeof handler.handleTakeProfitFilled>[0]);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Matched TP by price (fallback)'),
        expect.any(Object)
      );
      expect(mockPositionExitingService.onTakeProfitHit).toHaveBeenCalledWith(expect.any(Object), 1, expect.closeTo(2.0121, 0.01));
    });

    it('should match TP by quantity (method 3 - fallback)', async () => {
      const event = {
        orderId: 'unknown-order',
        avgPrice: 0, // Unknown price
        cumExecQty: 25, // Should match TP1 (25% sizePercent)
      };

      await handler.handleTakeProfitFilled(event as unknown as Parameters<typeof handler.handleTakeProfitFilled>[0]);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Matched TP by quantity (fallback)'),
        expect.any(Object)
      );
      expect(mockPositionExitingService.onTakeProfitHit).toHaveBeenCalledWith(expect.any(Object), 1, expect.any(Number));
    });

    it('should handle case with no active position', async () => {
      mockPositionManager.getCurrentPosition.mockReturnValue(null);

      const event = {
        orderId: 'tp1-order',
        avgPrice: 2.012,
        cumExecQty: 25,
      };

      await handler.handleTakeProfitFilled(event as unknown as Parameters<typeof handler.handleTakeProfitFilled>[0]);

      expect(mockLogger.warn).toHaveBeenCalledWith('Take Profit filled but no active position');
      expect(mockPositionManager.onTakeProfitHit).not.toHaveBeenCalled();
    });

    it('should log critical error if TP level cannot be determined', async () => {
      const position = createMockPosition();
      position.takeProfits = []; // No TPs defined
      mockPositionManager.getCurrentPosition.mockReturnValue(position);

      const event = {
        orderId: 'unknown-order',
        avgPrice: 3.0, // Doesn't match any TP
        cumExecQty: 50,
      };

      await handler.handleTakeProfitFilled(event as unknown as Parameters<typeof handler.handleTakeProfitFilled>[0]);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Could not determine ANY TP level'),
        expect.any(Object),
      );
      expect(mockPositionManager.onTakeProfitHit).not.toHaveBeenCalled();
    });
  });

  describe('handleStopLossFilled', () => {
    it('should log stop loss filled event', async () => {
      const event = {
        orderId: 'sl-order',
        avgPrice: 1.96,
        cumExecQty: 100,
      };

      await handler.handleStopLossFilled(event as unknown as Parameters<typeof handler.handleStopLossFilled>[0]);

      expect(mockLogger.info).toHaveBeenCalledWith('WebSocket: Stop Loss filled', expect.any(Object));
    });

    it('should not call recordPositionClose (wait for positionClosed event)', async () => {
      const event = {
        orderId: 'sl-order',
        avgPrice: 1.96,
        cumExecQty: 100,
      };

      await handler.handleStopLossFilled(event as unknown as Parameters<typeof handler.handleStopLossFilled>[0]);

      expect(mockPositionManager.recordPositionClose).not.toHaveBeenCalled();
    });
  });

  describe('handleError', () => {
    it('should log WebSocket error', async () => {
      const error = new Error('WebSocket connection lost');

      await handler.handleError(error);

      expect(mockLogger.error).toHaveBeenCalledWith('WebSocket error', expect.any(Object));
    });
  });
});
