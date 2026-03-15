import { ErrorHandler } from '../../errors/ErrorHandler';
import { AnalyzerRegistryService } from '../../services/analyzer-registry.service';
import type { LoggerService } from '../../services/logger.service';

export type AnalyzerRegistryMockLogger = {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

export function createAnalyzerRegistryMockLogger(
  overrides: Partial<AnalyzerRegistryMockLogger> = {},
): AnalyzerRegistryMockLogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    ...overrides,
  };
}

export function asAnalyzerRegistryLogger(
  logger: AnalyzerRegistryMockLogger,
): LoggerService {
  return logger as unknown as LoggerService;
}

export function createAnalyzerRegistryHarness(
  overrides: Partial<AnalyzerRegistryMockLogger> = {},
  options: {
    withErrorHandler?: boolean;
  } = {},
) {
  const logger = createAnalyzerRegistryMockLogger(overrides);
  const errorHandler =
    options.withErrorHandler === false
      ? undefined
      : createAnalyzerRegistryErrorHandler(logger);
  const registry = createAnalyzerRegistryService({
    logger,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    logger,
    errorHandler: errorHandler ?? createAnalyzerRegistryErrorHandler(logger),
    registry,
  };
}

export function createAnalyzerRegistryErrorHandler(
  logger: AnalyzerRegistryMockLogger = createAnalyzerRegistryMockLogger(),
): ErrorHandler {
  return new ErrorHandler(asAnalyzerRegistryLogger(logger));
}

export function createAnalyzerRegistryService(options: {
  logger?: AnalyzerRegistryMockLogger;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): AnalyzerRegistryService {
  const logger = options.logger ?? createAnalyzerRegistryMockLogger();
  return new AnalyzerRegistryService(
    asAnalyzerRegistryLogger(logger),
    options.withErrorHandler === false
      ? undefined
      : options.errorHandler,
  );
}

export function createAnalyzerRegistryMockIndicator(name: string) {
  return {
    calculate: jest.fn().mockResolvedValue([]),
    getValue: jest.fn().mockReturnValue(50),
    isReady: jest.fn().mockReturnValue(true),
    getType: jest.fn().mockReturnValue(name),
    getMinCandlesRequired: jest.fn().mockReturnValue(14),
  };
}

export function createAnalyzerRegistryBaseConfig() {
  return {
    indicators: {
      ema: { period: 20 },
      rsi: { period: 14 },
      atr: { period: 14 },
    },
    analyzerDefaults: {
      EMA_ANALYZER_NEW: { minConfidence: 0.5 },
    },
  };
}
