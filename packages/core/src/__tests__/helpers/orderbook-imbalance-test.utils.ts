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

export function createOrderbookImbalanceOrderbook(options: {
  bids?: [number, number][];
  asks?: [number, number][];
} = {}): { bids: [number, number][]; asks: [number, number][] } {
  return {
    bids: options.bids ?? [[50000, 10]],
    asks: options.asks ?? [[50010, 10]],
  };
}

export function createOrderbookImbalanceLevels(options: {
  startPrice: number;
  quantities: number[];
  direction?: 'asc' | 'desc';
  priceStep?: number;
}): [number, number][] {
  const {
    startPrice,
    quantities,
    direction = 'desc',
    priceStep = 10,
  } = options;

  return quantities.map((quantity, index) => {
    const price = direction === 'desc'
      ? startPrice - (index * priceStep)
      : startPrice + (index * priceStep);
    return [price, quantity];
  });
}

export function createOrderbookImbalanceScenario(options: {
  bidQuantities?: number[];
  askQuantities?: number[];
  bidStartPrice?: number;
  askStartPrice?: number;
} = {}): { bids: [number, number][]; asks: [number, number][] } {
  return createOrderbookImbalanceOrderbook({
    bids: options.bidQuantities
      ? createOrderbookImbalanceLevels({
        startPrice: options.bidStartPrice ?? 50000,
        quantities: options.bidQuantities,
        direction: 'desc',
      })
      : undefined,
    asks: options.askQuantities
      ? createOrderbookImbalanceLevels({
        startPrice: options.askStartPrice ?? 50010,
        quantities: options.askQuantities,
        direction: 'asc',
      })
      : undefined,
  });
}

export function createOrderbookImbalanceFailingLogger(
  logger: LoggerService,
  overrides: Partial<Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error'>>,
): LoggerService {
  return {
    ...logger,
    ...overrides,
  } as LoggerService;
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

export function createOrderbookImbalanceServiceFactory(options: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createOrderbookImbalanceLogger();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);

  return {
    logger,
    errorHandler,
    createService: (configOrOverrides?: OrderbookImbalanceConfig | Partial<OrderbookImbalanceConfig>) =>
      createOrderbookImbalanceService({
        logger,
        errorHandler,
        withErrorHandler: options.withErrorHandler,
        ...(configOrOverrides && 'enabled' in configOrOverrides && 'levels' in configOrOverrides && 'minImbalancePercent' in configOrOverrides
          ? { config: configOrOverrides as OrderbookImbalanceConfig }
          : { configOverrides: configOrOverrides as Partial<OrderbookImbalanceConfig> | undefined }),
      }),
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
