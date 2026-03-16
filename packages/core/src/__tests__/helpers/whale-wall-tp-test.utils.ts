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
    {
      side: 'ASK',
      price: 50500,
      quantity: 10,
      percentOfTotal: 15,
      distance: 1.0,
    },
    {
      side: 'BID',
      price: 49500,
      quantity: 8,
      percentOfTotal: 12,
      distance: -1.0,
    },
  ];
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
