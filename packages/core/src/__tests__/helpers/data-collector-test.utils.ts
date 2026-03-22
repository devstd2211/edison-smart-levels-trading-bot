import { ErrorHandler } from '../../errors';
import { DataCollectorService } from '../../services/data-collector.service';
import { DatabaseWriter } from '../../services/data-collector/database-writer';
import { DataCollectionConfig, LoggerService } from '../../types/legacy';

export const createMockDataCollectorLogger = (): Partial<LoggerService> => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

export function createDataCollectorErrorHandler(
  logger: LoggerService = createMockDataCollectorLogger() as LoggerService,
): ErrorHandler {
  return new ErrorHandler(logger);
}

export const createMockDataCollectorConfig = (): DataCollectionConfig => ({
  enabled: true,
  symbols: ['BTCUSDT', 'ETHUSDT'],
  timeframes: ['1', '5', '15'],
  collectOrderbook: true,
  collectTradeTicks: true,
  orderbookInterval: 5,
  database: {
    path: ':memory:',
    compression: true,
  },
  websocket: {
    maxReconnectAttempts: 5,
    reconnectDelay: 100,
  },
});

export function createDataCollectorService(options: {
  config?: DataCollectionConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): DataCollectorService {
  const logger = options.logger ?? (createMockDataCollectorLogger() as LoggerService);
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? createDataCollectorErrorHandler(logger);

  return new DataCollectorService(
    options.config ?? createMockDataCollectorConfig(),
    logger,
    errorHandler,
  );
}

export function createStandardDataCollectorService(options: {
  config?: DataCollectionConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}): DataCollectorService {
  return createDataCollectorService({
    config: options.config,
    logger: options.logger,
    errorHandler: options.errorHandler,
  });
}

export function createLegacyDataCollectorService(options: {
  config?: DataCollectionConfig;
  logger?: LoggerService;
} = {}): DataCollectorService {
  return createDataCollectorService({
    config: options.config,
    logger: options.logger,
    withErrorHandler: false,
  });
}

export function createDataCollectorHarness(options: {
  config?: DataCollectionConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? (createMockDataCollectorLogger() as LoggerService);
  const config = options.config ?? createMockDataCollectorConfig();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? createDataCollectorErrorHandler(logger);

  return {
    logger,
    config,
    errorHandler,
    service: createDataCollectorService({
      config,
      logger,
      errorHandler,
      withErrorHandler: options.withErrorHandler,
    }),
  };
}

export function createStandardDataCollectorHarness(options: {
  config?: DataCollectionConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}) {
  const logger = options.logger ?? (createMockDataCollectorLogger() as LoggerService);
  const config = options.config ?? createMockDataCollectorConfig();
  const errorHandler = options.errorHandler ?? createDataCollectorErrorHandler(logger);

  return {
    logger,
    config,
    errorHandler,
    service: createStandardDataCollectorService({
      config,
      logger,
      errorHandler,
    }),
  };
}

export type ManagedDataCollectorContext = ReturnType<typeof createStandardDataCollectorHarness> & {
  cleanup: () => void;
};

export function createManagedDataCollectorContext(options: {
  config?: DataCollectionConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}): ManagedDataCollectorContext {
  const harness = createStandardDataCollectorHarness(options);

  return {
    ...harness,
    cleanup: () => {
      jest.clearAllMocks();
      jest.clearAllTimers();
    },
  };
}

export function createLegacyDataCollectorHarness(options: {
  config?: DataCollectionConfig;
  logger?: LoggerService;
} = {}) {
  const logger = options.logger ?? (createMockDataCollectorLogger() as LoggerService);
  const config = options.config ?? createMockDataCollectorConfig();

  return {
    logger,
    config,
    errorHandler: undefined,
    service: createLegacyDataCollectorService({
      config,
      logger,
    }),
  };
}

export const createMockCollectorDatabase = () => ({
  run: jest.fn().mockResolvedValue({}),
  exec: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  prepare: jest.fn(),
});

type MockDatabase = ReturnType<typeof createMockCollectorDatabase>;

export const asWriterDatabase = (
  db: MockDatabase,
): ConstructorParameters<typeof DatabaseWriter>[0] =>
  db as unknown as ConstructorParameters<typeof DatabaseWriter>[0];

export function createDataCollectorDatabaseWriter(options: {
  database?: MockDatabase;
  logger?: LoggerService;
  compression?: boolean;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): DatabaseWriter {
  const logger = options.logger ?? (createMockDataCollectorLogger() as LoggerService);
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? createDataCollectorErrorHandler(logger);

  return new DatabaseWriter(
    asWriterDatabase(options.database ?? createMockCollectorDatabase()),
    logger,
    options.compression ?? true,
    errorHandler,
  );
}

export function createStandardDataCollectorDatabaseWriter(options: {
  database?: MockDatabase;
  logger?: LoggerService;
  compression?: boolean;
  errorHandler?: ErrorHandler;
} = {}): DatabaseWriter {
  return createDataCollectorDatabaseWriter({
    database: options.database,
    logger: options.logger,
    compression: options.compression,
    errorHandler: options.errorHandler,
  });
}

export function createLegacyDataCollectorDatabaseWriter(options: {
  database?: MockDatabase;
  logger?: LoggerService;
  compression?: boolean;
} = {}): DatabaseWriter {
  return createDataCollectorDatabaseWriter({
    database: options.database,
    logger: options.logger,
    compression: options.compression,
    withErrorHandler: false,
  });
}
