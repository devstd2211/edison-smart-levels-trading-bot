import { ErrorHandler } from '../../errors/ErrorHandler';
import { PositionPnLCalculatorService } from '../../services/position-pnl-calculator.service';
import { Position, PositionSide, type LoggerService } from '../../types/legacy';

export function createMockPnlPosition(
  side: PositionSide = PositionSide.LONG,
  entryPrice: number = 100,
  overrides: Partial<Position> = {},
): Position {
  return {
    id: 'test-position-123',
    symbol: 'APEXUSDT',
    side,
    entryPrice,
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
    openedAt: Date.now(),
    unrealizedPnL: 0,
    orderId: 'entry-order-123',
    reason: 'Test position',
    status: 'OPEN',
    ...overrides,
  };
}

export function createMockPnlLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    getLogs: jest.fn(() => []),
    getLogsByLevel: jest.fn(() => []),
    clear: jest.fn(),
    disableConsoleOutput: jest.fn(),
    enableConsoleOutputMode: jest.fn(),
  };
}

export function createMockPnlErrorHandler(): ErrorHandler {
  const errorLogger = createMockPnlLogger() as unknown as Pick<
    LoggerService,
    'debug' | 'info' | 'warn' | 'error'
  >;
  return new ErrorHandler(errorLogger);
}

export function createPositionPnLCalculatorService(options: {
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  return new PositionPnLCalculatorService(
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}

export function createPositionPnLCalculatorServiceWithHarness(options: {
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  return createPositionPnLCalculatorService(options);
}

export function createMockPnlPositions(
  positions: Array<{
    side?: PositionSide;
    entryPrice?: number;
    overrides?: Partial<Position>;
  }>,
): Position[] {
  return positions.map((position) =>
    createMockPnlPosition(
      position.side,
      position.entryPrice,
      position.overrides,
    ),
  );
}

export function createPositionPnLCalculatorHarness(options: {
  withErrorHandler?: boolean;
} = {}) {
  const errorHandler =
    options.withErrorHandler === false ? undefined : createMockPnlErrorHandler();
  const service = createPositionPnLCalculatorService({
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    service,
    errorHandler,
  };
}

export function createPositionPnLFactory(options: {
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const errorHandler =
    options.withErrorHandler === false
      ? undefined
      : (options.errorHandler ?? createMockPnlErrorHandler());

  return {
    errorHandler,
    createService: (factoryOptions: {
      errorHandler?: ErrorHandler;
      withErrorHandler?: boolean;
    } = {}) =>
      createPositionPnLCalculatorService({
        errorHandler:
          factoryOptions.withErrorHandler === false
            ? undefined
            : (factoryOptions.errorHandler ?? errorHandler),
        withErrorHandler:
          factoryOptions.withErrorHandler ?? options.withErrorHandler,
      }),
    createPosition: (
      side: PositionSide = PositionSide.LONG,
      entryPrice = 100,
      overrides: Partial<Position> = {},
    ) => createMockPnlPosition(side, entryPrice, overrides),
    createPositions: createMockPnlPositions,
  };
}

export function createPositionPnLScenarioHarness(options: {
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const factory = createPositionPnLFactory(options);

  return {
    errorHandler: factory.errorHandler,
    service: factory.createService({
      errorHandler: factory.errorHandler,
      withErrorHandler: options.withErrorHandler,
    }),
    createService: factory.createService,
    createPosition: factory.createPosition,
    createPositions: factory.createPositions,
  };
}

export interface ManagedPositionPnLCalculatorContext {
  service: PositionPnLCalculatorService;
  errorHandler?: ErrorHandler;
  createService: ReturnType<typeof createPositionPnLScenarioHarness>['createService'];
  createPosition: ReturnType<typeof createPositionPnLScenarioHarness>['createPosition'];
  createPositions: ReturnType<typeof createPositionPnLScenarioHarness>['createPositions'];
  cleanup: () => void;
}

export function createManagedPositionPnLCalculatorContext(options: {
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): ManagedPositionPnLCalculatorContext {
  jest.clearAllMocks();

  const harness = createPositionPnLScenarioHarness(options);

  return {
    service: harness.service,
    errorHandler: harness.errorHandler,
    createService: harness.createService,
    createPosition: harness.createPosition,
    createPositions: harness.createPositions,
    cleanup: () => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}
