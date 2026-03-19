import { ErrorHandler } from '../../errors/ErrorHandler';
import { VolumeProfileService } from '../../services/volume-profile.service';
import {
  Candle,
  LoggerService,
  LogLevel,
  VolumeProfileConfig,
} from '../../types/legacy';

export function createVolumeProfileLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createVolumeProfileMockLogger(methodToFail?: string): LoggerService {
  return {
    minLevel: 'debug',
    logDir: '/tmp',
    logToFile: false,
    logs: [],
    info: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'info') {
        throw new Error('Logger.info failed');
      }
    }),
    warn: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'warn') {
        throw new Error('Logger.warn failed');
      }
    }),
    debug: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'debug') {
        throw new Error('Logger.debug failed');
      }
    }),
    error: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'error') {
        throw new Error('Logger.error failed');
      }
    }),
  } as unknown as LoggerService;
}

export function createVolumeProfileConfig(
  overrides: Partial<VolumeProfileConfig> = {},
): VolumeProfileConfig {
  return {
    enabled: true,
    lookbackCandles: 100,
    valueAreaPercent: 70,
    priceTickSize: 0.01,
    ...overrides,
  };
}

export function createVolumeProfileCandle(
  low: number,
  high: number,
  close: number,
  volume: number,
  timestamp: number = Date.now(),
): Candle {
  return {
    timestamp,
    open: (low + high) / 2,
    high,
    low,
    close,
    volume,
  };
}

export function createVolumeProfileCandles(count: number = 10): Candle[] {
  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    candles.push({
      timestamp: 1000 + i * 60,
      open: 100 + i * 0.1,
      high: 100.5 + i * 0.1,
      low: 99.5 + i * 0.1,
      close: 100 + i * 0.1,
      volume: 1000 + i * 10,
    });
  }
  return candles;
}

export function createVolumeProfileCandlesFromSpecs(
  specs: Array<{
    low: number;
    high: number;
    close: number;
    volume: number;
    timestamp?: number;
  }>,
): Candle[] {
  return specs.map((spec) =>
    createVolumeProfileCandle(
      spec.low,
      spec.high,
      spec.close,
      spec.volume,
      spec.timestamp,
    ),
  );
}

export function createInvalidVolumeProfileCandle(
  overrides: Partial<Candle> = {},
): Candle {
  return {
    timestamp: 1000,
    open: 100,
    high: 100.5,
    low: 99.5,
    close: 100,
    volume: 1000,
    ...overrides,
  };
}

export function createVolumeProfileServiceWithHarness(options: {
  configOverrides?: Partial<VolumeProfileConfig>;
  config?: Partial<VolumeProfileConfig>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  return createVolumeProfileService(options);
}

export function createVolumeProfileHarness(options: {
  configOverrides?: Partial<VolumeProfileConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createVolumeProfileLogger();
  const config = createVolumeProfileConfig(options.configOverrides);
  const errorHandler = createVolumeProfileErrorHandler(logger);
  const service = createVolumeProfileService({
    configOverrides: options.configOverrides,
    logger,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    service,
    logger,
    config,
    errorHandler,
  };
}

export function createVolumeProfileErrorHandler(
  logger: LoggerService = createVolumeProfileLogger(),
): ErrorHandler {
  return new ErrorHandler(logger);
}

export function createVolumeProfileService(options: {
  configOverrides?: Partial<VolumeProfileConfig>;
  config?: Partial<VolumeProfileConfig>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createVolumeProfileLogger();
  const config =
    Object.prototype.hasOwnProperty.call(options, 'config')
      ? options.config
      : createVolumeProfileConfig(options.configOverrides);

  return new VolumeProfileService(
    logger,
    config,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}
