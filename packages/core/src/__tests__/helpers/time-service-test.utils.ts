import { ErrorHandler } from '../../errors/ErrorHandler';
import type { IExchange } from '../../interfaces/IExchange';
import { TimeService } from '../../services/time.service';
import { LoggerService } from '../../types/legacy';

export type MockTimeExchange = {
  getServerTime: jest.MockedFunction<() => Promise<number | undefined>>;
};

export interface TimeServiceHarness {
  logger: LoggerService;
  exchange: MockTimeExchange;
  errorHandler: ErrorHandler;
  createService: (options?: {
    syncIntervalMs?: number;
    maxSyncFailures?: number;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
    exchange?: MockTimeExchange;
    attachExchange?: boolean;
  }) => TimeService;
  createSyncedService: (options?: {
    serverTime?: number;
    syncIntervalMs?: number;
    maxSyncFailures?: number;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
    exchange?: MockTimeExchange;
    attachExchange?: boolean;
  }) => Promise<TimeService>;
  createServiceWithoutExchange: (options?: {
    syncIntervalMs?: number;
    maxSyncFailures?: number;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  }) => TimeService;
  createFailingSyncService: (message?: string) => TimeService;
}

export function createTimeServiceLogger(): LoggerService {
  const logger = new LoggerService('ERROR', './logs', false);
  jest.spyOn(logger, 'info').mockImplementation(() => undefined);
  jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  jest.spyOn(logger, 'debug').mockImplementation(() => undefined);
  return logger;
}

export function createTimeServiceHarness(): TimeServiceHarness {
  const logger = createTimeServiceLogger();
  const exchange: MockTimeExchange = {
    getServerTime: jest.fn() as jest.MockedFunction<() => Promise<number | undefined>>,
  };
  const errorHandler = new ErrorHandler(logger);

  return {
    logger,
    exchange,
    errorHandler,
    createService(options = {}): TimeService {
      const serviceLogger = Object.prototype.hasOwnProperty.call(options, 'logger')
        ? options.logger
        : logger;
      const serviceErrorHandler = Object.prototype.hasOwnProperty.call(options, 'errorHandler')
        ? options.errorHandler
        : errorHandler;
      const serviceExchange = Object.prototype.hasOwnProperty.call(options, 'exchange')
        ? options.exchange
        : exchange;
      const service = new TimeService(
        serviceLogger ?? logger,
        options.syncIntervalMs ?? 1000,
        options.maxSyncFailures ?? 3,
        serviceErrorHandler,
      );

      if (options.attachExchange !== false) {
        service.setBybitService((serviceExchange ?? exchange) as unknown as IExchange);
      }

      return service;
    },
    async createSyncedService(options = {}): Promise<TimeService> {
      const service = this.createService(options);
      const exchange =
        (Object.prototype.hasOwnProperty.call(options, 'exchange')
          ? options.exchange
          : this.exchange) ?? this.exchange;

      if (options.attachExchange === false) {
        return service;
      }

      exchange.getServerTime.mockResolvedValue(
        options.serverTime ?? Date.now() + 1000,
      );
      await service.syncWithExchange();
      return service;
    },
    createServiceWithoutExchange(options = {}): TimeService {
      return this.createService({
        ...options,
        attachExchange: false,
      });
    },
    createFailingSyncService(message = 'API error'): TimeService {
      const service = this.createService();
      this.exchange.getServerTime.mockRejectedValue(new Error(message));
      return service;
    },
  };
}
