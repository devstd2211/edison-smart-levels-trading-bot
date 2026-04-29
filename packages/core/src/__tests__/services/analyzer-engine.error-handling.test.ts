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

import type { AnalyzerSignal } from '../../types/strategy';
import { AnalyzerEngineService, AnalyzerExecutionConfig } from '../../services/analyzer-engine.service';
import type { AnalyzerRegistryService } from '../../services/analyzer-registry.service';
import type { IAnalyzer } from '../../types/analyzer';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import {
  createAnalyzerEngineAnalyzers,
  createAnalyzerEngineAnalyzerEntry,
  createAnalyzerEngineFailingRegistry,
  createAnalyzerEngineMockAnalyzer,
  createAnalyzerEngineMockErrorHandler,
  createAnalyzerEngineMockLogger,
  createAnalyzerEngineMockRegistry,
  createManagedAnalyzerEngineSuiteContext,
  type AnalyzerEngineSuiteContext,
  type AnalyzerEngineMockLogger,
} from '../helpers/analyzer-engine-test.utils';

type AnalyzerEngineErrorHandlingSuiteState = Pick<
  AnalyzerEngineSuiteContext,
  'createScenario' | 'cleanup'
>;

// ============================================================================
// MOCK UTILITIES
// ============================================================================

/**
 * Create mock analyzer with configurable behavior
 */
const createMockAnalyzer = createAnalyzerEngineMockAnalyzer;

/**
 * Create mock analyzer registry
 */
const createMockAnalyzerRegistry = createAnalyzerEngineMockRegistry;

const createMockLogger = createAnalyzerEngineMockLogger;
// ============================================================================
// TESTS
// ============================================================================

describe('AnalyzerEngineService Error Handling (Phase 8.9.13)', () => {
  let service: AnalyzerEngineService;
  let mockRegistry: AnalyzerRegistryService;
  let mockLogger: AnalyzerEngineMockLogger;
  let mockErrorHandler: jest.Mocked<ErrorHandler>;
  let createScenario: AnalyzerEngineErrorHandlingSuiteState['createScenario'];
  let cleanup: AnalyzerEngineErrorHandlingSuiteState['cleanup'];

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockErrorHandler = createAnalyzerEngineMockErrorHandler();
    ({ createScenario, cleanup } = createManagedAnalyzerEngineSuiteContext({
      logger: mockLogger,
      errorHandler: mockErrorHandler,
    }));
  });

  afterEach(() => {
    cleanup();
  });

  // ========== SECTION A: Individual Analyzer Failures - SKIP Strategy (5 tests) ==========

  describe('A: Individual Analyzer Failures - SKIP Strategy', () => {
    test('A1: Single analyzer failure does not block other analyzers', async () => {
      const analyzers = createAnalyzerEngineAnalyzers([
        { name: 'EMA', direction: 'LONG' },
        { name: 'RSI', direction: 'SHORT', throwError: new Error('RSI calculation failed') },
        { name: 'ATR', direction: 'LONG' },
      ]);
      const scenario = createScenario(analyzers, {
        analyzerNames: ['EMA', 'RSI', 'ATR'],
      });
      mockRegistry = scenario.registry;
      service = scenario.service;

      const result = await service.executeAnalyzers(scenario.candles, scenario.config);

      expect(result.signals).toHaveLength(2);
      expect(result.analyzersExecuted).toBe(2);
      expect(result.analyzersFailed).toBe(1);
      expect(result.signals.map((s) => s.source)).toEqual(['EMA', 'ATR']);
    });

    test('A2: ErrorHandler.handle called with SKIP strategy for analyzer failures', async () => {
      const analyzers = createAnalyzerEngineAnalyzers([
        { name: 'EMA', direction: 'LONG' },
        { name: 'RSI', direction: 'SHORT', throwError: new Error('RSI calculation failed') },
      ]);
      const scenario = createScenario(analyzers, {
        analyzerNames: ['EMA', 'RSI'],
      });
      mockRegistry = scenario.registry;
      service = scenario.service;

      await service.executeAnalyzers(scenario.candles, scenario.config);

      expect(mockErrorHandler.handle).toHaveBeenCalled();
      const calls = mockErrorHandler.handle.mock.calls;
      const skipCalls = calls.filter((call) => call[1].strategy === RecoveryStrategy.SKIP);
      expect(skipCalls.length).toBeGreaterThan(0);
    });

    test('A3: All analyzers failing still returns empty signals with error tracking', async () => {
      const analyzers = createAnalyzerEngineAnalyzers([
        { name: 'EMA', direction: 'LONG', throwError: new Error('EMA failed') },
        { name: 'RSI', direction: 'SHORT', throwError: new Error('RSI failed') },
      ]);
      const scenario = createScenario(analyzers, {
        analyzerNames: ['EMA', 'RSI'],
      });
      mockRegistry = scenario.registry;
      service = scenario.service;

      const result = await service.executeAnalyzers(scenario.candles, scenario.config);

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

      const scenario = createScenario(analyzers, {
        registry: createMockAnalyzerRegistry(analyzers),
        analyzerNames: ['EMA'],
      });
      mockRegistry = scenario.registry;
      service = scenario.service;

      await service.executeAnalyzers(scenario.candles, scenario.config);

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

      const scenario = createScenario(analyzers, {
        registry: createMockAnalyzerRegistry(analyzers),
        analyzerNames: ['BAD'],
      });
      mockRegistry = scenario.registry;
      service = scenario.service;

      const result = await service.executeAnalyzers(scenario.candles, scenario.config);

      expect(result.signals).toHaveLength(0);
      expect(result.analyzersFailed).toBe(1);
      expect(mockErrorHandler.handle).toHaveBeenCalled();
    });
  });

  // ========== SECTION B: Registry Failures - GRACEFUL_DEGRADE Strategy (4 tests) ==========

  describe('B: Registry Failures - GRACEFUL_DEGRADE Strategy', () => {
    test('B1: Registry failure triggers GRACEFUL_DEGRADE in lenient mode', async () => {
      const mockFailingRegistry = createAnalyzerEngineFailingRegistry(
        new Error('Registry connection failed'),
      );
      const scenario = createScenario(new Map(), {
        registry: mockFailingRegistry,
        analyzerNames: ['EMA'],
      });
      service = scenario.service;
      const executionConfig: AnalyzerExecutionConfig = { errorHandling: 'lenient' };

      const result = await service.executeAnalyzers(
        scenario.candles,
        scenario.config,
        executionConfig,
      );

      expect(result.signals).toHaveLength(0);
      expect(result.errors).toBeDefined();
      expect(mockErrorHandler.handle).toHaveBeenCalled();
      const call = mockErrorHandler.handle.mock.calls[0];
      expect(call[1].strategy).toBe(RecoveryStrategy.GRACEFUL_DEGRADE);
    });

    test('B2: Registry failure returns empty result with error tracking', async () => {
      const mockFailingRegistry = createAnalyzerEngineFailingRegistry(
        new Error('Registry connection failed'),
      );
      const scenario = createScenario(new Map(), {
        registry: mockFailingRegistry,
        analyzerNames: ['EMA'],
      });
      service = scenario.service;
      const executionConfig: AnalyzerExecutionConfig = { errorHandling: 'lenient' };

      const result = await service.executeAnalyzers(
        scenario.candles,
        scenario.config,
        executionConfig,
      );

      expect(result.signals).toHaveLength(0);
      expect(result.analyzersExecuted).toBe(0);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    test('B3: ErrorHandler not called if not provided (backward compatibility)', async () => {
      const mockFailingRegistry = createAnalyzerEngineFailingRegistry(
        new Error('Registry connection failed'),
      );

      const scenario = createScenario(new Map(), {
        registry: mockFailingRegistry,
        analyzerNames: ['EMA'],
        logger: mockLogger,
        errorHandler: undefined,
      });
      service = scenario.service;
      const executionConfig: AnalyzerExecutionConfig = { errorHandling: 'lenient' };

      const result = await service.executeAnalyzers(scenario.candles, scenario.config, executionConfig);

      expect(result.signals).toHaveLength(0);
      expect(result.errors).toBeDefined();
      // No error handler to call
    });

    test('B4: Registry error context includes meaningful info', async () => {
      const mockFailingRegistry = createAnalyzerEngineFailingRegistry(
        new Error('Registry service unavailable'),
      );

      const scenario = createScenario(new Map(), {
        registry: mockFailingRegistry,
        analyzerNames: ['EMA'],
      });
      service = scenario.service;
      const executionConfig: AnalyzerExecutionConfig = { errorHandling: 'lenient' };

      await service.executeAnalyzers(scenario.candles, scenario.config, executionConfig);

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

      const scenario = createScenario(analyzers, {
        analyzerNames: ['EMA', 'RSI'],
      });
      mockRegistry = scenario.registry;
      service = scenario.service;
      const executionConfig: AnalyzerExecutionConfig = { errorHandling: 'strict' };

      // In strict mode with ErrorHandler, still continues (SKIP is non-fatal)
      const result = await service.executeAnalyzers(scenario.candles, scenario.config, executionConfig);
      expect(result.signals).toHaveLength(1);
      expect(result.analyzersFailed).toBe(1);
    });

    test('C2: Lenient mode continues on analyzer failure', async () => {
      const analyzers = createAnalyzerEngineAnalyzers([
        { name: 'EMA', direction: 'LONG' },
        { name: 'RSI', direction: 'SHORT', throwError: new Error('RSI failed') },
      ]);

      const scenario = createScenario(analyzers, {
        analyzerNames: ['EMA', 'RSI'],
      });
      mockRegistry = scenario.registry;
      service = scenario.service;
      const executionConfig: AnalyzerExecutionConfig = { errorHandling: 'lenient' };

      const result = await service.executeAnalyzers(scenario.candles, scenario.config, executionConfig);

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

      const scenario = createScenario(analyzers, {
        registry: createMockAnalyzerRegistry(analyzers),
        analyzerNames: ['EMA', 'RSI'],
        logger: mockLogger,
        errorHandler: undefined,
      });
      mockRegistry = scenario.registry;
      service = scenario.service;

      const result = await service.executeAnalyzers(scenario.candles, scenario.config);

      expect(result.signals).toHaveLength(1);
      expect(result.analyzersFailed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  // ========== SECTION D: Parallel vs Sequential with Errors (2 tests) ==========

  describe('D: Parallel vs Sequential with Errors', () => {
    test('D1: Parallel execution handles multiple concurrent failures gracefully', async () => {
      const analyzers = createAnalyzerEngineAnalyzers([
        { name: 'ANALYZER1', direction: 'LONG', throwError: new Error('Failed') },
        { name: 'ANALYZER2', direction: 'SHORT', throwError: new Error('Failed') },
        { name: 'ANALYZER3', direction: 'LONG' },
      ]);

      const scenario = createScenario(analyzers, {
        analyzerNames: ['ANALYZER1', 'ANALYZER2', 'ANALYZER3'],
      });
      mockRegistry = scenario.registry;
      service = scenario.service;
      const executionConfig: AnalyzerExecutionConfig = { executionMode: 'parallel' };

      const result = await service.executeAnalyzers(scenario.candles, scenario.config, executionConfig);

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

      const scenario = createScenario(analyzers, {
        analyzerNames: ['EMA', 'RSI'],
      });
      mockRegistry = scenario.registry;
      service = scenario.service;
      const executionConfig: AnalyzerExecutionConfig = {
        executionMode: 'sequential',
        errorHandling: 'lenient',
      };

      const result = await service.executeAnalyzers(scenario.candles, scenario.config, executionConfig);

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

      const scenario = createScenario(analyzers, {
        logger: mockLogger,
        errorHandler: mockErrorHandler,
        analyzerNames: ['EMA', 'RSI'],
      });
      mockRegistry = scenario.registry;
      service = scenario.service;

      await service.executeAnalyzers(scenario.candles, scenario.config);

      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
      const calls = mockLogger.warn.mock.calls;
      expect(calls[0][0]).toContain('EMA');
      expect(calls[1][0]).toContain('RSI');
    });

    test('E2: Error information preserved in result.errors for analysis', async () => {
      const analyzers = createAnalyzerEngineAnalyzers([
        { name: 'EMA', direction: 'LONG', throwError: new Error('Specific EMA error message') },
        { name: 'RSI', direction: 'SHORT', throwError: new Error('Specific RSI error message') },
      ]);

      const scenario = createScenario(analyzers, {
        analyzerNames: ['EMA', 'RSI'],
      });
      mockRegistry = scenario.registry;
      service = scenario.service;

      const result = await service.executeAnalyzers(scenario.candles, scenario.config);

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


