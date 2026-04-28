import type { Candle } from '../../types/core';
import type { AnalyzerSignal } from '../../types/strategy';
import type { StrategyConfig } from '../../types/strategy-config';
import type { AnalyzerRegistryService } from '../../services/analyzer-registry.service';
import type { IAnalyzer } from '../../types/analyzer';
import { AnalyzerEngineService } from '../../services/analyzer-engine.service';
import { LoggerService } from '../../services/logger.service';
import { ErrorHandler, RecoveryStrategy, type ErrorHandlingResult } from '../../errors/ErrorHandler';

export type AnalyzerEngineMockLogger = {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

export function createAnalyzerEngineMockLogger(): AnalyzerEngineMockLogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

export function asAnalyzerEngineLogger(logger: AnalyzerEngineMockLogger): LoggerService {
  return logger as unknown as LoggerService;
}

export function createAnalyzerEngineErrorHandler(
  logger: AnalyzerEngineMockLogger = createAnalyzerEngineMockLogger(),
): ErrorHandler {
  return new ErrorHandler(asAnalyzerEngineLogger(logger));
}

export function createAnalyzerEngineMockAnalyzer(
  name: string,
  direction: 'LONG' | 'SHORT' | 'HOLD' = 'LONG',
  options: {
    isReady?: boolean;
    throwError?: unknown;
    minCandlesRequired?: number;
    weight?: number;
    priority?: number;
    delayMs?: number;
  } = {},
): IAnalyzer {
  const {
    isReady: shouldBeReady = true,
    throwError = null,
    minCandlesRequired = 20,
    weight = 0.5,
    priority = 5,
  } = options;

  return {
    getType: jest.fn(() => name),
    analyze: jest.fn((candles: Candle[]) => {
      if (throwError) {
        throw throwError;
      }

      return {
        source: name,
        direction,
        confidence: 0.75,
        weight,
        priority,
      } as AnalyzerSignal;
    }),
    isReady: jest.fn(() => shouldBeReady),
    getMinCandlesRequired: jest.fn(() => minCandlesRequired),
    isEnabled: jest.fn(() => true),
    getWeight: jest.fn(() => weight),
    getPriority: jest.fn(() => priority),
    getMaxConfidence: jest.fn(() => 1.0),
  };
}

export function createAnalyzerEngineInvalidSignalAnalyzer(name: string): IAnalyzer {
  return {
    getType: jest.fn(() => name),
    analyze: jest.fn(() => ({ direction: undefined } as unknown as AnalyzerSignal)),
    isReady: jest.fn(() => true),
    getMinCandlesRequired: jest.fn(() => 20),
    isEnabled: jest.fn(() => true),
    getWeight: jest.fn(() => 0.5),
    getPriority: jest.fn(() => 5),
    getMaxConfidence: jest.fn(() => 1.0),
  };
}

export function createAnalyzerEngineAnalyzerEntry(
  name: string,
  direction: 'LONG' | 'SHORT' | 'HOLD' = 'LONG',
  options: {
    isReady?: boolean;
    throwError?: unknown;
    minCandlesRequired?: number;
    weight?: number;
    priority?: number;
    delayMs?: number;
  } = {},
): [string, { instance: IAnalyzer; weight: number; priority: number }] {
  const analyzer = createAnalyzerEngineMockAnalyzer(name, direction, options);

  return [
    name,
    {
      instance: analyzer,
      weight: options.weight ?? 0.5,
      priority: options.priority ?? 5,
    },
  ];
}

export function createAnalyzerEngineAnalyzers(
  entries: Array<
  | [string, { instance: IAnalyzer; weight: number; priority: number }]
  | {
    name: string;
    direction?: 'LONG' | 'SHORT' | 'HOLD';
    throwError?: unknown;
    isReady?: boolean;
    minCandlesRequired?: number;
    weight?: number;
    priority?: number;
  }
  >,
): Map<string, { instance: IAnalyzer; weight: number; priority: number }> {
  return new Map(
    entries.map((entry) =>
      Array.isArray(entry)
        ? entry
        : createAnalyzerEngineAnalyzerEntry(entry.name, entry.direction, entry),
    ),
  );
}

export function createAnalyzerEngineMockRegistry(
  analyzers: Map<string, { instance: IAnalyzer; weight: number; priority: number }>,
): AnalyzerRegistryService {
  return {
    getEnabledAnalyzers: jest.fn(async () => analyzers),
  } as unknown as AnalyzerRegistryService;
}

export function createAnalyzerEngineFailingRegistry(error: unknown): AnalyzerRegistryService {
  return {
    getEnabledAnalyzers: jest.fn(async () => {
      throw error;
    }),
  } as unknown as AnalyzerRegistryService;
}

export function createAnalyzerEngineMockStrategyConfig(
  analyzerNames: string[],
): StrategyConfig {
  return {
    version: 1,
    metadata: {
      name: 'test-strategy',
      version: '1.0',
      description: 'Test strategy',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      tags: [],
    },
    analyzers: analyzerNames.map((name, idx) => ({
      name,
      enabled: true,
      weight: 0.5 + idx * 0.1,
      priority: 5 + idx,
      minConfidence: 0.5,
      maxConfidence: 1.0,
    })),
  };
}

export function createAnalyzerEngineMockCandles(count: number): Candle[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: Date.now() - (count - i) * 60000,
    open: 100,
    high: 101,
    low: 99,
    close: 100 + i * 0.1,
    volume: 1000,
  }));
}

export function createAnalyzerEngineMockErrorHandler(): jest.Mocked<ErrorHandler> {
  return {
    handle: jest.fn(async (error, options): Promise<ErrorHandlingResult> => ({
      success: true,
      recovered: options.strategy !== RecoveryStrategy.SKIP && options.strategy !== RecoveryStrategy.THROW,
      attempts: 1,
      message: 'Handled successfully',
      strategy: options.strategy,
      error: error as ErrorHandlingResult['error'],
    })),
    getLogger: jest.fn(() => createAnalyzerEngineMockLogger() as unknown as LoggerService),
  } as unknown as jest.Mocked<ErrorHandler>;
}

type AnalyzerEngineDependencyOverrides = {
  registry?: AnalyzerRegistryService;
  logger?: AnalyzerEngineMockLogger;
  errorHandler?: ErrorHandler;
};

export function createAnalyzerEngineService(
  analyzers: Map<string, { instance: IAnalyzer; weight: number; priority: number }>,
  overrides: AnalyzerEngineDependencyOverrides = {},
): AnalyzerEngineService {
  return new AnalyzerEngineService(
    overrides.registry ?? createAnalyzerEngineMockRegistry(analyzers),
    overrides.logger ? asAnalyzerEngineLogger(overrides.logger) : undefined,
    overrides.errorHandler,
  );
}

export function createAnalyzerEngineHarness(
  analyzers: Map<string, { instance: IAnalyzer; weight: number; priority: number }>,
  overrides: AnalyzerEngineDependencyOverrides = {},
) {
  const logger = overrides.logger ?? createAnalyzerEngineMockLogger();
  const registry = overrides.registry ?? createAnalyzerEngineMockRegistry(analyzers);
  const errorHandler = overrides.errorHandler;
  const service = createAnalyzerEngineService(analyzers, {
    registry,
    logger,
    errorHandler,
  });

  return {
    logger,
    registry,
    errorHandler,
    service,
  };
}

export type AnalyzerEngineHarness = ReturnType<typeof createAnalyzerEngineHarness>;

export function createAnalyzerEngineScenarioHarness(
  analyzers: Map<string, { instance: IAnalyzer; weight: number; priority: number }>,
  options: AnalyzerEngineScenarioOptions = {},
) {
  const harness = createAnalyzerEngineHarness(analyzers, options);
  const analyzerNames = options.analyzerNames ?? Array.from(analyzers.keys());
  const candles = createAnalyzerEngineMockCandles(options.candleCount ?? 50);
  const config = createAnalyzerEngineMockStrategyConfig(analyzerNames);

  return {
    ...harness,
    candles,
    config,
  };
}

export type AnalyzerEngineScenarioHarness = ReturnType<typeof createAnalyzerEngineScenarioHarness>;

export interface ManagedAnalyzerEngineContext {
  logger: AnalyzerEngineMockLogger;
  registry: AnalyzerRegistryService;
  errorHandler: ErrorHandler | undefined;
  service: AnalyzerEngineService;
  candles: Candle[];
  config: StrategyConfig;
  createScenario: (
    analyzers: Map<string, { instance: IAnalyzer; weight: number; priority: number }>,
    options?: AnalyzerEngineScenarioOptions,
  ) => ManagedAnalyzerEngineContext;
  cleanup: () => void;
}

export type ManagedAnalyzerEngineScenarioContext = ManagedAnalyzerEngineContext;

export type AnalyzerEngineSuiteContext = Pick<
  ManagedAnalyzerEngineContext,
  'logger' | 'createScenario' | 'cleanup'
>;

export type AnalyzerEngineScenarioMap = Map<
  string,
  { instance: IAnalyzer; weight: number; priority: number }
>;

export type AnalyzerEngineScenarioOptions = AnalyzerEngineDependencyOverrides & {
  analyzerNames?: string[];
  candleCount?: number;
};

export function createManagedAnalyzerEngineSuiteContext(
  options: AnalyzerEngineScenarioOptions = {},
): AnalyzerEngineSuiteContext {
  const trackedScenarios: ManagedAnalyzerEngineContext[] = [];
  const logger = options.logger ?? createAnalyzerEngineMockLogger();
  const sharedOptions: AnalyzerEngineScenarioOptions = {
    ...options,
    logger,
  };

  const cleanup = () => {
    trackedScenarios.length = 0;
    jest.clearAllMocks();
  };

  return {
    logger,
    createScenario: (analyzers, nextOptions = {}) => {
      const scenario = createManagedAnalyzerEngineScenarioContext(analyzers, {
        ...sharedOptions,
        ...nextOptions,
        logger: nextOptions.logger ?? logger,
      });
      trackedScenarios.push(scenario);
      return scenario;
    },
    cleanup,
  };
}

export function createManagedAnalyzerEngineScenarioContext(
  analyzers: Map<string, { instance: IAnalyzer; weight: number; priority: number }>,
  options: AnalyzerEngineScenarioOptions = {},
): ManagedAnalyzerEngineContext {
  const trackedScenarios: AnalyzerEngineScenarioHarness[] = [];
  const createScenario = (
    nextAnalyzers: Map<string, { instance: IAnalyzer; weight: number; priority: number }>,
    nextOptions: AnalyzerEngineScenarioOptions = {},
  ): ManagedAnalyzerEngineContext => {
    const scenario = createAnalyzerEngineScenarioHarness(nextAnalyzers, {
      ...options,
      ...nextOptions,
    });
    trackedScenarios.push(scenario);

    return {
      ...scenario,
      createScenario,
      cleanup: () => {
        trackedScenarios.length = 0;
        jest.clearAllMocks();
      },
    };
  };

  const scenario = createAnalyzerEngineScenarioHarness(analyzers, options);
  trackedScenarios.push(scenario);

  return {
    ...scenario,
    createScenario,
    cleanup: () => {
      trackedScenarios.length = 0;
      jest.clearAllMocks();
    },
  };
}
