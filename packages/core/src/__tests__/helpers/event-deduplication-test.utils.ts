import { ErrorHandler } from '../../errors';
import { EventDeduplicationService } from '../../services/event-deduplication.service';
import { LoggerService, LogLevel } from '../../types/legacy';

export interface EventDeduplicationHarness {
  logger: LoggerService;
  errorHandler: ErrorHandler;
  createStandardService: (options?: {
    cacheSize?: number;
    cacheTtlMs?: number;
    withErrorHandler?: boolean;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  }) => EventDeduplicationService;
  createLegacyService: (options?: {
    cacheSize?: number;
    cacheTtlMs?: number;
    logger?: LoggerService;
  }) => EventDeduplicationService;
  createServiceWithDefaults: (options?: {
    cacheSize?: number;
    cacheTtlMs?: number;
    logger?: LoggerService;
    withErrorHandler?: boolean;
    errorHandler?: ErrorHandler;
  }) => EventDeduplicationService;
  createService: (
    cacheSize?: number,
    cacheTtlMs?: number,
    logger?: LoggerService,
    errorHandler?: ErrorHandler,
  ) => EventDeduplicationService;
}

export interface ManagedEventDeduplicationContext {
  harness: EventDeduplicationHarness;
  logger: LoggerService;
  errorHandler: ErrorHandler;
  createStandardService: EventDeduplicationHarness['createStandardService'];
  createLegacyService: EventDeduplicationHarness['createLegacyService'];
  createServiceWithDefaults: EventDeduplicationHarness['createServiceWithDefaults'];
  createService: EventDeduplicationHarness['createService'];
  cleanup: () => void;
}

export type ManagedEventDeduplicationRuntime = Pick<
  ManagedEventDeduplicationContext,
  'logger' | 'createStandardService' | 'createServiceWithDefaults' | 'cleanup'
>;

export type EventDeduplicationRuntime = ManagedEventDeduplicationRuntime;

export type EventDeduplicationErrorHandlingRuntime = Pick<
  ManagedEventDeduplicationContext,
  'logger' | 'errorHandler' | 'createServiceWithDefaults' | 'createLegacyService' | 'cleanup'
>;

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

export function createStandardEventDeduplicationService(options: {
  cacheSize?: number;
  cacheTtlMs?: number;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}): EventDeduplicationService {
  return createEventDeduplicationService({
    cacheSize: options.cacheSize,
    cacheTtlMs: options.cacheTtlMs,
    logger: options.logger,
    errorHandler: options.errorHandler,
  });
}

export function createLegacyEventDeduplicationService(options: {
  cacheSize?: number;
  cacheTtlMs?: number;
  logger?: LoggerService;
} = {}): EventDeduplicationService {
  return createEventDeduplicationService({
    cacheSize: options.cacheSize,
    cacheTtlMs: options.cacheTtlMs,
    logger: options.logger,
    withErrorHandler: false,
  });
}

export function createEventDeduplicationServiceWithHarness(options: {
  cacheSize?: number;
  cacheTtlMs?: number;
  logger?: LoggerService;
  withErrorHandler?: boolean;
  errorHandler?: ErrorHandler;
} = {}): EventDeduplicationService {
  return createEventDeduplicationService(options);
}

export function createEventDeduplicationEvent(
  overrides: Partial<{
    type: string;
    id: string;
    time: number;
  }> = {},
): { type: string; id: string; time: number } {
  return {
    type: 'TP',
    id: 'order-123',
    time: Date.now(),
    ...overrides,
  };
}

export function createEventDeduplicationEvents(
  events: Array<Partial<{ type: string; id: string; time: number }>>,
): Array<{ type: string; id: string; time: number }> {
  return events.map((event) => createEventDeduplicationEvent(event));
}

export function getEventDeduplicationProcessedEvents(
  target: EventDeduplicationService,
): Map<string, number> {
  return (target as unknown as { processedEvents: Map<string, number> }).processedEvents;
}

export function runEventDeduplicationChecks(
  service: EventDeduplicationService,
  events: Array<{ type: string; id: string; time: number }>,
): boolean[] {
  return events.map((event) => service.isDuplicate(event.type, event.id, event.time));
}

export function populateEventDeduplicationCache(
  service: EventDeduplicationService,
  options: {
    count: number;
    type?: string;
    idPrefix?: string;
    startTime?: number;
    timeStepMs?: number;
  },
): void {
  const {
    count,
    type = 'TP',
    idPrefix = 'order-',
    startTime = 1000,
    timeStepMs = 1,
  } = options;

  for (let index = 0; index < count; index++) {
    service.isDuplicate(type, `${idPrefix}${index}`, startTime + (index * timeStepMs));
  }
}

export function createEventDeduplicationHarness(): EventDeduplicationHarness {
  const logger = createEventDeduplicationLogger();
  const errorHandler = createEventDeduplicationErrorHandler(logger);

  return {
    logger,
    errorHandler,
    createStandardService: (options = {}) =>
      createStandardEventDeduplicationService({
        cacheSize: options.cacheSize ?? 100,
        cacheTtlMs: options.cacheTtlMs ?? 60000,
        logger: options.logger ?? logger,
        errorHandler: options.errorHandler ?? errorHandler,
      }),
    createLegacyService: (options = {}) =>
      createLegacyEventDeduplicationService({
        cacheSize: options.cacheSize ?? 100,
        cacheTtlMs: options.cacheTtlMs ?? 60000,
        logger: options.logger ?? logger,
      }),
    createServiceWithDefaults: (options = {}) =>
      (options.withErrorHandler === false
        ? createLegacyEventDeduplicationService({
            cacheSize: options.cacheSize,
            cacheTtlMs: options.cacheTtlMs,
            logger: options.logger ?? logger,
          })
        : createStandardEventDeduplicationService({
            cacheSize: options.cacheSize,
            cacheTtlMs: options.cacheTtlMs,
            logger: options.logger ?? logger,
            errorHandler: options.errorHandler ?? errorHandler,
          })),
    createService: (
      cacheSize: number = 100,
      cacheTtlMs: number = 60000,
      customLogger: LoggerService = logger,
      customErrorHandler: ErrorHandler = errorHandler,
    ) => createStandardEventDeduplicationService({
      cacheSize,
      cacheTtlMs,
      logger: customLogger,
      errorHandler: customErrorHandler,
    }),
  };
}

export function createManagedEventDeduplicationContext(): ManagedEventDeduplicationContext {
  const harness = createEventDeduplicationHarness();
  const trackedServices = new Set<EventDeduplicationService>();

  const createStandardService: EventDeduplicationHarness['createStandardService'] = (options = {}) => {
    const service = harness.createStandardService(options);
    trackedServices.add(service);
    return service;
  };

  const createLegacyService: EventDeduplicationHarness['createLegacyService'] = (options = {}) => {
    const service = harness.createLegacyService(options);
    trackedServices.add(service);
    return service;
  };

  const createServiceWithDefaults: EventDeduplicationHarness['createServiceWithDefaults'] = (options = {}) =>
    options.withErrorHandler === false
      ? createLegacyService(options)
      : createStandardService(options);

  const createService: EventDeduplicationHarness['createService'] = (
    cacheSize = 100,
    cacheTtlMs = 60000,
    customLogger = harness.logger,
    customErrorHandler = harness.errorHandler,
  ) => createStandardService({
    cacheSize,
    cacheTtlMs,
    logger: customLogger,
    errorHandler: customErrorHandler,
  });

  return {
    harness,
    logger: harness.logger,
    errorHandler: harness.errorHandler,
    createStandardService,
    createLegacyService,
    createServiceWithDefaults,
    createService,
    cleanup() {
      trackedServices.clear();
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}

export function createEventDeduplicationBoundFactory(options: {
  cacheSize?: number;
  cacheTtlMs?: number;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}) {
  const logger = options.logger ?? createEventDeduplicationLogger();
  const errorHandler = options.errorHandler ?? createEventDeduplicationErrorHandler(logger);
  const cacheSize = options.cacheSize ?? 100;
  const cacheTtlMs = options.cacheTtlMs ?? 60000;

  return {
    logger,
    errorHandler,
    cacheSize,
    cacheTtlMs,
    createStandardService: (serviceOptions: {
      cacheSize?: number;
      cacheTtlMs?: number;
      logger?: LoggerService;
      errorHandler?: ErrorHandler;
    } = {}) =>
      createStandardEventDeduplicationService({
        cacheSize: serviceOptions.cacheSize ?? cacheSize,
        cacheTtlMs: serviceOptions.cacheTtlMs ?? cacheTtlMs,
        logger: serviceOptions.logger ?? logger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
      }),
    createLegacyService: (serviceOptions: {
      cacheSize?: number;
      cacheTtlMs?: number;
      logger?: LoggerService;
    } = {}) =>
      createLegacyEventDeduplicationService({
        cacheSize: serviceOptions.cacheSize ?? cacheSize,
        cacheTtlMs: serviceOptions.cacheTtlMs ?? cacheTtlMs,
        logger: serviceOptions.logger ?? logger,
      }),
  };
}
