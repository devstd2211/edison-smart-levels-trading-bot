import { ErrorHandler } from '../../errors/ErrorHandler';
import { BybitService } from '../../services/bybit/bybit.service';
import { LimitOrderExecutorService } from '../../services/limit-order-executor.service';
import { LoggerService } from '../../services/logger.service';
import {
  LimitOrderExecutorConfig,
  LogLevel,
} from '../../types/legacy';

export function createLimitOrderExecutorLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createLimitOrderExecutorConfig(
  overrides: Partial<LimitOrderExecutorConfig> = {},
): LimitOrderExecutorConfig {
  return {
    enabled: true,
    timeoutMs: 5000,
    slippagePercent: 0.02,
    fallbackToMarket: true,
    maxRetries: 2,
    ...overrides,
  };
}

export function createMockLimitOrderBybitService(): BybitService {
  return {
    setLeverage: jest.fn().mockResolvedValue(undefined),
    roundQuantity: jest.fn((qty) => qty.toFixed(0)),
    roundPrice: jest.fn((price) => price.toFixed(2)),
    getSymbol: jest.fn().mockReturnValue('APEXUSDT'),
    getRestClient: jest.fn().mockReturnValue({
      submitOrder: jest.fn(),
      getActiveOrders: jest.fn(),
      getHistoricOrders: jest.fn(),
      cancelOrder: jest.fn(),
    }),
    openPosition: jest.fn(),
  } as unknown as BybitService;
}

export function createLimitOrderExecutorService(options: {
  config?: LimitOrderExecutorConfig;
  configOverrides?: Partial<LimitOrderExecutorConfig>;
  bybitService?: BybitService;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): LimitOrderExecutorService {
  const logger = options.logger ?? createLimitOrderExecutorLogger();
  const config = options.config ?? createLimitOrderExecutorConfig(options.configOverrides);
  const bybitService = options.bybitService ?? createMockLimitOrderBybitService();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);

  return new LimitOrderExecutorService(
    config,
    bybitService,
    logger,
    errorHandler,
  );
}

export function createLimitOrderExecutorHarness(options: {
  config?: LimitOrderExecutorConfig;
  configOverrides?: Partial<LimitOrderExecutorConfig>;
  bybitService?: BybitService;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createLimitOrderExecutorLogger();
  const config = options.config ?? createLimitOrderExecutorConfig(options.configOverrides);
  const bybitService = options.bybitService ?? createMockLimitOrderBybitService();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);

  return {
    logger,
    config,
    bybitService,
    errorHandler,
    service: createLimitOrderExecutorService({
      config,
      bybitService,
      logger,
      errorHandler,
      withErrorHandler: options.withErrorHandler,
    }),
  };
}
