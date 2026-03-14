import { ErrorHandler } from '../../errors/ErrorHandler';
import { SwingPointDetectorService } from '../../services/swing-point-detector.service';
import { Candle, LoggerService, SwingPoint, SwingPointType } from '../../types/legacy';

type SwingPointDetectorHarnessOptions = {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  lookbackPeriod?: number;
  withErrorHandler?: boolean;
};

export type SwingPointDetectorSwingPointsInput =
  Parameters<SwingPointDetectorService['calculateStrengthFromSwingPoints']>[1];

export const createSwingPointDetectorMockCandle = (
  overrides: Partial<Candle> = {},
): Candle => ({
  timestamp: Date.now(),
  open: 100,
  high: 105,
  low: 95,
  close: 102,
  volume: 1000,
  ...overrides,
});

export const createSwingPointDetectorCandleArray = (count: number): Candle[] => {
  const candles: Candle[] = [];

  for (let i = 0; i < count; i++) {
    candles.push(
      createSwingPointDetectorMockCandle({
        timestamp: Date.now() + i * 60000,
        open: 100 + i,
        high: 105 + i,
        low: 95 + i,
        close: 102 + i,
      }),
    );
  }

  return candles;
};

export const createSwingPointDetectorMockLogger = (): LoggerService =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  }) as unknown as LoggerService;

export const createSwingPointDetectorFailingLogger = (
  methodToFail?: 'info' | 'warn' | 'debug' | 'error',
): LoggerService =>
  ({
    info: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'info') throw new Error('Logger.info failed');
    }),
    warn: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'warn') throw new Error('Logger.warn failed');
    }),
    debug: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'debug') throw new Error('Logger.debug failed');
    }),
    error: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'error') throw new Error('Logger.error failed');
    }),
  }) as unknown as LoggerService;

export const createSwingPointDetectorMockErrorHandler = (): ErrorHandler =>
  ({
    handle: jest.fn(),
    handleAsync: jest.fn(),
  }) as unknown as ErrorHandler;

export const createSwingPointDetectorHarness = (
  options: SwingPointDetectorHarnessOptions = {},
): {
  service: SwingPointDetectorService;
  logger: LoggerService;
  errorHandler?: ErrorHandler;
} => {
  const logger = options.logger ?? createSwingPointDetectorMockLogger();
  const errorHandler =
    options.withErrorHandler === false
      ? undefined
      : options.errorHandler ?? createSwingPointDetectorMockErrorHandler();

  return {
    service: createSwingPointDetectorService({
      logger,
      lookbackPeriod: options.lookbackPeriod,
      errorHandler,
      withErrorHandler: options.withErrorHandler,
    }),
    logger,
    errorHandler,
  };
};

export const createSwingPointDetectorService = (
  options: SwingPointDetectorHarnessOptions = {},
): SwingPointDetectorService => {
  const logger = options.logger ?? createSwingPointDetectorMockLogger();
  const errorHandler =
    options.withErrorHandler === false
      ? undefined
      : options.errorHandler ?? createSwingPointDetectorMockErrorHandler();

  return new SwingPointDetectorService(
    logger,
    options.lookbackPeriod ?? 2,
    options.withErrorHandler === false ? undefined : errorHandler,
  );
};

export const asSwingPointDetectorCandles = (value: unknown): Candle[] => value as Candle[];

export const asSwingPointDetectorSwingPoints = (
  value: unknown,
): SwingPointDetectorSwingPointsInput => value as SwingPointDetectorSwingPointsInput;

export const createSwingPoint = (
  price: number,
  type: SwingPointType,
  timestamp = Date.now(),
): SwingPoint => ({
  price,
  timestamp,
  type,
});
