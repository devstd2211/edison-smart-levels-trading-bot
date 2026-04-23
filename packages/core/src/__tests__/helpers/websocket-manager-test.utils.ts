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
  createStandardService: (options?: {
    configOverrides?: Partial<ExchangeConfig>;
    symbol?: string;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
    orderExecutionDetector?: OrderExecutionDetectorService;
    authService?: WebSocketAuthenticationService;
    deduplicationService?: EventDeduplicationService;
    keepAliveService?: WebSocketKeepAliveService;
  }) => WebSocketManagerService;
  createService: (options?: {
    configOverrides?: Partial<ExchangeConfig>;
    symbol?: string;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
    orderExecutionDetector?: OrderExecutionDetectorService;
    authService?: WebSocketAuthenticationService;
    deduplicationService?: EventDeduplicationService;
    keepAliveService?: WebSocketKeepAliveService;
  }) => WebSocketManagerService;
  createStandardTestnetService: (options?: {
    configOverrides?: Partial<ExchangeConfig>;
    symbol?: string;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
    orderExecutionDetector?: OrderExecutionDetectorService;
    authService?: WebSocketAuthenticationService;
    deduplicationService?: EventDeduplicationService;
    keepAliveService?: WebSocketKeepAliveService;
  }) => WebSocketManagerService;
  createTestnetService: (options?: {
    configOverrides?: Partial<ExchangeConfig>;
    symbol?: string;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
    orderExecutionDetector?: OrderExecutionDetectorService;
    authService?: WebSocketAuthenticationService;
    deduplicationService?: EventDeduplicationService;
    keepAliveService?: WebSocketKeepAliveService;
  }) => WebSocketManagerService;
};

export type WebSocketManagerInternalState = {
  errorHandler: ErrorHandler;
  reconnectAttempts: number;
  isConnecting: boolean;
  shouldReconnect: boolean;
  isDuplicateEvent: (eventType: string, eventId: string, timestamp: number) => boolean;
};

export type ManagedWebSocketManagerContext = WebSocketManagerHarness & {
  cleanup: () => Promise<void>;
};

export type WebSocketManagerManagedRuntime = Pick<
  ManagedWebSocketManagerContext,
  | 'wsManager'
  | 'logger'
  | 'errorHandler'
  | 'orderExecutionDetector'
  | 'deduplicationService'
  | 'keepAliveService'
>;

export type WebSocketManagerSharedState = Pick<
  ManagedWebSocketManagerContext,
  | 'wsManager'
  | 'logger'
  | 'errorHandler'
  | 'orderExecutionDetector'
  | 'deduplicationService'
  | 'keepAliveService'
>;

export type WebSocketManagerManagedFactories = Pick<
  ManagedWebSocketManagerContext,
  'cleanup' | 'createStandardTestnetService'
>;

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

export function createStandardWebSocketManagerService(options: {
  configOverrides?: Partial<ExchangeConfig>;
  symbol?: string;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  orderExecutionDetector?: OrderExecutionDetectorService;
  authService?: WebSocketAuthenticationService;
  deduplicationService?: EventDeduplicationService;
  keepAliveService?: WebSocketKeepAliveService;
} = {}): WebSocketManagerService {
  return createWebSocketManagerService(options);
}

export function createTestnetWebSocketManagerService(options: {
  configOverrides?: Partial<ExchangeConfig>;
  symbol?: string;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  orderExecutionDetector?: OrderExecutionDetectorService;
  authService?: WebSocketAuthenticationService;
  deduplicationService?: EventDeduplicationService;
  keepAliveService?: WebSocketKeepAliveService;
} = {}): WebSocketManagerService {
  return createWebSocketManagerService({
    ...options,
    configOverrides: {
      testnet: true,
      ...options.configOverrides,
    },
  });
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
    createStandardService: (serviceOptions = {}) =>
      createStandardWebSocketManagerService({
        configOverrides: serviceOptions.configOverrides ?? options.configOverrides,
        symbol: serviceOptions.symbol ?? options.symbol,
        logger: serviceOptions.logger ?? logger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
        orderExecutionDetector: serviceOptions.orderExecutionDetector ?? orderExecutionDetector,
        authService: serviceOptions.authService ?? authService,
        deduplicationService: serviceOptions.deduplicationService ?? deduplicationService,
        keepAliveService: serviceOptions.keepAliveService ?? keepAliveService,
      }),
    createService: (serviceOptions = {}) =>
      createWebSocketManagerService({
        configOverrides: serviceOptions.configOverrides ?? options.configOverrides,
        symbol: serviceOptions.symbol ?? options.symbol,
        logger: serviceOptions.logger ?? logger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
        orderExecutionDetector: serviceOptions.orderExecutionDetector ?? orderExecutionDetector,
        authService: serviceOptions.authService ?? authService,
        deduplicationService: serviceOptions.deduplicationService ?? deduplicationService,
        keepAliveService: serviceOptions.keepAliveService ?? keepAliveService,
      }),
    createStandardTestnetService: (serviceOptions = {}) =>
      createTestnetWebSocketManagerService({
        configOverrides: serviceOptions.configOverrides ?? options.configOverrides,
        symbol: serviceOptions.symbol ?? options.symbol,
        logger: serviceOptions.logger ?? logger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
        orderExecutionDetector: serviceOptions.orderExecutionDetector ?? orderExecutionDetector,
        authService: serviceOptions.authService ?? authService,
        deduplicationService: serviceOptions.deduplicationService ?? deduplicationService,
        keepAliveService: serviceOptions.keepAliveService ?? keepAliveService,
      }),
    createTestnetService: (serviceOptions = {}) =>
      createTestnetWebSocketManagerService({
        configOverrides: serviceOptions.configOverrides ?? options.configOverrides,
        symbol: serviceOptions.symbol ?? options.symbol,
        logger: serviceOptions.logger ?? logger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
        orderExecutionDetector: serviceOptions.orderExecutionDetector ?? orderExecutionDetector,
        authService: serviceOptions.authService ?? authService,
        deduplicationService: serviceOptions.deduplicationService ?? deduplicationService,
        keepAliveService: serviceOptions.keepAliveService ?? keepAliveService,
      }),
  };
}

export function createTestnetWebSocketManagerHarness(options: {
  configOverrides?: Partial<ExchangeConfig>;
  symbol?: string;
} = {}): WebSocketManagerHarness {
  return createWebSocketManagerHarness({
    ...options,
    configOverrides: {
      testnet: true,
      ...options.configOverrides,
    },
  });
}

export function createManagedWebSocketManagerContext(options: {
  configOverrides?: Partial<ExchangeConfig>;
  symbol?: string;
  testnet?: boolean;
} = {}): ManagedWebSocketManagerContext {
  const harness = options.testnet
    ? createTestnetWebSocketManagerHarness({
        configOverrides: options.configOverrides,
        symbol: options.symbol,
      })
    : createWebSocketManagerHarness({
        configOverrides: options.configOverrides,
        symbol: options.symbol,
      });

  const trackedManagers = new Set<WebSocketManagerService>([harness.wsManager]);

  const trackManager = (manager: WebSocketManagerService): WebSocketManagerService => {
    trackedManagers.add(manager);
    return manager;
  };

  return {
    ...harness,
    createStandardService: (serviceOptions = {}) =>
      trackManager(harness.createStandardService(serviceOptions)),
    createService: (serviceOptions = {}) =>
      trackManager(harness.createService(serviceOptions)),
    createStandardTestnetService: (serviceOptions = {}) =>
      trackManager(harness.createStandardTestnetService(serviceOptions)),
    createTestnetService: (serviceOptions = {}) =>
      trackManager(harness.createTestnetService(serviceOptions)),
    cleanup: async () => {
      for (const manager of trackedManagers) {
        await manager.disconnect();
      }
      trackedManagers.clear();
      jest.clearAllMocks();
      jest.clearAllTimers();
      jest.restoreAllMocks();
    },
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

export function getWebSocketManagerErrorHandler(
  manager: WebSocketManagerService,
): ErrorHandler {
  return getWebSocketManagerInternals(manager).errorHandler;
}

export function getWebSocketManagerReconnectAttempts(
  manager: WebSocketManagerService,
): number {
  return getWebSocketManagerInternals(manager).reconnectAttempts;
}

export function setWebSocketManagerReconnectAttempts(
  manager: WebSocketManagerService,
  attempts: number,
): void {
  getWebSocketManagerInternals(manager).reconnectAttempts = attempts;
}

export function getWebSocketManagerIsConnecting(
  manager: WebSocketManagerService,
): boolean {
  return getWebSocketManagerInternals(manager).isConnecting;
}

export function getWebSocketManagerShouldReconnect(
  manager: WebSocketManagerService,
): boolean {
  return getWebSocketManagerInternals(manager).shouldReconnect;
}

export function setWebSocketManagerShouldReconnect(
  manager: WebSocketManagerService,
  shouldReconnect: boolean,
): void {
  getWebSocketManagerInternals(manager).shouldReconnect = shouldReconnect;
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

export function populateWebSocketManagerDeduplicationCache(
  manager: WebSocketManagerService,
  options: {
    count: number;
    eventType?: string;
    idPrefix?: string;
    startTime?: number;
    timeStepMs?: number;
  },
): void {
  const {
    count,
    eventType = 'TP',
    idPrefix = 'order-',
    startTime = Date.now(),
    timeStepMs = 1,
  } = options;

  const isDuplicateEvent = getWebSocketManagerDuplicateEventChecker(manager);
  for (let index = 0; index < count; index++) {
    isDuplicateEvent(eventType, `${idPrefix}${index}`, startTime + (index * timeStepMs));
  }
}
