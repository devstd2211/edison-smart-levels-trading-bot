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

export function createWallTrackerHarness(options: {
  configOverrides?: Partial<WallTrackingConfig>;
  withErrorHandler?: boolean;
} = {}) {
  const logger = createWallTrackerLogger();
  const config = createWallTrackerConfig(options.configOverrides);
  const errorHandler = new ErrorHandler(logger);
  const service = new WallTrackerService(
    config,
    logger,
    options.withErrorHandler === false ? undefined : errorHandler,
  );

  return {
    service,
    logger,
    config,
    errorHandler,
  };
}
