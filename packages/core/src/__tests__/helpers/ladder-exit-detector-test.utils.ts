import { ErrorHandler } from '../../errors/ErrorHandler';
import { LadderExitDetectorService } from '../../services/ladder-exit-detector.service';
import {
  BybitOrder,
  ExitType,
  LogLevel,
  LoggerService,
  Position,
  PositionSide,
} from '../../types/legacy';
import type { IExchange } from '../../interfaces/IExchange';

export type MockLadderExitBybitService = {
  getOrderHistory: jest.Mock;
  closePosition: jest.Mock;
};

type LadderExitHarnessOptions = {
  logger?: LoggerService;
  bybitService?: MockLadderExitBybitService;
  withErrorHandler?: boolean;
};

type LadderExitScenarioOptions = LadderExitHarnessOptions & {
  side?: PositionSide;
  entryPrice?: number;
  quantity?: number;
};

export const createLadderExitLogger = (): LoggerService =>
  new LoggerService(LogLevel.ERROR, './logs', false);

export const createLadderExitBybitService = (): MockLadderExitBybitService => ({
  getOrderHistory: jest.fn().mockResolvedValue([]),
  closePosition: jest.fn().mockResolvedValue(undefined),
});

export const createLadderExitErrorHandler = (
  logger: LoggerService = createLadderExitLogger(),
): ErrorHandler => new ErrorHandler(logger);

export const createLadderExitService = (options: {
  logger?: LoggerService;
  bybitService?: MockLadderExitBybitService;
  errorHandler?: ErrorHandler;
} = {}): LadderExitDetectorService => {
  const logger = options.logger ?? createLadderExitLogger();
  const bybitService = options.bybitService ?? createLadderExitBybitService();

  return new LadderExitDetectorService(
    logger,
    bybitService as unknown as IExchange,
    options.errorHandler,
  );
};

export const createLadderExitHarness = (options: LadderExitHarnessOptions = {}) => {
  const logger = options.logger ?? createLadderExitLogger();
  const bybitService = options.bybitService ?? createLadderExitBybitService();
  const errorHandler = createLadderExitErrorHandler(logger);
  const service = createLadderExitService({
    logger,
    bybitService,
    errorHandler: options.withErrorHandler === false ? undefined : errorHandler,
  });

  return {
    logger,
    bybitService,
    errorHandler,
    service,
  };
};

export type LadderExitHarness = ReturnType<typeof createLadderExitHarness>;
export type LadderExitScenarioHarnessOptions = LadderExitScenarioOptions;

export type ManagedLadderExitContext = LadderExitHarness & {
  cleanup: () => void;
};

export type LadderExitErrorHandlingRuntime = Pick<
  ManagedLadderExitContext,
  'logger' | 'bybitService' | 'cleanup'
>;

export type LadderExitScenarioHarness = ReturnType<
  typeof createLadderExitScenarioHarness
>;

export const createManagedLadderExitContext = (
  options: LadderExitHarnessOptions = {},
): ManagedLadderExitContext => {
  const harness = createLadderExitHarness(options);

  return {
    ...harness,
    cleanup: () => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
      jest.clearAllTimers();
      jest.useRealTimers();
    },
  };
};

export const createLadderExitScenarioHarness = (options: LadderExitScenarioOptions = {}) => {
  const harness = createLadderExitHarness(options);
  const position = createLadderExitPosition(
    options.side ?? PositionSide.LONG,
    options.entryPrice ?? 100,
    options.quantity,
  );

  return {
    ...harness,
    position,
  };
};

export const createLadderExitPosition = (
  side: PositionSide,
  entryPrice: number,
  quantity: number = 1,
): Position => {
  const slPrice = side === PositionSide.LONG ? entryPrice * 0.998 : entryPrice * 1.002;
  const tpOffset1 = side === PositionSide.LONG ? entryPrice * 0.0008 : -entryPrice * 0.0008;
  const tpOffset2 = side === PositionSide.LONG ? entryPrice * 0.0015 : -entryPrice * 0.0015;
  const tpOffset3 = side === PositionSide.LONG ? entryPrice * 0.0025 : -entryPrice * 0.0025;

  return {
    id: `APEXUSDT_${side}`,
    symbol: 'APEXUSDT',
    side,
    entryPrice,
    quantity,
    stopLoss: {
      price: slPrice,
      initialPrice: slPrice,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
    takeProfits: [
      { level: 1, percent: 0.08, sizePercent: 33, price: entryPrice + tpOffset1, hit: false },
      { level: 2, percent: 0.15, sizePercent: 33, price: entryPrice + tpOffset2, hit: false },
      { level: 3, percent: 0.25, sizePercent: 34, price: entryPrice + tpOffset3, hit: false },
    ],
    leverage: 10,
    marginUsed: 100,
    openedAt: Date.now(),
    unrealizedPnL: 0,
    orderId: 'ORDER_123',
    reason: 'Test',
    status: 'OPEN',
  };
};

export const createLadderExitOrder = (
  symbol: string,
  price: string,
  orderType: string = 'Limit',
  stopOrderType?: string,
  reduceOnly: boolean = true,
): BybitOrder => ({
  orderId: `ORDER_${Math.random().toString(36).substring(7)}`,
  symbol,
  orderType,
  stopOrderType,
  price,
  orderStatus: 'Filled',
  reduceOnly,
  createdTime: Date.now(),
  updatedTime: Date.now(),
  qty: '1',
  cumExecQty: '1',
  avgPrice: price,
  side: 'Buy',
  positionIdx: 0,
  orderLinkId: '',
  triggerPrice: '',
  triggerDirection: 0,
  triggerBy: '',
  timeInForce: 'GTC',
  isLiquidation: false,
});

export const createLadderExitOrderHistory = (
  orders: Array<{
    symbol?: string;
    price: string;
    orderType?: string;
    stopOrderType?: string;
    reduceOnly?: boolean;
  }>,
): BybitOrder[] =>
  orders.map((order) =>
    createLadderExitOrder(
      order.symbol ?? 'APEXUSDT',
      order.price,
      order.orderType,
      order.stopOrderType,
      order.reduceOnly,
    ),
  );

export const createLadderExitTpOrderHistory = (
  prices: string[],
): BybitOrder[] =>
  createLadderExitOrderHistory(
    prices.map((price) => ({
      price,
      orderType: 'Limit',
      reduceOnly: true,
    })),
  );

export const queueLadderExitOrderHistory = (
  bybitService: MockLadderExitBybitService,
  orders: Array<{
    symbol?: string;
    price: string;
    orderType?: string;
    stopOrderType?: string;
    reduceOnly?: boolean;
  }>,
): BybitOrder[] => {
  const orderHistory = createLadderExitOrderHistory(orders);
  bybitService.getOrderHistory.mockResolvedValueOnce(orderHistory);
  return orderHistory;
};

export const asLadderExitPosition = (value: unknown): Position => value as Position;
export const asLadderExitPrice = (value: unknown): number => value as number;
export const asLadderExitTakeProfits = (
  value: unknown,
): Position['takeProfits'] => value as Position['takeProfits'];

export const LADDER_EXIT_DEFAULT_FALLBACK = { exitType: ExitType.MANUAL };
