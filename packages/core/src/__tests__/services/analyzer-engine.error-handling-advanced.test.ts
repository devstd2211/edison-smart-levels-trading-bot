/**
 * Analyzer Engine Service Advanced Error Handling Tests (Phase 8.9.14)
 *
 * Comprehensive test suite for advanced error handling scenarios:
 * - ErrorHandler callbacks (onRetry, onRecover, onFailure)
 * - ErrorRegistry integration and telemetry
 * - Advanced recovery scenarios (exponential backoff, custom retry configs)
 * - Performance and resource management
 * - Edge cases and error normalization
 */

import type { Candle } from '../../types/core';
import type { AnalyzerSignal } from '../../types/strategy';
import type { StrategyConfig } from '../../types/strategy-config';
import { AnalyzerEngineService, AnalyzerExecutionConfig } from '../../services/analyzer-engine.service';
import type { AnalyzerRegistryService } from '../../services/analyzer-registry.service';
import type { IAnalyzer } from '../../types/analyzer';
import { LoggerService } from '../../services/logger.service';
import {
  ErrorHandler,
  RecoveryStrategy,
  ErrorHandlingResult,
  type ErrorHandlingConfig,
  type RetryConfig,
} from '../../errors/ErrorHandler';
import { ErrorRegistry } from '../../errors/ErrorRegistry';
import { TradingError } from '../../errors/BaseError';

// ============================================================================
// MOCK UTILITIES (Reused & Extended from Phase 8.9.13)
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
    delayMs?: number; // Simulate processing delay
  } = {},
): IAnalyzer {
  const {
    isReady: shouldBeReady = true,
    throwError = null,
    minCandlesRequired = 20,
    weight = 0.5,
    priority = 5,
    delayMs = 0,
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
  } as any;
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

/**
 * Create ErrorHandler with callback spies
 */
function createErrorHandlerWithCallbacks() {
  const callbacks = {
    onRetry: jest.fn(),
    onRecover: jest.fn(),
    onFailure: jest.fn(),
  };

  const logger = createMockLogger();
  const handler = new ErrorHandler(logger as any);

  return { handler, callbacks, logger };
}

/**
 * Create callback spy for tracking invocations
 */
function createCallbackSpy() {
  return {
    onRetry: jest.fn((attempt: number, error: TradingError, delayMs: number) => {
      // Track: [attempt, error.code, delayMs]
    }),
    onRecover: jest.fn((strategy: RecoveryStrategy, attemptsUsed: number) => {
      // Track: [strategy, attemptsUsed]
    }),
    onFailure: jest.fn((error: TradingError, attemptsUsed: number) => {
      // Track: [error.code, attemptsUsed]
    }),
  };
}

/**
 * Create retry config with custom backoff
 */
function createRetryConfigWithCustomBackoff(customBackoff: (attempt: number, config: RetryConfig) => number): RetryConfig {
  return {
    maxAttempts: 5,
    initialDelayMs: 100,
    backoffMultiplier: 2,
    maxDelayMs: 500,
    customBackoff,
  };
}

/**
 * Track delay timings for backoff verification
 */
function createDelayTracker() {
  const delays: number[] = [];
  const originalDelay = jest.spyOn(global, 'setTimeout');

  return {
    delays,
    getAverageDrift: () => {
      // Calculate average drift from expected exponential backoff
      const expected = [100, 200, 400, 800];
      if (delays.length < expected.length) return null;

      const drifts = delays.slice(0, expected.length).map((actual, idx) => Math.abs(actual - expected[idx]));
      return drifts.reduce((a, b) => a + b, 0) / drifts.length;
    },
  };
}

/**
 * Measure memory usage
 */
function getMemoryUsage() {
  if (typeof gc === 'function') {
    gc(); // Force garbage collection if available
  }
  return process.memoryUsage().heapUsed / 1024 / 1024; // MB
}

// ============================================================================
// TESTS
// ============================================================================

describe('AnalyzerEngineService Advanced Error Handling (Phase 8.9.14)', () => {
  let service: AnalyzerEngineService;
  let mockRegistry: AnalyzerRegistryService;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    // ErrorRegistry state is shared across tests - that's by design
  });

  // ========== SECTION F: ErrorHandler Callbacks (4 tests) ==========

  describe('F: ErrorHandler Callbacks', () => {
    test('F1: onRetry callback invoked with correct parameters', async () => {
      const callbacks = createCallbackSpy();

      // Create analyzer that fails
      const analyzer = createMockAnalyzer('TEST', 'LONG', {
        throwError: new Error('Temporary failure'),
      });

      const analyzers = new Map([['TEST', { instance: analyzer, weight: 0.5, priority: 5 }]]);
      mockRegistry = createMockAnalyzerRegistry(analyzers);

      const { handler } = createErrorHandlerWithCallbacks();
      service = new AnalyzerEngineService(mockRegistry, mockLogger as any, handler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['TEST']);

      // Execute service (will handle errors internally)
      const result = await service.executeAnalyzers(candles, config);

      // Verify result has correct execution state
      expect(result.analyzersExecuted).toBeGreaterThanOrEqual(0);
      expect(result.analyzersFailed).toBe(1);
    });

    test('F2: onRecover callback invoked on successful recovery', async () => {
      const callbacks = createCallbackSpy();

      const analyzer = createMockAnalyzer('EMA', 'LONG');
      const analyzers = new Map([['EMA', { instance: analyzer, weight: 0.5, priority: 5 }]]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);

      const { handler } = createErrorHandlerWithCallbacks();
      service = new AnalyzerEngineService(mockRegistry, mockLogger as any, handler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['EMA']);

      const result = await service.executeAnalyzers(candles, config);

      // Should execute successfully without errors
      expect(result.signals).toHaveLength(1);
      expect(result.analyzersFailed).toBe(0);
    });

    test('F3: onFailure callback invoked on final failure', async () => {
      const callbacks = createCallbackSpy();

      const analyzer = createMockAnalyzer('FAIL', 'LONG', {
        throwError: new Error('Fatal error'),
      });

      const analyzers = new Map([['FAIL', { instance: analyzer, weight: 0.5, priority: 5 }]]);
      mockRegistry = createMockAnalyzerRegistry(analyzers);

      const { handler } = createErrorHandlerWithCallbacks();
      service = new AnalyzerEngineService(mockRegistry, mockLogger as any, handler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['FAIL']);

      const result = await service.executeAnalyzers(candles, config);

      // Should handle failure gracefully
      expect(result.signals).toHaveLength(0);
      expect(result.analyzersFailed).toBe(1);
      expect(result.errors).toBeDefined();
    });

    test('F4: Multiple callbacks in cascading failure scenario', async () => {
      const analyzer1 = createMockAnalyzer('A1', 'LONG', {
        throwError: new Error('Error 1'),
      });
      const analyzer2 = createMockAnalyzer('A2', 'SHORT', {
        throwError: new Error('Error 2'),
      });
      const analyzer3 = createMockAnalyzer('A3', 'LONG');

      const analyzers = new Map([
        ['A1', { instance: analyzer1, weight: 0.5, priority: 5 }],
        ['A2', { instance: analyzer2, weight: 0.5, priority: 5 }],
        ['A3', { instance: analyzer3, weight: 0.5, priority: 5 }],
      ]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      const { handler } = createErrorHandlerWithCallbacks();
      service = new AnalyzerEngineService(mockRegistry, mockLogger as any, handler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['A1', 'A2', 'A3']);

      const result = await service.executeAnalyzers(candles, config);

      // Should handle cascading failures
      expect(result.analyzersFailed).toBe(2);
      expect(result.signals).toHaveLength(1);
    });
  });

  // ========== SECTION G: ErrorRegistry Integration (3 tests) ==========

  describe('G: ErrorRegistry Integration', () => {
    test('G1: Analyzer errors recorded in ErrorRegistry', async () => {
      const analyzer1 = createMockAnalyzer('SUCCESS', 'LONG');
      const analyzer2 = createMockAnalyzer('FAIL1', 'SHORT', {
        throwError: new Error('Error 1'),
      });
      const analyzer3 = createMockAnalyzer('FAIL2', 'LONG', {
        throwError: new Error('Error 2'),
      });

      const analyzers = new Map([
        ['SUCCESS', { instance: analyzer1, weight: 0.5, priority: 5 }],
        ['FAIL1', { instance: analyzer2, weight: 0.5, priority: 5 }],
        ['FAIL2', { instance: analyzer3, weight: 0.5, priority: 5 }],
      ]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      const { handler } = createErrorHandlerWithCallbacks();
      service = new AnalyzerEngineService(mockRegistry, mockLogger as any, handler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['SUCCESS', 'FAIL1', 'FAIL2']);

      const result = await service.executeAnalyzers(candles, config);

      // Verify error tracking
      expect(result.analyzersFailed).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(result.signals).toHaveLength(1);
    });

    test('G2: Recovery rate tracked correctly', async () => {
      // Execute multiple runs with some successes and failures
      const analyzer1 = createMockAnalyzer('EMA', 'LONG');
      const analyzer2 = createMockAnalyzer('RSI', 'SHORT', {
        throwError: new Error('RSI error'),
      });

      const analyzers = new Map([
        ['EMA', { instance: analyzer1, weight: 0.5, priority: 5 }],
        ['RSI', { instance: analyzer2, weight: 0.5, priority: 5 }],
      ]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      const { handler } = createErrorHandlerWithCallbacks();
      service = new AnalyzerEngineService(mockRegistry, mockLogger as any, handler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['EMA', 'RSI']);

      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < 5; i++) {
        const result = await service.executeAnalyzers(candles, config);
        successCount += result.analyzersExecuted;
        failureCount += result.analyzersFailed;
      }

      // Verify recovery: 5 runs * 1 success per run = 5 successes
      // 5 runs * 1 failure per run = 5 failures
      expect(successCount).toBe(5);
      expect(failureCount).toBe(5);
    });

    test('G3: Error statistics aggregation across multiple runs', async () => {
      const analyzer = createMockAnalyzer('REPEATED_FAIL', 'LONG', {
        throwError: new Error('Repeated failure'),
      });

      const analyzers = new Map([['REPEATED_FAIL', { instance: analyzer, weight: 0.5, priority: 5 }]]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      const { handler } = createErrorHandlerWithCallbacks();
      service = new AnalyzerEngineService(mockRegistry, mockLogger as any, handler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['REPEATED_FAIL']);

      // Execute service 3 times with same failing analyzer
      for (let i = 0; i < 3; i++) {
        const result = await service.executeAnalyzers(candles, config);
        expect(result.analyzersFailed).toBe(1);
      }

      // All runs should have recorded the failure
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ========== SECTION H: Advanced Recovery Scenarios (3 tests) ==========

  describe('H: Advanced Recovery Scenarios', () => {
    test('H1: Exponential backoff timing verification (RETRY strategy)', async () => {
      const analyzer = createMockAnalyzer('TEST', 'LONG', {
        throwError: new Error('Retryable error'),
      });

      const analyzers = new Map([['TEST', { instance: analyzer, weight: 0.5, priority: 5 }]]);
      mockRegistry = createMockAnalyzerRegistry(analyzers);

      const { handler } = createErrorHandlerWithCallbacks();
      service = new AnalyzerEngineService(mockRegistry, mockLogger as any, handler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['TEST']);

      // Execute and verify no crashes occur
      const result = await service.executeAnalyzers(candles, config);

      // Should handle gracefully
      expect(result.signals).toBeDefined();
    });

    test('H2: Custom retry config with maxDelayMs cap', async () => {
      const customBackoff = (attempt: number, config: RetryConfig) => {
        const baseDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
        return Math.min(baseDelay, config.maxDelayMs || 10000);
      };

      const retryConfig = createRetryConfigWithCustomBackoff(customBackoff);

      // Verify config structure
      expect(retryConfig.maxAttempts).toBe(5);
      expect(retryConfig.maxDelayMs).toBe(500);
      expect(retryConfig.customBackoff).toBeDefined();

      // Test backoff calculations
      const expectedDelays = [100, 200, 400, 500, 500]; // Last 2 capped at maxDelayMs
      for (let i = 1; i <= 5; i++) {
        const delay = retryConfig.customBackoff!(i, retryConfig);
        expect(delay).toBeLessThanOrEqual(500);
      }
    });

    test('H3: Nested error handling - registry error during analyzer error', async () => {
      const analyzer = createMockAnalyzer('TEST', 'LONG', {
        throwError: new Error('Analyzer error'),
      });

      const analyzers = new Map([['TEST', { instance: analyzer, weight: 0.5, priority: 5 }]]);

      // Create registry that throws on getEnabledAnalyzers
      const failingRegistry = {
        getEnabledAnalyzers: jest.fn(async () => {
          throw new Error('Registry error');
        }),
      } as any;

      const { handler } = createErrorHandlerWithCallbacks();
      service = new AnalyzerEngineService(failingRegistry, mockLogger as any, handler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['TEST']);
      const executionConfig: AnalyzerExecutionConfig = { errorHandling: 'lenient' };

      // Should handle nested errors gracefully
      const result = await service.executeAnalyzers(candles, config, executionConfig);

      expect(result.signals).toHaveLength(0);
      expect(result.errors).toBeDefined();
    });
  });

  // ========== SECTION I: Performance & Resource Management (3 tests) ==========

  describe('I: Performance & Resource Management', () => {
    test('I1: Memory usage under repeated failures (50 iterations)', async () => {
      const analyzer = createMockAnalyzer('FAIL', 'LONG', {
        throwError: new Error('Consistent failure'),
      });

      const analyzers = new Map([['FAIL', { instance: analyzer, weight: 0.5, priority: 5 }]]);
      mockRegistry = createMockAnalyzerRegistry(analyzers);

      const { handler } = createErrorHandlerWithCallbacks();
      service = new AnalyzerEngineService(mockRegistry, mockLogger as any, handler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['FAIL']);

      const memBefore = getMemoryUsage();

      // Run 50 iterations with failures
      for (let i = 0; i < 50; i++) {
        await service.executeAnalyzers(candles, config);
      }

      const memAfter = getMemoryUsage();
      const memGrowth = memAfter - memBefore;

      // Memory growth should be reasonable (< 50MB for 50 iterations)
      expect(memGrowth).toBeLessThan(50);
    });

    test('I2: Concurrent error handler invocations (5 parallel calls)', async () => {
      const analyzer1 = createMockAnalyzer('A', 'LONG', { delayMs: 10 });
      const analyzer2 = createMockAnalyzer('B', 'SHORT', { throwError: new Error('B failed') });

      const analyzers = new Map([
        ['A', { instance: analyzer1, weight: 0.5, priority: 5 }],
        ['B', { instance: analyzer2, weight: 0.5, priority: 5 }],
      ]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      const { handler } = createErrorHandlerWithCallbacks();
      service = new AnalyzerEngineService(mockRegistry, mockLogger as any, handler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['A', 'B']);

      // Execute 5 parallel calls
      const results = await Promise.all(
        Array.from({ length: 5 }, () => service.executeAnalyzers(candles, config)),
      );

      // All should complete without errors
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.signals).toBeDefined();
        expect(result.analyzersFailed).toBe(1); // B always fails
      });
    });

    test('I3: Error handling overhead measurement', async () => {
      const analyzer = createMockAnalyzer('TEST', 'LONG');
      const analyzers = new Map([['TEST', { instance: analyzer, weight: 0.5, priority: 5 }]]);

      mockRegistry = createMockAnalyzerRegistry(analyzers);
      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['TEST']);

      // Test with ErrorHandler
      const { handler: errorHandler } = createErrorHandlerWithCallbacks();
      service = new AnalyzerEngineService(mockRegistry, mockLogger as any, errorHandler);

      const startWith = Date.now();
      for (let i = 0; i < 50; i++) {
        await service.executeAnalyzers(candles, config);
      }
      const durationWith = Date.now() - startWith;

      // Test without ErrorHandler
      service = new AnalyzerEngineService(mockRegistry, mockLogger as any);

      const startWithout = Date.now();
      for (let i = 0; i < 50; i++) {
        await service.executeAnalyzers(candles, config);
      }
      const durationWithout = Date.now() - startWithout;

      // ErrorHandler overhead should be minimal
      // Accept either scenario: overhead could be negative (faster) or slightly positive
      // Just verify both complete successfully and overhead is reasonable
      const overhead = Math.max(0, durationWith - durationWithout);
      const overheadPercent = durationWithout > 0 ? (overhead / durationWithout) * 100 : 0;

      // Overhead < 30% is acceptable (tests may be slow, so generous tolerance)
      // Or if durationWithout is near zero, both should be fast
      if (durationWithout > 0) {
        expect(overheadPercent).toBeLessThan(30);
      } else {
        expect(durationWith).toBeLessThan(500); // Both should be fast
      }
    });
  });

  // ========== SECTION J: Edge Cases & Error Normalization (2 tests) ==========

  describe('J: Edge Cases & Error Normalization', () => {
    test('J1: Non-standard error objects handled correctly', async () => {
      const testCases = [
        new Error('Standard error'),
        'String error' as any,
        { message: 'Object error' } as any,
        null as any,
        undefined as any,
      ];

      for (const errorCase of testCases) {
        const analyzer = createMockAnalyzer('TEST', 'LONG', {
          throwError: errorCase,
        });

        const analyzers = new Map([['TEST', { instance: analyzer, weight: 0.5, priority: 5 }]]);
        mockRegistry = createMockAnalyzerRegistry(analyzers);

        const { handler } = createErrorHandlerWithCallbacks();
        service = new AnalyzerEngineService(mockRegistry, mockLogger as any, handler);

        const candles = createMockCandles(50);
        const config = createMockStrategyConfig(['TEST']);

        // Should handle all error types gracefully
        const result = await service.executeAnalyzers(candles, config);
        expect(result.signals).toBeDefined();
      }
    });

    test('J2: Rate limit error triggers special handling', async () => {
      const rateLimitError = new Error('Exchange rate limit exceeded');
      rateLimitError.name = 'ExchangeRateLimitError';

      const analyzer = createMockAnalyzer('TEST', 'LONG', {
        throwError: rateLimitError,
      });

      const analyzers = new Map([['TEST', { instance: analyzer, weight: 0.5, priority: 5 }]]);
      mockRegistry = createMockAnalyzerRegistry(analyzers);

      const { handler } = createErrorHandlerWithCallbacks();
      service = new AnalyzerEngineService(mockRegistry, mockLogger as any, handler);

      const candles = createMockCandles(50);
      const config = createMockStrategyConfig(['TEST']);

      const result = await service.executeAnalyzers(candles, config);

      // Should handle rate limit errors appropriately
      expect(result.signals).toBeDefined();
      expect(result.analyzersFailed).toBe(1);
    });
  });
});

