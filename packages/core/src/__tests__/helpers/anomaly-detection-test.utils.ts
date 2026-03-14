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

export function createAnomalyDetectionService(options: {
  config?: Partial<AnomalyDetectionConfig>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}): AnomalyDetectionService {
  return new AnomalyDetectionService(
    options.config,
    undefined,
    options.logger ?? createAnomalyDetectionLogger(),
    options.errorHandler,
  );
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
