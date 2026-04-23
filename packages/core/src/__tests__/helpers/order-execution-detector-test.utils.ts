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

export function createOrderExecutionDetectorExecutionBatch(
  overridesList: Array<Partial<OrderExecutionData>>,
): OrderExecutionData[] {
  return overridesList.map((overrides, index) =>
    createOrderExecutionDetectorExecutionData({
      orderId: overrides.orderId ?? `test-order-${index + 1}`,
      ...overrides,
    }),
  );
}

export function runOrderExecutionDetectorSequence(
  service: OrderExecutionDetectorService,
  overridesList: Array<Partial<OrderExecutionData>>,
) {
  return createOrderExecutionDetectorExecutionBatch(overridesList).map((execution) =>
    service.detectExecution(execution),
  );
}

export function createOrderExecutionDetectorFailingLogger(
  failures: Partial<Record<'debug' | 'info', string>> = {},
): LoggerService {
  return {
    debug: jest.fn(() => {
      if (failures.debug) {
        throw new Error(failures.debug);
      }
    }),
    info: jest.fn(() => {
      if (failures.info) {
        throw new Error(failures.info);
      }
    }),
  } as unknown as LoggerService;
}

export function createOrderExecutionDetectorHarness(options: {
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}): {
  service: OrderExecutionDetectorService;
  logger: LoggerService;
  errorHandler?: ErrorHandler;
  createService: (serviceOptions?: {
    logger?: LoggerService;
    withErrorHandler?: boolean;
    errorHandler?: ErrorHandler;
  }) => OrderExecutionDetectorService;
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
    createService: (serviceOptions = {}) =>
      createOrderExecutionDetectorService({
        logger: serviceOptions.logger ?? logger,
        withErrorHandler: serviceOptions.withErrorHandler,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
      }),
  };
}

export type OrderExecutionDetectorHarness = ReturnType<
  typeof createOrderExecutionDetectorHarness
>;

export type ManagedOrderExecutionDetectorContext = OrderExecutionDetectorHarness & {
  cleanup: () => void;
};

export type OrderExecutionDetectorSuiteState = Pick<
  ManagedOrderExecutionDetectorContext,
  'service' | 'logger' | 'cleanup'
>;

export type OrderExecutionDetectorScenarioFactoryContext = Pick<
  ManagedOrderExecutionDetectorContext,
  'logger'
>;

export type OrderExecutionDetectorErrorHandlingState = Pick<
  ManagedOrderExecutionDetectorContext,
  'logger' | 'errorHandler' | 'cleanup'
>;

export type OrderExecutionDetectorScenarioFactoryState = Pick<
  ManagedOrderExecutionDetectorContext,
  'logger' | 'errorHandler'
>;

export type OrderExecutionDetectorServiceScenarioFactoryState = Pick<
  ManagedOrderExecutionDetectorContext,
  'logger'
>;

export function createManagedOrderExecutionDetectorContext(options: {
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}): ManagedOrderExecutionDetectorContext {
  const harness = createOrderExecutionDetectorHarness(options);

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

export function createOrderExecutionDetectorScenarioHarness(options: {
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
  executionOverrides?: Partial<OrderExecutionData>;
  executionBatchOverrides?: Array<Partial<OrderExecutionData>>;
} = {}) {
  const harness = createOrderExecutionDetectorHarness(options);
  const execution = createOrderExecutionDetectorExecutionData(options.executionOverrides);
  const executionBatch = createOrderExecutionDetectorExecutionBatch(
    options.executionBatchOverrides ?? [options.executionOverrides ?? {}],
  );

  return {
    ...harness,
    execution,
    executionBatch,
  };
}

export type OrderExecutionDetectorScenarioHarnessState = ReturnType<
  typeof createOrderExecutionDetectorScenarioHarness
>;

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
