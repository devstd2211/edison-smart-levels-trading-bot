import type { IExchange } from '../../interfaces/IExchange';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { PositionExitingService } from '../../services/position-exiting.service';
import { PositionLifecycleService } from '../../services/position-lifecycle.service';
import { TradingJournalService } from '../../services/trading-journal.service';
import { TelegramService } from '../../services/telegram.service';
import { WebSocketEventHandler } from '../../services/handlers/websocket.handler';
import { WebSocketManagerService } from '../../services/websocket-manager.service';
import { LoggerService, Position, PositionSide } from '../../types/legacy';
import type { OrderFilledEvent, StopLossFilledEvent, TakeProfitFilledEvent } from '../../types/legacy';

export type WebSocketEventHandlerHarness = {
  handler: WebSocketEventHandler;
  mockPositionManager: jest.Mocked<PositionLifecycleService>;
  mockPositionExitingService: jest.Mocked<PositionExitingService>;
  mockBybitService: jest.Mocked<IExchange>;
  mockWebSocketManager: jest.Mocked<WebSocketManagerService>;
  mockJournal: jest.Mocked<TradingJournalService>;
  mockTelegram: jest.Mocked<TelegramService>;
  mockLogger: jest.Mocked<Pick<LoggerService, 'info' | 'warn' | 'error' | 'debug'>>;
  createStandardHandler: (options?: WebSocketEventHandlerOverrides) => WebSocketEventHandler;
  createHandler: (options?: WebSocketEventHandlerOverrides) => WebSocketEventHandler;
  createCloseScenarioHandler: (options?: WebSocketEventHandlerCloseScenarioOptions) => WebSocketEventHandlerCloseScenarioRuntime;
};

export type ManagedWebSocketEventHandlerContext = WebSocketEventHandlerHarness & {
  cleanup: () => void;
};

export interface WebSocketEventHandlerOverrides {
  mockPositionManager?: jest.Mocked<PositionLifecycleService>;
  mockPositionExitingService?: jest.Mocked<PositionExitingService>;
  mockBybitService?: jest.Mocked<IExchange>;
  mockWebSocketManager?: jest.Mocked<WebSocketManagerService>;
  mockJournal?: jest.Mocked<TradingJournalService>;
  mockTelegram?: jest.Mocked<TelegramService>;
  mockLogger?: jest.Mocked<Pick<LoggerService, 'info' | 'warn' | 'error' | 'debug'>>;
}

export interface WebSocketEventHandlerCloseScenarioOptions {
  position?: Position;
  currentPrice?: number | Error;
  lastCloseReason?: 'SL' | 'TP' | 'TRAILING' | null;
  existingTrade?: unknown;
}

export interface WebSocketEventHandlerCloseScenarioRuntime {
  handler: WebSocketEventHandler;
  position: Position;
}

export type WebSocketEventHandlerSharedState = Pick<
  ManagedWebSocketEventHandlerContext,
  | 'handler'
  | 'mockPositionManager'
  | 'mockPositionExitingService'
  | 'mockBybitService'
  | 'mockWebSocketManager'
  | 'mockJournal'
  | 'mockTelegram'
  | 'mockLogger'
>;

export type WebSocketEventHandlerFactoryState = Pick<
  ManagedWebSocketEventHandlerContext,
  'createCloseScenarioHandler' | 'createStandardHandler' | 'cleanup'
>;

export type WebSocketEventHandlerManagedRuntime = WebSocketEventHandlerSharedState;

export type WebSocketEventHandlerManagedFactories = WebSocketEventHandlerFactoryState;

export type WebSocketEventHandlerSuiteState =
  WebSocketEventHandlerSharedState & WebSocketEventHandlerFactoryState;

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

export function createMockTakeProfitFilledEvent(
  overrides: Partial<TakeProfitFilledEvent> = {},
): TakeProfitFilledEvent {
  return {
    orderId: 'tp-order-1',
    avgPrice: 46000,
    cumExecQty: 0.05,
    ...overrides,
  };
}

export function createMockOrderFilledEvent(
  overrides: Partial<OrderFilledEvent> = {},
): OrderFilledEvent {
  return {
    orderId: 'order-456',
    symbol: 'BTCUSDT',
    side: 'Buy',
    execQty: '0.1',
    execPrice: '45500',
    ...overrides,
  };
}

export function createMockStopLossFilledEvent(
  overrides: Partial<StopLossFilledEvent> = {},
): StopLossFilledEvent {
  return {
    orderId: 'sl-order-1',
    avgPrice: 44000,
    cumExecQty: 0.1,
    ...overrides,
  };
}

export function configureWebSocketCloseScenario(
  harness: Pick<
    WebSocketEventHandlerHarness,
    'mockBybitService' | 'mockPositionManager' | 'mockWebSocketManager' | 'mockJournal'
  >,
  options: WebSocketEventHandlerCloseScenarioOptions = {},
): Position {
  const position = options.position ?? createMockWebSocketEventPosition();
  harness.mockPositionManager.getCurrentPosition.mockReturnValue(position);
  harness.mockWebSocketManager.getLastCloseReason.mockReturnValue(options.lastCloseReason ?? 'TP');
  harness.mockJournal.getTrade.mockReturnValue(options.existingTrade as never);

  if (options.currentPrice instanceof Error) {
    harness.mockBybitService.getCurrentPrice.mockRejectedValue(options.currentPrice);
  } else {
    harness.mockBybitService.getCurrentPrice.mockResolvedValue(options.currentPrice ?? 46000);
  }

  return position;
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
  options: WebSocketEventHandlerOverrides = {},
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

export function createStandardWebSocketEventHandler(
  options: WebSocketEventHandlerOverrides = {},
): WebSocketEventHandler {
  return createWebSocketEventHandler(options);
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
    handler: createStandardWebSocketEventHandler({
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
    createStandardHandler: (options = {}) =>
      createStandardWebSocketEventHandler({
        mockPositionManager: options.mockPositionManager ?? mockPositionManager,
        mockPositionExitingService: options.mockPositionExitingService ?? mockPositionExitingService,
        mockBybitService: options.mockBybitService ?? mockBybitService,
        mockWebSocketManager: options.mockWebSocketManager ?? mockWebSocketManager,
        mockJournal: options.mockJournal ?? mockJournal,
        mockTelegram: options.mockTelegram ?? mockTelegram,
        mockLogger: options.mockLogger ?? mockLogger,
      }),
    createHandler: (options = {}) =>
      createWebSocketEventHandler({
        mockPositionManager: options.mockPositionManager ?? mockPositionManager,
        mockPositionExitingService: options.mockPositionExitingService ?? mockPositionExitingService,
        mockBybitService: options.mockBybitService ?? mockBybitService,
        mockWebSocketManager: options.mockWebSocketManager ?? mockWebSocketManager,
        mockJournal: options.mockJournal ?? mockJournal,
        mockTelegram: options.mockTelegram ?? mockTelegram,
        mockLogger: options.mockLogger ?? mockLogger,
      }),
    createCloseScenarioHandler: (options = {}) => {
      const handler = createStandardWebSocketEventHandler({
        mockPositionManager,
        mockPositionExitingService,
        mockBybitService,
        mockWebSocketManager,
        mockJournal,
        mockTelegram,
        mockLogger,
      });
      const position = configureWebSocketCloseScenario(
        { mockBybitService, mockPositionManager, mockWebSocketManager, mockJournal },
        options,
      );

      return { handler, position };
    },
  };
}

export function createManagedWebSocketEventHandlerContext(): ManagedWebSocketEventHandlerContext {
  const harness = createWebSocketEventHandlerHarness();

  return {
    ...harness,
    cleanup: () => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}
