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
    errorHandler?: ErrorHandler;
    attachExchange?: boolean;
  }) => TimeService;
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
      const service = new TimeService(
        logger,
        options.syncIntervalMs ?? 1000,
        options.maxSyncFailures ?? 3,
        options.errorHandler ?? errorHandler,
      );

      if (options.attachExchange !== false) {
        service.setBybitService(exchange as unknown as IExchange);
      }

      return service;
    },
  };
}
