import { ErrorHandler, type ErrorLogger } from '../../errors/ErrorHandler';
import {
  IndicatorRegistry,
  type IIndicatorMetadata,
} from '../../services/indicator-registry.service';
import type { LoggerService } from '../../types/legacy';
import { IndicatorType } from '../../types/indicator';

export type IndicatorRegistryMockLogger = {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

export function createIndicatorRegistryMockLogger(
  overrides: Partial<IndicatorRegistryMockLogger> = {},
): IndicatorRegistryMockLogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    ...overrides,
  };
}

export function asIndicatorRegistryLogger(
  value: IndicatorRegistryMockLogger,
): LoggerService {
  return value as unknown as LoggerService;
}

export function asIndicatorRegistryErrorLogger(
  value: IndicatorRegistryMockLogger,
): ErrorLogger {
  return value as unknown as ErrorLogger;
}

export function createIndicatorRegistryHarness(
  overrides: Partial<IndicatorRegistryMockLogger> = {},
  options: {
    withErrorHandler?: boolean;
  } = {},
) {
  const logger = createIndicatorRegistryMockLogger(overrides);
  const errorHandler =
    options.withErrorHandler === false
      ? undefined
      : createIndicatorRegistryErrorHandler(logger);
  const registry = createIndicatorRegistryService({
    logger,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    logger,
    errorHandler: errorHandler ?? createIndicatorRegistryErrorHandler(logger),
    registry,
  };
}

export function createIndicatorRegistryErrorHandler(
  logger: IndicatorRegistryMockLogger = createIndicatorRegistryMockLogger(),
): ErrorHandler {
  return new ErrorHandler(asIndicatorRegistryErrorLogger(logger));
}

export function createIndicatorRegistryService(options: {
  logger?: IndicatorRegistryMockLogger;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): IndicatorRegistry {
  const logger = options.logger;
  return new IndicatorRegistry(
    logger ? asIndicatorRegistryLogger(logger) : undefined,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}

export function createIndicatorRegistryMetadata(
  name: string,
  enabled = true,
  type: IndicatorType = IndicatorType.EMA,
): IIndicatorMetadata {
  return {
    type,
    name,
    description: `${name} indicator`,
    enabled,
  };
}

export function asIndicatorRegistryType(value: unknown): IndicatorType {
  return value as IndicatorType;
}

export function asIndicatorRegistryMetadata(value: unknown): IIndicatorMetadata {
  return value as IIndicatorMetadata;
}
