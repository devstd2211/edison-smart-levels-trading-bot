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
