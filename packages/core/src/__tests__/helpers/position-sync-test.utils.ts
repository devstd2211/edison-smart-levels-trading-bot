import { ErrorHandler } from '../../errors/ErrorHandler';
import type { IExchange } from '../../interfaces/IExchange';
import { ExitTypeDetectorService } from '../../services/exit-type-detector.service';
import { PositionLifecycleService } from '../../services/position-lifecycle.service';
import { PositionSyncService } from '../../services/position-sync.service';
import { TelegramService } from '../../services/telegram.service';
import {
  ExchangeAPIError,
  ExchangeConnectionError,
  ExchangeRateLimitError,
  TelegramNetworkError,
} from '../../errors/DomainErrors';
import {
  BybitOrder,
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

export function createPositionSyncAgedPosition(
  ageMs: number,
  side: PositionSide = PositionSide.LONG,
  overrides: Partial<Position> = {},
): Position {
  return createPositionSyncPosition(side, Date.now() - ageMs, overrides);
}

export function createPositionSyncExchangeConnectionError(
  message = 'Network timeout',
  overrides: { exchangeName?: string; endpoint?: string } = {},
) {
  return new ExchangeConnectionError(message, {
    exchangeName: overrides.exchangeName ?? 'Bybit',
    ...(overrides.endpoint !== undefined ? { endpoint: overrides.endpoint } : {}),
  });
}

export function createPositionSyncExchangeRateLimitError(
  message = 'Rate limit',
  retryAfterMs = 100,
) {
  return new ExchangeRateLimitError(message, { retryAfterMs });
}

export function createPositionSyncExchangeApiError(
  message = 'API error',
  overrides: { statusCode?: number } = {},
) {
  return new ExchangeAPIError(message, {
    ...(overrides.statusCode !== undefined ? { statusCode: overrides.statusCode } : {}),
  });
}

export function createPositionSyncTelegramNetworkError(
  message = 'Telegram API timeout',
  overrides: { operation?: string; reason?: string } = {},
) {
  return new TelegramNetworkError(message, {
    operation: overrides.operation ?? 'sendAlert',
    reason: overrides.reason ?? 'Network timeout',
  });
}

export function createPositionSyncProtectedOrders(
  options: {
    stopLossSide?: string;
    takeProfitSide?: string;
    takeProfitLevels?: number[];
  } = {},
) {
  const stopLossOrder = createPositionSyncStopLossOrder(options.stopLossSide);
  const takeProfitOrders = (options.takeProfitLevels ?? [1]).map((level) =>
    createPositionSyncTakeProfitOrder(options.takeProfitSide, level),
  );

  return [stopLossOrder, ...takeProfitOrders];
}

export function prepareClosedPositionSync(
  harness: Pick<PositionSyncHarness, 'mockBybit'>,
  options: {
    orderHistory?: BybitOrder[];
    currentPrice?: number;
  } = {},
): {
  orderHistory: BybitOrder[];
  currentPrice: number;
} {
  const orderHistory = options.orderHistory ?? [];
  const currentPrice = options.currentPrice ?? 105;

  harness.mockBybit.getOrderHistory.mockResolvedValue(orderHistory);
  harness.mockBybit.getCurrentPrice.mockResolvedValue(currentPrice);

  return {
    orderHistory,
    currentPrice,
  };
}

export function prepareDeepSyncProtectionScenario(
  harness: Pick<PositionSyncHarness, 'mockBybit'>,
  position: Position,
  options: {
    activeOrders?: BybitOrder[];
    exchangePosition?: Position | null;
  } = {},
): {
  exchangePosition: Position | null;
  activeOrders: BybitOrder[];
} {
  const exchangePosition = options.exchangePosition ?? position;
  const activeOrders = options.activeOrders ?? [];

  harness.mockBybit.getPosition.mockResolvedValue(exchangePosition);
  harness.mockBybit.getActiveOrders.mockResolvedValue(activeOrders);

  return {
    exchangePosition,
    activeOrders,
  };
}

export function preparePositionSyncRetrySequence<T>(
  mockFn: jest.Mock,
  failures: Error[],
  successValue?: T,
): void {
  failures.forEach((error) => {
    mockFn.mockRejectedValueOnce(error);
  });

  if (successValue !== undefined) {
    mockFn.mockResolvedValueOnce(successValue);
  }
}

export function preparePositionSyncEmergencyCloseScenario(
  harness: Pick<PositionSyncHarness, 'mockBybit' | 'mockTelegram'>,
  position: Position,
  options: {
    exchangePosition?: Position;
    activeOrders?: BybitOrder[];
    closeResult?: unknown;
    telegramError?: Error;
  } = {},
): void {
  const exchangePosition = options.exchangePosition ?? position;
  preparePositionSyncRetrySequence(harness.mockBybit.getPosition, [], exchangePosition);
  harness.mockBybit.getPosition.mockResolvedValueOnce(exchangePosition);
  harness.mockBybit.getActiveOrders.mockResolvedValue(options.activeOrders ?? []);
  harness.mockBybit.closePosition.mockResolvedValue(
    options.closeResult ?? { orderId: 'close-order' },
  );

  if (options.telegramError) {
    harness.mockTelegram.sendAlert.mockRejectedValue(options.telegramError);
  } else {
    harness.mockTelegram.sendAlert.mockResolvedValue(undefined);
  }
}

export function preparePositionSyncMissingProtectionScenario(
  harness: Pick<PositionSyncHarness, 'mockBybit' | 'mockTelegram'>,
  position: Position,
  options: {
    exchangePosition?: Position;
    closeResult?: unknown;
    telegramError?: Error;
  } = {},
): void {
  position.stopLoss.isTrailing = false;
  preparePositionSyncEmergencyCloseScenario(harness, position, {
    exchangePosition: options.exchangePosition,
    activeOrders: [],
    closeResult: options.closeResult,
    telegramError: options.telegramError,
  });
}

export function preparePositionSyncClosedDuringCheckScenario(
  harness: Pick<PositionSyncHarness, 'mockBybit'>,
  position: Position,
): void {
  position.stopLoss.isTrailing = false;
  harness.mockBybit.getPosition.mockResolvedValueOnce(position);
  harness.mockBybit.getActiveOrders.mockResolvedValue([]);
  harness.mockBybit.getPosition.mockResolvedValueOnce(null);
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

export function createStandardPositionSyncService(
  dependencies: Omit<PositionSyncHarness, 'service'>,
): PositionSyncService {
  return createPositionSyncService(dependencies);
}

export function createPositionSyncServiceWithHarness(
  dependencies: Omit<PositionSyncHarness, 'service'>,
): PositionSyncService {
  return createPositionSyncService(dependencies);
}

export function recreatePositionSyncHarness(
  harness: Omit<PositionSyncHarness, 'service'>,
  overrides: Partial<Omit<PositionSyncHarness, 'service'>> = {},
): PositionSyncHarness {
  const nextHarness = {
    ...harness,
    ...overrides,
  };

  return {
    ...nextHarness,
    service: createStandardPositionSyncService(nextHarness),
  };
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
    service: createStandardPositionSyncService({
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

export interface ManagedPositionSyncContext extends PositionSyncHarness {
  createHarness: (
    overrides?: Parameters<typeof createPositionSyncHarness>[0],
  ) => PositionSyncHarness;
  cleanup: () => void;
}

export function createManagedPositionSyncContext(
  options: Parameters<typeof createPositionSyncHarness>[0] = {},
): ManagedPositionSyncContext {
  const trackedHarnesses: PositionSyncHarness[] = [];
  const createHarness = (
    overrides: Parameters<typeof createPositionSyncHarness>[0] = {},
  ): PositionSyncHarness => {
    const harness = createPositionSyncHarness({
      ...options,
      ...overrides,
    });
    trackedHarnesses.push(harness);
    return harness;
  };

  const harness = createHarness();

  return {
    ...harness,
    createHarness,
    cleanup: () => {
      trackedHarnesses.length = 0;
      jest.clearAllMocks();
    },
  };
}
