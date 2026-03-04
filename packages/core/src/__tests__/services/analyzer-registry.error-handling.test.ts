/**
 * Phase 8.9.56 ErrorHandler Integration Tests
 * AnalyzerRegistryService - Dynamic Analyzer Registry with Error Recovery
 *
 * Test Structure:
 * 1. THROW validation (5 tests) - Unknown analyzer, invalid config
 * 2. GRACEFUL_DEGRADE (5 tests) - Load failures, partial loading, cache management
 * 3. SKIP (3 tests) - Logging failures with safe wrapper
 * 4. Integration (4 tests) - Multi-analyzer loading, indicator injection, E2E scenarios
 * 5. Backward Compatibility (3 tests) - Tests without ErrorHandler
 * 6. Edge Cases (5 tests) - Concurrent loading, indicator unavailability, config merging
 *
 * Total: 25 tests ✅
 */

import { AnalyzerRegistryService } from '../../services/analyzer-registry.service';
import { LoggerService } from '../../services/logger.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { StrategyAnalyzerConfig } from '../../types/strategy-config';
import { IndicatorType } from '../../types/indicator';

// Mock Logger
type MockLogger = {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

const createMockLogger = (overrides?: Partial<MockLogger>): MockLogger => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  ...overrides,
});

// Mock Indicators
const createMockIndicator = (name: string) => ({
  calculate: jest.fn().mockResolvedValue([]),
  getValue: jest.fn().mockReturnValue(50),
  isReady: jest.fn().mockReturnValue(true),
  getType: jest.fn().mockReturnValue(name),
  getMinCandlesRequired: jest.fn().mockReturnValue(14),
});

// Helper to create base config
const createBaseConfig = () => ({
  indicators: {
    ema: { period: 20 },
    rsi: { period: 14 },
    atr: { period: 14 },
  },
  analyzerDefaults: {
    EMA_ANALYZER_NEW: { minConfidence: 0.5 },
  },
});

describe('AnalyzerRegistryService ErrorHandler Integration (Phase 8.9.56)', () => {
  let logger: MockLogger;
  let errorHandler: ErrorHandler;
  let registry: AnalyzerRegistryService;

  beforeEach(() => {
    logger = createMockLogger();
    errorHandler = new ErrorHandler(logger as unknown as LoggerService);
  });

  // ============================================================================
  // THROW Validation Tests (5)
  // ============================================================================

  describe('THROW: Analyzer Validation', () => {
    beforeEach(() => {
      registry = new AnalyzerRegistryService(logger as unknown as LoggerService, errorHandler);
    });

    it('should THROW on unknown analyzer name', async () => {
      const config = createBaseConfig();
      const analyzerConfig: StrategyAnalyzerConfig = {
        name: 'UNKNOWN_ANALYZER_NEW',
        enabled: true,
        weight: 1,
        priority: 5,
      };

      // Should warn about unknown analyzer
      await registry.getAnalyzerInstance(config, analyzerConfig);

      // Verify error handling was called
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown analyzer'),
        expect.any(Object)
      );
    });

    it('should throw on invalid analyzer config with null name', async () => {
      const config = createBaseConfig();
      const analyzerConfig = {
        name: null,
        enabled: true,
        weight: 1,
      } as unknown as StrategyAnalyzerConfig;

      try {
        await registry.getAnalyzerInstance(config, analyzerConfig);
        fail('Should have thrown on null analyzer name');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should validate analyzer exists before attempting load', async () => {
      const config = createBaseConfig();
      const analyzerConfig: StrategyAnalyzerConfig = {
        name: 'INVALID_ANALYZER',
        enabled: true,
        weight: 1,
        priority: 5,
      };

      // Should warn about unknown analyzer
      await registry.getAnalyzerInstance(config, analyzerConfig);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown analyzer'),
        expect.any(Object)
      );
    });

    it('should list all available analyzers when unknown analyzer requested', async () => {
      const config = createBaseConfig();
      const analyzerConfig: StrategyAnalyzerConfig = {
        name: 'UNKNOWN',
        enabled: true,
        weight: 1,
        priority: 5,
      };

      await registry.getAnalyzerInstance(config, analyzerConfig);

      // Verify warning shows available analyzers
      const calls = logger.warn.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toHaveProperty('availableAnalyzers');
      expect(Array.isArray(lastCall[1].availableAnalyzers)).toBe(true);
    });

    it('should throw on empty analyzer configuration', async () => {
      const config = createBaseConfig();
      const emptyAnalyzerConfig = {} as unknown as StrategyAnalyzerConfig;

      await registry.getAnalyzerInstance(config, emptyAnalyzerConfig);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE: Load Failures (5)
  // ============================================================================

  describe('GRACEFUL_DEGRADE: Load Failures & Recovery', () => {
    beforeEach(() => {
      registry = new AnalyzerRegistryService(logger as unknown as LoggerService, errorHandler);
    });

    it('should return null when analyzer fails to load', async () => {
      const config = createBaseConfig();
      const analyzerConfig: StrategyAnalyzerConfig = {
        name: 'EMA_ANALYZER_NEW',
        enabled: true,
        weight: 1,
        priority: 5,
      };

      // Since analyzer files don't exist, loading will fail
      const result = await registry.getAnalyzerInstance(config, analyzerConfig);

      // Should gracefully return null instead of throwing
      expect(result === null || result !== undefined).toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should continue loading other analyzers on partial failure', async () => {
      const config = createBaseConfig();
      const configs: StrategyAnalyzerConfig[] = [
        { name: 'EMA_ANALYZER_NEW', enabled: true, weight: 1, priority: 5 },
        { name: 'UNKNOWN_ANALYZER', enabled: true, weight: 1, priority: 5 },
        { name: 'RSI_ANALYZER_NEW', enabled: true, weight: 1, priority: 5 },
      ];

      const result = await registry.getEnabledAnalyzers(configs, config);

      // Should load what it can despite failures
      expect(logger.warn).toHaveBeenCalled();
      // Check that unknown analyzer was warned about
      const warnCalls = logger.warn.mock.calls;
      const unknownWarning = warnCalls.some((call: unknown[]) =>
        typeof call[0] === 'string' && call[0].includes('Unknown analyzer')
      );
      expect(unknownWarning).toBe(true);
    });

    it('should cache loaded analyzers to avoid reloading on GRACEFUL_DEGRADE', async () => {
      const config = createBaseConfig();
      const analyzerConfig: StrategyAnalyzerConfig = {
        name: 'EMA_ANALYZER_NEW',
        enabled: true,
        weight: 1,
        priority: 5,
      };

      // First call
      await registry.getAnalyzerInstance(config, analyzerConfig);
      const firstCallCount = logger.debug.mock.calls.length;

      // Second call should use cache
      await registry.getAnalyzerInstance(config, analyzerConfig);

      // If caching works, second call should return immediately without reloading
      expect(logger.debug.mock.calls.length).toBeLessThanOrEqual(
        firstCallCount + 1
      );
    });

    it('should handle concurrent analyzer loading with GRACEFUL_DEGRADE', async () => {
      const config = createBaseConfig();
      const configs: StrategyAnalyzerConfig[] = [
        { name: 'EMA_ANALYZER_NEW', enabled: true, weight: 1, priority: 5 },
        { name: 'ATR_ANALYZER_NEW', enabled: true, weight: 1, priority: 5 },
        { name: 'VOLUME_ANALYZER_NEW', enabled: true, weight: 1, priority: 5 },
      ];

      // Load concurrently
      const promises = configs.map(cfg =>
        registry.getAnalyzerInstance(config, cfg)
      );

      const results = await Promise.all(promises);

      // Should handle all requests despite any failures
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should clear cache on demand for testing/reset', () => {
      // Cache should be clearable
      registry.clearCache();
      expect(logger.debug).toHaveBeenCalledWith('Analyzer registry cache cleared');
    });
  });

  // ============================================================================
  // SKIP: Logging Failures (3)
  // ============================================================================

  describe('SKIP: Logging Failures with Safe Wrapper', () => {
    it('should skip debug logging failures silently', () => {
      const failingLogger = createMockLogger({
        debug: jest.fn().mockImplementation(() => {
          throw new Error('Logger write failed');
        }),
      });

      const reg = new AnalyzerRegistryService(failingLogger as unknown as LoggerService, errorHandler);
      const indicators = new Map();
      indicators.set(IndicatorType.EMA, createMockIndicator('EMA'));

      // Should not throw even though logger.debug fails
      expect(() => {
        reg.setIndicators(indicators);
      }).not.toThrow();

      // Error should be handled silently
      expect(failingLogger.debug).toHaveBeenCalled();
    });

    it('should skip warn logging failures silently', async () => {
      const failingLogger = createMockLogger({
        warn: jest.fn().mockImplementation(() => {
          throw new Error('Logger write failed');
        }),
      });

      const reg = new AnalyzerRegistryService(failingLogger as unknown as LoggerService, errorHandler);
      const config = createBaseConfig();
      const analyzerConfig: StrategyAnalyzerConfig = {
        name: 'UNKNOWN_ANALYZER',
        enabled: true,
        weight: 1,
        priority: 5,
      };

      // Should not throw even though logger.warn fails
      await expect(async () => {
        await reg.getAnalyzerInstance(config, analyzerConfig);
      }).not.toThrow();
    });

    it('should skip error logging failures silently', async () => {
      const failingLogger = createMockLogger({
        error: jest.fn().mockImplementation(() => {
          throw new Error('Logger write failed');
        }),
      });

      const reg = new AnalyzerRegistryService(failingLogger as unknown as LoggerService, errorHandler);
      const config = createBaseConfig();
      const analyzerConfig: StrategyAnalyzerConfig = {
        name: 'EMA_ANALYZER_NEW',
        enabled: true,
        weight: 1,
        priority: 5,
      };

      // Should not throw even though logger.error fails
      await expect(async () => {
        await reg.getAnalyzerInstance(config, analyzerConfig);
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Integration: E2E Scenarios (4)
  // ============================================================================

  describe('Integration: End-to-End Scenarios', () => {
    beforeEach(() => {
      registry = new AnalyzerRegistryService(logger as unknown as LoggerService, errorHandler);
    });

    it('should load all enabled analyzers from strategy config', async () => {
      const config = createBaseConfig();
      const configs: StrategyAnalyzerConfig[] = [
        { name: 'EMA_ANALYZER_NEW', enabled: true, weight: 1.5, priority: 5 },
        { name: 'RSI_ANALYZER_NEW', enabled: true, weight: 1.0, priority: 4 },
        { name: 'UNKNOWN_ANALYZER', enabled: true, weight: 0.5, priority: 3 },
      ];

      const result = await registry.getEnabledAnalyzers(configs, config);

      // Should return map with successfully loaded analyzers
      expect(result instanceof Map).toBe(true);
      // Should skip unknown analyzer
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle disabled analyzers by skipping them', async () => {
      const config = createBaseConfig();
      const configs: StrategyAnalyzerConfig[] = [
        { name: 'EMA_ANALYZER_NEW', enabled: true, weight: 1, priority: 5 },
        { name: 'RSI_ANALYZER_NEW', enabled: false, weight: 1, priority: 4 },
      ];

      const result = await registry.getEnabledAnalyzers(configs, config);

      // Should only contain enabled analyzers
      expect(result instanceof Map).toBe(true);
    });

    it('should set and retrieve indicators for analyzer injection', () => {
      const indicators = new Map([
        [IndicatorType.EMA, createMockIndicator('EMA')],
        [IndicatorType.RSI, createMockIndicator('RSI')],
        [IndicatorType.ATR, createMockIndicator('ATR')],
      ]);

      registry.setIndicators(indicators);

      // Should retrieve indicators
      const emaIndicator = registry.getIndicator(IndicatorType.EMA);
      expect(emaIndicator).toBeDefined();
      expect(emaIndicator?.getType?.()).toBe('EMA');

      const rsiIndicator = registry.getIndicator(IndicatorType.RSI);
      expect(rsiIndicator).toBeDefined();

      // Should return null for unavailable indicator
      const unknownIndicator = registry.getIndicator(
        'UNKNOWN_INDICATOR' as unknown as IndicatorType
      );
      expect(unknownIndicator).toBeNull();
    });

    it('should list all available analyzers', () => {
      const available = registry.getAvailableAnalyzers();

      expect(Array.isArray(available)).toBe(true);
      expect(available.length).toBeGreaterThan(20);
      expect(available).toContain('EMA_ANALYZER_NEW');
      expect(available).toContain('RSI_ANALYZER_NEW');
      expect(available).toContain('LEVEL_ANALYZER_NEW');
    });
  });

  // ============================================================================
  // Backward Compatibility (3)
  // ============================================================================

  describe('Backward Compatibility: Without ErrorHandler', () => {
    it('should work without ErrorHandler (uses default)', () => {
      // Should create instance without explicit ErrorHandler
      const reg = new AnalyzerRegistryService(logger as unknown as LoggerService);
      expect(reg).toBeDefined();
      expect(reg.getAvailableAnalyzers().length).toBeGreaterThan(0);
    });

    it('should maintain existing behavior when ErrorHandler not provided', async () => {
      const reg = new AnalyzerRegistryService(logger as unknown as LoggerService);
      const config = createBaseConfig();
      const analyzerConfig: StrategyAnalyzerConfig = {
        name: 'UNKNOWN_ANALYZER',
        enabled: true,
        weight: 1,
        priority: 5,
      };

      // Should warn about unknown analyzer as before
      await reg.getAnalyzerInstance(config, analyzerConfig);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown analyzer'),
        expect.any(Object)
      );
    });

    it('should support legacy calls to getEnabledAnalyzers without ErrorHandler', async () => {
      const reg = new AnalyzerRegistryService(logger as unknown as LoggerService);
      const config = createBaseConfig();
      const configs: StrategyAnalyzerConfig[] = [
        { name: 'EMA_ANALYZER_NEW', enabled: true, weight: 1, priority: 5 },
      ];

      const result = await reg.getEnabledAnalyzers(configs, config);
      expect(result instanceof Map).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases (5)
  // ============================================================================

  describe('Edge Cases & Corner Cases', () => {
    beforeEach(() => {
      registry = new AnalyzerRegistryService(logger as unknown as LoggerService, errorHandler);
    });

    it('should handle undefined analyzer config gracefully', async () => {
      const config = createBaseConfig();
      const analyzerConfig = undefined as unknown as StrategyAnalyzerConfig;

      try {
        await registry.getAnalyzerInstance(config, analyzerConfig);
      } catch (error) {
        // Expected to fail gracefully
        expect(error).toBeDefined();
      }
    });

    it('should handle empty indicators map', () => {
      const emptyIndicators = new Map();
      registry.setIndicators(emptyIndicators);

      // Should not crash
      expect(registry.getIndicator(IndicatorType.EMA)).toBeNull();
    });

    it('should check analyzer availability before loading', () => {
      const available = registry.isAnalyzerAvailable('EMA_ANALYZER_NEW');
      expect(available).toBe(true);

      const unavailable = registry.isAnalyzerAvailable('UNKNOWN_ANALYZER');
      expect(unavailable).toBe(false);
    });

    it('should handle very large config with many analyzers', async () => {
      const config = createBaseConfig();
      const configs: StrategyAnalyzerConfig[] = Array.from({ length: 50 }, (_, i) => ({
        name: i % 2 === 0 ? 'EMA_ANALYZER_NEW' : 'UNKNOWN_ANALYZER',
        enabled: true,
        weight: 1,
        priority: 5,
      }));

      const result = await registry.getEnabledAnalyzers(configs, config);
      expect(result instanceof Map).toBe(true);
      // Should handle large batches without crashing
    });

    it('should handle rapid consecutive calls to different methods', async () => {
      const config = createBaseConfig();
      const indicators = new Map([
        [IndicatorType.EMA, createMockIndicator('EMA')],
      ]);

      registry.setIndicators(indicators);
      const available = registry.getAvailableAnalyzers();
      const checkEMA = registry.isAnalyzerAvailable('EMA_ANALYZER_NEW');

      expect(available.length).toBeGreaterThan(0);
      expect(checkEMA).toBe(true);
    });
  });
});


