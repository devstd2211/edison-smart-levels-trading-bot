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
} = {}) {
  const logger = options.logger ?? createOrderbookImbalanceLogger();
  const config = createOrderbookImbalanceConfig(options.configOverrides);
  const errorHandler = new ErrorHandler(logger);
  const service = new OrderbookImbalanceService(
    config,
    logger,
    options.withErrorHandler === false ? undefined : errorHandler,
  );

  return {
    service,
    logger,
    config,
    errorHandler,
  };
}
