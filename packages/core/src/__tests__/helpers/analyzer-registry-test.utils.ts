import { ErrorHandler } from '../../errors/ErrorHandler';
import { AnalyzerRegistryService } from '../../services/analyzer-registry.service';
import type { LoggerService } from '../../services/logger.service';
import type { StrategyAnalyzerConfig } from '../../types/strategy-config';
import { IndicatorType } from '../../types/indicator';

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
  const registry =
    options.withErrorHandler === false
      ? createLegacyAnalyzerRegistryService({ logger })
      : createStandardAnalyzerRegistryService({
          logger,
          errorHandler,
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

export function createStandardAnalyzerRegistryService(options: {
  logger?: AnalyzerRegistryMockLogger;
  errorHandler?: ErrorHandler;
} = {}): AnalyzerRegistryService {
  const logger = options.logger ?? createAnalyzerRegistryMockLogger();
  return new AnalyzerRegistryService(
    asAnalyzerRegistryLogger(logger),
    options.errorHandler,
  );
}

export function createLegacyAnalyzerRegistryService(options: {
  logger?: AnalyzerRegistryMockLogger;
} = {}): AnalyzerRegistryService {
  const logger = options.logger ?? createAnalyzerRegistryMockLogger();
  return new AnalyzerRegistryService(asAnalyzerRegistryLogger(logger));
}

export function createAnalyzerRegistryService(options: {
  logger?: AnalyzerRegistryMockLogger;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): AnalyzerRegistryService {
  return options.withErrorHandler === false
    ? createLegacyAnalyzerRegistryService(options)
    : createStandardAnalyzerRegistryService(options);
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

export function createAnalyzerRegistryAnalyzerConfig(
  overrides: Partial<StrategyAnalyzerConfig> = {},
): StrategyAnalyzerConfig {
  return {
    name: 'EMA_ANALYZER_NEW',
    enabled: true,
    weight: 1,
    priority: 5,
    ...overrides,
  };
}

export function createAnalyzerRegistryAnalyzerConfigs(
  overridesList: Array<Partial<StrategyAnalyzerConfig>>,
): StrategyAnalyzerConfig[] {
  return overridesList.map((overrides) => createAnalyzerRegistryAnalyzerConfig(overrides));
}

export function createAnalyzerRegistryIndicatorMap(
  names: string[],
): Map<IndicatorType, ReturnType<typeof createAnalyzerRegistryMockIndicator>> {
  return new Map(
    names.map((name) => [name as unknown as IndicatorType, createAnalyzerRegistryMockIndicator(name)]),
  );
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

export function createAnalyzerRegistryScenarioHarness(options: {
  analyzerConfigOverrides?: Partial<StrategyAnalyzerConfig>;
  analyzerConfigsOverrides?: Array<Partial<StrategyAnalyzerConfig>>;
  indicatorNames?: string[];
} = {}) {
  const config = createAnalyzerRegistryBaseConfig();
  const analyzerConfig = createAnalyzerRegistryAnalyzerConfig(
    options.analyzerConfigOverrides,
  );
  const analyzerConfigs = options.analyzerConfigsOverrides
    ? createAnalyzerRegistryAnalyzerConfigs(options.analyzerConfigsOverrides)
    : [analyzerConfig];
  const indicators = createAnalyzerRegistryIndicatorMap(options.indicatorNames ?? ['EMA']);

  return {
    config,
    analyzerConfig,
    analyzerConfigs,
    indicators,
  };
}
