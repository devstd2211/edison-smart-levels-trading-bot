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
  createFailingExchangeService: () => HealthCheckService;
  createHealthyProbeService: () => HealthCheckService;
  createThresholdConfig: (thresholds: NonNullable<HealthCheckConfig['thresholds']>) => HealthCheckConfig;
  createService: (options?: {
    exchange?: IExchangeService;
    websocket?: IWebSocketService;
    config?: HealthCheckConfig;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  }) => HealthCheckService;
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

  return {
    logger,
    exchange,
    websocket,
    errorHandler,
    createExchange,
    createWebSocket,
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
        websocket: createWebSocket({
          isConnected: jest.fn().mockReturnValue(false),
          getLastMessageTime: jest.fn().mockReturnValue(0),
        }),
      });
    },
    createFailingExchangeService() {
      return this.createService({
        exchange: createExchange({
          testConnection: jest.fn().mockRejectedValue(new Error('API down')),
          getServerTime: jest.fn().mockResolvedValue(Date.now()),
        }),
      });
    },
    createHealthyProbeService() {
      return this.createService({
        exchange: createExchange(),
        websocket: createWebSocket(),
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
