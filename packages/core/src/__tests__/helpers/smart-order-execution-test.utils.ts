import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  ExecutionReport,
  SmartOrderConfig,
  SmartOrderExecutionService,
  SmartOrderRequest,
} from '../../services/smart-order-execution.service';
import { LoggerService } from '../../types/legacy';

type MockLoggerShape = {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

export function createSmartOrderExecutionLogger(
  overrides: Partial<MockLoggerShape> = {},
): MockLoggerShape {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    ...overrides,
  };
}

export function asSmartOrderLogger(value: MockLoggerShape): LoggerService {
  return value as unknown as LoggerService;
}

export function createSmartOrderExecutionConfig(
  overrides: Partial<SmartOrderConfig> = {},
): SmartOrderConfig {
  return {
    maxSlippagePercent: 0.1,
    maxOrderSplits: 5,
    minFillProbability: 0.7,
    adaptiveExecution: true,
    executionStrategy: 'adaptive',
    twapInterval: 30000,
    vwapLookback: 20,
    executionTimeout: 300000,
    ...overrides,
  };
}

export function createSmartOrderRequest(
  overrides: Partial<SmartOrderRequest> = {},
): SmartOrderRequest {
  return {
    symbol: 'BTCUSDT',
    side: 'Buy',
    size: 1.0,
    price: 45000,
    ...overrides,
  };
}

export function createSmartOrderScenario(
  overrides: Partial<SmartOrderRequest> = {},
): SmartOrderRequest {
  return createSmartOrderRequest(overrides);
}

export function createMinimalSmartOrder(
  overrides: Partial<SmartOrderRequest> = {},
): SmartOrderRequest {
  return createSmartOrderRequest({
    symbol: 'BTCUSDT',
    side: 'Buy',
    size: 1.0,
    price: 45000,
    ...overrides,
  });
}

export function createSmartOrderExecutionHarness(
  overrides: Partial<SmartOrderConfig> = {},
): {
  service: SmartOrderExecutionService;
  logger: LoggerService;
  errorHandler: ErrorHandler;
  config: SmartOrderConfig;
  order: SmartOrderRequest;
  createNoHandlerService: () => SmartOrderExecutionService;
  createService: (options?: {
    config?: SmartOrderConfig;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  }) => SmartOrderExecutionService;
} {
  const logger = asSmartOrderLogger(createSmartOrderExecutionLogger());
  const errorHandler = new ErrorHandler(logger);
  const config = createSmartOrderExecutionConfig(overrides);
  const order = createSmartOrderRequest();
  const createService = (options: {
    config?: SmartOrderConfig;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  } = {}): SmartOrderExecutionService =>
    new SmartOrderExecutionService(
      options.config ?? config,
      Object.prototype.hasOwnProperty.call(options, 'logger') ? options.logger : logger,
      Object.prototype.hasOwnProperty.call(options, 'errorHandler') ? options.errorHandler : errorHandler,
    );

  return {
    service: createService(),
    logger,
    errorHandler,
    config,
    order,
    createNoHandlerService: () => createService({ errorHandler: undefined }),
    createService,
  };
}

export type SmartOrderInternals = {
  doExecuteSmartOrder: (...args: unknown[]) => Promise<ExecutionReport>;
  doCalculateOptimalSplit: (size: number, price: number) => number[];
  doEstimateMarketImpact: (size: number, side: SmartOrderRequest['side']) => number;
  shouldAdjustPrice: (...args: unknown[]) => boolean;
  doHandlePartialFills: (...args: unknown[]) => Promise<void>;
  doExecuteTWAP: (...args: unknown[]) => Promise<ExecutionReport>;
  doExecuteVWAP: (...args: unknown[]) => Promise<ExecutionReport>;
  calculateSlippage: (executedPrice: number, referencePrice: number) => number;
  roundToDecimals: (value: number, decimals: number) => number;
  activeOrders: Map<string, ExecutionReport>;
};

export function asSmartOrderInternals(
  service: SmartOrderExecutionService,
): SmartOrderInternals {
  return service as unknown as SmartOrderInternals;
}
