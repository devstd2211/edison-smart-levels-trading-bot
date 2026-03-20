import { ErrorHandler } from '../../errors';
import { OrderbookManagerService, OrderbookUpdate } from '../../services/orderbook-manager.service';
import { LoggerService, LogLevel } from '../../types/legacy';
import { WallTrackerService } from '../../services/wall-tracker.service';

export function createOrderbookLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createOrderbookMockLogger(): Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error'> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

export function createOrderbookWallTrackerMock() {
  return {
    detectWall: jest.fn(),
    removeWall: jest.fn(),
    getWalls: jest.fn(() => ({})),
    reset: jest.fn(),
  };
}

export function createOrderbookSnapshotUpdate(
  bids: Array<[string, string]>,
  asks: Array<[string, string]>,
  updateId: number = 1,
): OrderbookUpdate {
  return {
    type: 'snapshot',
    bids,
    asks,
    updateId,
    timestamp: Date.now(),
  };
}

export function createOrderbookDeltaUpdate(
  bids: Array<[string, string]>,
  asks: Array<[string, string]>,
  updateId: number,
): OrderbookUpdate {
  return {
    type: 'delta',
    bids,
    asks,
    updateId,
    timestamp: Date.now(),
  };
}

export function createOrderbookSnapshotFixture(options: {
  bids?: Array<[string, string]>;
  asks?: Array<[string, string]>;
  updateId?: number;
} = {}): OrderbookUpdate {
  return createOrderbookSnapshotUpdate(
    options.bids ?? [['45000', '1.0']],
    options.asks ?? [['45100', '1.0']],
    options.updateId,
  );
}

export function createOrderbookDeltaFixture(options: {
  bids?: Array<[string, string]>;
  asks?: Array<[string, string]>;
  updateId?: number;
} = {}): OrderbookUpdate {
  return createOrderbookDeltaUpdate(
    options.bids ?? [['45001', '2.0']],
    options.asks ?? [],
    options.updateId ?? 2,
  );
}

export function createOrderbookLevels(options: {
  start: number;
  count: number;
  step?: number;
  size?: string;
  direction?: 'asc' | 'desc';
}): Array<[string, string]> {
  const {
    start,
    count,
    step = 1,
    size = '1.0',
    direction = 'asc',
  } = options;

  return Array.from({ length: count }, (_, index) => {
    const price = direction === 'desc'
      ? start - (index * step)
      : start + (index * step);
    return [`${price}`, size];
  });
}

type OrderbookManagerInternals = {
  lastSnapshotTime: number;
};

export function setOrderbookLastSnapshotTime(
  manager: OrderbookManagerService,
  timestamp: number,
): void {
  (manager as unknown as OrderbookManagerInternals).lastSnapshotTime = timestamp;
}

export function initializeOrderbookManager(
  service: OrderbookManagerService,
  snapshotOptions: {
    bids?: Array<[string, string]>;
    asks?: Array<[string, string]>;
    updateId?: number;
  } = {},
): OrderbookUpdate {
  const snapshot = createOrderbookSnapshotFixture(snapshotOptions);
  service.processUpdate(snapshot);
  return snapshot;
}

export function createOrderbookManagerHarness(options: {
  symbol?: string;
  withWallTracker?: boolean;
  withErrorHandler?: boolean;
  logger?: LoggerService;
  wallTracker?: WallTrackerService;
  errorHandler?: ErrorHandler;
} = {}) {
  const mockLogger = createOrderbookMockLogger();
  const loggerService = options.logger ?? (mockLogger as unknown as LoggerService);
  const mockWallTracker = createOrderbookWallTrackerMock();
  const wallTracker = options.withWallTracker === false
    ? undefined
    : options.wallTracker ?? (mockWallTracker as unknown as WallTrackerService);
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(loggerService);
  const service = createOrderbookManagerService({
    symbol: options.symbol,
    logger: loggerService,
    wallTracker,
    withErrorHandler: options.withErrorHandler,
    errorHandler,
  });

  return {
    service,
    mockLogger,
    loggerService,
    mockWallTracker,
    errorHandler,
  };
}

export function createOrderbookManagerService(options: {
  symbol?: string;
  logger?: LoggerService;
  wallTracker?: WallTrackerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}): OrderbookManagerService {
  const logger = options.logger ?? (createOrderbookMockLogger() as unknown as LoggerService);
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);

  return new OrderbookManagerService(
    options.symbol ?? 'BTCUSDT',
    logger,
    options.wallTracker,
    errorHandler,
  );
}

export function createOrderbookLegacyService(options: {
  symbol?: string;
  logger?: LoggerService;
  wallTracker?: WallTrackerService;
} = {}): OrderbookManagerService {
  return createOrderbookManagerService({
    ...options,
    withErrorHandler: false,
  });
}

export function createOrderbookServiceWithoutWallTracker(options: {
  symbol?: string;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}): OrderbookManagerService {
  return createOrderbookManagerService({
    ...options,
    wallTracker: undefined,
  });
}
