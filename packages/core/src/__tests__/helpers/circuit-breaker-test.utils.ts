import { ErrorHandler } from '../../errors';
import {
  CircuitBreakerConfig,
  CircuitBreakerService,
} from '../../services/circuit-breaker.service';
import { LoggerService, LogLevel } from '../../types/legacy';

export function createCircuitBreakerLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createCircuitBreakerMockLogger(overrides: Record<string, unknown> = {}) {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    ...overrides,
  };
}

export function createCircuitBreakerFailingLogger(
  overrides: Record<string, unknown> = {},
): LoggerService {
  return createCircuitBreakerMockLogger(overrides) as unknown as LoggerService;
}

export function createCircuitBreakerConfig(
  overrides: Partial<CircuitBreakerConfig> = {},
): CircuitBreakerConfig {
  return {
    errorThreshold: 5,
    cooldownMs: 5000,
    autoReset: true,
    ...overrides,
  };
}

export function createCircuitBreakerHarness(options: {
  configOverrides?: Partial<CircuitBreakerConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createCircuitBreakerLogger();
  const config = createCircuitBreakerConfig(options.configOverrides);
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : createCircuitBreakerErrorHandler(logger);
  const service = createCircuitBreakerService({
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

export function createStandardCircuitBreakerHarness(options: {
  configOverrides?: Partial<CircuitBreakerConfig>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}) {
  const logger = options.logger ?? createCircuitBreakerLogger();
  const config = createCircuitBreakerConfig(options.configOverrides);
  const errorHandler = options.errorHandler ?? createCircuitBreakerErrorHandler(logger);
  const service = createStandardCircuitBreakerService({
    configOverrides: options.configOverrides,
    logger,
    errorHandler,
  });

  return {
    service,
    logger,
    config,
    errorHandler,
    createService: (serviceOptions: {
      configOverrides?: Partial<CircuitBreakerConfig>;
    } = {}) =>
      createStandardCircuitBreakerService({
        configOverrides: {
          ...options.configOverrides,
          ...serviceOptions.configOverrides,
        },
        logger,
        errorHandler,
      }),
  };
}

export function createLegacyCircuitBreakerHarness(options: {
  configOverrides?: Partial<CircuitBreakerConfig>;
  logger?: LoggerService;
} = {}) {
  const logger = options.logger ?? createCircuitBreakerLogger();
  const config = createCircuitBreakerConfig(options.configOverrides);
  const service = createLegacyCircuitBreakerService({
    configOverrides: options.configOverrides,
    logger,
  });

  return {
    service,
    logger,
    config,
    errorHandler: undefined,
    createService: (serviceOptions: {
      configOverrides?: Partial<CircuitBreakerConfig>;
    } = {}) =>
      createLegacyCircuitBreakerService({
        configOverrides: {
          ...options.configOverrides,
          ...serviceOptions.configOverrides,
        },
        logger,
      }),
  };
}

export function createCircuitBreakerErrorHandler(
  logger: LoggerService = createCircuitBreakerLogger(),
): ErrorHandler {
  return new ErrorHandler(logger);
}

export function createCircuitBreakerService(options: {
  configOverrides?: Partial<CircuitBreakerConfig>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createCircuitBreakerLogger();
  const config = createCircuitBreakerConfig(options.configOverrides);

  return new CircuitBreakerService(
    config,
    logger,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}

export function createStandardCircuitBreakerService(options: {
  configOverrides?: Partial<CircuitBreakerConfig>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}) {
  return createCircuitBreakerService({
    configOverrides: options.configOverrides,
    logger: options.logger,
    errorHandler: options.errorHandler,
  });
}

export function createLegacyCircuitBreakerService(options: {
  configOverrides?: Partial<CircuitBreakerConfig>;
  logger?: LoggerService;
} = {}) {
  return createCircuitBreakerService({
    configOverrides: options.configOverrides,
    logger: options.logger,
    withErrorHandler: false,
  });
}
