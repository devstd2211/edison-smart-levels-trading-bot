import { ErrorHandler } from '../../errors/ErrorHandler';
import { TFAlignmentService } from '../../services/tf-alignment.service';
import { LoggerService, LogLevel, TFAlignmentConfig } from '../../types/legacy';

type TFAlignmentIndicators = Parameters<TFAlignmentService['calculateAlignment']>[2];

export function createTFAlignmentLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createTFAlignmentMockLogger(overrides: Record<string, unknown> = {}) {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
    ...overrides,
  };
}

export function createTFAlignmentConfig(
  overrides: Partial<TFAlignmentConfig> = {},
): TFAlignmentConfig {
  return {
    enabled: true,
    timeframes: {
      entry: { weight: 20 },
      primary: { weight: 50 },
      trend1: { weight: 30 },
    },
    minAlignmentScore: 70,
    ...overrides,
  };
}

export function createTFAlignmentIndicators(
  baseValue: number = 100,
  overrides: Partial<TFAlignmentIndicators> = {},
): TFAlignmentIndicators {
  return {
    entry: { ema20: baseValue - 1 },
    primary: { ema20: baseValue - 2, ema50: baseValue - 3 },
    trend1: { ema20: baseValue + 1, ema50: baseValue - 2 },
    ...overrides,
  };
}

export function createTFAlignmentHarness(options: {
  configOverrides?: Partial<TFAlignmentConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
  config?: TFAlignmentConfig;
  errorHandler?: ErrorHandler;
} = {}) {
  const logger = options.logger ?? createTFAlignmentLogger();
  const config = Object.prototype.hasOwnProperty.call(options, 'config')
    ? options.config
    : createTFAlignmentConfig(options.configOverrides);
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);
  const service = createTFAlignmentService({
    config,
    logger,
    withErrorHandler: options.withErrorHandler,
    errorHandler,
  });

  return {
    service,
    logger,
    config,
    errorHandler,
    createStandardService: (serviceOptions: {
      configOverrides?: Partial<TFAlignmentConfig>;
      logger?: LoggerService;
      withErrorHandler?: boolean;
      config?: TFAlignmentConfig;
      errorHandler?: ErrorHandler;
    } = {}) => {
      const baseOptions = {
        logger: serviceOptions.logger ?? logger,
        withErrorHandler: serviceOptions.withErrorHandler ?? options.withErrorHandler,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
      };

      return Object.prototype.hasOwnProperty.call(serviceOptions, 'config')
        ? createTFAlignmentService({
          ...baseOptions,
          config: serviceOptions.config,
        })
        : createTFAlignmentService({
          ...baseOptions,
          configOverrides: serviceOptions.configOverrides,
        });
    },
    createLegacyService: (serviceOptions: {
      configOverrides?: Partial<TFAlignmentConfig>;
      logger?: LoggerService;
      config?: TFAlignmentConfig;
    } = {}) => {
      const baseOptions = {
        logger: serviceOptions.logger ?? logger,
        withErrorHandler: false,
      };

      return Object.prototype.hasOwnProperty.call(serviceOptions, 'config')
        ? createTFAlignmentService({
          ...baseOptions,
          config: serviceOptions.config,
        })
        : createTFAlignmentService({
          ...baseOptions,
          configOverrides: serviceOptions.configOverrides,
        });
    },
  };
}

export function createTFAlignmentBoundFactory(options: {
  configOverrides?: Partial<TFAlignmentConfig>;
  logger?: LoggerService;
  config?: TFAlignmentConfig;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const harness = createTFAlignmentHarness(options);

  return {
    logger: harness.logger,
    config: harness.config,
    errorHandler: harness.errorHandler,
    createStandardService: harness.createStandardService,
    createLegacyService: harness.createLegacyService,
  };
}

export function createTFAlignmentService(options: {
  configOverrides?: Partial<TFAlignmentConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
  config?: TFAlignmentConfig;
  errorHandler?: ErrorHandler;
} = {}): TFAlignmentService {
  const logger = options.logger ?? createTFAlignmentLogger();
  const config = Object.prototype.hasOwnProperty.call(options, 'config')
    ? options.config
    : createTFAlignmentConfig(options.configOverrides);
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);

  return new TFAlignmentService(
    config,
    logger,
    errorHandler,
  );
}
