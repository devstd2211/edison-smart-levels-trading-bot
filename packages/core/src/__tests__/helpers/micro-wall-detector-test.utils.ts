import { ErrorHandler } from '../../errors/ErrorHandler';
import { MicroWallDetectorService } from '../../services/micro-wall-detector.service';
import {
  LoggerService,
  LogLevel,
  MicroWallDetectorConfig,
  OrderBook,
} from '../../types/legacy';

export function createMicroWallDetectorLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createMicroWallDetectorConfig(
  overrides?: Partial<MicroWallDetectorConfig>,
): MicroWallDetectorConfig {
  return {
    minWallSizePercent: 5,
    breakConfirmationMs: 1000,
    maxConfidence: 75,
    wallExpiryMs: 60000,
    ...overrides,
  };
}

export function createMicroWallOrderBook(
  bids: Array<[number, number]>,
  asks: Array<[number, number]>,
): OrderBook {
  return {
    symbol: 'APEXUSDT',
    timestamp: Date.now(),
    bids,
    asks,
    updateId: 1,
  };
}

export function createMicroWallDetectorHarness(options: {
  configOverrides?: Partial<MicroWallDetectorConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createMicroWallDetectorLogger();
  const config = createMicroWallDetectorConfig(options.configOverrides);
  const errorHandler = new ErrorHandler(logger);
  const detector = new MicroWallDetectorService(
    config,
    logger,
    options.withErrorHandler === false ? undefined : errorHandler,
  );

  return {
    detector,
    logger,
    config,
    errorHandler,
  };
}
