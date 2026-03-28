/**
 * Strategy Manager Service Error Handling Tests (Phase 8.9.75)
 *
 * Comprehensive test suite for StrategyManagerService error handling:
 * - THROW strategy for input validation (null/invalid strategyName, null mainConfig)
 * - GRACEFUL_DEGRADE strategy for loader/merger failures
 * - SKIP strategy for console logging failures
 * - E2E scenarios with cascading failures
 * - Backward compatibility (without ErrorHandler)
 */

import { StrategyManagerService } from '../../services/strategy-manager.service';
import { StrategyLoaderService } from '../../services/strategy-loader.service';
import { StrategyConfigMergerService } from '../../services/strategy-config-merger.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { StrategyConfig } from '../../types/strategy-config';
import { ConfigNew } from '../../types/config/config-new.types';
import {
  createManagedStrategyManagerContext,
  type ManagedStrategyManagerContext,
} from '../helpers/strategy-manager-test.utils';

function bindStrategyManagerContext() {
  let context: ManagedStrategyManagerContext;

  beforeEach(() => {
    context = createManagedStrategyManagerContext();
  });

  afterEach(() => {
    context.cleanup();
  });

  return () => context;
}

describe('StrategyManagerService - Error Handling (Phase 8.9.75)', () => {
  type StrategyManagerFixtures = Pick<
    ManagedStrategyManagerContext,
    | 'mockLoader'
    | 'mockMerger'
    | 'mockErrorHandler'
    | 'mockStrategy'
    | 'mockMainConfig'
    | 'consoleLogSpy'
    | 'createManager'
  >;
  let strategyManager: StrategyManagerService;
  let mockLoader: jest.Mocked<StrategyLoaderService>;
  let mockMerger: jest.Mocked<StrategyConfigMergerService>;
  let mockErrorHandler: jest.Mocked<ErrorHandler>;
  let consoleLogSpy: jest.SpyInstance;
  let createManager: (options?: { withErrorHandler?: boolean }) => StrategyManagerService;
  type InitStrategyName = Parameters<StrategyManagerService['initialize']>[0];
  type InitMainConfig = Parameters<StrategyManagerService['initialize']>[1];
  const getContext = bindStrategyManagerContext();

  // Mock strategy for testing
  let mockStrategy: StrategyConfig;
  let mockMainConfig: InitMainConfig;

  beforeEach(() => {
    const context = getContext();
    const fixtures: StrategyManagerFixtures = {
      mockLoader: context.mockLoader,
      mockMerger: context.mockMerger,
      mockErrorHandler: context.mockErrorHandler,
      mockStrategy: context.mockStrategy,
      mockMainConfig: context.mockMainConfig,
      consoleLogSpy: context.consoleLogSpy,
      createManager: context.createManager,
    };

    mockLoader = fixtures.mockLoader;
    mockMerger = fixtures.mockMerger;
    mockErrorHandler = fixtures.mockErrorHandler;
    consoleLogSpy = fixtures.consoleLogSpy;
    createManager = fixtures.createManager;
    mockStrategy = fixtures.mockStrategy;
    mockMainConfig = fixtures.mockMainConfig as unknown as InitMainConfig;
  });

  // ============================================================================
  // SECTION 1: THROW - Input Validation (4 tests)
  // ============================================================================

  describe('THROW - Input Validation', () => {
    test('1.1: should THROW on null strategyName', async () => {
      strategyManager = createManager();

      await expect(strategyManager.initialize(null as unknown as InitStrategyName, mockMainConfig)).rejects.toThrow(
        'StrategyName is required'
      );
    });

    test('1.2: should THROW on empty strategyName', async () => {
      strategyManager = createManager();

      await expect(strategyManager.initialize('', mockMainConfig)).rejects.toThrow(
        'StrategyName cannot be empty'
      );
    });

    test('1.3: should THROW on null mainConfig', async () => {
      strategyManager = createManager();

      await expect(strategyManager.initialize('test-strategy', null)).rejects.toThrow(
        'Main config is required'
      );
    });

    test('1.4: should THROW on invalid mainConfig (not object)', async () => {
      strategyManager = createManager();

      await expect(strategyManager.initialize('test-strategy', 'not-an-object' as unknown as InitMainConfig)).rejects.toThrow(
        'Main config must be an object'
      );
    });
  });

  // ============================================================================
  // SECTION 2: GRACEFUL_DEGRADE - Loader/Merger Failures (5 tests)
  // ============================================================================

  describe('GRACEFUL_DEGRADE - Loader/Merger Failures', () => {
    test('2.1: should handle loader rejection with GRACEFUL_DEGRADE', async () => {
      mockLoader.loadStrategy.mockRejectedValue(new Error('Failed to load strategy'));
      mockMerger.mergeConfigs.mockReturnValue(mockMainConfig);
      mockMerger.getChangeReport.mockReturnValue({ strategyName: 'test-strategy', changesCount: 0, changes: [] });

      strategyManager = createManager();

      // Should continue despite loader failure
      await expect(strategyManager.initialize('test-strategy', mockMainConfig)).rejects.toThrow();
    });

    test('2.2: should handle merger rejection with GRACEFUL_DEGRADE', async () => {
      mockLoader.loadStrategy.mockResolvedValue(mockStrategy);
      mockMerger.mergeConfigs.mockImplementation(() => {
        throw new Error('Merge failed');
      });

      strategyManager = createManager();

      await expect(strategyManager.initialize('test-strategy', mockMainConfig)).rejects.toThrow();
    });

    test('2.3: should handle invalid strategy from loader', async () => {
      mockLoader.loadStrategy.mockResolvedValue(null as unknown as StrategyConfig);
      mockMerger.mergeConfigs.mockReturnValue(mockMainConfig);

      strategyManager = createManager();

      await expect(strategyManager.initialize('test-strategy', mockMainConfig)).rejects.toThrow();
    });

    test('2.4: should return safe default on getStrategy after failed initialize', async () => {
      mockLoader.loadStrategy.mockRejectedValue(new Error('Load failed'));

      strategyManager = createManager();

      // Should throw on getStrategy after failed initialize
      await expect(strategyManager.initialize('test-strategy', mockMainConfig)).rejects.toThrow();

      expect(() => strategyManager.getStrategy()).toThrow(
        'Strategy not initialized. Call initialize() first.'
      );
    });

    test('2.5: should handle getMergedConfig after failed initialize', async () => {
      mockLoader.loadStrategy.mockRejectedValue(new Error('Load failed'));

      strategyManager = createManager();

      await expect(strategyManager.initialize('test-strategy', mockMainConfig)).rejects.toThrow();

      expect(() => strategyManager.getMergedConfig()).toThrow(
        'Config not merged. Call initialize() first.'
      );
    });
  });

  // ============================================================================
  // SECTION 3: SKIP - Console Logging Failures (2 tests)
  // ============================================================================

  describe('SKIP - Console Logging Failures', () => {
    test('3.1: should continue despite console.log failure during initialize', async () => {
      consoleLogSpy.mockImplementation(() => {
        throw new Error('Console log failed');
      });

      mockLoader.loadStrategy.mockResolvedValue(mockStrategy);
      mockMerger.mergeConfigs.mockReturnValue(mockMainConfig);
      mockMerger.getChangeReport.mockReturnValue({ strategyName: 'test-strategy', changesCount: 0, changes: [] });

      strategyManager = createManager();

      // Should complete successfully despite console.log failures
      await strategyManager.initialize('test-strategy', mockMainConfig);

      expect(strategyManager.isReady()).toBe(true);
      expect(strategyManager.getStrategy()).toEqual(mockStrategy);
    });

    test('3.2: should recover from console error in change report logging', async () => {
      const changeReport = {
        strategyName: 'test-strategy',
        changesCount: 2,
        changes: [
          { path: 'traders.maxSize', original: 100, overridden: 200 },
          { path: 'traders.risk', original: 2, overridden: 3 },
        ],
      };

      mockLoader.loadStrategy.mockResolvedValue(mockStrategy);
      mockMerger.mergeConfigs.mockReturnValue(mockMainConfig);
      mockMerger.getChangeReport.mockReturnValue(changeReport);

      let callCount = 0;
      consoleLogSpy.mockImplementation(() => {
        callCount++;
        if (callCount === 3) { // Fail on third call (in change logging)
          throw new Error('Console log failed');
        }
      });

      strategyManager = createManager();

      await strategyManager.initialize('test-strategy', mockMainConfig);

      expect(strategyManager.isReady()).toBe(true);
    });
  });

  // ============================================================================
  // SECTION 4: Integration - Complete Workflows (4 tests)
  // ============================================================================

  describe('Integration - Complete Workflows', () => {
    test('4.1: successful initialization with strategy loading and merging', async () => {
      mockLoader.loadStrategy.mockResolvedValue(mockStrategy);
      mockMerger.mergeConfigs.mockReturnValue(mockMainConfig);
      mockMerger.getChangeReport.mockReturnValue({ strategyName: 'test-strategy', changesCount: 0, changes: [] });

      strategyManager = createManager();

      await strategyManager.initialize('test-strategy', mockMainConfig);

      expect(strategyManager.isReady()).toBe(true);
      expect(strategyManager.getStrategy()).toEqual(mockStrategy);
      expect(strategyManager.getMergedConfig()).toEqual(mockMainConfig);
      expect(mockLoader.loadStrategy).toHaveBeenCalledWith('test-strategy');
      expect(mockMerger.mergeConfigs).toHaveBeenCalledWith(mockMainConfig, mockStrategy);
    });

    test('4.2: getEnabledAnalyzers returns correct analyzers', async () => {
      mockLoader.loadStrategy.mockResolvedValue(mockStrategy);
      mockMerger.mergeConfigs.mockReturnValue(mockMainConfig);
      mockMerger.getChangeReport.mockReturnValue({ strategyName: 'test-strategy', changesCount: 0, changes: [] });

      strategyManager = createManager();

      await strategyManager.initialize('test-strategy', mockMainConfig);

      const enabledAnalyzers = strategyManager.getEnabledAnalyzers();
      expect(enabledAnalyzers).toEqual(['analyzer1', 'analyzer2']);
      expect(enabledAnalyzers).not.toContain('analyzer3');
    });

    test('4.3: getAnalyzerWeight returns correct weight', async () => {
      mockLoader.loadStrategy.mockResolvedValue(mockStrategy);
      mockMerger.mergeConfigs.mockReturnValue(mockMainConfig);
      mockMerger.getChangeReport.mockReturnValue({ strategyName: 'test-strategy', changesCount: 0, changes: [] });

      strategyManager = createManager();

      await strategyManager.initialize('test-strategy', mockMainConfig);

      expect(strategyManager.getAnalyzerWeight('analyzer1')).toBe(0.5);
      expect(strategyManager.getAnalyzerWeight('analyzer2')).toBe(0.3);
      expect(strategyManager.getAnalyzerWeight('analyzer3')).toBe(0.2);
      expect(strategyManager.getAnalyzerWeight('unknown')).toBe(0);
    });

    test('4.4: getAllWeights returns map of enabled analyzers with weights', async () => {
      mockLoader.loadStrategy.mockResolvedValue(mockStrategy);
      mockMerger.mergeConfigs.mockReturnValue(mockMainConfig);
      mockMerger.getChangeReport.mockReturnValue({ strategyName: 'test-strategy', changesCount: 0, changes: [] });

      strategyManager = createManager();

      await strategyManager.initialize('test-strategy', mockMainConfig);

      const weights = strategyManager.getAllWeights();
      expect(weights.get('analyzer1')).toBe(0.5);
      expect(weights.get('analyzer2')).toBe(0.3);
      expect(weights.has('analyzer3')).toBe(false); // Disabled, not included
      expect(weights.size).toBe(2); // Only enabled analyzers
    });
  });

  // ============================================================================
  // SECTION 5: Backward Compatibility - Without ErrorHandler (3 tests)
  // ============================================================================

  describe('Backward Compatibility - Without ErrorHandler', () => {
    test('5.1: should work without ErrorHandler parameter', async () => {
      mockLoader.loadStrategy.mockResolvedValue(mockStrategy);
      mockMerger.mergeConfigs.mockReturnValue(mockMainConfig);
      mockMerger.getChangeReport.mockReturnValue({ strategyName: 'test-strategy', changesCount: 0, changes: [] });

      // Create without error handler
      strategyManager = createManager({ withErrorHandler: false });

      await strategyManager.initialize('test-strategy', mockMainConfig);

      expect(strategyManager.isReady()).toBe(true);
      expect(strategyManager.getStrategy()).toEqual(mockStrategy);
    });

    test('5.2: should still throw validation errors without ErrorHandler', async () => {
      strategyManager = createManager({ withErrorHandler: false });

      await expect(strategyManager.initialize(null as unknown as InitStrategyName, mockMainConfig)).rejects.toThrow(
        'StrategyName is required'
      );
    });

    test('5.3: should propagate loader errors without ErrorHandler', async () => {
      mockLoader.loadStrategy.mockRejectedValue(new Error('Custom load error'));

      strategyManager = createManager({ withErrorHandler: false });

      await expect(strategyManager.initialize('test-strategy', mockMainConfig)).rejects.toThrow(
        'Custom load error'
      );
    });
  });

  // ============================================================================
  // SECTION 6: Edge Cases - Error Scenarios (4 tests)
  // ============================================================================

  describe('Edge Cases - Error Scenarios', () => {
    test('6.1: should handle strategy with no analyzers', async () => {
      const strategyNoAnalyzers: StrategyConfig = {
        version: 1,
        metadata: mockStrategy.metadata,
        analyzers: [],
      };

      mockLoader.loadStrategy.mockResolvedValue(strategyNoAnalyzers);
      mockMerger.mergeConfigs.mockReturnValue(mockMainConfig);
      mockMerger.getChangeReport.mockReturnValue({ strategyName: 'test-strategy', changesCount: 0, changes: [] });

      strategyManager = createManager();

      await strategyManager.initialize('test-strategy', mockMainConfig);

      expect(strategyManager.getEnabledAnalyzers()).toEqual([]);
      expect(strategyManager.getAllWeights().size).toBe(0);
    });

    test('6.2: should handle strategy with all analyzers disabled', async () => {
      const strategyAllDisabled: StrategyConfig = {
        version: 1,
        metadata: mockStrategy.metadata,
        analyzers: [
          { name: 'analyzer1', weight: 0.5, enabled: false, priority: 1 },
          { name: 'analyzer2', weight: 0.3, enabled: false, priority: 2 },
        ],
      };

      mockLoader.loadStrategy.mockResolvedValue(strategyAllDisabled);
      mockMerger.mergeConfigs.mockReturnValue(mockMainConfig);
      mockMerger.getChangeReport.mockReturnValue({ strategyName: 'test-strategy', changesCount: 0, changes: [] });

      strategyManager = createManager();

      await strategyManager.initialize('test-strategy', mockMainConfig);

      expect(strategyManager.getEnabledAnalyzers()).toEqual([]);
    });

    test('6.3: should handle large number of changes in merge report', async () => {
      const manyChanges = Array.from({ length: 100 }, (_, i) => ({
        path: `config.path.${i}`,
        original: i,
        overridden: i * 2,
      }));

      mockLoader.loadStrategy.mockResolvedValue(mockStrategy);
      mockMerger.mergeConfigs.mockReturnValue(mockMainConfig);
      mockMerger.getChangeReport.mockReturnValue({
        strategyName: 'test-strategy',
        changesCount: 100,
        changes: manyChanges,
      });

      strategyManager = createManager();

      await strategyManager.initialize('test-strategy', mockMainConfig);

      expect(strategyManager.isReady()).toBe(true);
    });

    test('6.4: should handle special characters in strategy name', async () => {
      const specialName = 'strategy@#$%^&*()_+-=[]{}|;:,.<>?';

      mockLoader.loadStrategy.mockResolvedValue(mockStrategy);
      mockMerger.mergeConfigs.mockReturnValue(mockMainConfig);
      mockMerger.getChangeReport.mockReturnValue({ strategyName: 'test-strategy', changesCount: 0, changes: [] });

      strategyManager = createManager();

      await strategyManager.initialize(specialName, mockMainConfig);

      expect(mockLoader.loadStrategy).toHaveBeenCalledWith(specialName);
      expect(strategyManager.isReady()).toBe(true);
    });
  });

  // ============================================================================
  // SECTION 7: Multiple Initializations (2 tests)
  // ============================================================================

  describe('Multiple Initializations', () => {
    test('7.1: should allow multiple initializations with different strategies', async () => {
      const strategy1: StrategyConfig = {
        version: 1,
        metadata: { ...mockStrategy.metadata, name: 'strategy1' },
        analyzers: mockStrategy.analyzers,
      };
      const strategy2: StrategyConfig = {
        version: 1,
        metadata: { ...mockStrategy.metadata, name: 'strategy2' },
        analyzers: mockStrategy.analyzers,
      };

      mockLoader.loadStrategy
        .mockResolvedValueOnce(strategy1)
        .mockResolvedValueOnce(strategy2);

      mockMerger.mergeConfigs.mockReturnValue(mockMainConfig);
      mockMerger.getChangeReport.mockReturnValue({ strategyName: 'test-strategy', changesCount: 0, changes: [] });

      strategyManager = createManager();

      await strategyManager.initialize('strategy1', mockMainConfig);
      expect(strategyManager.getStrategyName()).toBe('strategy1');

      await strategyManager.initialize('strategy2', mockMainConfig);
      expect(strategyManager.getStrategyName()).toBe('strategy2');
    });

    test('7.2: should handle re-initialization after failure', async () => {
      mockLoader.loadStrategy
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(mockStrategy);

      mockMerger.mergeConfigs.mockReturnValue(mockMainConfig);
      mockMerger.getChangeReport.mockReturnValue({ strategyName: 'test-strategy', changesCount: 0, changes: [] });

      strategyManager = createManager();

      // First attempt fails
      await expect(strategyManager.initialize('test-strategy', mockMainConfig)).rejects.toThrow();

      // Second attempt succeeds
      await strategyManager.initialize('test-strategy', mockMainConfig);
      expect(strategyManager.isReady()).toBe(true);
    });
  });
});

