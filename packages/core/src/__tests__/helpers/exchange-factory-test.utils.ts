import type { ExchangeConfig } from '../../services/exchange-factory.service';
import { ExchangeFactory } from '../../services/exchange-factory.service';
import { ErrorHandler, type ErrorHandlingConfig, type ErrorHandlingResult, type TradingError } from '../../errors';
import { LoggerService } from '../../services/logger.service';

export type ExchangeFactoryMockLogger = jest.Mocked<
  Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error'>
>;

export const asExchangeFactoryLogger = (logger: Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error'>): LoggerService =>
  logger as unknown as LoggerService;

export const asExchangeFactoryName = (name: unknown): ExchangeConfig['name'] =>
  name as ExchangeConfig['name'];

export const asExchangeFactorySymbol = (symbol: unknown): string =>
  symbol as string;

export function createExchangeFactoryMockLogger(): ExchangeFactoryMockLogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

export function createExchangeFactoryConfig(
  overrides: Partial<ExchangeConfig> = {},
): ExchangeConfig {
  return {
    name: 'bybit',
    symbol: 'BTCUSDT',
    demo: true,
    testnet: false,
    apiKey: 'test-key',
    apiSecret: 'test-secret',
    ...overrides,
  };
}

export function createBybitExchangeFactoryConfig(
  overrides: Partial<ExchangeConfig> = {},
): ExchangeConfig {
  return createExchangeFactoryConfig({
    name: 'bybit',
    symbol: 'XRPUSDT',
    ...overrides,
  });
}

export function createBinanceExchangeFactoryConfig(
  overrides: Partial<ExchangeConfig> = {},
): ExchangeConfig {
  return createExchangeFactoryConfig({
    name: 'binance',
    symbol: 'BTCUSDT',
    ...overrides,
  });
}

export function createExchangeFactoryErrorHandler(
  logger: LoggerService = asExchangeFactoryLogger(createExchangeFactoryMockLogger()),
): jest.Mocked<ErrorHandler> {
  return {
    handle: jest.fn(
      (error: unknown, options: ErrorHandlingConfig): ErrorHandlingResult => {
        const normalizedError =
          error instanceof Error
            ? (error as unknown as TradingError)
            : (new Error(String(error)) as unknown as TradingError);

        if (options.strategy === 'THROW') {
          throw normalizedError;
        }

        return {
          success: false,
          error: normalizedError,
          recovered: false,
          attempts: 1,
          message: normalizedError.message,
          strategy: options.strategy,
        };
      },
    ),
    executeAsync: jest.fn(
      async (
        fn: () => Promise<unknown>,
      ): Promise<{ success: boolean; value?: unknown; error?: TradingError }> => {
        try {
          const value = await fn();
          return { success: true, value };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? (error as unknown as TradingError)
                : (new Error(String(error)) as unknown as TradingError),
          };
        }
      },
    ),
    getLogger: jest.fn(() => logger),
  } as unknown as jest.Mocked<ErrorHandler>;
}

export function createExchangeFactoryHarness(options: {
  logger?: LoggerService;
  config?: ExchangeConfig;
  errorHandler?: ErrorHandler;
} = {}): {
  factory: ExchangeFactory;
  config: ExchangeConfig;
  logger: LoggerService;
  mockLogger: ExchangeFactoryMockLogger;
  errorHandler: ErrorHandler;
} {
  const mockLogger = createExchangeFactoryMockLogger();
  const logger = options.logger ?? asExchangeFactoryLogger(mockLogger);
  const config = options.config ?? createExchangeFactoryConfig();
  const errorHandler = options.errorHandler ?? createExchangeFactoryErrorHandler(logger);
  const factory = new ExchangeFactory(logger, config, errorHandler);

  return {
    factory,
    config,
    logger,
    mockLogger,
    errorHandler,
  };
}

export function createExchangeFactoryService(options: {
  logger?: LoggerService;
  config?: ExchangeConfig;
  errorHandler?: ErrorHandler;
} = {}): ExchangeFactory {
  return new ExchangeFactory(
    options.logger ?? asExchangeFactoryLogger(createExchangeFactoryMockLogger()),
    options.config ?? createExchangeFactoryConfig(),
    options.errorHandler,
  );
}

export function createStandardExchangeFactory(options: {
  logger?: LoggerService;
  config?: ExchangeConfig;
  errorHandler?: ErrorHandler;
} = {}): ExchangeFactory {
  return createExchangeFactoryService({
    logger: options.logger,
    config: options.config,
    errorHandler: options.errorHandler,
  });
}

export function createLegacyExchangeFactory(options: {
  logger?: LoggerService;
  config?: ExchangeConfig;
} = {}): ExchangeFactory {
  return createExchangeFactoryService({
    logger: options.logger,
    config: options.config,
  });
}

export function createExchangeFactoryServiceWithHarness(options: {
  logger?: LoggerService;
  config?: ExchangeConfig;
  configOverrides?: Partial<ExchangeConfig>;
  errorHandler?: ErrorHandler;
} = {}): ExchangeFactory {
  return createExchangeFactoryService({
    logger: options.logger,
    config: options.config ?? createExchangeFactoryConfig(options.configOverrides),
    errorHandler: options.errorHandler,
  });
}

export function createExchangeFactoryTestContext() {
  const mockLogger = createExchangeFactoryMockLogger();
  const logger = asExchangeFactoryLogger(mockLogger);
  const errorHandler = createExchangeFactoryErrorHandler(logger);

  return {
    mockLogger,
    logger,
    errorHandler,
    createFactory: (
      config: ExchangeConfig = createExchangeFactoryConfig(),
      overrideErrorHandler: ErrorHandler = errorHandler,
    ) =>
      createExchangeFactoryService({
        logger,
        config,
        errorHandler: overrideErrorHandler,
      }),
    createFactoryWithoutErrorHandler: (
      config: ExchangeConfig = createExchangeFactoryConfig(),
    ) =>
      createExchangeFactoryService({
        logger,
        config,
      }),
  };
}

export function createExchangeFactoryBoundCreators(options: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}) {
  const mockLogger = createExchangeFactoryMockLogger();
  const logger = options.logger ?? asExchangeFactoryLogger(mockLogger);
  const errorHandler = options.errorHandler ?? createExchangeFactoryErrorHandler(logger);

  return {
    mockLogger,
    logger,
    errorHandler,
    createFactory: (overrides: Partial<ExchangeConfig> = {}) =>
      createStandardExchangeFactory({
        logger,
        config: createExchangeFactoryConfig(overrides),
        errorHandler,
      }),
    createBybitFactory: (overrides: Partial<ExchangeConfig> = {}) =>
      createStandardExchangeFactory({
        logger,
        config: createBybitExchangeFactoryConfig(overrides),
        errorHandler,
      }),
    createBinanceFactory: (overrides: Partial<ExchangeConfig> = {}) =>
      createStandardExchangeFactory({
        logger,
        config: createBinanceExchangeFactoryConfig(overrides),
        errorHandler,
      }),
    createFactoryWithoutErrorHandler: (overrides: Partial<ExchangeConfig> = {}) =>
      createLegacyExchangeFactory({
        logger,
        config: createExchangeFactoryConfig(overrides),
      }),
  };
}
