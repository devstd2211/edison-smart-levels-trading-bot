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

type OrderbookManagerInternals = {
  lastSnapshotTime: number;
};

export function setOrderbookLastSnapshotTime(
  manager: OrderbookManagerService,
  timestamp: number,
): void {
  (manager as unknown as OrderbookManagerInternals).lastSnapshotTime = timestamp;
}

export function createOrderbookManagerHarness(options: {
  symbol?: string;
  withWallTracker?: boolean;
  withErrorHandler?: boolean;
} = {}) {
  const mockLogger = createOrderbookMockLogger();
  const loggerService = mockLogger as unknown as LoggerService;
  const mockWallTracker = createOrderbookWallTrackerMock();
  const errorHandler = new ErrorHandler(loggerService);
  const service = new OrderbookManagerService(
    options.symbol ?? 'BTCUSDT',
    loggerService,
    options.withWallTracker === false
      ? undefined
      : (mockWallTracker as unknown as WallTrackerService),
    options.withErrorHandler === false ? undefined : errorHandler,
  );

  return {
    service,
    mockLogger,
    loggerService,
    mockWallTracker,
    errorHandler,
  };
}
