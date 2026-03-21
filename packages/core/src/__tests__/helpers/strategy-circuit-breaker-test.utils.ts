import { ErrorHandler } from '../../errors';
import { StrategyCircuitBreakerService } from '../../services/multi-strategy/strategy-circuit-breaker.service';
import { LoggerService } from '../../types/legacy';

export function createStrategyCircuitBreakerMockLogger(
  overrides: Partial<LoggerService> = {},
): LoggerService {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    ...overrides,
  } as unknown as LoggerService;
}

export function createStrategyCircuitBreakerErrorHandler(
  logger: LoggerService = createStrategyCircuitBreakerMockLogger(),
): ErrorHandler {
  return new ErrorHandler(logger);
}

export function createStrategyCircuitBreakerService(options: {
  logger?: LoggerService;
  config?: Record<string, unknown>;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): StrategyCircuitBreakerService {
  return new StrategyCircuitBreakerService(
    options.logger,
    options.config,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}

export function createStrategyCircuitBreakerHarness(options: {
  logger?: LoggerService;
  config?: Record<string, unknown>;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createStrategyCircuitBreakerMockLogger();
  const errorHandler =
    options.withErrorHandler === false
      ? undefined
      : createStrategyCircuitBreakerErrorHandler(logger);
  const service = createStrategyCircuitBreakerService({
    logger,
    config: options.config,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    service,
    logger,
    errorHandler,
  };
}

export function createStandardStrategyCircuitBreakerService(options: {
  logger?: LoggerService;
  config?: Record<string, unknown>;
  errorHandler?: ErrorHandler;
} = {}): StrategyCircuitBreakerService {
  return createStrategyCircuitBreakerService(options);
}

export function createLegacyStrategyCircuitBreakerService(options: {
  logger?: LoggerService;
  config?: Record<string, unknown>;
} = {}): StrategyCircuitBreakerService {
  return createStrategyCircuitBreakerService({
    logger: options.logger,
    config: options.config,
    withErrorHandler: false,
  });
}

export function createStandardStrategyCircuitBreakerHarness(options: {
  logger?: LoggerService;
  config?: Record<string, unknown>;
  errorHandler?: ErrorHandler;
} = {}) {
  const logger = options.logger ?? createStrategyCircuitBreakerMockLogger();
  const errorHandler = options.errorHandler ?? createStrategyCircuitBreakerErrorHandler(logger);
  const service = createStandardStrategyCircuitBreakerService({
    logger,
    config: options.config,
    errorHandler,
  });

  return {
    service,
    logger,
    errorHandler,
  };
}

export function createLegacyStrategyCircuitBreakerHarness(options: {
  logger?: LoggerService;
  config?: Record<string, unknown>;
} = {}) {
  const logger = options.logger ?? createStrategyCircuitBreakerMockLogger();
  const service = createLegacyStrategyCircuitBreakerService({
    logger,
    config: options.config,
  });

  return {
    service,
    logger,
    errorHandler: undefined,
  };
}
