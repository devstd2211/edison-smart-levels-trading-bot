import { ErrorHandler } from '../../errors/ErrorHandler';
import type { IMarketDataRepository } from '../../repositories/IRepositories';
import { IndicatorCacheService } from '../../services/indicator-cache.service';
import type { LoggerService } from '../../services/logger.service';

export type IndicatorCacheMockLogger = Pick<
  LoggerService,
  'debug' | 'info' | 'warn' | 'error'
>;

export type IndicatorCacheMockRepository = IMarketDataRepository & {
  getIndicator: jest.Mock;
  cacheIndicator: jest.Mock;
  clearExpiredIndicators: jest.Mock;
  getStats: jest.Mock;
  clear: jest.Mock;
};

export interface ManagedIndicatorCacheContext {
  logger: LoggerService;
  repository: IndicatorCacheMockRepository;
  errorHandler: ErrorHandler;
  cache: IndicatorCacheService;
  cleanup: () => void;
}

export type IndicatorCacheManagedRuntime = Pick<
  ManagedIndicatorCacheContext,
  'logger' | 'repository' | 'errorHandler' | 'cache' | 'cleanup'
>;

export type IndicatorCacheErrorHandlingState = IndicatorCacheManagedRuntime;

export function createIndicatorCacheMockLogger(
  overrides: Partial<IndicatorCacheMockLogger> = {},
): LoggerService {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    ...overrides,
  } as LoggerService;
}

export function createIndicatorCacheMockRepository(
  overrides: Partial<IndicatorCacheMockRepository> = {},
): IndicatorCacheMockRepository {
  return {
    getIndicator: jest.fn().mockReturnValue(null),
    cacheIndicator: jest.fn(),
    clearExpiredIndicators: jest.fn(),
    getStats: jest.fn().mockReturnValue({ indicatorCount: 0 }),
    clear: jest.fn(),
    setCandles: jest.fn(),
    getCandles: jest.fn().mockReturnValue([]),
    checkExists: jest.fn().mockReturnValue(false),
    ...overrides,
  } as IndicatorCacheMockRepository;
}

export function createIndicatorCacheFailingLogger(
  level: keyof IndicatorCacheMockLogger,
  message: string = 'Logger write failed',
): LoggerService {
  return createIndicatorCacheMockLogger({
    [level]: jest.fn().mockImplementation(() => {
      throw new Error(message);
    }),
  } as Partial<IndicatorCacheMockLogger>);
}

export function createIndicatorCacheFailingRepository(
  method: keyof Pick<
    IndicatorCacheMockRepository,
    'getIndicator' | 'cacheIndicator' | 'clearExpiredIndicators' | 'getStats' | 'clear'
  >,
  message: string,
): IndicatorCacheMockRepository {
  return createIndicatorCacheMockRepository({
    [method]: jest.fn().mockImplementation(() => {
      throw new Error(message);
    }),
  } as Partial<IndicatorCacheMockRepository>);
}

export function createIndicatorCacheHarness(options?: {
  logger?: LoggerService;
  repository?: IndicatorCacheMockRepository;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
}) {
  const logger = options?.logger ?? createIndicatorCacheMockLogger();
  const repository = options?.repository ?? createIndicatorCacheMockRepository();
  const errorHandler =
    options?.withErrorHandler === false
      ? undefined
      : (options?.errorHandler ?? new ErrorHandler(logger));
  const cache =
    options?.withErrorHandler === false
      ? createLegacyIndicatorCache({
          logger,
          repository,
        })
      : createStandardIndicatorCache({
          logger,
          repository,
          errorHandler,
        });

  return {
    logger,
    repository,
    errorHandler: errorHandler ?? new ErrorHandler(logger),
    cache,
  };
}

export function createManagedIndicatorCacheContext(options?: {
  logger?: LoggerService;
  repository?: IndicatorCacheMockRepository;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
}): ManagedIndicatorCacheContext {
  const context = createIndicatorCacheHarness(options);

  return {
    ...context,
    cleanup() {
      jest.restoreAllMocks();
    },
  };
}

export function createStandardIndicatorCache(options?: {
  logger?: LoggerService;
  repository?: IndicatorCacheMockRepository;
  errorHandler?: ErrorHandler;
}) {
  return createIndicatorCacheService({
    logger: options?.logger,
    repository: options?.repository,
    errorHandler: options?.errorHandler,
  });
}

export function createLegacyIndicatorCache(options?: {
  logger?: LoggerService;
  repository?: IndicatorCacheMockRepository;
}) {
  return createIndicatorCacheService({
    logger: options?.logger,
    repository: options?.repository,
    withErrorHandler: false,
  });
}

export function createIndicatorCacheService(options?: {
  logger?: LoggerService;
  repository?: IndicatorCacheMockRepository;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
}) {
  const logger = options?.logger;
  const repository = options?.repository ?? createIndicatorCacheMockRepository();

  if (options?.withErrorHandler === false) {
    return new IndicatorCacheService(repository, logger);
  }

  return new IndicatorCacheService(
    repository,
    logger,
    options?.errorHandler ?? (logger ? new ErrorHandler(logger) : undefined),
  );
}

export function asIndicatorCacheKey(value: unknown): string {
  return value as string;
}
