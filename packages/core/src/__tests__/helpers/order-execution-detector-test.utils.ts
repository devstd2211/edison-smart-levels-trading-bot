import { ErrorHandler } from '../../errors/ErrorHandler';
import { OrderExecutionDetectorService } from '../../services/order-execution-detector.service';
import {
  LoggerService,
  LogLevel,
  OrderExecutionData,
} from '../../types/legacy';

export function createOrderExecutionDetectorLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createOrderExecutionDetectorExecutionData(
  overrides?: Partial<OrderExecutionData>,
): OrderExecutionData {
  return {
    orderId: 'test-order-123',
    symbol: 'APEXUSDT',
    side: 'Buy',
    execType: 'Trade',
    execPrice: '100.50',
    execQty: '10',
    closedSize: '10',
    stopOrderType: 'UNKNOWN',
    orderType: 'Market',
    createType: 'CreateByUser',
    ...overrides,
  };
}

export function createOrderExecutionDetectorHarness(options: {
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}): {
  service: OrderExecutionDetectorService;
  logger: LoggerService;
  errorHandler?: ErrorHandler;
} {
  const logger = options.logger ?? createOrderExecutionDetectorLogger();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);
  const service = createOrderExecutionDetectorService({
    logger,
    withErrorHandler: options.withErrorHandler,
    errorHandler,
  });

  return {
    service,
    logger,
    errorHandler,
  };
}

export function createOrderExecutionDetectorService(options: {
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}) {
  const logger = options.logger ?? createOrderExecutionDetectorLogger();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);

  return new OrderExecutionDetectorService(logger, errorHandler);
}
