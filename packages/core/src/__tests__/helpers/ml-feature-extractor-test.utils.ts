import { ErrorHandler } from '../../errors/ErrorHandler';
import { MLFeatureExtractorService } from '../../services/ml-feature-extractor.service';
import { Candle, LoggerService } from '../../types/legacy';

export type MLFeatureExtractorLogger = Pick<LoggerService, 'info' | 'warn' | 'error' | 'debug'>;

export type MLFeatureExtractorHarness = {
  service: MLFeatureExtractorService;
  errorHandler?: ErrorHandler;
  logger: LoggerService;
  createStandardService: (options?: MLFeatureExtractorServiceOptions) => MLFeatureExtractorService;
  createLegacyService: (options?: Omit<MLFeatureExtractorServiceOptions, 'errorHandler'>) => MLFeatureExtractorService;
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

type FlatCandleSequenceOptions = {
  count?: number;
  price?: number;
  baseTimestamp?: number;
  intervalMs?: number;
  volume?: number;
};

type VolumeImbalanceSequenceOptions = {
  count?: number;
  baseTimestamp?: number;
  intervalMs?: number;
  basePrice?: number;
  normalVolume?: number;
  spikeVolume?: number;
  spikeFromIndex?: number;
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
  withErrorHandler?: boolean;
} = {}): MLFeatureExtractorHarness {
  const logger = options.logger ?? createMLFeatureExtractorLogger();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);
  const service = createMLFeatureExtractorService({
    logger,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    service,
    errorHandler,
    logger,
    createStandardService: (serviceOptions: MLFeatureExtractorServiceOptions = {}) =>
      createMLFeatureExtractorService({
        logger: serviceOptions.logger ?? logger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
      }),
    createLegacyService: (serviceOptions: Omit<MLFeatureExtractorServiceOptions, 'errorHandler'> = {}) =>
      createMLFeatureExtractorService({
        logger: serviceOptions.logger ?? logger,
        withErrorHandler: false,
      }),
  };
}

export interface ManagedMLFeatureExtractorContext extends MLFeatureExtractorHarness {
  createService: (options?: MLFeatureExtractorServiceOptions) => MLFeatureExtractorService;
  cleanup: () => void;
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

export function createManagedMLFeatureExtractorContext(options: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): ManagedMLFeatureExtractorContext {
  jest.clearAllMocks();
  const harness = createMLFeatureExtractorHarness(options);
  const createdServices = new Set<MLFeatureExtractorService>([harness.service]);

  const trackService = (service: MLFeatureExtractorService) => {
    createdServices.add(service);
    return service;
  };

  return {
    ...harness,
    createService: (serviceOptions: MLFeatureExtractorServiceOptions = {}) =>
      trackService(harness.createStandardService(serviceOptions)),
    createStandardService: (serviceOptions: MLFeatureExtractorServiceOptions = {}) =>
      trackService(harness.createStandardService(serviceOptions)),
    createLegacyService: (serviceOptions: Omit<MLFeatureExtractorServiceOptions, 'errorHandler'> = {}) =>
      trackService(harness.createLegacyService(serviceOptions)),
    cleanup: () => {
      createdServices.clear();
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
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

export function createMLFeatureFlatCandleSequence(
  options: FlatCandleSequenceOptions = {},
): Candle[] {
  const count = options.count ?? 20;
  const price = options.price ?? 100;
  const baseTimestamp = options.baseTimestamp ?? 1_700_000_000_000;
  const intervalMs = options.intervalMs ?? 60_000;
  const volume = options.volume ?? 1_000;

  return Array.from({ length: count }, (_, index) =>
    createMLFeatureCandle(price, {
      timestamp: baseTimestamp + index * intervalMs,
      high: price,
      low: price,
      volume,
    }),
  );
}

export function createMLFeatureVolumeImbalanceSequence(
  options: VolumeImbalanceSequenceOptions = {},
): Candle[] {
  const count = options.count ?? 20;
  const baseTimestamp = options.baseTimestamp ?? 1_700_000_000_000;
  const intervalMs = options.intervalMs ?? 60_000;
  const basePrice = options.basePrice ?? 100;
  const normalVolume = options.normalVolume ?? 1_000;
  const spikeVolume = options.spikeVolume ?? 5_000;
  const spikeFromIndex = options.spikeFromIndex ?? count - 2;

  return Array.from({ length: count }, (_, index) =>
    createMLFeatureCandle(basePrice + index, {
      timestamp: baseTimestamp + index * intervalMs,
      high: basePrice + index + 1,
      low: basePrice + index - 1,
      volume: index >= spikeFromIndex ? spikeVolume : normalVolume,
    }),
  );
}
