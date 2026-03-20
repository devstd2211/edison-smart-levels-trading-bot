import { ErrorHandler } from '../../errors/ErrorHandler';
import type { IExchange } from '../../interfaces/IExchange';
import { ExitTypeDetectorService } from '../../services/exit-type-detector.service';
import { PositionLifecycleService } from '../../services/position-lifecycle.service';
import { PositionSyncService } from '../../services/position-sync.service';
import { TelegramService } from '../../services/telegram.service';
import {
  ExitType,
  LogLevel,
  LoggerService,
  Position,
  PositionSide,
} from '../../types/legacy';

type PositionCloseRecorder = {
  closeFullPosition: jest.Mock<Promise<boolean>, [Position | null | undefined, number, string, ExitType]>;
};

export function createMockPositionSyncLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createPositionSyncErrorHandler(
  logger: LoggerService = createMockPositionSyncLogger(),
): ErrorHandler {
  return new ErrorHandler(logger);
}

export function createMockPositionSyncExchange() {
  return {
    getOrderHistory: jest.fn(),
    getCurrentPrice: jest.fn(),
    getPosition: jest.fn(),
    closePosition: jest.fn(),
    getActiveOrders: jest.fn(),
  };
}

export function createMockPositionSyncManager() {
  return {
    getCurrentPosition: jest.fn(),
    clearPosition: jest.fn(),
    syncWithWebSocket: jest.fn(),
  };
}

export function createMockPositionSyncExitTypeDetector() {
  return {
    determineExitTypeFromHistory: jest.fn().mockReturnValue(ExitType.TAKE_PROFIT_1),
    identifyTPLevel: jest.fn(),
  };
}

export function createMockPositionSyncTelegram() {
  return {
    sendAlert: jest.fn().mockResolvedValue(undefined),
  };
}

export function createMockPositionCloseRecorder(
  result: boolean = true,
): PositionCloseRecorder {
  return {
    closeFullPosition: jest.fn().mockResolvedValue(result),
  };
}

export function asPositionCloseRecorder(
  value: PositionCloseRecorder,
): {
  closeFullPosition(
    position: Position | null | undefined,
    exitPrice: number,
    exitReason: string,
    exitType: ExitType,
  ): Promise<boolean>;
} {
  return value as unknown as {
    closeFullPosition(
      position: Position | null | undefined,
      exitPrice: number,
      exitReason: string,
      exitType: ExitType,
    ): Promise<boolean>;
  };
}

export function createMockSyncedPosition(
  side: PositionSide = PositionSide.LONG,
  openedAt: number = Date.now(),
  overrides: Partial<Position> = {},
): Position {
  return {
    id: 'test-position-123',
    symbol: 'APEXUSDT',
    side,
    entryPrice: 100,
    quantity: 10,
    leverage: 10,
    marginUsed: 10,
    stopLoss: {
      price: side === PositionSide.LONG ? 99 : 101,
      initialPrice: side === PositionSide.LONG ? 99 : 101,
      orderId: 'sl-order-123',
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
    takeProfits: [
      {
        level: 1,
        price: side === PositionSide.LONG ? 101 : 99,
        percent: 1,
        sizePercent: 33.33,
        orderId: 'tp1-order',
        hit: false,
      },
    ],
    openedAt,
    unrealizedPnL: 0,
    orderId: 'entry-order-123',
    reason: 'Test position',
    status: 'OPEN',
    ...overrides,
  };
}

export function createPositionSyncPosition(
  side: PositionSide = PositionSide.LONG,
  openedAt: number = Date.now(),
  overrides: Partial<Position> = {},
): Position {
  return createMockSyncedPosition(side, openedAt, overrides);
}

export function createPositionSyncOldPosition(
  side: PositionSide = PositionSide.LONG,
  overrides: Partial<Position> = {},
): Position {
  return createPositionSyncPosition(side, Date.now() - 3 * 60 * 1000, overrides);
}

export function createPositionSyncStopLossOrder(side: string = 'Sell') {
  return {
    orderId: 'sl-order-123',
    symbol: 'APEXUSDT',
    side,
    orderType: 'Market',
    qty: '10',
    price: '99',
    status: 'Active',
    createdTime: Date.now(),
    updatedTime: Date.now(),
    reduceOnly: true,
    triggerPrice: '99',
    triggerBy: 'LastPrice',
  };
}

export function createPositionSyncTakeProfitOrder(side: string = 'Sell', level: number = 1) {
  return {
    orderId: `tp${level}-order`,
    symbol: 'APEXUSDT',
    side,
    orderType: 'Market',
    qty: '3.33',
    price: `${101 + level}`,
    status: 'Active',
    createdTime: Date.now(),
    updatedTime: Date.now(),
    reduceOnly: true,
    triggerPrice: `${101 + level}`,
    triggerBy: 'LastPrice',
  };
}

export type PositionSyncHarness = {
  service: PositionSyncService;
  mockBybit: ReturnType<typeof createMockPositionSyncExchange>;
  mockPositionManager: ReturnType<typeof createMockPositionSyncManager>;
  mockExitTypeDetector: ReturnType<typeof createMockPositionSyncExitTypeDetector>;
  mockTelegram: ReturnType<typeof createMockPositionSyncTelegram>;
  positionExiting: PositionCloseRecorder;
  logger: LoggerService;
  errorHandler?: ErrorHandler;
};

export function createPositionSyncService(
  dependencies: Omit<PositionSyncHarness, 'service'>,
): PositionSyncService {
  return new PositionSyncService(
    dependencies.mockBybit as unknown as IExchange,
    dependencies.mockPositionManager as unknown as PositionLifecycleService,
    dependencies.mockExitTypeDetector as unknown as ExitTypeDetectorService,
    dependencies.mockTelegram as unknown as TelegramService,
    dependencies.logger,
    asPositionCloseRecorder(dependencies.positionExiting),
    dependencies.errorHandler,
  );
}

export function createPositionSyncServiceWithHarness(
  dependencies: Omit<PositionSyncHarness, 'service'>,
): PositionSyncService {
  return createPositionSyncService(dependencies);
}

export function createMockSyncedPositions(
  positions: Array<{
    side?: PositionSide;
    openedAt?: number;
    overrides?: Partial<Position>;
  }>,
): Position[] {
  return positions.map((position) =>
    createMockSyncedPosition(
      position.side,
      position.openedAt,
      position.overrides,
    ),
  );
}

export function createPositionSyncHarness(options: {
  mockBybit?: ReturnType<typeof createMockPositionSyncExchange>;
  mockPositionManager?: ReturnType<typeof createMockPositionSyncManager>;
  mockExitTypeDetector?: ReturnType<typeof createMockPositionSyncExitTypeDetector>;
  mockTelegram?: ReturnType<typeof createMockPositionSyncTelegram>;
  positionExiting?: PositionCloseRecorder;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}): PositionSyncHarness {
  const mockBybit = options.mockBybit ?? createMockPositionSyncExchange();
  const mockPositionManager = options.mockPositionManager ?? createMockPositionSyncManager();
  const mockExitTypeDetector = options.mockExitTypeDetector ?? createMockPositionSyncExitTypeDetector();
  const mockTelegram = options.mockTelegram ?? createMockPositionSyncTelegram();
  const positionExiting = options.positionExiting ?? createMockPositionCloseRecorder();
  const logger = options.logger ?? createMockPositionSyncLogger();

  return {
    service: createPositionSyncService({
      mockBybit,
      mockPositionManager,
      mockExitTypeDetector,
      mockTelegram,
      positionExiting,
      logger,
      errorHandler: options.errorHandler,
    }),
    mockBybit,
    mockPositionManager,
    mockExitTypeDetector,
    mockTelegram,
    positionExiting,
    logger,
    errorHandler: options.errorHandler,
  };
}
