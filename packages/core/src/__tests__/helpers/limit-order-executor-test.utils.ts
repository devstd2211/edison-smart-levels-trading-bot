import { ErrorHandler } from '../../errors/ErrorHandler';
import { BybitService } from '../../services/bybit/bybit.service';
import { LimitOrderExecutorService } from '../../services/limit-order-executor.service';
import { LoggerService } from '../../services/logger.service';
import {
  LimitOrderExecutorConfig,
  LogLevel,
} from '../../types/legacy';

export type MockLimitOrderRestClient = {
  submitOrder: jest.Mock;
  getActiveOrders: jest.Mock;
  getHistoricOrders: jest.Mock;
  cancelOrder: jest.Mock;
};

export type LimitOrderStatusRecord = {
  orderId: string;
  orderStatus: string;
  avgPrice?: string;
};

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

export function createMockLimitOrderRestClient(
  overrides: Partial<MockLimitOrderRestClient> = {},
): MockLimitOrderRestClient {
  return {
    submitOrder: jest.fn(),
    getActiveOrders: jest.fn(),
    getHistoricOrders: jest.fn(),
    cancelOrder: jest.fn(),
    ...overrides,
  };
}

export function attachLimitOrderRestClient(
  bybitService: BybitService,
  overrides: Partial<MockLimitOrderRestClient> = {},
): MockLimitOrderRestClient {
  const restClient = createMockLimitOrderRestClient(overrides);
  (bybitService.getRestClient as jest.Mock).mockReturnValue(restClient);
  return restClient;
}

export function createLimitOrderStatusRecord(
  overrides: Partial<LimitOrderStatusRecord> = {},
): LimitOrderStatusRecord {
  return {
    orderId: 'order-123',
    orderStatus: 'Filled',
    avgPrice: '99.98',
    ...overrides,
  };
}

export type LimitOrderExecutorServiceOptions = {
  config?: LimitOrderExecutorConfig;
  configOverrides?: Partial<LimitOrderExecutorConfig>;
  bybitService?: BybitService;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
};

export function createLimitOrderExecutorService(
  options: LimitOrderExecutorServiceOptions = {},
): LimitOrderExecutorService {
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

export type LimitOrderExecutorHarnessOptions = LimitOrderExecutorServiceOptions;

export function createLimitOrderExecutorHarness(
  options: LimitOrderExecutorHarnessOptions = {},
) {
  const logger = options.logger ?? createLimitOrderExecutorLogger();
  const config = options.config ?? createLimitOrderExecutorConfig(options.configOverrides);
  const bybitService = options.bybitService ?? createMockLimitOrderBybitService();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);
  const createService = (serviceOptions: LimitOrderExecutorServiceOptions = {}) =>
    createLimitOrderExecutorService({
      config,
      bybitService,
      logger,
      errorHandler,
      withErrorHandler: options.withErrorHandler,
      ...serviceOptions,
    });

  return {
    logger,
    config,
    bybitService,
    errorHandler,
    service: createService(),
    createService,
  };
}

export type LimitOrderExecutorHarness = ReturnType<
  typeof createLimitOrderExecutorHarness
>;

export type ManagedLimitOrderExecutorContext = LimitOrderExecutorHarness & {
  cleanup: () => void;
};

export type LimitOrderExecutorState = Pick<
  ManagedLimitOrderExecutorContext,
  | 'logger'
  | 'config'
  | 'bybitService'
  | 'service'
  | 'createService'
  | 'cleanup'
  | 'errorHandler'
>;

export function createManagedLimitOrderExecutorContext(
  options: LimitOrderExecutorHarnessOptions = {},
): ManagedLimitOrderExecutorContext {
  const harness = createLimitOrderExecutorHarness(options);

  return {
    ...harness,
    cleanup: () => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
      jest.clearAllTimers();
      jest.useRealTimers();
    },
  };
}
