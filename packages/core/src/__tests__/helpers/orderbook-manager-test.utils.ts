import { ErrorHandler } from '../../errors';
import { OrderbookManagerService, OrderbookUpdate } from '../../services/orderbook-manager.service';
import { LoggerService, LogLevel } from '../../types/legacy';
import { WallTrackerService } from '../../services/wall-tracker.service';

export interface OrderbookManagerHarness {
  service: OrderbookManagerService;
  mockLogger: ReturnType<typeof createOrderbookMockLogger>;
  loggerService: LoggerService;
  mockWallTracker: ReturnType<typeof createOrderbookWallTrackerMock>;
  errorHandler?: ErrorHandler;
  createService: (options?: {
    symbol?: string;
    logger?: LoggerService;
    wallTracker?: WallTrackerService;
    withErrorHandler?: boolean;
    errorHandler?: ErrorHandler;
  }) => OrderbookManagerService;
  createLegacyService: (options?: {
    symbol?: string;
    logger?: LoggerService;
    wallTracker?: WallTrackerService;
  }) => OrderbookManagerService;
  createServiceWithoutWallTracker: (options?: {
    symbol?: string;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  }) => OrderbookManagerService;
}

export interface ManagedOrderbookManagerContext {
  service: OrderbookManagerService;
  mockLogger: ReturnType<typeof createOrderbookMockLogger>;
  loggerService: LoggerService;
  mockWallTracker: ReturnType<typeof createOrderbookWallTrackerMock>;
  errorHandler?: ErrorHandler;
  createService: OrderbookManagerHarness['createService'];
  createLegacyService: OrderbookManagerHarness['createLegacyService'];
  createServiceWithoutWallTracker: OrderbookManagerHarness['createServiceWithoutWallTracker'];
  cleanup: () => void;
}

export type OrderbookManagerManagedRuntime = Pick<
  ManagedOrderbookManagerContext,
  'service' | 'loggerService' | 'createLegacyService' | 'cleanup'
>;

export type OrderbookManagerErrorHandlingRuntime = Pick<
  ManagedOrderbookManagerContext,
  | 'service'
  | 'errorHandler'
  | 'mockLogger'
  | 'loggerService'
  | 'createLegacyService'
  | 'createServiceWithoutWallTracker'
  | 'mockWallTracker'
  | 'cleanup'
>;

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
} = {}): OrderbookManagerHarness {
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
    createService: (serviceOptions = {}) => createOrderbookManagerService({
      symbol: serviceOptions.symbol ?? options.symbol,
      logger: serviceOptions.logger ?? loggerService,
      wallTracker: serviceOptions.wallTracker ?? wallTracker,
      withErrorHandler: serviceOptions.withErrorHandler ?? options.withErrorHandler,
      errorHandler: serviceOptions.errorHandler ?? errorHandler,
    }),
    createLegacyService: (serviceOptions = {}) => createOrderbookLegacyService({
      symbol: serviceOptions.symbol ?? options.symbol,
      logger: serviceOptions.logger ?? loggerService,
      wallTracker: serviceOptions.wallTracker ?? wallTracker,
    }),
    createServiceWithoutWallTracker: (serviceOptions = {}) => createOrderbookServiceWithoutWallTracker({
      symbol: serviceOptions.symbol ?? options.symbol,
      logger: serviceOptions.logger ?? loggerService,
      errorHandler: serviceOptions.errorHandler ?? errorHandler,
    }),
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

export function createManagedOrderbookManagerContext(options: {
  symbol?: string;
  withWallTracker?: boolean;
  withErrorHandler?: boolean;
  logger?: LoggerService;
  wallTracker?: WallTrackerService;
  errorHandler?: ErrorHandler;
} = {}): ManagedOrderbookManagerContext {
  jest.clearAllMocks();

  const harness = createOrderbookManagerHarness(options);
  const createdServices = new Set<OrderbookManagerService>([harness.service]);

  const trackService = (service: OrderbookManagerService) => {
    createdServices.add(service);
    return service;
  };

  return {
    service: harness.service,
    mockLogger: harness.mockLogger,
    loggerService: harness.loggerService,
    mockWallTracker: harness.mockWallTracker,
    errorHandler: harness.errorHandler,
    createService: (serviceOptions = {}) => trackService(harness.createService(serviceOptions)),
    createLegacyService: (serviceOptions = {}) => trackService(harness.createLegacyService(serviceOptions)),
    createServiceWithoutWallTracker: (serviceOptions = {}) =>
      trackService(harness.createServiceWithoutWallTracker(serviceOptions)),
    cleanup: () => {
      jest.useRealTimers();
      createdServices.forEach((service) => {
        service.reset();
      });
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
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
