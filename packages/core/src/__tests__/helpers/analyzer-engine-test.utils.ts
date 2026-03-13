import type { Candle } from '../../types/core';
import type { AnalyzerSignal } from '../../types/strategy';
import type { StrategyConfig } from '../../types/strategy-config';
import type { AnalyzerRegistryService } from '../../services/analyzer-registry.service';
import type { IAnalyzer } from '../../types/analyzer';
import { AnalyzerEngineService } from '../../services/analyzer-engine.service';
import { LoggerService } from '../../services/logger.service';

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

export function createAnalyzerEngineMockRegistry(
  analyzers: Map<string, { instance: IAnalyzer; weight: number; priority: number }>,
): AnalyzerRegistryService {
  return {
    getEnabledAnalyzers: jest.fn(async () => analyzers),
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

export function createAnalyzerEngineHarness(
  analyzers: Map<string, { instance: IAnalyzer; weight: number; priority: number }>,
) {
  const logger = createAnalyzerEngineMockLogger();
  const registry = createAnalyzerEngineMockRegistry(analyzers);
  const service = new AnalyzerEngineService(
    registry,
    asAnalyzerEngineLogger(logger),
  );

  return {
    logger,
    registry,
    service,
  };
}
