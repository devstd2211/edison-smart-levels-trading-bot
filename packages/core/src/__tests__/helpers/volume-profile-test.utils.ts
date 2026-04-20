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
    priceTickSize: 0.5,
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
    createStandardService: (serviceOptions: {
      configOverrides?: Partial<VolumeProfileConfig>;
      logger?: LoggerService;
      errorHandler?: ErrorHandler;
      withErrorHandler?: boolean;
    } = {}) =>
      createVolumeProfileService({
        configOverrides: serviceOptions.configOverrides ?? options.configOverrides,
        logger: serviceOptions.logger ?? logger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
        withErrorHandler: serviceOptions.withErrorHandler ?? options.withErrorHandler,
      }),
    createLegacyService: (serviceOptions: {
      configOverrides?: Partial<VolumeProfileConfig>;
      logger?: LoggerService;
    } = {}) =>
      createVolumeProfileService({
        configOverrides: serviceOptions.configOverrides ?? options.configOverrides,
        logger: serviceOptions.logger ?? logger,
        withErrorHandler: false,
      }),
  };
}

export type VolumeProfileHarness = ReturnType<typeof createVolumeProfileHarness>;

export type ManagedVolumeProfileContext = VolumeProfileHarness & {
  createStandardService: VolumeProfileHarness['createStandardService'];
  createLegacyService: VolumeProfileHarness['createLegacyService'];
  cleanup: () => void;
};

export type VolumeProfileRuntime = Pick<
  ManagedVolumeProfileContext,
  'service' | 'logger' | 'config'
>;

export type VolumeProfileFactories = Pick<
  ManagedVolumeProfileContext,
  'cleanup' | 'createStandardService' | 'createLegacyService'
>;

export function createManagedVolumeProfileContext(options: {
  configOverrides?: Partial<VolumeProfileConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
} = {}): ManagedVolumeProfileContext {
  const harness = createVolumeProfileHarness(options);
  const trackedServices = new Set<VolumeProfileService>([harness.service]);

  const createStandardService: VolumeProfileHarness['createStandardService'] = (serviceOptions = {}) => {
    const service = harness.createStandardService(serviceOptions);
    trackedServices.add(service);
    return service;
  };

  const createLegacyService: VolumeProfileHarness['createLegacyService'] = (serviceOptions = {}) => {
    const service = harness.createLegacyService(serviceOptions);
    trackedServices.add(service);
    return service;
  };

  return {
    ...harness,
    createStandardService,
    createLegacyService,
    cleanup: () => {
      trackedServices.clear();
      jest.restoreAllMocks();
      jest.clearAllMocks();
      jest.clearAllTimers();
      jest.useRealTimers();
    },
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

export function createVolumeProfileInvalidConfig(
  overrides: Partial<VolumeProfileConfig>,
): Partial<VolumeProfileConfig> {
  return {
    ...overrides,
  };
}

export function createVolumeProfileBoundFactory(options: {
  configOverrides?: Partial<VolumeProfileConfig>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createVolumeProfileLogger();
  const errorHandler = options.errorHandler ?? createVolumeProfileErrorHandler(logger);

  return {
    logger,
    errorHandler,
    createStandardService: (
      configOverrides?: Partial<VolumeProfileConfig>,
      serviceLogger: LoggerService = logger,
      withErrorHandler: boolean = options.withErrorHandler ?? true,
    ) =>
      createVolumeProfileServiceWithHarness({
        configOverrides: {
          ...options.configOverrides,
          ...configOverrides,
        },
        logger: serviceLogger,
        errorHandler,
        withErrorHandler,
      }),
    createLegacyService: (
      configOverrides?: Partial<VolumeProfileConfig>,
      serviceLogger: LoggerService = logger,
    ) =>
      createVolumeProfileServiceWithHarness({
        configOverrides: {
          ...options.configOverrides,
          ...configOverrides,
        },
        logger: serviceLogger,
        withErrorHandler: false,
      }),
  };
}
