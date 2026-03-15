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
    : options.errorHandler ?? new ErrorHandler(logger);

  return new DataCollectorService(
    options.config ?? createMockDataCollectorConfig(),
    logger,
    errorHandler,
  );
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
