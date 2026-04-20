import { ErrorHandler } from '../../errors/ErrorHandler';
import { WhaleWallTPConfig, WhaleWallTPService } from '../../services/whale-wall-tp.service';
import { LoggerService, OrderBookWall } from '../../types/legacy';

type WhaleWallTPMockLogger = ReturnType<typeof createWhaleWallTPMockLogger>;

export function createWhaleWallTPMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
  };
}

export function createWhaleWallTPMockLoggerService(
  overrides: Partial<WhaleWallTPMockLogger> = {},
): LoggerService {
  return {
    ...createWhaleWallTPMockLogger(),
    ...overrides,
  } as unknown as LoggerService;
}

export function createWhaleWallTPConfig(): Partial<WhaleWallTPConfig> {
  return {
    enabled: true,
    minWallPercent: 5,
    maxDistancePercent: 2.0,
    minDistancePercent: 0.3,
    tpTargeting: {
      enabled: true,
      alignmentThresholdPercent: 0.5,
      scaleToWall: true,
      minWallSizeForTP: 8,
    },
    slProtection: {
      enabled: true,
      moveSlBehindWall: true,
      bufferPercent: 0.1,
      minWallSizeForSL: 10,
    },
    qualityValidation: {
      enabled: false,
      rejectSpoofing: true,
      boostIceberg: true,
      icebergBoostFactor: 1.2,
      minStrength: 0.3,
    },
  };
}

export function createWhaleWallTPConfigWithTargeting(
  override: Partial<NonNullable<WhaleWallTPConfig['tpTargeting']>>,
): Partial<WhaleWallTPConfig> {
  return {
    ...createWhaleWallTPConfig(),
    tpTargeting: {
      ...createWhaleWallTPConfig().tpTargeting!,
      ...override,
    },
  };
}

export function createWhaleWallTPConfigWithQuality(
  override: Partial<NonNullable<WhaleWallTPConfig['qualityValidation']>>,
): Partial<WhaleWallTPConfig> {
  return {
    ...createWhaleWallTPConfig(),
    qualityValidation: {
      ...createWhaleWallTPConfig().qualityValidation!,
      ...override,
    },
  };
}

export function createWhaleWallTPWalls(): OrderBookWall[] {
  return [
    createWhaleWallTPWall('ASK', 50500, 15, 1.0, 10),
    createWhaleWallTPWall('BID', 49500, 12, -1.0, 8),
  ];
}

export function createWhaleWallTPWall(
  side: 'BID' | 'ASK',
  price: number,
  percentOfTotal: number,
  distance: number,
  quantity = 1000,
): OrderBookWall {
  return {
    side,
    price,
    quantity,
    percentOfTotal,
    distance,
  };
}

export function createWhaleWallTPTakeProfits(
  prices: number[],
  sizePercents?: number[],
): Array<{
  level: number;
  percent: number;
  sizePercent: number;
  price: number;
  hit: boolean;
}> {
  return prices.map((price, index) => ({
    level: index + 1,
    percent: 0,
    sizePercent: sizePercents?.[index] ?? 100 / prices.length,
    price,
    hit: false,
  }));
}

export function createWhaleWallTPHarness(options: {
  logger?: LoggerService;
  config?: Partial<WhaleWallTPConfig>;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createWhaleWallTPMockLoggerService();
  const errorHandler =
    options.withErrorHandler === false
      ? undefined
      : createWhaleWallTPErrorHandler(logger);
  const service = createWhaleWallTPService({
    logger,
    config: options.config,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    service,
    logger,
    errorHandler,
  };
}

export function createWhaleWallTPErrorHandler(
  logger: LoggerService | WhaleWallTPMockLogger = createWhaleWallTPMockLogger(),
): ErrorHandler {
  return new ErrorHandler(logger as LoggerService);
}

export function createWhaleWallTPService(options: {
  logger?: LoggerService;
  config?: Partial<WhaleWallTPConfig>;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger =
    options.logger ??
    createWhaleWallTPMockLoggerService();

  return new WhaleWallTPService(
    logger,
    options.config ?? createWhaleWallTPConfig(),
    undefined,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}

export type WhaleWallTPHarness = ReturnType<typeof createWhaleWallTPHarness>;

export type ManagedWhaleWallTPContext = WhaleWallTPHarness & {
  createStandardService: typeof createWhaleWallTPService;
  createLegacyService: typeof createWhaleWallTPService;
  createService: typeof createWhaleWallTPService;
  cleanup: () => void;
};

export type WhaleWallTPServiceFactories = Pick<
  ManagedWhaleWallTPContext,
  'createStandardService' | 'createLegacyService' | 'cleanup'
>;

export function createManagedWhaleWallTPContext(options: {
  logger?: LoggerService;
  config?: Partial<WhaleWallTPConfig>;
  withErrorHandler?: boolean;
} = {}): ManagedWhaleWallTPContext {
  const harness = createWhaleWallTPHarness(options);
  const trackedServices = new Set<WhaleWallTPService>([harness.service]);

  const createStandardService: typeof createWhaleWallTPService = (serviceOptions = {}) => {
    const service = createWhaleWallTPService({
      logger: harness.logger,
      config: options.config,
      errorHandler: harness.errorHandler,
      withErrorHandler: options.withErrorHandler,
      ...serviceOptions,
    });
    trackedServices.add(service);
    return service;
  };

  const createLegacyService: typeof createWhaleWallTPService = (serviceOptions = {}) => {
    const service = createWhaleWallTPService({
      logger: harness.logger,
      config: options.config,
      withErrorHandler: false,
      ...serviceOptions,
    });
    trackedServices.add(service);
    return service;
  };

  return {
    ...harness,
    createStandardService,
    createLegacyService,
    createService: createStandardService,
    cleanup: () => {
      trackedServices.clear();
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}
