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

export type WebSocketManagerInternalState = {
  errorHandler: ErrorHandler;
  reconnectAttempts: number;
  isConnecting: boolean;
  shouldReconnect: boolean;
  isDuplicateEvent: (eventType: string, eventId: string, timestamp: number) => boolean;
};

export function createMockWebSocketAuthenticationService(): WebSocketAuthenticationService {
  return new WebSocketAuthenticationService();
}

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

export function createWebSocketManagerErrorHandler(
  logger: LoggerService = createMockWebSocketManagerLogger(),
): ErrorHandler {
  return new ErrorHandler(logger);
}

export function createWebSocketManagerService(options: {
  configOverrides?: Partial<ExchangeConfig>;
  symbol?: string;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  orderExecutionDetector?: OrderExecutionDetectorService;
  authService?: WebSocketAuthenticationService;
  deduplicationService?: EventDeduplicationService;
  keepAliveService?: WebSocketKeepAliveService;
} = {}): WebSocketManagerService {
  const config = createMockWebSocketManagerConfig(options.configOverrides);
  const logger = options.logger ?? createMockWebSocketManagerLogger();
  const errorHandler =
    options.errorHandler ?? createWebSocketManagerErrorHandler(logger);

  return new WebSocketManagerService(
    config,
    options.symbol ?? config.symbol,
    errorHandler,
    options.orderExecutionDetector ?? new OrderExecutionDetectorService(logger),
    options.authService ?? createMockWebSocketAuthenticationService(),
    options.deduplicationService ?? new EventDeduplicationService(100, 60000, logger),
    options.keepAliveService ?? new WebSocketKeepAliveService(20000, logger),
  );
}

export function createWebSocketManagerHarness(options: {
  configOverrides?: Partial<ExchangeConfig>;
  symbol?: string;
} = {}): WebSocketManagerHarness {
  const config = createMockWebSocketManagerConfig(options.configOverrides);
  const logger = createMockWebSocketManagerLogger();
  const errorHandler = createWebSocketManagerErrorHandler(logger);
  const orderExecutionDetector = new OrderExecutionDetectorService(logger);
  const authService = createMockWebSocketAuthenticationService();
  const deduplicationService = new EventDeduplicationService(100, 60000, logger);
  const keepAliveService = new WebSocketKeepAliveService(20000, logger);
  const wsManager = createWebSocketManagerService({
    configOverrides: options.configOverrides,
    symbol: options.symbol,
    logger,
    errorHandler,
    orderExecutionDetector,
    authService,
    deduplicationService,
    keepAliveService,
  });

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

export function getWebSocketManagerInternals(
  manager: WebSocketManagerService,
): WebSocketManagerInternalState {
  return manager as unknown as WebSocketManagerInternalState;
}

export function getWebSocketManagerDuplicateEventChecker(
  manager: WebSocketManagerService,
): (eventType: string, eventId: string, timestamp: number) => boolean {
  return (eventType: string, eventId: string, timestamp: number): boolean =>
    getWebSocketManagerInternals(manager).isDuplicateEvent.call(
      manager,
      eventType,
      eventId,
      timestamp,
    );
}

export function createWebSocketManagerBackoffDelays(options: {
  attempts: number;
  baseDelay: number;
  multiplier?: number;
  maxDelay: number;
}): number[] {
  const { attempts, baseDelay, maxDelay, multiplier = 2 } = options;

  return Array.from({ length: attempts }, (_, index) =>
    Math.min(baseDelay * Math.pow(multiplier, index), maxDelay),
  );
}
