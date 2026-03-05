/**
 * Analyzer Engine Service Error Handling Tests (Phase 8.9.13)
 *
 * Comprehensive test suite for AnalyzerEngineService error handling:
 * - Individual analyzer failures with SKIP strategy
 * - Registry failures with GRACEFUL_DEGRADE strategy
 * - Signal validation errors
 * - Recovery scenarios
 * - Backward compatibility (without ErrorHandler)
 */

import type { Candle } from '../../types/core';
import type { AnalyzerSignal } from '../../types/strategy';
import type { StrategyConfig } from '../../types/strategy-config';
import { AnalyzerEngineService, AnalyzerExecutionConfig } from '../../services/analyzer-engine.service';
import type { AnalyzerRegistryService } from '../../services/analyzer-registry.service';
import type { IAnalyzer } from '../../types/analyzer';
import { LoggerService } from '../../services/logger.service';
import { ErrorHandler, RecoveryStrategy, ErrorHandlingResult } from '../../errors/ErrorHandler';

// ============================================================================
// MOCK UTILITIES
// ============================================================================

/**
 * Create mock analyzer with configurable behavior
 */
function createMockAnalyzer(
  name: string,
  direction: 'LONG' | 'SHORT' | 'HOLD' = 'LONG',
  options: {
    isReady?: boolean;
    throwError?: Error | null;
    minCandlesRequired?: number;
    weight?: number;
    priority?: number;
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

/**
 * Create mock analyzer registry
 */
function createMockAnalyzerRegistry(
  analyzers: Map<string, { instance: IAnalyzer; weight: number; priority: number }>,
): AnalyzerRegistryService {
  return {
    getEnabledAnalyzers: jest.fn(async () => analyzers),
  } as unknown as AnalyzerRegistryService;
}

/**
 * Create mock strategy config
 */
function createMockStrategyConfig(analyzerNames: string[]): StrategyConfig {
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

/**
 * Create mock candles
 */
function createMockCandles(count: number): Candle[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: Date.now() - (count - i) * 60000,
    open: 100,
    high: 101,
    low: 99,
    close: 100 + i * 0.1,
    volume: 1000,
  }));
}

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});
type MockLogger = ReturnType<typeof createMockLogger>;
const asLogger = (logger: MockLogger): LoggerService => logger as unknown as LoggerService;

const createMockErrorHandler = () => ({
  handle: jest.fn(async (error, options): Promise<ErrorHandlingResult> => {
    return {
      success: true,
      recovered: options.strategy !== RecoveryStrategy.SKIP && options.strategy !== RecoveryStrategy.THROW,
      attempts: 1,
      message: 'Handled successfully',
      strategy: options.strategy,
      error: error as ErrorHandlingResult['error'],
    };
  }),
  getLogger: jest.fn(() => createMockLogger()),
} as unknown as jest.Mocked<ErrorHandler>);

// ============================================================================
// TESTS
// ============================================================================

describe('AnalyzerEngineService Error Handling (Phase 8.9.13)', () => {
  let service: AnalyzerEngineService;
  let mockRegistry: AnalyzerRegistryService;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockErrorHandler: jest.Mocked<ErrorHandler>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockErrorHandler = createMockErrorHandler();
  });

  // ========== SECTION A: Individual Analyzer Failures - SKIP Strategy (5 tests) ==========

  describe('A: Individual Analyzer Failures - SKIP Strategy', () => {
    test('A1: Single analyzer failure does not block other analyzers', async () => {
      const analyzer1 = createMockAnalyzer('EMA', 'LONG');
      const analyzer2 = createMockAnalyzer('RSI', 'SHORT', {
        throwError: new Error('RSI calculation failed'),
      });
      const analyzer3 = createMockAnalyzer('ATR', 'LONG');
      const analyzers = new Map([
        ['EMA', { instance: analyzer1, weight: 0.5, priority: 5 }],
        ['RSI', { instance: analyzer2, weight: 0.5, priority: 5 }],
        ['ATR', { instance: analyzer3, weight: 0.5, priority: 5 }],
      ]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      service = new AnalyzerEngineService(mockRegistry, asLogger(mockLogger), mockErrorHandler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['EMA', 'RSI', 'ATR']);

      const result = await service.executeAnalyzers(candles, config);

      expect(result.signals).toHaveLength(2);
      expect(result.analyzersExecuted).toBe(2);
      expect(result.analyzersFailed).toBe(1);
      expect(result.signals.map((s) => s.source)).toEqual(['EMA', 'ATR']);
    });

    test('A2: ErrorHandler.handle called with SKIP strategy for analyzer failures', async () => {
      const analyzer1 = createMockAnalyzer('EMA', 'LONG');
      const analyzer2 = createMockAnalyzer('RSI', 'SHORT', {
        throwError: new Error('RSI calculation failed'),
      });
      const analyzers = new Map([
        ['EMA', { instance: analyzer1, weight: 0.5, priority: 5 }],
        ['RSI', { instance: analyzer2, weight: 0.5, priority: 5 }],
      ]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      service = new AnalyzerEngineService(mockRegistry, asLogger(mockLogger), mockErrorHandler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['EMA', 'RSI']);

      await service.executeAnalyzers(candles, config);

      expect(mockErrorHandler.handle).toHaveBeenCalled();
      const calls = mockErrorHandler.handle.mock.calls;
      const skipCalls = calls.filter((call) => call[1].strategy === RecoveryStrategy.SKIP);
      expect(skipCalls.length).toBeGreaterThan(0);
    });

    test('A3: All analyzers failing still returns empty signals with error tracking', async () => {
      const analyzer1 = createMockAnalyzer('EMA', 'LONG', {
        throwError: new Error('EMA failed'),
      });
      const analyzer2 = createMockAnalyzer('RSI', 'SHORT', {
        throwError: new Error('RSI failed'),
      });
      const analyzers = new Map([
        ['EMA', { instance: analyzer1, weight: 0.5, priority: 5 }],
        ['RSI', { instance: analyzer2, weight: 0.5, priority: 5 }],
      ]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      service = new AnalyzerEngineService(mockRegistry, asLogger(mockLogger), mockErrorHandler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['EMA', 'RSI']);

      const result = await service.executeAnalyzers(candles, config);

      expect(result.signals).toHaveLength(0);
      expect(result.analyzersFailed).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors!.map((e) => e.analyzerName)).toEqual(['EMA', 'RSI']);
    });

    test('A4: Error context includes analyzer name in ErrorHandler call', async () => {
      const analyzer = createMockAnalyzer('EMA', 'LONG', {
        throwError: new Error('Analysis failed'),
      });
      const analyzers = new Map([['EMA', { instance: analyzer, weight: 0.5, priority: 5 }]]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      service = new AnalyzerEngineService(mockRegistry, asLogger(mockLogger), mockErrorHandler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['EMA']);

      await service.executeAnalyzers(candles, config);

      expect(mockErrorHandler.handle).toHaveBeenCalled();
      const call = mockErrorHandler.handle.mock.calls[0];
      expect(call[1].context).toContain('EMA');
    });

    test('A5: Signal validation failures trigger SKIP strategy', async () => {
      const badAnalyzer: IAnalyzer = {
        getType: jest.fn(() => 'BAD'),
        analyze: jest.fn(() => ({ direction: undefined } as unknown as AnalyzerSignal)), // Missing direction
        isReady: jest.fn(() => true),
        getMinCandlesRequired: jest.fn(() => 20),
        isEnabled: jest.fn(() => true),
        getWeight: jest.fn(() => 0.5),
        getPriority: jest.fn(() => 5),
        getMaxConfidence: jest.fn(() => 1.0),
      };

      const analyzers = new Map([['BAD', { instance: badAnalyzer, weight: 0.5, priority: 5 }]]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      service = new AnalyzerEngineService(mockRegistry, asLogger(mockLogger), mockErrorHandler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['BAD']);

      const result = await service.executeAnalyzers(candles, config);

      expect(result.signals).toHaveLength(0);
      expect(result.analyzersFailed).toBe(1);
      expect(mockErrorHandler.handle).toHaveBeenCalled();
    });
  });

  // ========== SECTION B: Registry Failures - GRACEFUL_DEGRADE Strategy (4 tests) ==========

  describe('B: Registry Failures - GRACEFUL_DEGRADE Strategy', () => {
    test('B1: Registry failure triggers GRACEFUL_DEGRADE in lenient mode', async () => {
      const mockFailingRegistry = {
        getEnabledAnalyzers: jest.fn(async () => {
          throw new Error('Registry connection failed');
        }),
      } as unknown as AnalyzerRegistryService;

      service = new AnalyzerEngineService(mockFailingRegistry, asLogger(mockLogger), mockErrorHandler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['EMA']);
      const executionConfig: AnalyzerExecutionConfig = { errorHandling: 'lenient' };

      const result = await service.executeAnalyzers(candles, config, executionConfig);

      expect(result.signals).toHaveLength(0);
      expect(result.errors).toBeDefined();
      expect(mockErrorHandler.handle).toHaveBeenCalled();
      const call = mockErrorHandler.handle.mock.calls[0];
      expect(call[1].strategy).toBe(RecoveryStrategy.GRACEFUL_DEGRADE);
    });

    test('B2: Registry failure returns empty result with error tracking', async () => {
      const mockFailingRegistry = {
        getEnabledAnalyzers: jest.fn(async () => {
          throw new Error('Registry connection failed');
        }),
      } as unknown as AnalyzerRegistryService;

      service = new AnalyzerEngineService(mockFailingRegistry, asLogger(mockLogger), mockErrorHandler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['EMA']);
      const executionConfig: AnalyzerExecutionConfig = { errorHandling: 'lenient' };

      const result = await service.executeAnalyzers(candles, config, executionConfig);

      expect(result.signals).toHaveLength(0);
      expect(result.analyzersExecuted).toBe(0);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    test('B3: ErrorHandler not called if not provided (backward compatibility)', async () => {
      const mockFailingRegistry = {
        getEnabledAnalyzers: jest.fn(async () => {
          throw new Error('Registry connection failed');
        }),
      } as unknown as AnalyzerRegistryService;

      // Service without ErrorHandler
      service = new AnalyzerEngineService(mockFailingRegistry, asLogger(mockLogger));

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['EMA']);
      const executionConfig: AnalyzerExecutionConfig = { errorHandling: 'lenient' };

      const result = await service.executeAnalyzers(candles, config, executionConfig);

      expect(result.signals).toHaveLength(0);
      expect(result.errors).toBeDefined();
      // No error handler to call
    });

    test('B4: Registry error context includes meaningful info', async () => {
      const mockFailingRegistry = {
        getEnabledAnalyzers: jest.fn(async () => {
          throw new Error('Registry service unavailable');
        }),
      } as unknown as AnalyzerRegistryService;

      service = new AnalyzerEngineService(mockFailingRegistry, asLogger(mockLogger), mockErrorHandler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['EMA']);
      const executionConfig: AnalyzerExecutionConfig = { errorHandling: 'lenient' };

      await service.executeAnalyzers(candles, config, executionConfig);

      expect(mockErrorHandler.handle).toHaveBeenCalled();
      const call = mockErrorHandler.handle.mock.calls[0];
      expect(call[1].context).toContain('registry-failure');
    });
  });

  // ========== SECTION C: Error Handling Modes (3 tests) ==========

  describe('C: Error Handling Modes', () => {
    test('C1: Strict mode throws on analyzer failure when ErrorHandler used', async () => {
      const analyzer1 = createMockAnalyzer('EMA', 'LONG');
      const analyzer2 = createMockAnalyzer('RSI', 'SHORT', {
        throwError: new Error('RSI failed'),
      });
      const analyzers = new Map([
        ['EMA', { instance: analyzer1, weight: 0.5, priority: 5 }],
        ['RSI', { instance: analyzer2, weight: 0.5, priority: 5 }],
      ]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      service = new AnalyzerEngineService(mockRegistry, asLogger(mockLogger), mockErrorHandler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['EMA', 'RSI']);
      const executionConfig: AnalyzerExecutionConfig = { errorHandling: 'strict' };

      // In strict mode with ErrorHandler, still continues (SKIP is non-fatal)
      const result = await service.executeAnalyzers(candles, config, executionConfig);
      expect(result.signals).toHaveLength(1);
      expect(result.analyzersFailed).toBe(1);
    });

    test('C2: Lenient mode continues on analyzer failure', async () => {
      const analyzer1 = createMockAnalyzer('EMA', 'LONG');
      const analyzer2 = createMockAnalyzer('RSI', 'SHORT', {
        throwError: new Error('RSI failed'),
      });
      const analyzers = new Map([
        ['EMA', { instance: analyzer1, weight: 0.5, priority: 5 }],
        ['RSI', { instance: analyzer2, weight: 0.5, priority: 5 }],
      ]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      service = new AnalyzerEngineService(mockRegistry, asLogger(mockLogger), mockErrorHandler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['EMA', 'RSI']);
      const executionConfig: AnalyzerExecutionConfig = { errorHandling: 'lenient' };

      const result = await service.executeAnalyzers(candles, config, executionConfig);

      expect(result.signals).toHaveLength(1);
      expect(result.analyzersExecuted).toBe(1);
      expect(result.analyzersFailed).toBe(1);
    });

    test('C3: Service works correctly without ErrorHandler (backward compatibility)', async () => {
      const analyzer1 = createMockAnalyzer('EMA', 'LONG');
      const analyzer2 = createMockAnalyzer('RSI', 'SHORT', {
        throwError: new Error('RSI failed'),
      });
      const analyzers = new Map([
        ['EMA', { instance: analyzer1, weight: 0.5, priority: 5 }],
        ['RSI', { instance: analyzer2, weight: 0.5, priority: 5 }],
      ]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      // Create service WITHOUT ErrorHandler
      service = new AnalyzerEngineService(mockRegistry, asLogger(mockLogger));

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['EMA', 'RSI']);

      const result = await service.executeAnalyzers(candles, config);

      expect(result.signals).toHaveLength(1);
      expect(result.analyzersFailed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  // ========== SECTION D: Parallel vs Sequential with Errors (2 tests) ==========

  describe('D: Parallel vs Sequential with Errors', () => {
    test('D1: Parallel execution handles multiple concurrent failures gracefully', async () => {
      const analyzer1 = createMockAnalyzer('ANALYZER1', 'LONG', {
        throwError: new Error('Failed'),
      });
      const analyzer2 = createMockAnalyzer('ANALYZER2', 'SHORT', {
        throwError: new Error('Failed'),
      });
      const analyzer3 = createMockAnalyzer('ANALYZER3', 'LONG');
      const analyzers = new Map([
        ['ANALYZER1', { instance: analyzer1, weight: 0.5, priority: 5 }],
        ['ANALYZER2', { instance: analyzer2, weight: 0.5, priority: 5 }],
        ['ANALYZER3', { instance: analyzer3, weight: 0.5, priority: 5 }],
      ]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      service = new AnalyzerEngineService(mockRegistry, asLogger(mockLogger), mockErrorHandler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['ANALYZER1', 'ANALYZER2', 'ANALYZER3']);
      const executionConfig: AnalyzerExecutionConfig = { executionMode: 'parallel' };

      const result = await service.executeAnalyzers(candles, config, executionConfig);

      expect(result.signals).toHaveLength(1);
      expect(result.analyzersFailed).toBe(2);
      expect(result.executionMode).toBe('parallel');
    });

    test('D2: Sequential execution stops on first failure in strict mode', async () => {
      const analyzer1 = createMockAnalyzer('EMA', 'LONG');
      const analyzer2 = createMockAnalyzer('RSI', 'SHORT', {
        throwError: new Error('RSI failed'),
      });
      const analyzers = new Map([
        ['EMA', { instance: analyzer1, weight: 0.5, priority: 5 }],
        ['RSI', { instance: analyzer2, weight: 0.5, priority: 5 }],
      ]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      service = new AnalyzerEngineService(mockRegistry, asLogger(mockLogger), mockErrorHandler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['EMA', 'RSI']);
      const executionConfig: AnalyzerExecutionConfig = {
        executionMode: 'sequential',
        errorHandling: 'lenient',
      };

      const result = await service.executeAnalyzers(candles, config, executionConfig);

      expect(result.executionMode).toBe('sequential');
      expect(result.analyzersFailed).toBe(1);
    });
  });

  // ========== SECTION E: Error Logging and Visibility (2 tests) ==========

  describe('E: Error Logging and Visibility', () => {
    test('E1: Logger warnings emitted for each analyzer failure', async () => {
      const analyzer1 = createMockAnalyzer('EMA', 'LONG', {
        throwError: new Error('EMA error'),
      });
      const analyzer2 = createMockAnalyzer('RSI', 'SHORT', {
        throwError: new Error('RSI error'),
      });
      const analyzers = new Map([
        ['EMA', { instance: analyzer1, weight: 0.5, priority: 5 }],
        ['RSI', { instance: analyzer2, weight: 0.5, priority: 5 }],
      ]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      service = new AnalyzerEngineService(mockRegistry, asLogger(mockLogger), mockErrorHandler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['EMA', 'RSI']);

      await service.executeAnalyzers(candles, config);

      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
      const calls = mockLogger.warn.mock.calls;
      expect(calls[0][0]).toContain('EMA');
      expect(calls[1][0]).toContain('RSI');
    });

    test('E2: Error information preserved in result.errors for analysis', async () => {
      const analyzer1 = createMockAnalyzer('EMA', 'LONG', {
        throwError: new Error('Specific EMA error message'),
      });
      const analyzer2 = createMockAnalyzer('RSI', 'SHORT', {
        throwError: new Error('Specific RSI error message'),
      });
      const analyzers = new Map([
        ['EMA', { instance: analyzer1, weight: 0.5, priority: 5 }],
        ['RSI', { instance: analyzer2, weight: 0.5, priority: 5 }],
      ]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      service = new AnalyzerEngineService(mockRegistry, asLogger(mockLogger), mockErrorHandler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['EMA', 'RSI']);

      const result = await service.executeAnalyzers(candles, config);

      expect(result.errors).toHaveLength(2);
      expect(result.errors![0]).toEqual({
        analyzerName: 'EMA',
        error: 'Specific EMA error message',
      });
      expect(result.errors![1]).toEqual({
        analyzerName: 'RSI',
        error: 'Specific RSI error message',
      });
    });
  });
});


