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

export function createIndicatorCacheHarness(options?: {
  logger?: LoggerService;
  repository?: IndicatorCacheMockRepository;
}) {
  const logger = options?.logger ?? createIndicatorCacheMockLogger();
  const repository = options?.repository ?? createIndicatorCacheMockRepository();
  const errorHandler = new ErrorHandler(logger);
  const cache = new IndicatorCacheService(repository, logger, errorHandler);

  return {
    logger,
    repository,
    errorHandler,
    cache,
  };
}

export function asIndicatorCacheKey(value: unknown): string {
  return value as string;
}
