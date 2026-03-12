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

export function createVolumeProfileHarness(options: {
  configOverrides?: Partial<VolumeProfileConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createVolumeProfileLogger();
  const config = createVolumeProfileConfig(options.configOverrides);
  const errorHandler = new ErrorHandler(logger);
  const service = new VolumeProfileService(
    logger,
    config,
    options.withErrorHandler === false ? undefined : errorHandler,
  );

  return {
    service,
    logger,
    config,
    errorHandler,
  };
}
