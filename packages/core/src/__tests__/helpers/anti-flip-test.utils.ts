import { ErrorHandler, RecoveryStrategy } from '../../errors';
import { AntiFlipConfig, AntiFlipService } from '../../services/anti-flip.service';
import { Candle, LoggerService, LogLevel } from '../../types/legacy';

export type AntiFlipLoggerLike = Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error'>;

export const createAntiFlipLogger = (): LoggerService =>
  new LoggerService(LogLevel.ERROR, './logs', false);

export const createAntiFlipMockLogger = (): AntiFlipLoggerLike => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

export const asAntiFlipLogger = (logger: AntiFlipLoggerLike): LoggerService =>
  logger as LoggerService;

export const createAntiFlipConfig = (
  overrides: Partial<AntiFlipConfig> = {},
): Partial<AntiFlipConfig> => ({
  enabled: true,
  cooldownCandles: 3,
  cooldownMs: 300000,
  requiredConfirmationCandles: 2,
  overrideConfidenceThreshold: 85,
  strongReversalRsiThreshold: 25,
  ...overrides,
});

export const createAntiFlipErrorHandler = (): ErrorHandler & { handle: jest.Mock } => {
  type HandleResult = Awaited<ReturnType<ErrorHandler['handle']>>;
  const handler = new ErrorHandler({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });

  jest.spyOn(handler, 'handle').mockResolvedValue({
    success: true,
    recovered: true,
    message: 'Handled',
    strategy: RecoveryStrategy.SKIP,
  } as HandleResult);

  return handler as ErrorHandler & { handle: jest.Mock };
};

export interface AntiFlipHarness {
  logger: LoggerService;
  errorHandler: ErrorHandler & { handle: jest.Mock };
  createStandardService: (
    overrides?: Partial<AntiFlipConfig>,
    options?: { errorHandler?: ErrorHandler; logger?: LoggerService },
  ) => AntiFlipService;
  createLegacyService: (
    overrides?: Partial<AntiFlipConfig>,
    options?: { logger?: LoggerService },
  ) => AntiFlipService;
  createService: (
    overrides?: Partial<AntiFlipConfig>,
    options?: { errorHandler?: ErrorHandler; logger?: LoggerService; withErrorHandler?: boolean },
  ) => AntiFlipService;
}

export interface ManagedAntiFlipContext extends AntiFlipHarness {
  cleanup: () => void;
}

export const createAntiFlipService = (
  overrides: Partial<AntiFlipConfig> = {},
  options: {
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
    withErrorHandler?: boolean;
  } = {},
): AntiFlipService => {
  const logger = options.logger ?? createAntiFlipLogger();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler;

  return new AntiFlipService(
    logger,
    createAntiFlipConfig(overrides),
    errorHandler,
  );
};

export const createStandardAntiFlipService = (
  overrides: Partial<AntiFlipConfig> = {},
  options: {
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  } = {},
): AntiFlipService =>
  createAntiFlipService(overrides, {
    logger: options.logger,
    errorHandler: options.errorHandler,
  });

export const createLegacyAntiFlipService = (
  overrides: Partial<AntiFlipConfig> = {},
  options: {
    logger?: LoggerService;
  } = {},
): AntiFlipService =>
  createAntiFlipService(overrides, {
    logger: options.logger,
    withErrorHandler: false,
  });

export const createAntiFlipHarness = (): AntiFlipHarness => {
  const logger = createAntiFlipLogger();
  const errorHandler = createAntiFlipErrorHandler();

  return {
    logger,
    errorHandler,
    createStandardService: (
      overrides: Partial<AntiFlipConfig> = {},
      options: { errorHandler?: ErrorHandler; logger?: LoggerService } = {},
    ) => createStandardAntiFlipService(overrides, {
      logger: options.logger ?? logger,
      errorHandler: options.errorHandler ?? errorHandler,
    }),
    createLegacyService: (
      overrides: Partial<AntiFlipConfig> = {},
      options: { logger?: LoggerService } = {},
    ) => createLegacyAntiFlipService(overrides, {
      logger: options.logger ?? logger,
    }),
    createService: (
      overrides: Partial<AntiFlipConfig> = {},
      options: { errorHandler?: ErrorHandler; logger?: LoggerService; withErrorHandler?: boolean } = {},
    ) => createAntiFlipService(overrides, {
      logger: options.logger ?? logger,
      errorHandler: options.withErrorHandler === false
        ? undefined
        : options.errorHandler ?? errorHandler,
      withErrorHandler: options.withErrorHandler,
    }),
  };
};

export const createStandardAntiFlipHarness = () => {
  const logger = createAntiFlipLogger();
  const errorHandler = createAntiFlipErrorHandler();

  return {
    logger,
    errorHandler,
    createLegacyService: (
      overrides: Partial<AntiFlipConfig> = {},
      options: { logger?: LoggerService } = {},
    ) => createLegacyAntiFlipService(overrides, {
      logger: options.logger ?? logger,
    }),
    createStandardService: (
      overrides: Partial<AntiFlipConfig> = {},
      options: { errorHandler?: ErrorHandler; logger?: LoggerService } = {},
    ) => createStandardAntiFlipService(overrides, {
      logger: options.logger ?? logger,
      errorHandler: options.errorHandler ?? errorHandler,
    }),
    createService: (
      overrides: Partial<AntiFlipConfig> = {},
      options: { errorHandler?: ErrorHandler; logger?: LoggerService } = {},
    ) => createStandardAntiFlipService(overrides, {
      logger: options.logger ?? logger,
      errorHandler: options.errorHandler ?? errorHandler,
    }),
  };
};

export const createManagedAntiFlipContext = (): ManagedAntiFlipContext => {
  jest.clearAllMocks();
  jest.clearAllTimers();
  jest.useFakeTimers();

  const harness = createStandardAntiFlipHarness();

  return {
    ...harness,
    cleanup: () => {
      jest.clearAllMocks();
      jest.clearAllTimers();
      jest.useRealTimers();
    },
  };
};

export const createLegacyAntiFlipHarness = () => {
  const logger = createAntiFlipLogger();

  return {
    logger,
    errorHandler: undefined,
    createService: (
      overrides: Partial<AntiFlipConfig> = {},
      options: { logger?: LoggerService } = {},
    ) => createLegacyAntiFlipService(overrides, {
      logger: options.logger ?? logger,
    }),
  };
};

export const createBullishAntiFlipCandle = (price: number): Candle => ({
  timestamp: Date.now(),
  open: price - 1,
  high: price + 0.5,
  low: price - 1.5,
  close: price,
  volume: 100,
});

export const createBearishAntiFlipCandle = (price: number): Candle => ({
  timestamp: Date.now(),
  open: price + 1,
  high: price + 1.5,
  low: price - 0.5,
  close: price,
  volume: 100,
});
