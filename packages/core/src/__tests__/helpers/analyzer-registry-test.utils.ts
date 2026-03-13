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
) {
  const logger = createAnalyzerRegistryMockLogger(overrides);
  const errorHandler = new ErrorHandler(asAnalyzerRegistryLogger(logger));
  const registry = new AnalyzerRegistryService(
    asAnalyzerRegistryLogger(logger),
    errorHandler,
  );

  return {
    logger,
    errorHandler,
    registry,
  };
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
