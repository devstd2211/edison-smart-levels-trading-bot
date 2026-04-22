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

export function createMicroWallFailingLogger(
  failures: Partial<Record<'info' | 'debug' | 'warn' | 'error', string>> = {},
): LoggerService {
  return {
    info: jest.fn(() => {
      if (failures.info) {
        throw new Error(failures.info);
      }
    }),
    debug: jest.fn(() => {
      if (failures.debug) {
        throw new Error(failures.debug);
      }
    }),
    warn: jest.fn(() => {
      if (failures.warn) {
        throw new Error(failures.warn);
      }
    }),
    error: jest.fn(() => {
      if (failures.error) {
        throw new Error(failures.error);
      }
    }),
  } as unknown as LoggerService;
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

export function createMicroWallDetectionOrderBook(options: {
  bidLevels?: Array<[number, number]>;
  askLevels?: Array<[number, number]>;
} = {}): OrderBook {
  return createMicroWallOrderBook(
    options.bidLevels ?? [
      [1.0, 500],
      [0.999, 100],
      [0.998, 100],
    ],
    options.askLevels ?? [
      [1.001, 4500],
      [1.002, 100],
      [1.003, 100],
    ],
  );
}

export function createTrackedMicroWallOrderBook(): OrderBook {
  return createMicroWallOrderBook(
    [[1.0, 500]],
    [[1.001, 4500]],
  );
}

export function createMicroWall(overrides: Partial<{
  side: 'BID' | 'ASK';
  price: number;
  size: number;
  percentOfTotal: number;
  distance: number;
  timestamp: number;
  broken: boolean;
}> = {}) {
  return {
    side: 'BID' as const,
    price: 1.0,
    size: 500,
    percentOfTotal: 5,
    distance: 0.1,
    timestamp: Date.now(),
    broken: false,
    ...overrides,
  };
}

export function createAgedMicroWall(
  overrides: Partial<Parameters<typeof createMicroWall>[0]> = {},
  ageMs: number = 2_000,
) {
  return createMicroWall({
    timestamp: Date.now() - ageMs,
    ...overrides,
  });
}

export function createBrokenMicroWall(
  overrides: Partial<Parameters<typeof createMicroWall>[0]> = {},
  brokenAgeMs: number = 1_000,
) {
  return {
    ...createMicroWall({
      broken: true,
      ...overrides,
    }),
    brokenAt: Date.now() - brokenAgeMs,
  };
}

export function createMicroWallDetectorHarness(options: {
  configOverrides?: Partial<MicroWallDetectorConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}) {
  const logger = options.logger ?? createMicroWallDetectorLogger();
  const config = createMicroWallDetectorConfig(options.configOverrides);
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);
  const detector = createMicroWallDetectorService({
    config,
    logger,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    detector,
    logger,
    config,
    errorHandler,
    createStandardDetector: (serviceOptions: {
      config?: MicroWallDetectorConfig;
      configOverrides?: Partial<MicroWallDetectorConfig>;
      logger?: LoggerService;
      errorHandler?: ErrorHandler;
    } = {}) => createMicroWallDetectorService({
      logger: serviceOptions.logger ?? logger,
      errorHandler: serviceOptions.errorHandler ?? errorHandler,
      config: Object.prototype.hasOwnProperty.call(serviceOptions, 'config')
        ? serviceOptions.config
        : undefined,
      configOverrides: serviceOptions.configOverrides,
    }),
    createLegacyDetector: (serviceOptions: {
      config?: MicroWallDetectorConfig;
      configOverrides?: Partial<MicroWallDetectorConfig>;
      logger?: LoggerService;
    } = {}) => createMicroWallDetectorService({
      logger: serviceOptions.logger ?? logger,
      withErrorHandler: false,
      config: Object.prototype.hasOwnProperty.call(serviceOptions, 'config')
        ? serviceOptions.config
        : undefined,
      configOverrides: serviceOptions.configOverrides,
    }),
  };
}

export interface ManagedMicroWallDetectorContext {
  detector: MicroWallDetectorService;
  logger: LoggerService;
  config: MicroWallDetectorConfig;
  errorHandler?: ErrorHandler;
  createDetector: (options?: Parameters<typeof createMicroWallDetectorService>[0]) => MicroWallDetectorService;
  createStandardDetector: NonNullable<ReturnType<typeof createMicroWallDetectorHarness>['createStandardDetector']>;
  createLegacyDetector: NonNullable<ReturnType<typeof createMicroWallDetectorHarness>['createLegacyDetector']>;
  cleanup: () => void;
}

export type MicroWallDetectorManagedRuntime = Pick<
  ManagedMicroWallDetectorContext,
  'detector' | 'logger' | 'config' | 'cleanup'
>;

export type MicroWallDetectorErrorHandlingRuntime = Pick<
  ManagedMicroWallDetectorContext,
  'logger' | 'errorHandler' | 'createStandardDetector' | 'createLegacyDetector' | 'cleanup'
>;

export function createManagedMicroWallDetectorContext(options: {
  configOverrides?: Partial<MicroWallDetectorConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}): ManagedMicroWallDetectorContext {
  jest.clearAllMocks();

  const harness = createMicroWallDetectorHarness(options);
  const createdDetectors = new Set<MicroWallDetectorService>([harness.detector]);

  const trackDetector = (detector: MicroWallDetectorService) => {
    createdDetectors.add(detector);
    return detector;
  };

  return {
    detector: harness.detector,
    logger: harness.logger,
    config: harness.config,
    errorHandler: harness.errorHandler,
    createDetector: (serviceOptions = {}) => trackDetector(harness.createStandardDetector(serviceOptions)),
    createStandardDetector: (serviceOptions = {}) =>
      trackDetector(harness.createStandardDetector(serviceOptions)),
    createLegacyDetector: (serviceOptions = {}) =>
      trackDetector(harness.createLegacyDetector(serviceOptions)),
    cleanup: () => {
      createdDetectors.forEach((detector) => {
        detector.reset();
      });
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}

export function createMicroWallDetectorService(options: {
  config?: MicroWallDetectorConfig;
  configOverrides?: Partial<MicroWallDetectorConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}): MicroWallDetectorService {
  const logger = options.logger ?? createMicroWallDetectorLogger();
  const config = Object.prototype.hasOwnProperty.call(options, 'config')
    ? options.config
    : createMicroWallDetectorConfig(options.configOverrides);
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);

  return new MicroWallDetectorService(
    config as MicroWallDetectorConfig,
    logger,
    errorHandler,
  );
}
