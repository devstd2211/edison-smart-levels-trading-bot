import { OrderExecutionPipeline } from '../../services/order-execution-pipeline.service';
import { LoggerService } from '../../types/legacy';
import { IExchange } from '../../interfaces';
import {
  OrderExecutionConfig,
  OrderRequest,
} from '../../types/legacy';

export type PlaceOrderResponse = {
  orderId: string;
  price?: number;
  filledQuantity?: number;
} | null;

export type OrderExecutionPipelineMockExchange = {
  placeOrder: jest.Mock<Promise<PlaceOrderResponse>, [unknown]>;
  getOrderStatus: jest.Mock<Promise<string>, [string]>;
};

export type OrderExecutionPipelineMockLogger = jest.Mocked<LoggerService>;

export function createOrderExecutionPipelineConfig(
  overrides: Partial<OrderExecutionConfig> = {},
): OrderExecutionConfig {
  return {
    enabled: true,
    maxRetries: 3,
    retryDelayMs: 100,
    timeoutMs: 30000,
    verifyBeforeRetry: true,
    slippagePercent: 0.5,
    ...overrides,
  };
}

export function createOrderExecutionPipelineMockLogger(): OrderExecutionPipelineMockLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  } as unknown as OrderExecutionPipelineMockLogger;
}

export function createOrderExecutionPipelineMockExchange(
  overrides: Partial<OrderExecutionPipelineMockExchange> = {},
): OrderExecutionPipelineMockExchange {
  return {
    placeOrder: jest.fn(),
    getOrderStatus: jest.fn(),
    ...overrides,
  };
}

export function createOrderExecutionPipelineOrder(
  overrides: Partial<OrderRequest> = {},
): OrderRequest {
  return {
    symbol: 'BTCUSDT',
    side: 'BUY',
    orderType: 'LIMIT',
    quantity: 0.01,
    price: 45000,
    timeInForce: 'GTC',
    clientOrderId: 'client-order',
    timestamp: 1700000000000,
    ...overrides,
  };
}

export function createOrderExecutionPipelineSuccessResponse(
  order: OrderRequest,
  overrides: Partial<NonNullable<PlaceOrderResponse>> = {},
): NonNullable<PlaceOrderResponse> {
  return {
    orderId: 'order-123',
    price: order.price,
    filledQuantity: order.quantity,
    ...overrides,
  };
}

export function createOrderExecutionPipelineHarness(options: {
  config?: OrderExecutionConfig;
  exchange?: OrderExecutionPipelineMockExchange;
  logger?: OrderExecutionPipelineMockLogger;
} = {}) {
  const config = options.config ?? createOrderExecutionPipelineConfig();
  const exchange = options.exchange ?? createOrderExecutionPipelineMockExchange();
  const logger = options.logger ?? createOrderExecutionPipelineMockLogger();
  const pipeline = new OrderExecutionPipeline(
    config,
    exchange as unknown as IExchange,
    logger,
  );

  return {
    config,
    exchange,
    logger,
    pipeline,
  };
}
