import { ErrorHandler } from '../../errors';
import { EventDeduplicationService } from '../../services/event-deduplication.service';
import { LoggerService, LogLevel } from '../../types/legacy';

export interface EventDeduplicationHarness {
  logger: LoggerService;
  errorHandler: ErrorHandler;
  createService: (
    cacheSize?: number,
    cacheTtlMs?: number,
    logger?: LoggerService,
    errorHandler?: ErrorHandler,
  ) => EventDeduplicationService;
}

export function createEventDeduplicationLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createEventDeduplicationErrorHandler(
  logger?: LoggerService,
): ErrorHandler {
  return new ErrorHandler(
    logger ?? {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  );
}

export function createEventDeduplicationService(options: {
  cacheSize?: number;
  cacheTtlMs?: number;
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}): EventDeduplicationService {
  const logger = options.logger;
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? createEventDeduplicationErrorHandler(logger);

  return new EventDeduplicationService(
    options.cacheSize ?? 100,
    options.cacheTtlMs ?? 60000,
    logger,
    errorHandler,
  );
}

export function createEventDeduplicationHarness(): EventDeduplicationHarness {
  const logger = createEventDeduplicationLogger();
  const errorHandler = createEventDeduplicationErrorHandler();

  return {
    logger,
    errorHandler,
    createService: (
      cacheSize: number = 100,
      cacheTtlMs: number = 60000,
      customLogger: LoggerService = logger,
      customErrorHandler: ErrorHandler = errorHandler,
    ) => createEventDeduplicationService({
      cacheSize,
      cacheTtlMs,
      logger: customLogger,
      errorHandler: customErrorHandler,
    }),
  };
}
