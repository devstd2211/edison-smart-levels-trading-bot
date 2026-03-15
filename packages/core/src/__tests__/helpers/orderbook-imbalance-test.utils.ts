import { ErrorHandler } from '../../errors/ErrorHandler';
import { OrderbookImbalanceService } from '../../services/orderbook-imbalance.service';
import {
  LoggerService,
  LogLevel,
  OrderbookImbalanceConfig,
} from '../../types/legacy';

export function createOrderbookImbalanceLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createOrderbookImbalanceConfig(
  overrides: Partial<OrderbookImbalanceConfig> = {},
): OrderbookImbalanceConfig {
  return {
    enabled: true,
    minImbalancePercent: 30,
    levels: 10,
    ...overrides,
  };
}

export function createOrderbookImbalanceHarness(options: {
  configOverrides?: Partial<OrderbookImbalanceConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}) {
  const logger = options.logger ?? createOrderbookImbalanceLogger();
  const config = createOrderbookImbalanceConfig(options.configOverrides);
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);
  const service = createOrderbookImbalanceService({
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
  };
}

export function createOrderbookImbalanceService(options: {
  config?: OrderbookImbalanceConfig;
  configOverrides?: Partial<OrderbookImbalanceConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}): OrderbookImbalanceService {
  const logger = options.logger ?? createOrderbookImbalanceLogger();
  const config = options.config ?? createOrderbookImbalanceConfig(options.configOverrides);
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);

  return new OrderbookImbalanceService(
    config,
    logger,
    errorHandler,
  );
}
