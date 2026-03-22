import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  HealthCheckConfig,
  HealthCheckService,
  IExchangeService,
  IWebSocketService,
} from '../../services/health-check.service';
import { LoggerService } from '../../types/legacy';

export interface HealthCheckTestHarness {
  logger: LoggerService;
  exchange: jest.Mocked<IExchangeService>;
  websocket: jest.Mocked<IWebSocketService>;
  errorHandler: ErrorHandler;
  createExchange: (overrides?: Partial<jest.Mocked<IExchangeService>>) => jest.Mocked<IExchangeService>;
  createWebSocket: (overrides?: Partial<jest.Mocked<IWebSocketService>>) => jest.Mocked<IWebSocketService>;
  createUnavailableService: () => HealthCheckService;
  createMemoryConstrainedService: (memoryUsagePercent: number) => HealthCheckService;
  createCpuConstrainedService: (cpuUsagePercent: number) => HealthCheckService;
  createDisconnectedWebSocketService: () => HealthCheckService;
  createStaleWebSocketService: (ageMs?: number) => HealthCheckService;
  createFailingExchangeService: () => HealthCheckService;
  createDisconnectedExchangeService: () => HealthCheckService;
  createOutOfSyncExchangeService: (offsetMs?: number) => HealthCheckService;
  createThrowingWebSocketService: () => HealthCheckService;
  createHealthyProbeService: () => HealthCheckService;
  createThresholdConfig: (thresholds: NonNullable<HealthCheckConfig['thresholds']>) => HealthCheckConfig;
  configureExchangeHealth: (options?: {
    connected?: boolean;
    serverTimeOffsetMs?: number;
    throwOnConnection?: Error;
  }) => jest.Mocked<IExchangeService>;
  configureWebSocketHealth: (options?: {
    connected?: boolean;
    messageAgeMs?: number;
  }) => jest.Mocked<IWebSocketService>;
  createService: (options?: {
    exchange?: IExchangeService;
    websocket?: IWebSocketService;
    config?: HealthCheckConfig;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  }) => HealthCheckService;
}

export interface ManagedHealthCheckContext {
  harness: HealthCheckTestHarness;
  service: HealthCheckService;
  cleanup: () => void;
}

export function createHealthCheckLogger(): LoggerService {
  const logger = new LoggerService('ERROR', './logs', false);
  jest.spyOn(logger, 'info').mockImplementation(() => undefined);
  jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  jest.spyOn(logger, 'debug').mockImplementation(() => undefined);
  return logger;
}

export function createHealthCheckHarness(): HealthCheckTestHarness {
  const logger = createHealthCheckLogger();
  const createExchange = (
    overrides: Partial<jest.Mocked<IExchangeService>> = {},
  ): jest.Mocked<IExchangeService> => ({
    testConnection: jest.fn().mockResolvedValue(true),
    getServerTime: jest.fn().mockResolvedValue(Date.now()),
    ...overrides,
  });
  const createWebSocket = (
    overrides: Partial<jest.Mocked<IWebSocketService>> = {},
  ): jest.Mocked<IWebSocketService> => ({
    isConnected: jest.fn().mockReturnValue(true),
    getLastMessageTime: jest.fn().mockReturnValue(Date.now()),
    ...overrides,
  });
  const exchange = createExchange();
  const websocket = createWebSocket();
  const errorHandler = new ErrorHandler(logger);
  const createThresholdConfig = (
    thresholds: NonNullable<HealthCheckConfig['thresholds']>,
  ): HealthCheckConfig => ({
    thresholds,
  });
  const configureExchangeHealth = (
    options: {
      connected?: boolean;
      serverTimeOffsetMs?: number;
      throwOnConnection?: Error;
    } = {},
  ): jest.Mocked<IExchangeService> => createExchange({
    testConnection: options.throwOnConnection
      ? jest.fn().mockRejectedValue(options.throwOnConnection)
      : jest.fn().mockResolvedValue(options.connected ?? true),
    getServerTime: jest.fn().mockResolvedValue(Date.now() + (options.serverTimeOffsetMs ?? 0)),
  });
  const configureWebSocketHealth = (
    options: {
      connected?: boolean;
      messageAgeMs?: number;
    } = {},
  ): jest.Mocked<IWebSocketService> => createWebSocket({
    isConnected: jest.fn().mockReturnValue(options.connected ?? true),
    getLastMessageTime: jest.fn().mockReturnValue(Date.now() - (options.messageAgeMs ?? 0)),
  });

  return {
    logger,
    exchange,
    websocket,
    errorHandler,
    createExchange,
    createWebSocket,
    configureExchangeHealth,
    configureWebSocketHealth,
    createUnavailableService() {
      return this.createService({
        exchange: undefined,
        websocket: undefined,
        errorHandler: undefined,
      });
    },
    createMemoryConstrainedService(memoryUsagePercent: number) {
      return this.createService({
        exchange: undefined,
        websocket: undefined,
        config: createThresholdConfig({
          memoryUsagePercent,
        }),
        errorHandler: undefined,
      });
    },
    createCpuConstrainedService(cpuUsagePercent: number) {
      return this.createService({
        exchange: undefined,
        websocket: undefined,
        config: createThresholdConfig({
          cpuUsagePercent,
        }),
        errorHandler: undefined,
      });
    },
    createDisconnectedWebSocketService() {
      return this.createService({
        websocket: configureWebSocketHealth({
          connected: false,
          messageAgeMs: Date.now(),
        }),
      });
    },
    createStaleWebSocketService(ageMs = 120000) {
      return this.createService({
        websocket: configureWebSocketHealth({
          connected: true,
          messageAgeMs: ageMs,
        }),
      });
    },
    createFailingExchangeService() {
      return this.createService({
        exchange: configureExchangeHealth({
          throwOnConnection: new Error('API down'),
        }),
      });
    },
    createDisconnectedExchangeService() {
      return this.createService({
        exchange: configureExchangeHealth({
          connected: false,
        }),
      });
    },
    createOutOfSyncExchangeService(offsetMs = 10000) {
      return this.createService({
        exchange: configureExchangeHealth({
          serverTimeOffsetMs: offsetMs,
        }),
      });
    },
    createThrowingWebSocketService() {
      return this.createService({
        websocket: createWebSocket({
          isConnected: jest.fn().mockImplementation(() => {
            throw new Error('WebSocket error');
          }),
        }),
      });
    },
    createHealthyProbeService() {
      return this.createService({
        exchange: configureExchangeHealth(),
        websocket: configureWebSocketHealth(),
        config: createThresholdConfig({
          memoryUsagePercent: 95,
          cpuUsagePercent: 95,
        }),
      });
    },
    createThresholdConfig,
    createService(options = {}) {
      const exchangeService = Object.prototype.hasOwnProperty.call(options, 'exchange')
        ? options.exchange
        : exchange;
      const websocketService = Object.prototype.hasOwnProperty.call(options, 'websocket')
        ? options.websocket
        : websocket;
      const loggerService = Object.prototype.hasOwnProperty.call(options, 'logger')
        ? options.logger
        : logger;
      const handler = Object.prototype.hasOwnProperty.call(options, 'errorHandler')
        ? options.errorHandler
        : errorHandler;

      return new HealthCheckService(
        exchangeService,
        websocketService,
        options.config ?? {},
        loggerService,
        handler,
      );
    },
  };
}

export function createStandardHealthCheckService(
  harness: Pick<HealthCheckTestHarness, 'createService'>,
  options?: Parameters<HealthCheckTestHarness['createService']>[0],
): HealthCheckService {
  return harness.createService(options);
}

export function createManagedHealthCheckContext(): ManagedHealthCheckContext {
  jest.clearAllMocks();

  const harness = createHealthCheckHarness();

  return {
    harness,
    service: createStandardHealthCheckService(harness),
    cleanup: () => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}
