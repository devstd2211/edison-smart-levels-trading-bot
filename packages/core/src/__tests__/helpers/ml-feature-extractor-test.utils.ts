import { ErrorHandler } from '../../errors/ErrorHandler';
import { MLFeatureExtractorService } from '../../services/ml-feature-extractor.service';
import { Candle, LoggerService } from '../../types/legacy';

export type MLFeatureExtractorLogger = Pick<LoggerService, 'info' | 'warn' | 'error' | 'debug'>;

export type MLFeatureExtractorHarness = {
  service: MLFeatureExtractorService;
  errorHandler: ErrorHandler;
  logger: LoggerService;
};

type MLFeatureExtractorServiceOptions = {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
};

type CandleOptions = {
  timestamp?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

type CandleSequenceOptions = {
  startPrice?: number;
  baseTimestamp?: number;
  intervalMs?: number;
  drift?: number;
  swing?: number;
  wickSize?: number;
  volumeBase?: number;
  volumeStep?: number;
};

type UniformCandleSequenceOptions = {
  baseTimestamp?: number;
  intervalMs?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
};

export function createMLFeatureExtractorLogger(): LoggerService {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as LoggerService;
}

export function createMLFeatureFailingLogger(
  failures: Partial<Record<'info' | 'warn' | 'error' | 'debug', string>> = {},
): LoggerService {
  return {
    info: jest.fn(() => {
      if (failures.info) {
        throw new Error(failures.info);
      }
    }),
    warn: jest.fn(() => {
      if (failures.warn) {
        throw new Error(failures.warn);
      }
    }),
    error: jest.fn(() => {
      if (failures.error) {
        throw new Error(failures.error);
      }
    }),
    debug: jest.fn(() => {
      if (failures.debug) {
        throw new Error(failures.debug);
      }
    }),
  } as unknown as LoggerService;
}

export function createMLFeatureExtractorHarness(options: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}): MLFeatureExtractorHarness {
  const logger = options.logger ?? createMLFeatureExtractorLogger();
  const errorHandler = options.errorHandler ?? new ErrorHandler(logger);
  const service = createMLFeatureExtractorService({ logger, errorHandler });

  return {
    service,
    errorHandler,
    logger,
  };
}

export function createMLFeatureExtractorService(options: MLFeatureExtractorServiceOptions = {}): MLFeatureExtractorService {
  if (options.withErrorHandler === false) {
    return new MLFeatureExtractorService(options.logger);
  }

  return new MLFeatureExtractorService(
    options.logger,
    options.errorHandler ?? (options.logger ? new ErrorHandler(options.logger) : undefined),
  );
}

export function createMLFeatureCandle(price: number, options: CandleOptions = {}): Candle {
  const close = options.close ?? price;
  const open = options.open ?? close;
  const high = options.high ?? Math.max(open, close) + 0.5;
  const low = options.low ?? Math.min(open, close) - 0.5;

  return {
    timestamp: options.timestamp ?? 1_700_000_000_000,
    open,
    high,
    low,
    close,
    volume: options.volume ?? 1_000,
  };
}

export function createMLFeatureCandleSequence(
  count: number,
  options: CandleSequenceOptions = {},
): Candle[] {
  const candles: Candle[] = [];
  const movementPattern = [-1, 0.5, 1, -0.5];
  const startPrice = options.startPrice ?? 100;
  const baseTimestamp = options.baseTimestamp ?? 1_700_000_000_000;
  const intervalMs = options.intervalMs ?? 60_000;
  const drift = options.drift ?? 0.2;
  const swing = options.swing ?? 0.8;
  const wickSize = options.wickSize ?? 0.4;
  const volumeBase = options.volumeBase ?? 1_000;
  const volumeStep = options.volumeStep ?? 40;

  let price = startPrice;

  for (let i = 0; i < count; i++) {
    const movement = drift + movementPattern[i % movementPattern.length] * swing;
    const open = price;
    const close = price + movement;
    const high = Math.max(open, close) + wickSize + (i % 3) * 0.05;
    const low = Math.min(open, close) - wickSize - (i % 2) * 0.05;

    candles.push({
      timestamp: baseTimestamp + i * intervalMs,
      open,
      high,
      low,
      close,
      volume: volumeBase + (i % 5) * volumeStep,
    });

    price = close;
  }

  return candles;
}

export function createMLFeatureUniformCandleSequence(
  count: number,
  options: UniformCandleSequenceOptions = {},
): Candle[] {
  const baseTimestamp = options.baseTimestamp ?? 1_700_000_000_000;
  const intervalMs = options.intervalMs ?? 60_000;
  const open = options.open ?? 100;
  const high = options.high ?? 102;
  const low = options.low ?? 99;
  const close = options.close ?? 101;
  const volume = options.volume ?? 1_000;

  return Array.from({ length: count }, (_, index) =>
    createMLFeatureCandle(close, {
      timestamp: baseTimestamp + index * intervalMs,
      open,
      high,
      low,
      close,
      volume,
    }),
  );
}
