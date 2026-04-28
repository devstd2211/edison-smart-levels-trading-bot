import { ErrorHandler } from '../../errors/ErrorHandler';
import { VolatilityRegimeService } from '../../services/volatility-regime.service';
import {
  LoggerService,
  LogLevel,
  VolatilityRegimeConfig,
} from '../../types/legacy';

export function createVolatilityRegimeLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createVolatilityRegimeMockLogger(methodToFail?: string): LoggerService {
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

export interface VolatilityRegimeHarnessOptions {
  logger?: LoggerService;
  config?: Partial<VolatilityRegimeConfig>;
  withErrorHandler?: boolean;
}

export interface VolatilityRegimeServiceOptions {
  logger?: LoggerService;
  config?: Partial<VolatilityRegimeConfig>;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
}

export function createVolatilityRegimeHarness(options: VolatilityRegimeHarnessOptions = {}) {
  const logger = options.logger ?? createVolatilityRegimeLogger();
  const errorHandler = new ErrorHandler(logger);
  const service = createVolatilityRegimeService({
    logger,
    config: options.config,
    errorHandler: options.withErrorHandler === false ? undefined : errorHandler,
  });

  return {
    service,
    logger,
    errorHandler,
    createStandardService: (overrides: VolatilityRegimeServiceOptions = {}) =>
      createVolatilityRegimeService({
        logger: overrides.logger ?? logger,
        config: overrides.config ?? options.config,
        errorHandler:
          overrides.withErrorHandler === false
            ? undefined
            : overrides.errorHandler ?? errorHandler,
      }),
    createLegacyService: (overrides: Pick<VolatilityRegimeServiceOptions, 'logger' | 'config'> = {}) =>
      createVolatilityRegimeService({
        logger: overrides.logger ?? logger,
        config: overrides.config ?? options.config,
      }),
    createService: (overrides: VolatilityRegimeServiceOptions = {}) =>
      createVolatilityRegimeService({
        logger: overrides.logger ?? logger,
        config: overrides.config ?? options.config,
        errorHandler:
          overrides.withErrorHandler === false
            ? undefined
            : overrides.errorHandler ?? errorHandler,
      }),
  };
}

export function createVolatilityRegimeService(
  options: Pick<VolatilityRegimeServiceOptions, 'logger' | 'config' | 'errorHandler'> = {},
): VolatilityRegimeService {
  return new VolatilityRegimeService(
    options.logger ?? createVolatilityRegimeLogger(),
    options.config,
    options.errorHandler,
  );
}

export function createInvalidVolatilityRegimeThresholds(overrides: {
  lowAtrPercent?: number;
  highAtrPercent?: number;
} = {}): Partial<VolatilityRegimeConfig> {
  return {
    thresholds: {
      lowAtrPercent: overrides.lowAtrPercent ?? NaN,
      highAtrPercent: overrides.highAtrPercent ?? 1.5,
    },
  };
}

export interface ManagedVolatilityRegimeContext {
  service: VolatilityRegimeService;
  logger: LoggerService;
  errorHandler: ErrorHandler;
  createStandardService: (overrides?: VolatilityRegimeServiceOptions) => VolatilityRegimeService;
  createLegacyService: (
    overrides?: Pick<VolatilityRegimeServiceOptions, 'logger' | 'config'>,
  ) => VolatilityRegimeService;
  createService: (overrides?: VolatilityRegimeServiceOptions) => VolatilityRegimeService;
  cleanup: () => void;
  reset: () => void;
}

export type VolatilityRegimeRuntime = Pick<
  ManagedVolatilityRegimeContext,
  'service' | 'logger' | 'errorHandler'
>;

export type VolatilityRegimeFactories = Pick<
  ManagedVolatilityRegimeContext,
  'cleanup' | 'createStandardService' | 'createLegacyService'
>;

export function createManagedVolatilityRegimeContext(
  options: VolatilityRegimeHarnessOptions = {},
): ManagedVolatilityRegimeContext {
  const harness = createVolatilityRegimeHarness(options);
  const trackedServices = new Set<VolatilityRegimeService>([harness.service]);

  return {
    ...harness,
    createStandardService: (overrides = {}) => {
      const service = harness.createStandardService(overrides);
      trackedServices.add(service);
      return service;
    },
    createLegacyService: (overrides = {}) => {
      const service = harness.createLegacyService(overrides);
      trackedServices.add(service);
      return service;
    },
    createService: (overrides = {}) => {
      const service = harness.createService(overrides);
      trackedServices.add(service);
      return service;
    },
    cleanup: () => {
      for (const service of trackedServices) {
        service.reset();
      }
      trackedServices.clear();
      trackedServices.add(harness.service);
      jest.clearAllMocks();
    },
    reset: () => {
      for (const service of trackedServices) {
        service.reset();
      }
      jest.clearAllMocks();
    },
  };
}
