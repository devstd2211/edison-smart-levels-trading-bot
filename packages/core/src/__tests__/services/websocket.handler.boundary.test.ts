import { WebSocketEventHandler, createWebSocketEventHandlerDependencies } from '../../services/handlers/websocket.handler';
import type { IExchange } from '../../interfaces/IExchange';
import type { PositionLifecycleService } from '../../services/position-lifecycle.service';
import type { PositionExitingService } from '../../services/position-exiting.service';
import type { WebSocketManagerService } from '../../services/websocket-manager.service';
import type { TradingJournalService } from '../../services/trading-journal.service';
import type { TelegramService } from '../../services/telegram.service';
import type { LoggerService } from '../../types/legacy';

describe('WebSocketEventHandler dependency boundary', () => {
  test('creates a named dependency bundle for the websocket handler runtime boundary', () => {
    const dependencies = createWebSocketEventHandlerDependencies({
      positionManager: {} as PositionLifecycleService,
      positionExitingService: {} as PositionExitingService,
      bybitService: {} as IExchange,
      webSocketManager: {} as WebSocketManagerService,
      journal: {} as TradingJournalService,
      telegram: {} as TelegramService,
      logger: {} as LoggerService,
    });

    expect(Object.keys(dependencies).sort()).toEqual([
      'bybitService',
      'journal',
      'logger',
      'positionExitingService',
      'positionManager',
      'telegram',
      'webSocketManager',
    ]);
  });

  test('constructs the handler from the named dependency bundle', () => {
    const handler = new WebSocketEventHandler(
      createWebSocketEventHandlerDependencies({
        positionManager: {} as PositionLifecycleService,
        positionExitingService: {} as PositionExitingService,
        bybitService: {} as IExchange,
        webSocketManager: {} as WebSocketManagerService,
        journal: {} as TradingJournalService,
        telegram: {} as TelegramService,
        logger: {} as LoggerService,
      }),
    );

    expect(handler).toBeInstanceOf(WebSocketEventHandler);
  });
});
