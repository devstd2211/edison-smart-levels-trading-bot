import { ErrorHandler } from '../../errors/ErrorHandler';
import { WallTrackerService } from '../../services/wall-tracker.service';
import { LoggerService, LogLevel, WallTrackingConfig } from '../../types/legacy';

export type WallTrackerWallInput = {
  price?: number;
  size?: number;
  side?: 'BID' | 'ASK';
};

export type WallTrackerServiceFactoryOptions = {
  config?: WallTrackingConfig;
  configOverrides?: Partial<WallTrackingConfig>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
};

export type WallTrackerLegacyServiceFactoryOptions = {
  config?: WallTrackingConfig;
  configOverrides?: Partial<WallTrackingConfig>;
  logger?: LoggerService;
};

export type WallTrackerHarnessOptions = {
  configOverrides?: Partial<WallTrackingConfig>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
};

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

export function createWallTrackerWall(
  options: WallTrackerWallInput = {},
): { price: number; size: number; side: 'BID' | 'ASK' } {
  return {
    price: options.price ?? 40000,
    size: options.size ?? 1000,
    side: options.side ?? 'BID',
  };
}

export function createWallTrackerWallSequence(
  entries: WallTrackerWallInput[],
): Array<{ price: number; size: number; side: 'BID' | 'ASK' }> {
  return entries.map((entry) => createWallTrackerWall(entry));
}

export function detectWallTrackerWalls(
  service: WallTrackerService,
  entries: WallTrackerWallInput[],
): void {
  createWallTrackerWallSequence(entries).forEach((wall) => {
    service.detectWall(wall.price, wall.size, wall.side);
  });
}

export function createWallTrackerServiceWithHarness(
  options: WallTrackerServiceFactoryOptions = {},
) {
  return createWallTrackerService(options);
}

export function createWallTrackerHarness(
  options: WallTrackerHarnessOptions = {},
) {
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
    createStandardService: (serviceOptions: WallTrackerServiceFactoryOptions = {}) =>
      createWallTrackerService({
        configOverrides: serviceOptions.configOverrides ?? options.configOverrides,
        logger: serviceOptions.logger ?? logger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
        withErrorHandler: serviceOptions.withErrorHandler ?? options.withErrorHandler,
      }),
    createLegacyService: (serviceOptions: WallTrackerLegacyServiceFactoryOptions = {}) =>
      createWallTrackerService({
        configOverrides: serviceOptions.configOverrides ?? options.configOverrides,
        logger: serviceOptions.logger ?? logger,
        withErrorHandler: false,
      }),
  };
}

export interface WallTrackerHarness {
  service: WallTrackerService;
  logger: LoggerService;
  config: WallTrackingConfig;
  errorHandler: ErrorHandler;
  createStandardService: (serviceOptions?: WallTrackerServiceFactoryOptions) => WallTrackerService;
  createLegacyService: (serviceOptions?: WallTrackerLegacyServiceFactoryOptions) => WallTrackerService;
}

export type ManagedWallTrackerContext = WallTrackerHarness & {
  cleanup: () => void;
};

export type WallTrackerSharedState = Pick<
  ManagedWallTrackerContext,
  'service'
>;

export type WallTrackerServiceSharedState = Pick<
  ManagedWallTrackerContext,
  'service' | 'cleanup' | 'createLegacyService'
>;

export type WallTrackerFactoryState = Pick<
  ManagedWallTrackerContext,
  'cleanup' | 'createLegacyService'
>;

export type WallTrackerRuntime = WallTrackerSharedState;

export type WallTrackerServiceRuntime = WallTrackerServiceSharedState;

export type WallTrackerFactories = WallTrackerFactoryState;

export type WallTrackerErrorHandlingRuntime = WallTrackerServiceSharedState;

export function createManagedWallTrackerContext(
  options: WallTrackerHarnessOptions = {},
): ManagedWallTrackerContext {
  const harness = createWallTrackerHarness(options);

  return {
    ...harness,
    cleanup: () => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
      jest.clearAllTimers();
      jest.useRealTimers();
    },
  };
}

export function createWallTrackerService(
  options: WallTrackerServiceFactoryOptions = {},
) {
  const logger = options.logger ?? createWallTrackerLogger();
  const config = options.config ?? createWallTrackerConfig(options.configOverrides);
  const errorHandler = options.errorHandler ?? new ErrorHandler(logger);

  return new WallTrackerService(
    config,
    logger,
    options.withErrorHandler === false ? undefined : errorHandler,
  );
}

export function createWallTrackerBoundFactory(
  options: WallTrackerServiceFactoryOptions = {},
) {
  const logger = options.logger ?? createWallTrackerLogger();
  const config = options.config ?? createWallTrackerConfig(options.configOverrides);
  const errorHandler = options.errorHandler ?? new ErrorHandler(logger);

  return {
    logger,
    config,
    errorHandler,
    createStandardService: (serviceOptions: WallTrackerServiceFactoryOptions = {}) =>
      createWallTrackerService({
        config: serviceOptions.config,
        configOverrides: serviceOptions.config ? undefined : {
          ...options.configOverrides,
          ...serviceOptions.configOverrides,
        },
        logger: serviceOptions.logger ?? logger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
        withErrorHandler: serviceOptions.withErrorHandler ?? options.withErrorHandler,
      }),
    createLegacyService: (serviceOptions: WallTrackerLegacyServiceFactoryOptions = {}) =>
      createWallTrackerService({
        config: serviceOptions.config,
        configOverrides: serviceOptions.config ? undefined : {
          ...options.configOverrides,
          ...serviceOptions.configOverrides,
        },
        logger: serviceOptions.logger ?? logger,
        withErrorHandler: false,
      }),
  };
}
