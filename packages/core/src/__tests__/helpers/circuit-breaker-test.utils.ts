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
  const errorHandler = new ErrorHandler(logger);
  const service = new CircuitBreakerService(
    config,
    logger,
    options.withErrorHandler === false ? undefined : errorHandler,
  );

  return {
    service,
    logger,
    config,
    errorHandler,
  };
}
