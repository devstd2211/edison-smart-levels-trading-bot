/**
 * STRATEGY LOADER SERVICE TESTS
 * Tests for loading, parsing, and validating strategy JSON configurations
 */

import { StrategyLoaderService } from '../../services/strategy-loader.service';
import { StrategyLoadError, StrategyParseError } from '../../errors/DomainErrors';
import {
  createManagedStrategyLoaderContext,
  createStrategyLoaderHarness,
  createStrategyLoaderAnalyzer,
  createStrategyLoaderMetadata,
  createStrategyLoaderStrategy,
  type ManagedStrategyLoaderContext,
  writeStrategyLoaderFile,
} from '../helpers/strategy-loader-test.utils';

describe('StrategyLoaderService', () => {
  let tempDir: string;
  let loader: StrategyLoaderService;
  let createLoader: ReturnType<typeof createStrategyLoaderHarness>['createLoader'];
  let context: ManagedStrategyLoaderContext;

  function bindStrategyLoaderContext() {
    let managedContext: ManagedStrategyLoaderContext;

    beforeEach(async () => {
      managedContext = await createManagedStrategyLoaderContext();
    });

    afterEach(async () => {
      await managedContext.cleanup();
    });

    return () => managedContext;
  }

  const getContext = bindStrategyLoaderContext();

  beforeEach(() => {
    context = getContext();
    tempDir = context.tempDir;
    loader = context.loader;
    createLoader = context.createLoader;
  });

  describe('loadStrategy', () => {
    it('should load valid strategy file', async () => {
      const strategy = createStrategyLoaderStrategy({
        metadata: createStrategyLoaderMetadata({ tags: ['test'] }),
      });

      await writeStrategyLoaderFile(tempDir, 'test-strategy.strategy.json', strategy);

      const loaded = await loader.loadStrategy('test-strategy');

      expect(loaded).toEqual(strategy);
      expect(loaded.metadata.name).toBe('Test Strategy');
      expect(loaded.analyzers).toHaveLength(1);
    });

    it('should throw error for non-existent file', async () => {
      const loaderWithoutHandler = createLoader({ withErrorHandler: false });

      await expect(loaderWithoutHandler.loadStrategy('non-existent')).rejects.toThrow(
        StrategyLoadError,
      );
    });

    it('should throw error for invalid JSON', async () => {
      await writeStrategyLoaderFile(tempDir, 'invalid.strategy.json', 'not valid json {[');

      await expect(loader.loadStrategy('invalid')).rejects.toThrow(
        StrategyParseError,
      );
    });
  });

  describe('validation - version', () => {
    it('should require version field', async () => {
      const strategy = {
        ...createStrategyLoaderStrategy(),
        version: undefined,
        analyzers: [],
      };

      await writeStrategyLoaderFile(tempDir, 'no-version.strategy.json', strategy);

      await expect(loader.loadStrategy('no-version')).rejects.toThrow(
        'version must be a number',
      );
    });

    it('should reject non-numeric version', async () => {
      const strategy = createStrategyLoaderStrategy({
        version: 'one',
        analyzers: [],
      });

      await writeStrategyLoaderFile(tempDir, 'string-version.strategy.json', strategy);

      await expect(loader.loadStrategy('string-version')).rejects.toThrow(
        'version must be a number',
      );
    });
  });

  describe('validation - metadata', () => {
    it('should require metadata', async () => {
      const strategy = createStrategyLoaderStrategy({
        metadata: undefined,
        analyzers: [],
      });

      await writeStrategyLoaderFile(tempDir, 'no-metadata.strategy.json', strategy);

      await expect(loader.loadStrategy('no-metadata')).rejects.toThrow(
        'metadata is required',
      );
    });

    it('should require metadata.name', async () => {
      const strategy = createStrategyLoaderStrategy({
        metadata: createStrategyLoaderMetadata({ name: undefined }),
      });

      await writeStrategyLoaderFile(tempDir, 'no-name.strategy.json', strategy);

      await expect(loader.loadStrategy('no-name')).rejects.toThrow(
        'metadata.name is required',
      );
    });

    it('should require metadata.tags as array', async () => {
      const strategy = createStrategyLoaderStrategy({
        metadata: createStrategyLoaderMetadata({
          name: 'Test',
          tags: 'test',
        }),
      });

      await writeStrategyLoaderFile(tempDir, 'bad-tags.strategy.json', strategy);

      await expect(loader.loadStrategy('bad-tags')).rejects.toThrow(
        'metadata.tags must be an array',
      );
    });

    it('should validate backtest results if present', async () => {
      const strategy = createStrategyLoaderStrategy({
        metadata: createStrategyLoaderMetadata({
          name: 'Test',
          backtest: {
            winRate: 1.5,
            profitFactor: 2.0,
            trades: 100,
            period: 'test',
          },
        }),
      });

      await writeStrategyLoaderFile(tempDir, 'bad-backtest.strategy.json', strategy);

      await expect(loader.loadStrategy('bad-backtest')).rejects.toThrow(
        'metadata.backtest.winRate must be a number between 0 and 1',
      );
    });
  });

  describe('validation - analyzers', () => {
    it('should require analyzers array', async () => {
      const strategy = {
        version: 1,
        metadata: createStrategyLoaderMetadata({ name: 'Test' }),
        analyzers: undefined,
      };

      await writeStrategyLoaderFile(tempDir, 'no-analyzers.strategy.json', strategy);

      await expect(loader.loadStrategy('no-analyzers')).rejects.toThrow(
        'analyzers must be a non-empty array',
      );
    });

    it('should reject empty analyzers array', async () => {
      const strategy = {
        version: 1,
        metadata: createStrategyLoaderMetadata({ name: 'Test' }),
        analyzers: [],
      };

      await writeStrategyLoaderFile(tempDir, 'empty-analyzers.strategy.json', strategy);

      await expect(loader.loadStrategy('empty-analyzers')).rejects.toThrow(
        'analyzers must be a non-empty array',
      );
    });

    it('should require analyzer.name', async () => {
      const strategy = {
        version: 1,
        metadata: createStrategyLoaderMetadata({ name: 'Test' }),
        analyzers: [
          {
            enabled: true,
            weight: 0.5,
            priority: 1,
          },
        ],
      };

      await writeStrategyLoaderFile(tempDir, 'no-analyzer-name.strategy.json', strategy);

      await expect(loader.loadStrategy('no-analyzer-name')).rejects.toThrow(
        'analyzers[0].name must be a string',
      );
    });

    it('should reject unknown analyzer', async () => {
      const strategy = {
        version: 1,
        metadata: createStrategyLoaderMetadata({ name: 'Test' }),
        analyzers: [createStrategyLoaderAnalyzer({ name: 'UNKNOWN_ANALYZER' })],
      };

      await writeStrategyLoaderFile(tempDir, 'unknown-analyzer.strategy.json', strategy);

      await expect(loader.loadStrategy('unknown-analyzer')).rejects.toThrow(
        'Unknown analyzer: UNKNOWN_ANALYZER',
      );
    });

    it('should require analyzer.weight between 0 and 1', async () => {
      const strategy = {
        version: 1,
        metadata: createStrategyLoaderMetadata({ name: 'Test' }),
        analyzers: [createStrategyLoaderAnalyzer({ weight: 1.5 })],
      };

      await writeStrategyLoaderFile(tempDir, 'bad-weight.strategy.json', strategy);

      await expect(loader.loadStrategy('bad-weight')).rejects.toThrow(
        'analyzers[0].weight must be a number between 0 and 1',
      );
    });

    it('should require analyzer.priority between 1 and 10', async () => {
      const strategy = {
        version: 1,
        metadata: createStrategyLoaderMetadata({ name: 'Test' }),
        analyzers: [createStrategyLoaderAnalyzer({ priority: 11 })],
      };

      await writeStrategyLoaderFile(tempDir, 'bad-priority.strategy.json', strategy);

      await expect(loader.loadStrategy('bad-priority')).rejects.toThrow(
        'analyzers[0].priority must be a number between 1 and 10',
      );
    });

    it('should detect duplicate analyzers', async () => {
      const strategy = {
        version: 1,
        metadata: createStrategyLoaderMetadata({ name: 'Test' }),
        analyzers: [
          createStrategyLoaderAnalyzer(),
          createStrategyLoaderAnalyzer({ priority: 2 }),
        ],
      };

      await writeStrategyLoaderFile(tempDir, 'duplicate-analyzer.strategy.json', strategy);

      await expect(loader.loadStrategy('duplicate-analyzer')).rejects.toThrow(
        'Duplicate analyzer: EMA_ANALYZER_NEW',
      );
    });

    it('should validate confidence thresholds', async () => {
      const strategy = {
        version: 1,
        metadata: createStrategyLoaderMetadata({ name: 'Test' }),
        analyzers: [createStrategyLoaderAnalyzer({ minConfidence: 150 })],
      };

      await writeStrategyLoaderFile(tempDir, 'bad-confidence.strategy.json', strategy);

      await expect(loader.loadStrategy('bad-confidence')).rejects.toThrow(
        'analyzers[0].minConfidence must be a number between 0 and 100',
      );
    });
  });

  describe('validation - overrides', () => {
    it('should reject unknown indicator override', async () => {
      const strategy = {
        version: 1,
        metadata: createStrategyLoaderMetadata({ name: 'Test' }),
        analyzers: [createStrategyLoaderAnalyzer()],
        indicators: {
          unknownIndicator: {},
        },
      };

      await writeStrategyLoaderFile(tempDir, 'bad-indicator.strategy.json', strategy);

      await expect(loader.loadStrategy('bad-indicator')).rejects.toThrow(
        'Unknown indicator override: unknownIndicator',
      );
    });

    it('should reject unknown filter override', async () => {
      const strategy = {
        version: 1,
        metadata: createStrategyLoaderMetadata({ name: 'Test' }),
        analyzers: [createStrategyLoaderAnalyzer()],
        filters: {
          unknownFilter: {},
        },
      };

      await writeStrategyLoaderFile(tempDir, 'bad-filter.strategy.json', strategy);

      await expect(loader.loadStrategy('bad-filter')).rejects.toThrow(
        'Unknown filter override: unknownFilter',
      );
    });
  });

  describe('getAvailableAnalyzers', () => {
    it('should return sorted list of available analyzers', () => {
      const analyzers = loader.getAvailableAnalyzers();

      expect(analyzers).toContain('EMA_ANALYZER_NEW');
      expect(analyzers).toContain('RSI_ANALYZER_NEW');
      expect(analyzers).toContain('WHALE_ANALYZER_NEW');
      expect(analyzers.length).toBeGreaterThan(20);

      // Should be sorted
      const sorted = [...analyzers].sort();
      expect(analyzers).toEqual(sorted);
    });
  });

  describe('loadAllStrategies', () => {
    it('should load all valid strategies from directory', async () => {
      const strategy1 = {
        version: 1,
        metadata: createStrategyLoaderMetadata({ name: 'Strategy 1' }),
        analyzers: [createStrategyLoaderAnalyzer()],
      };

      const strategy2 = {
        version: 1,
        metadata: createStrategyLoaderMetadata({ name: 'Strategy 2' }),
        analyzers: [createStrategyLoaderAnalyzer({ name: 'RSI_ANALYZER_NEW' })],
      };

      await writeStrategyLoaderFile(tempDir, 'strat1.strategy.json', strategy1);
      await writeStrategyLoaderFile(tempDir, 'strat2.strategy.json', strategy2);

      const loaded = await loader.loadAllStrategies();

      expect(loaded.size).toBe(2);
      expect(loaded.has('strat1')).toBe(true);
      expect(loaded.has('strat2')).toBe(true);
      expect(loaded.get('strat1')?.metadata.name).toBe('Strategy 1');
      expect(loaded.get('strat2')?.metadata.name).toBe('Strategy 2');
    });

    it('should handle empty directory', async () => {
      const loaded = await loader.loadAllStrategies();
      expect(loaded.size).toBe(0);
    });

    it('should skip invalid strategy files', async () => {
      const validStrategy = {
        version: 1,
        metadata: createStrategyLoaderMetadata({ name: 'Valid' }),
        analyzers: [createStrategyLoaderAnalyzer()],
      };

      const invalidStrategy = {
        version: 1,
        // Missing required fields
      };

      await writeStrategyLoaderFile(tempDir, 'valid.strategy.json', validStrategy);
      await writeStrategyLoaderFile(tempDir, 'invalid.strategy.json', invalidStrategy);

      const loaded = await loader.loadAllStrategies();

      // Should load only valid strategy
      expect(loaded.size).toBe(1);
      expect(loaded.has('valid')).toBe(true);
      expect(loaded.has('invalid')).toBe(false);
    });
  });

  describe('integration tests', () => {
    it('should load and validate complete level-trading strategy', async () => {
      const strategy = {
        version: 1,
        metadata: createStrategyLoaderMetadata({
          name: 'Level Trading Strategy',
          description: 'Trade support/resistance levels',
          tags: ['level-trading'],
          backtest: {
            winRate: 0.58,
            profitFactor: 1.92,
            trades: 150,
            period: '2024-01-01 to 2024-12-31',
          },
        }),
        analyzers: [
          createStrategyLoaderAnalyzer({
            name: 'LEVEL_ANALYZER_NEW',
            weight: 0.35,
            minConfidence: 50,
          }),
          createStrategyLoaderAnalyzer({
            weight: 0.30,
            priority: 2,
            minConfidence: 40,
          }),
          createStrategyLoaderAnalyzer({
            name: 'TREND_DETECTOR_ANALYZER_NEW',
            weight: 0.20,
            priority: 3,
            minConfidence: 45,
          }),
          createStrategyLoaderAnalyzer({
            name: 'RSI_ANALYZER_NEW',
            weight: 0.15,
            priority: 4,
            minConfidence: 35,
          }),
        ],
        indicators: {
          ema: {
            fastPeriod: 9,
            slowPeriod: 21,
          },
        },
        filters: {
          blindZone: {
            minSignalsForLong: 2,
            minSignalsForShort: 2,
          },
        },
      };

      await writeStrategyLoaderFile(tempDir, 'level-trading.strategy.json', strategy);

      const loaded = await loader.loadStrategy('level-trading');

      expect(loaded.metadata.name).toBe('Level Trading Strategy');
      expect(loaded.analyzers).toHaveLength(4);
      expect(loaded.analyzers[0].weight).toBe(0.35);
      expect(loaded.indicators?.ema?.fastPeriod).toBe(9);
      expect(loaded.filters?.blindZone?.minSignalsForLong).toBe(2);
    });
  });
});

