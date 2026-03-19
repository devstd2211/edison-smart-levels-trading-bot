import { ErrorHandler } from '../../errors/ErrorHandler';
import { WallTrackerService } from '../../services/wall-tracker.service';
import { LoggerService, LogLevel, WallTrackingConfig } from '../../types/legacy';

export function createWallTrackerLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createWallTrackerConfig(
  overrides: Partial<WallTrackingConfig> = {},
): WallTrackingConfig {
  return {
    enabled: true,
    minLifetimeMs: 60000,
    spoofingThresholdMs: 5000,
    trackHistoryCount: 100,
    ...overrides,
  };
}

export function createWallTrackerWall(options: {
  price?: number;
  size?: number;
  side?: 'BID' | 'ASK';
} = {}): { price: number; size: number; side: 'BID' | 'ASK' } {
  return {
    price: options.price ?? 40000,
    size: options.size ?? 1000,
    side: options.side ?? 'BID',
  };
}

export function createWallTrackerWallSequence(
  entries: Array<{
    price?: number;
    size?: number;
    side?: 'BID' | 'ASK';
  }>,
): Array<{ price: number; size: number; side: 'BID' | 'ASK' }> {
  return entries.map((entry) => createWallTrackerWall(entry));
}

export function detectWallTrackerWalls(
  service: WallTrackerService,
  entries: Array<{
    price?: number;
    size?: number;
    side?: 'BID' | 'ASK';
  }>,
): void {
  createWallTrackerWallSequence(entries).forEach((wall) => {
    service.detectWall(wall.price, wall.size, wall.side);
  });
}

export function createWallTrackerServiceWithHarness(options: {
  config?: WallTrackingConfig;
  configOverrides?: Partial<WallTrackingConfig>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  return createWallTrackerService(options);
}

export function createWallTrackerHarness(options: {
  configOverrides?: Partial<WallTrackingConfig>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createWallTrackerLogger();
  const config = createWallTrackerConfig(options.configOverrides);
  const errorHandler = options.errorHandler ?? new ErrorHandler(logger);
  const service = createWallTrackerService({
    config,
    logger,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    service,
    logger,
    config,
    errorHandler,
  };
}

export function createWallTrackerService(options: {
  config?: WallTrackingConfig;
  configOverrides?: Partial<WallTrackingConfig>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createWallTrackerLogger();
  const config = options.config ?? createWallTrackerConfig(options.configOverrides);
  const errorHandler = options.errorHandler ?? new ErrorHandler(logger);

  return new WallTrackerService(
    config,
    logger,
    options.withErrorHandler === false ? undefined : errorHandler,
  );
}
