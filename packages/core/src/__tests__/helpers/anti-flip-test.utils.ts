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
  createService: (
    overrides?: Partial<AntiFlipConfig>,
    options?: { errorHandler?: ErrorHandler; logger?: LoggerService; withErrorHandler?: boolean },
  ) => AntiFlipService;
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

export const createAntiFlipHarness = (): AntiFlipHarness => {
  const logger = createAntiFlipLogger();
  const errorHandler = createAntiFlipErrorHandler();

  return {
    logger,
    errorHandler,
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
