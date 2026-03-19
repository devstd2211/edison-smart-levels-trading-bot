import { ErrorHandler } from '../../errors/ErrorHandler';
import { MultiTimeframeTrendService } from '../../services/multi-timeframe-trend.service';
import { SwingPointDetectorService } from '../../services/swing-point-detector.service';
import {
  createSwingPointDetectorMockLogger,
  createSwingPointDetectorService,
} from './swing-point-detector-test.utils';
import type {
  Candle,
  LoggerService,
  MultiTimeframeData,
} from '../../types/legacy';

type MultiTimeframeTrendOptions = {
  logger?: LoggerService;
  swingPointDetector?: SwingPointDetectorService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
};

export function createMultiTimeframeTrendErrorHandler(
  logger: LoggerService = createMultiTimeframeTrendLogger(),
): ErrorHandler {
  return new ErrorHandler(logger);
}

export function createMultiTimeframeTrendFailingLogger(
  overrides: Partial<Pick<LoggerService, 'info' | 'warn' | 'debug' | 'error'>> = {},
): LoggerService {
  return {
    ...createMultiTimeframeTrendLogger(),
    ...overrides,
  } as LoggerService;
}

export function createMultiTimeframeTrendLogger(): LoggerService {
  return {
    ...createSwingPointDetectorMockLogger(),
    minLevel: 'info',
    logDir: '',
    logToFile: false,
    logs: [],
    pushLog: jest.fn(),
    formatLog: jest.fn(),
    getLatestLog: jest.fn(),
    getAllLogs: jest.fn(),
    clearLogs: jest.fn(),
    exportLogs: jest.fn(),
    stat: jest.fn(),
  } as unknown as LoggerService;
}

export function createMultiTimeframeTrendCandles(count = 10): Candle[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: 1_000_000 + i * 60_000,
    open: 100 + i * 0.1,
    high: 101 + i * 0.1,
    low: 99 + i * 0.1,
    close: 100.5 + i * 0.1,
    volume: 1000 + i * 100,
  }));
}

export function createMultiTimeframeTrendInvalidCandle(
  overrides: Partial<Candle> = {},
): Candle {
  return {
    timestamp: 1_000_000,
    open: NaN,
    high: NaN,
    low: NaN,
    close: NaN,
    volume: 1000,
    ...overrides,
  };
}

export function createMultiTimeframeTrendData(): MultiTimeframeData {
  const candles5m = createMultiTimeframeTrendCandles(10);
  const candles15m = createMultiTimeframeTrendCandles(10);
  const candles1h = createMultiTimeframeTrendCandles(10);
  const candles4h = createMultiTimeframeTrendCandles(10);

  return {
    primary: candles5m,
    candles5m,
    candles15m,
    candles1h,
    candles4h,
  };
}

export function createMultiTimeframeTrendService(
  options: MultiTimeframeTrendOptions = {},
): MultiTimeframeTrendService {
  const logger = options.logger ?? createMultiTimeframeTrendLogger();
  const swingPointDetector =
    options.swingPointDetector ??
    createSwingPointDetectorService({
      logger,
      withErrorHandler: false,
    });

  if (options.withErrorHandler === false) {
    return new MultiTimeframeTrendService(logger, swingPointDetector);
  }

  return new MultiTimeframeTrendService(
    logger,
    swingPointDetector,
    options.errorHandler ?? createMultiTimeframeTrendErrorHandler(logger),
  );
}

export function createMultiTimeframeTrendHarness(
  options: MultiTimeframeTrendOptions = {},
) {
  const logger = options.logger ?? createMultiTimeframeTrendLogger();
  const errorHandler =
    options.withErrorHandler === false
      ? undefined
      : (options.errorHandler ?? createMultiTimeframeTrendErrorHandler(logger));
  const swingPointDetector =
    options.swingPointDetector ??
    createSwingPointDetectorService({
      logger,
      withErrorHandler: false,
    });
  const createService = (serviceOptions: MultiTimeframeTrendOptions = {}) =>
    createMultiTimeframeTrendService({
      logger,
      swingPointDetector,
      errorHandler,
      withErrorHandler: options.withErrorHandler,
      ...serviceOptions,
    });

  return {
    logger,
    errorHandler,
    swingPointDetector,
    service: createService(),
    createService,
  };
}

export function asMultiTimeframeTrendData(value: unknown): MultiTimeframeData {
  return value as MultiTimeframeData;
}
