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

  return {
    logger,
    exchange,
    websocket,
    errorHandler,
    createExchange,
    createWebSocket,
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
