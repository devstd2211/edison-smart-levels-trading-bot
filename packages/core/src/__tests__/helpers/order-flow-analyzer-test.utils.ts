import { ErrorHandler } from '../../errors/ErrorHandler';
import { OrderFlowAnalyzerService } from '../../services/order-flow-analyzer.service';
import {
  AggressiveFlow,
  LoggerService,
  LogLevel,
  OrderBook,
  OrderFlowAnalyzerConfig,
} from '../../types/legacy';

export function createOrderFlowAnalyzerConfig(
  overrides: Partial<OrderFlowAnalyzerConfig> = {},
): OrderFlowAnalyzerConfig {
  return {
    aggressiveBuyThreshold: 3.0,
    detectionWindow: 3000,
    minVolumeUSDT: 5000,
    maxConfidence: 90,
    ...overrides,
  };
}

export function createOrderFlowAnalyzerLogger(): LoggerService {
  const logger = new LoggerService(LogLevel.ERROR, './logs', false);
  jest.spyOn(logger, 'info').mockImplementation(() => undefined);
  jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  jest.spyOn(logger, 'debug').mockImplementation(() => undefined);
  return logger;
}

export function createMockOrderbook(
  bidPrice: number,
  bidSize: number,
  askPrice: number,
  askSize: number,
): OrderBook {
  return {
    symbol: 'APEXUSDT',
    bids: [
      [bidPrice, bidSize],
      [bidPrice - 0.001, 50],
      [bidPrice - 0.002, 50],
    ],
    asks: [
      [askPrice, askSize],
      [askPrice + 0.001, 50],
      [askPrice + 0.002, 50],
    ],
    timestamp: Date.now(),
    updateId: Date.now(),
  };
}

export function createMockFlow(
  direction: 'BUY' | 'SELL',
  volumeUSDT: number,
  timestamp: number = Date.now(),
): AggressiveFlow {
  return { direction, volumeUSDT, timestamp, price: 1.0 };
}

export function createOrderFlowAnalyzerHarness(
  overrides: Partial<OrderFlowAnalyzerConfig> = {},
): {
  service: OrderFlowAnalyzerService;
  logger: LoggerService;
  errorHandler: ErrorHandler;
  config: OrderFlowAnalyzerConfig;
  createService: (options?: {
    config?: OrderFlowAnalyzerConfig;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  }) => OrderFlowAnalyzerService;
} {
  const logger = createOrderFlowAnalyzerLogger();
  const errorHandler = new ErrorHandler(logger);
  const config = createOrderFlowAnalyzerConfig(overrides);
  const createService = (options: {
    config?: OrderFlowAnalyzerConfig;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  } = {}): OrderFlowAnalyzerService =>
    new OrderFlowAnalyzerService(
      options.config ?? config,
      Object.prototype.hasOwnProperty.call(options, 'logger') ? options.logger ?? logger : logger,
      Object.prototype.hasOwnProperty.call(options, 'errorHandler') ? options.errorHandler : errorHandler,
    );

  return {
    service: createService(),
    logger,
    errorHandler,
    config,
    createService,
  };
}
