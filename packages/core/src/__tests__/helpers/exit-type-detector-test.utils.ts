import { ErrorHandler } from '../../errors';
import { ExitTypeDetectorService } from '../../services/exit-type-detector.service';
import {
  BybitOrder,
  ExitType,
  LoggerService,
  LogLevel,
  Position,
  PositionSide,
} from '../../types/legacy';

export function createExitTypeDetectorLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createExitTypeDetectorMockLogger(): LoggerService {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as LoggerService;
}

export function createExitTypeDetectorHarness(options: {
  logger?: LoggerService;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createExitTypeDetectorLogger();
  const errorHandler = new ErrorHandler(logger);
  const service = new ExitTypeDetectorService(
    logger,
    options.withErrorHandler === false ? undefined : errorHandler,
  );

  return {
    service,
    logger,
    errorHandler,
  };
}

export function createExitTypeDetectorScenarioHarness(options: {
  logger?: LoggerService;
  withErrorHandler?: boolean;
  positionOverrides?: Partial<Position>;
} = {}) {
  const harness = createExitTypeDetectorHarness(options);
  const position = createExitTypeDetectorScenarioPosition(options.positionOverrides);

  return {
    ...harness,
    position,
  };
}

export type ManagedExitTypeDetectorContext = {
  service: ExitTypeDetectorService;
  logger: LoggerService;
  errorHandler: ErrorHandler;
  createScenario: typeof createExitTypeDetectorScenarioHarness;
  createService: typeof createExitTypeDetectorHarness;
  cleanup: () => void;
  reset: () => void;
};

export type ExitTypeDetectorRuntime = Pick<
  ManagedExitTypeDetectorContext,
  'service' | 'logger' | 'createScenario' | 'cleanup'
>;

export type ExitTypeDetectorFactories = Pick<
  ManagedExitTypeDetectorContext,
  'createService' | 'cleanup'
>;

export function createManagedExitTypeDetectorContext(options: {
  logger?: LoggerService;
  withErrorHandler?: boolean;
} = {}): ManagedExitTypeDetectorContext {
  const harness = createExitTypeDetectorHarness(options);

  return {
    ...harness,
    createScenario: (scenarioOptions = {}) =>
      createExitTypeDetectorScenarioHarness({
        logger: harness.logger,
        withErrorHandler: options.withErrorHandler,
        ...scenarioOptions,
      }),
    createService: (serviceOptions = {}) =>
      createExitTypeDetectorHarness({
        logger: harness.logger,
        withErrorHandler: options.withErrorHandler,
        ...serviceOptions,
      }),
    cleanup: () => {
      jest.clearAllMocks();
    },
    reset: () => {
      jest.clearAllMocks();
    },
  };
}

export function createExitTypeDetectorPosition(
  side: PositionSide = PositionSide.LONG,
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
      price: 99,
      initialPrice: 99,
      orderId: 'sl-order-123',
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
    takeProfits: [
      { level: 1, price: 101, percent: 1, sizePercent: 33.33, orderId: 'tp1-order', hit: false },
      { level: 2, price: 102, percent: 2, sizePercent: 33.33, orderId: 'tp2-order', hit: false },
      { level: 3, price: 103, percent: 3, sizePercent: 33.34, orderId: 'tp3-order', hit: false },
    ],
    openedAt: Date.now(),
    unrealizedPnL: 0,
    orderId: 'entry-order-123',
    reason: 'Test position',
    status: 'OPEN',
  };
}

export function createExitTypeDetectorScenarioPosition(
  overrides: Partial<Position> = {},
): Position {
  return {
    ...createExitTypeDetectorPosition(overrides.side ?? PositionSide.LONG),
    ...overrides,
  };
}

export function createExitTypeDetectorOrder(
  overrides?: Partial<BybitOrder>,
): BybitOrder {
  return {
    orderId: 'order-123',
    symbol: 'APEXUSDT',
    orderType: 'Limit',
    side: 'Sell',
    price: '101.0',
    qty: '10',
    orderStatus: 'Filled',
    stopOrderType: undefined,
    triggerPrice: undefined,
    reduceOnly: false,
    updatedTime: Date.now(),
    ...overrides,
  } as BybitOrder;
}

export function createExitTypeDetectorOrderHistory(
  overridesList: Array<Partial<BybitOrder>>,
): BybitOrder[] {
  return overridesList.map((overrides, index) =>
    createExitTypeDetectorOrder({
      orderId: overrides.orderId ?? `order-${index + 1}`,
      ...overrides,
    }),
  );
}

export function createExitTypeDetectorTimestampSequence(
  count: number,
  start: number = Date.now(),
  stepMs: number = 1000,
): number[] {
  return Array.from({ length: count }, (_, index) => start - index * stepMs);
}

export function createExitTypeDetectorTimedOrderHistory(
  overridesList: Array<Partial<BybitOrder>>,
  options: {
    start?: number;
    stepMs?: number;
  } = {},
): BybitOrder[] {
  const timestamps = createExitTypeDetectorTimestampSequence(
    overridesList.length,
    options.start,
    options.stepMs,
  );

  return createExitTypeDetectorOrderHistory(
    overridesList.map((overrides, index) => ({
      updatedTime: overrides.updatedTime ?? timestamps[index],
      ...overrides,
    })),
  );
}

export function createExitTypeDetectorTakeProfits(
  prices: number[],
): Position['takeProfits'] {
  return prices.map((price, index) => ({
    level: index + 1,
    price,
    percent: index + 1,
    sizePercent: Number((100 / prices.length).toFixed(2)),
    orderId: `tp${index + 1}-order`,
    hit: false,
  }));
}

export const asExitTypeDetectorPosition = (value: unknown): Position => value as Position;
export const asExitTypeDetectorOrder = (value: unknown): BybitOrder => value as BybitOrder;
export const takeProfitExitTypes = [
  ExitType.TAKE_PROFIT_1,
  ExitType.TAKE_PROFIT_2,
  ExitType.TAKE_PROFIT_3,
];
