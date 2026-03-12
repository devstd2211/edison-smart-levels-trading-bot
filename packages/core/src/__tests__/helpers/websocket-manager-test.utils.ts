import { ErrorHandler } from '../../errors';
import { EventDeduplicationService } from '../../services/event-deduplication.service';
import { OrderExecutionDetectorService } from '../../services/order-execution-detector.service';
import { WebSocketAuthenticationService } from '../../services/websocket-authentication.service';
import { WebSocketKeepAliveService } from '../../services/websocket-keep-alive.service';
import { WebSocketManagerService } from '../../services/websocket-manager.service';
import type { ExchangeConfig } from '../../types/legacy';
import { LoggerService, LogLevel } from '../../types/legacy';

export type WebSocketManagerHarness = {
  config: ExchangeConfig;
  logger: LoggerService;
  errorHandler: ErrorHandler;
  orderExecutionDetector: OrderExecutionDetectorService;
  authService: WebSocketAuthenticationService;
  deduplicationService: EventDeduplicationService;
  keepAliveService: WebSocketKeepAliveService;
  wsManager: WebSocketManagerService;
};

export function createMockWebSocketManagerConfig(
  overrides: Partial<ExchangeConfig> = {},
): ExchangeConfig {
  return {
    name: 'bybit',
    symbol: 'APEXUSDT',
    timeframe: '1m',
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
    testnet: false,
    demo: false,
    ...overrides,
  };
}

export function createMockWebSocketManagerLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createWebSocketManagerHarness(options: {
  configOverrides?: Partial<ExchangeConfig>;
  symbol?: string;
} = {}): WebSocketManagerHarness {
  const config = createMockWebSocketManagerConfig(options.configOverrides);
  const logger = createMockWebSocketManagerLogger();
  const errorHandler = new ErrorHandler(logger);
  const orderExecutionDetector = new OrderExecutionDetectorService(logger);
  const authService = new WebSocketAuthenticationService();
  const deduplicationService = new EventDeduplicationService(100, 60000, logger);
  const keepAliveService = new WebSocketKeepAliveService(20000, logger);
  const wsManager = new WebSocketManagerService(
    config,
    options.symbol ?? config.symbol,
    errorHandler,
    orderExecutionDetector,
    authService,
    deduplicationService,
    keepAliveService,
  );

  return {
    config,
    logger,
    errorHandler,
    orderExecutionDetector,
    authService,
    deduplicationService,
    keepAliveService,
    wsManager,
  };
}
