import type { IExchange } from '../../interfaces/IExchange';
import { PositionEventHandler } from '../../services/handlers/position.handler';
import { WebSocketEventHandler } from '../../services/handlers/websocket.handler';
import type { PositionLifecycleService } from '../../services/position-lifecycle.service';
import type { PositionExitingService } from '../../services/position-exiting.service';
import type { WebSocketManagerService } from '../../services/websocket-manager.service';
import type { TradingJournalService } from '../../services/trading-journal.service';
import type { TelegramService } from '../../services/telegram.service';
import {
  LoggerService,
  Position,
  PositionSide,
} from '../../types/legacy';

export type EventHandlersLoggerMock = {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
  trace: jest.Mock;
};

export type EventHandlersPositionManagerMock = {
  getCurrentPosition: jest.Mock;
  clearPosition: jest.Mock;
  syncWithWebSocket: jest.Mock;
  closePositionWithAtomicLock: jest.Mock;
};

export type EventHandlersPositionExitingMock = {
  closeFullPosition: jest.Mock;
  onTakeProfitHit: jest.Mock;
};

export type EventHandlersExchangeMock = {
  closePosition?: jest.Mock;
  getCurrentPrice: jest.Mock;
};

export type EventHandlersTelegramMock = {
  sendAlert: jest.Mock;
  notifyPositionClosed: jest.Mock;
};

export type EventHandlersWebSocketManagerMock = {
  getLastCloseReason: jest.Mock;
  resetLastCloseReason: jest.Mock;
};

export type EventHandlersJournalMock = {
  getTrade: jest.Mock;
  recordTrade: jest.Mock;
};

export type ManagedPositionEventHandlerContext = ReturnType<typeof createPositionEventHandlerHarness> & {
  createStandardHandler: (options?: {
    positionManager?: EventHandlersPositionManagerMock;
    positionExitingService?: EventHandlersPositionExitingMock;
    exchange?: EventHandlersExchangeMock;
    telegram?: EventHandlersTelegramMock;
    logger?: EventHandlersLoggerMock;
  }) => PositionEventHandler;
  cleanup: () => void;
};

export type ManagedWebSocketEventHandlerContext = ReturnType<typeof createWebSocketEventHandlerHarness> & {
  cleanup: () => void;
};

export type PositionEventHandlersManagedRuntime = Pick<
  ManagedPositionEventHandlerContext,
  | 'handler'
  | 'mockPositionManager'
  | 'mockPositionExitingService'
  | 'mockBybitService'
  | 'mockTelegram'
  | 'mockLogger'
  | 'createStandardHandler'
  | 'cleanup'
>;

export type WebSocketEventHandlersManagedRuntime = Pick<
  ManagedWebSocketEventHandlerContext,
  | 'handler'
  | 'mockPositionManager'
  | 'mockPositionExitingService'
  | 'mockBybitService'
  | 'mockWebSocketManager'
  | 'mockJournal'
  | 'mockTelegram'
  | 'mockLogger'
  | 'cleanup'
>;

export type PositionEventHandlerTimeBasedExitInput = Parameters<
  ManagedPositionEventHandlerContext['handler']['handleTimeBasedExit']
>[0];

export type WebSocketEventHandlerOrderFilledInput = Parameters<
  ManagedWebSocketEventHandlerContext['handler']['handleOrderFilled']
>[0];

export type WebSocketEventHandlerStopLossFilledInput = Parameters<
  ManagedWebSocketEventHandlerContext['handler']['handleStopLossFilled']
>[0];

type PositionManagerInput = ConstructorParameters<typeof PositionEventHandler>[0];
type PositionExitingInput = ConstructorParameters<typeof PositionEventHandler>[1];
type ExchangeInput = ConstructorParameters<typeof PositionEventHandler>[2];
type TelegramInput = ConstructorParameters<typeof PositionEventHandler>[3];
type PositionLoggerInput = ConstructorParameters<typeof PositionEventHandler>[4];
type WebSocketManagerInput = ConstructorParameters<typeof WebSocketEventHandler>[3];
type JournalInput = ConstructorParameters<typeof WebSocketEventHandler>[4];

export function createEventHandlersMockPosition(
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
      {
        level: 1,
        percent: 0.5,
        sizePercent: 50,
        price: 46000,
        hit: false,
        orderId: 'tp-order-1',
      },
      {
        level: 2,
        percent: 1.0,
        sizePercent: 30,
        price: 47000,
        hit: false,
        orderId: 'tp-order-2',
      },
      {
        level: 3,
        percent: 1.5,
        sizePercent: 20,
        price: 48000,
        hit: false,
        orderId: 'tp-order-3',
      },
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

export function createEventHandlersMockLogger(): EventHandlersLoggerMock {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
  };
}

function asPositionManager(value: unknown): PositionManagerInput {
  return value as PositionManagerInput;
}

function asPositionExiting(value: unknown): PositionExitingInput {
  return value as PositionExitingInput;
}

function asExchange(value: unknown): ExchangeInput {
  return value as ExchangeInput;
}

function asTelegram(value: unknown): TelegramInput {
  return value as TelegramInput;
}

function asPositionLogger(value: unknown): PositionLoggerInput {
  return value as PositionLoggerInput;
}

function asWebSocketManager(value: unknown): WebSocketManagerInput {
  return value as WebSocketManagerInput;
}

function asJournal(value: unknown): JournalInput {
  return value as JournalInput;
}

export function createPositionEventHandler(options?: {
  positionManager?: EventHandlersPositionManagerMock;
  positionExitingService?: EventHandlersPositionExitingMock;
  exchange?: EventHandlersExchangeMock;
  telegram?: EventHandlersTelegramMock;
  logger?: EventHandlersLoggerMock;
}) {
  const positionManager = options?.positionManager ?? {
    getCurrentPosition: jest.fn(),
    clearPosition: jest.fn(async () => {}),
    syncWithWebSocket: jest.fn(async () => {}),
    closePositionWithAtomicLock: jest.fn(),
  };
  const positionExitingService = options?.positionExitingService ?? {
    closeFullPosition: jest.fn(async () => {}),
    onTakeProfitHit: jest.fn(async () => {}),
  };
  const exchange = options?.exchange ?? {
    closePosition: jest.fn(async () => {}),
    getCurrentPrice: jest.fn(),
  };
  const telegram = options?.telegram ?? {
    sendAlert: jest.fn(async () => {}),
    notifyPositionClosed: jest.fn(async () => {}),
  };
  const logger = options?.logger ?? createEventHandlersMockLogger();

  return new PositionEventHandler(
    asPositionManager(positionManager),
    asPositionExiting(positionExitingService),
    asExchange(exchange),
    asTelegram(telegram),
    asPositionLogger(logger as unknown as LoggerService),
  );
}

export function createStandardPositionEventHandler(options?: {
  positionManager?: EventHandlersPositionManagerMock;
  positionExitingService?: EventHandlersPositionExitingMock;
  exchange?: EventHandlersExchangeMock;
  telegram?: EventHandlersTelegramMock;
  logger?: EventHandlersLoggerMock;
}) {
  return createPositionEventHandler(options);
}

export function createPositionEventHandlerHarness(options?: {
  positionManager?: EventHandlersPositionManagerMock;
  positionExitingService?: EventHandlersPositionExitingMock;
  exchange?: EventHandlersExchangeMock;
  telegram?: EventHandlersTelegramMock;
  logger?: EventHandlersLoggerMock;
}) {
  const mockPositionManager =
    options?.positionManager ?? {
      getCurrentPosition: jest.fn(),
      clearPosition: jest.fn(async () => {}),
      syncWithWebSocket: jest.fn(async () => {}),
      closePositionWithAtomicLock: jest.fn(),
    };

  const mockPositionExitingService =
    options?.positionExitingService ?? {
      closeFullPosition: jest.fn(async () => {}),
      onTakeProfitHit: jest.fn(async () => {}),
    };

  const mockBybitService =
    options?.exchange ?? {
      closePosition: jest.fn(async () => {}),
      getCurrentPrice: jest.fn(),
    };

  const mockTelegram =
    options?.telegram ?? {
      sendAlert: jest.fn(async () => {}),
      notifyPositionClosed: jest.fn(async () => {}),
    };

  const mockLogger = options?.logger ?? createEventHandlersMockLogger();

  return {
    handler: createStandardPositionEventHandler({
      positionManager: mockPositionManager,
      positionExitingService: mockPositionExitingService,
      exchange: mockBybitService,
      telegram: mockTelegram,
      logger: mockLogger,
    }),
    mockPositionManager,
    mockPositionExitingService,
    mockBybitService,
    mockTelegram,
    mockLogger,
  };
}

export function createWebSocketEventHandlerHarness(options?: {
  positionManager?: EventHandlersPositionManagerMock;
  positionExitingService?: EventHandlersPositionExitingMock;
  exchange?: EventHandlersExchangeMock;
  webSocketManager?: EventHandlersWebSocketManagerMock;
  journal?: EventHandlersJournalMock;
  telegram?: EventHandlersTelegramMock;
  logger?: EventHandlersLoggerMock;
}) {
  const mockPositionManager =
    options?.positionManager ?? {
      getCurrentPosition: jest.fn(),
      clearPosition: jest.fn(async () => {}),
      syncWithWebSocket: jest.fn(),
      closePositionWithAtomicLock: jest.fn(
        async (_reason: string, callback: () => Promise<void>) => {
          await callback();
        },
      ),
    };

  const mockPositionExitingService =
    options?.positionExitingService ?? {
      closeFullPosition: jest.fn(async () => {}),
      onTakeProfitHit: jest.fn(async () => {}),
    };

  const mockBybitService =
    options?.exchange ?? {
      getCurrentPrice: jest.fn(async () => 45500),
    };

  const mockWebSocketManager =
    options?.webSocketManager ?? {
      getLastCloseReason: jest.fn(() => 'TP'),
      resetLastCloseReason: jest.fn(),
    };

  const mockJournal =
    options?.journal ?? {
      getTrade: jest.fn(() => null),
      recordTrade: jest.fn(),
    };

  const mockTelegram =
    options?.telegram ?? {
      notifyPositionClosed: jest.fn(async () => {}),
      sendAlert: jest.fn(),
    };

  const mockLogger = options?.logger ?? createEventHandlersMockLogger();

  return {
    handler: new WebSocketEventHandler(
      asPositionManager(mockPositionManager),
      asPositionExiting(mockPositionExitingService),
      asExchange(mockBybitService as unknown as IExchange),
      asWebSocketManager(mockWebSocketManager),
      asJournal(mockJournal),
      asTelegram(mockTelegram),
      asPositionLogger(mockLogger as unknown as LoggerService),
    ),
    mockPositionManager,
    mockPositionExitingService,
    mockBybitService,
    mockWebSocketManager,
    mockJournal,
    mockTelegram,
    mockLogger,
  };
}

export function createManagedPositionEventHandlerContext(options?: {
  positionManager?: EventHandlersPositionManagerMock;
  positionExitingService?: EventHandlersPositionExitingMock;
  exchange?: EventHandlersExchangeMock;
  telegram?: EventHandlersTelegramMock;
  logger?: EventHandlersLoggerMock;
}): ManagedPositionEventHandlerContext {
  const harness = createPositionEventHandlerHarness(options);

  return {
    ...harness,
    createStandardHandler: (handlerOptions = {}) =>
      createStandardPositionEventHandler({
        positionManager: handlerOptions.positionManager ?? harness.mockPositionManager,
        positionExitingService:
          handlerOptions.positionExitingService ?? harness.mockPositionExitingService,
        exchange: handlerOptions.exchange ?? harness.mockBybitService,
        telegram: handlerOptions.telegram ?? harness.mockTelegram,
        logger: handlerOptions.logger ?? harness.mockLogger,
      }),
    cleanup: () => {
      jest.clearAllMocks();
      jest.clearAllTimers();
      jest.useRealTimers();
    },
  };
}

export function createManagedEventHandlersWebSocketContext(options?: {
  positionManager?: EventHandlersPositionManagerMock;
  positionExitingService?: EventHandlersPositionExitingMock;
  exchange?: EventHandlersExchangeMock;
  webSocketManager?: EventHandlersWebSocketManagerMock;
  journal?: EventHandlersJournalMock;
  telegram?: EventHandlersTelegramMock;
  logger?: EventHandlersLoggerMock;
}): ManagedWebSocketEventHandlerContext {
  const harness = createWebSocketEventHandlerHarness(options);

  return {
    ...harness,
    cleanup: () => {
      jest.clearAllMocks();
      jest.clearAllTimers();
      jest.useRealTimers();
    },
  };
}
