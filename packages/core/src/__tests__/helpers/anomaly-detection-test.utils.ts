import { ErrorHandler } from '../../errors/ErrorHandler';
import { AnomalyDetectionService } from '../../services/anomaly-detection.service';
import { LoggerService } from '../../services/logger.service';
import { LogLevel } from '../../types/legacy';
import { AnomalyDetectionConfig, Trade } from '../../types/anomaly-detection';

type LoggerMethod = jest.Mock;

export type MockAnomalyLogger = Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error'>;

export type AnomalyDetectionInternals = {
  performVolumeAnomalyDetection: (volume: number) => unknown;
  performVolatilitySpikeDetection: (value: number) => unknown;
  performWhaleDetection: (trades: Trade[]) => unknown;
  performManipulationDetection: () => unknown;
};

export function createAnomalyDetectionLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createAnomalyDetectionMockLogger(overrides: Partial<Record<keyof MockAnomalyLogger, LoggerMethod>> = {}): LoggerService {
  return {
    debug: overrides.debug ?? jest.fn(),
    info: overrides.info ?? jest.fn(),
    warn: overrides.warn ?? jest.fn(),
    error: overrides.error ?? jest.fn(),
  } as unknown as LoggerService;
}

export function createAnomalyDetectionTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    price: 50000,
    size: 0.1,
    side: 'BUY',
    timestamp: Date.now(),
    ...overrides,
  };
}

export function createAnomalyDetectionTradeSeries(
  entries: Array<Partial<Trade>>,
): Trade[] {
  return entries.map((entry, index) =>
    createAnomalyDetectionTrade({
      timestamp: entry.timestamp ?? 1_700_000_000_000 + index,
      ...entry,
    }),
  );
}

export function createAnomalyDetectionValueSeries(
  count: number,
  base: number,
  step: number = 0,
): number[] {
  return Array.from({ length: count }, (_, index) => base + index * step);
}

export function createAnomalyDetectionServiceHarness(options: {
  config?: Partial<AnomalyDetectionConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createAnomalyDetectionLogger();
  const errorHandler = options.withErrorHandler === false ? undefined : new ErrorHandler(logger);
  const service = createAnomalyDetectionService({
    config: options.config,
    logger,
    errorHandler,
  });

  return {
    service,
    logger,
    errorHandler,
  };
}

export interface ManagedAnomalyDetectionContext {
  service: AnomalyDetectionService;
  logger: LoggerService;
  errorHandler: ErrorHandler | undefined;
  createStandardService: (serviceOptions?: {
    config?: Partial<AnomalyDetectionConfig>;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  }) => AnomalyDetectionService;
  createLegacyService: (serviceOptions?: {
    config?: Partial<AnomalyDetectionConfig>;
    logger?: LoggerService;
  }) => AnomalyDetectionService;
  cleanup: () => void;
}

export function createAnomalyDetectionService(options: {
  config?: Partial<AnomalyDetectionConfig>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): AnomalyDetectionService {
  return new AnomalyDetectionService(
    options.config,
    undefined,
    options.logger ?? createAnomalyDetectionLogger(),
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}

export function createAnomalyDetectionBoundFactory(options: {
  config?: Partial<AnomalyDetectionConfig>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createAnomalyDetectionLogger();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);

  return {
    logger,
    errorHandler,
    config: options.config,
    createStandardService: (serviceOptions: {
      config?: Partial<AnomalyDetectionConfig>;
      logger?: LoggerService;
      errorHandler?: ErrorHandler;
    } = {}) =>
      createAnomalyDetectionService({
        config: serviceOptions.config ?? options.config,
        logger: serviceOptions.logger ?? logger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
      }),
    createLegacyService: (serviceOptions: {
      config?: Partial<AnomalyDetectionConfig>;
      logger?: LoggerService;
    } = {}) =>
      createAnomalyDetectionService({
        config: serviceOptions.config ?? options.config,
        logger: serviceOptions.logger ?? logger,
        withErrorHandler: false,
      }),
  };
}

export function createManagedAnomalyDetectionContext(options: {
  config?: Partial<AnomalyDetectionConfig>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): ManagedAnomalyDetectionContext {
  const harness = createAnomalyDetectionServiceHarness(options);
  const factory = createAnomalyDetectionBoundFactory({
    config: options.config,
    logger: harness.logger,
    errorHandler: options.withErrorHandler === false ? undefined : options.errorHandler ?? harness.errorHandler,
    withErrorHandler: options.withErrorHandler,
  });
  const createdServices = new Set<AnomalyDetectionService>([harness.service]);

  const trackService = (service: AnomalyDetectionService) => {
    createdServices.add(service);
    return service;
  };

  return {
    service: harness.service,
    logger: harness.logger,
    errorHandler: harness.errorHandler,
    createStandardService: (serviceOptions = {}) =>
      trackService(factory.createStandardService(serviceOptions)),
    createLegacyService: (serviceOptions = {}) =>
      trackService(factory.createLegacyService(serviceOptions)),
    cleanup: () => {
      createdServices.forEach((service) => {
        service.clearHistory();
      });
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}

export function seedVolumeHistory(service: AnomalyDetectionService, values: number[]): void {
  values.forEach((value) => {
    service.detectVolumeAnomaly(value);
  });
}

export function seedVolatilityHistory(service: AnomalyDetectionService, values: number[]): void {
  values.forEach((value) => {
    service.detectVolatilitySpike(value);
  });
}

export function seedAnomalyDetectionHistory(
  service: AnomalyDetectionService,
  options: {
    volumeValues?: number[];
    volatilityValues?: number[];
  } = {},
): void {
  if (options.volumeValues) {
    seedVolumeHistory(service, options.volumeValues);
  }

  if (options.volatilityValues) {
    seedVolatilityHistory(service, options.volatilityValues);
  }
}
