import type { IExchange } from '../../interfaces/IExchange';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { PositionExitingService } from '../../services/position-exiting.service';
import { PositionLifecycleService } from '../../services/position-lifecycle.service';
import { TradingJournalService } from '../../services/trading-journal.service';
import { TelegramService } from '../../services/telegram.service';
import { WebSocketEventHandler } from '../../services/handlers/websocket.handler';
import { WebSocketManagerService } from '../../services/websocket-manager.service';
import { LoggerService, Position, PositionSide } from '../../types/legacy';

export type WebSocketEventHandlerHarness = {
  handler: WebSocketEventHandler;
  mockPositionManager: jest.Mocked<PositionLifecycleService>;
  mockPositionExitingService: jest.Mocked<PositionExitingService>;
  mockBybitService: jest.Mocked<IExchange>;
  mockWebSocketManager: jest.Mocked<WebSocketManagerService>;
  mockJournal: jest.Mocked<TradingJournalService>;
  mockTelegram: jest.Mocked<TelegramService>;
  mockLogger: jest.Mocked<Pick<LoggerService, 'info' | 'warn' | 'error' | 'debug'>>;
};

export function createMockWebSocketEventPosition(
  overrides: Partial<Position> = {},
): Position {
  return {
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
    ],
    stopLoss: {
      price: 44000,
      initialPrice: 44000,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
    ...overrides,
  };
}

function asPositionLifecycleService(
  value: unknown,
): jest.Mocked<PositionLifecycleService> {
  return value as jest.Mocked<PositionLifecycleService>;
}

function asPositionExitingService(
  value: unknown,
): jest.Mocked<PositionExitingService> {
  return value as jest.Mocked<PositionExitingService>;
}

function asExchange(value: unknown): jest.Mocked<IExchange> {
  return value as jest.Mocked<IExchange>;
}

function asWebSocketManagerService(
  value: unknown,
): jest.Mocked<WebSocketManagerService> {
  return value as jest.Mocked<WebSocketManagerService>;
}

function asTradingJournalService(
  value: unknown,
): jest.Mocked<TradingJournalService> {
  return value as jest.Mocked<TradingJournalService>;
}

function asTelegramService(value: unknown): jest.Mocked<TelegramService> {
  return value as jest.Mocked<TelegramService>;
}

function asLoggerService(value: unknown): LoggerService {
  return value as LoggerService;
}

export function createWebSocketEventHandler(
  options: {
    mockPositionManager?: jest.Mocked<PositionLifecycleService>;
    mockPositionExitingService?: jest.Mocked<PositionExitingService>;
    mockBybitService?: jest.Mocked<IExchange>;
    mockWebSocketManager?: jest.Mocked<WebSocketManagerService>;
    mockJournal?: jest.Mocked<TradingJournalService>;
    mockTelegram?: jest.Mocked<TelegramService>;
    mockLogger?: jest.Mocked<Pick<LoggerService, 'info' | 'warn' | 'error' | 'debug'>>;
  } = {},
): WebSocketEventHandler {
  return new WebSocketEventHandler(
    options.mockPositionManager as jest.Mocked<PositionLifecycleService>,
    options.mockPositionExitingService as jest.Mocked<PositionExitingService>,
    options.mockBybitService as jest.Mocked<IExchange>,
    options.mockWebSocketManager as jest.Mocked<WebSocketManagerService>,
    options.mockJournal as jest.Mocked<TradingJournalService>,
    options.mockTelegram as jest.Mocked<TelegramService>,
    asLoggerService(options.mockLogger),
  );
}

export function createWebSocketEventHandlerHarness(): WebSocketEventHandlerHarness {
  const mockPositionManager = asPositionLifecycleService({
    getCurrentPosition: jest.fn(),
    syncWithWebSocket: jest.fn(),
    closePositionWithAtomicLock: jest.fn(async (_reason: string, callback: () => Promise<void>) => {
      await callback();
    }),
    clearPosition: jest.fn(),
  });

  const mockPositionExitingService = asPositionExitingService({
    closeFullPosition: jest.fn(),
    onTakeProfitHit: jest.fn(),
  });

  const mockBybitService = asExchange({
    getCurrentPrice: jest.fn(),
  });

  const mockWebSocketManager = asWebSocketManagerService({
    getLastCloseReason: jest.fn().mockReturnValue('TP'),
    resetLastCloseReason: jest.fn(),
  });

  const mockJournal = asTradingJournalService({
    getTrade: jest.fn(),
    recordTrade: jest.fn(),
  });

  const mockTelegram = asTelegramService({
    notifyPositionClosed: jest.fn(),
  });

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as jest.Mocked<Pick<LoggerService, 'info' | 'warn' | 'error' | 'debug'>>;

  jest.spyOn(ErrorHandler, 'handle').mockResolvedValue({
    success: true,
    recovered: true,
    attempts: 1,
    message: 'mocked',
    strategy: RecoveryStrategy.SKIP,
  });

  return {
    handler: createWebSocketEventHandler({
      mockPositionManager,
      mockPositionExitingService,
      mockBybitService,
      mockWebSocketManager,
      mockJournal,
      mockTelegram,
      mockLogger,
    }),
    mockPositionManager,
    mockPositionExitingService,
    mockBybitService,
    mockWebSocketManager,
    mockJournal,
    mockTelegram,
    mockLogger,
  };
}
