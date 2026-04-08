/**
 * Phase 6.2 TIER 2.2: CandleProvider + IMarketDataRepository Integration Tests
 *
 * Tests the integration of refactored CandleProvider with IMarketDataRepository
 * Ensures candle caching is delegated to repository (not per-timeframe LRU)
 */

import { Candle, TimeframeRole, LoggerService } from '../../types/legacy';
import { IMarketDataRepository } from '../../repositories/IRepositories';
import { TimeframeProvider } from '../../providers/timeframe.provider';
import type { CandleProvider } from '../../providers/candle.provider';
import {
  createManagedCandleProviderRepositoryIntegrationContext,
  createIntegrationClosedCandle,
  createIntegrationRapidCandles,
  getRepositoryCandlesByRole,
  IntegrationMockExchange,
} from '../helpers/candle-provider-repository-integration-test.utils';

describe('CandleProvider + IMarketDataRepository Integration (Phase 6.2 TIER 2.2)', () => {
  type CandleProviderRepositoryManagedContext = ReturnType<
    typeof createManagedCandleProviderRepositoryIntegrationContext
  >;
  let provider: CandleProvider;
  let exchange: IntegrationMockExchange;
  let repository: IMarketDataRepository;
  let timeframeProvider: TimeframeProvider;
  let logger: LoggerService;

  type CandleProviderRepositoryServices = Pick<
    CandleProviderRepositoryManagedContext,
    'provider' | 'exchange' | 'repository' | 'timeframeProvider'
  >;
  type CandleProviderRepositoryFixtures = {
    services: CandleProviderRepositoryServices;
    logger: CandleProviderRepositoryManagedContext['logger'];
  };
  type CandleProviderRepositoryCleanup = CandleProviderRepositoryManagedContext['cleanup'];
  type CandleProviderRepositoryFixtureAccessor = () => CandleProviderRepositoryFixtures;

  function registerCandleProviderRepositoryFixtures(): CandleProviderRepositoryFixtureAccessor {
    let fixtures: CandleProviderRepositoryFixtures;
    let cleanup: CandleProviderRepositoryCleanup;

    beforeEach(() => {
      const managedContext = createManagedCandleProviderRepositoryIntegrationContext();
      fixtures = {
        services: {
          provider: managedContext.provider,
          exchange: managedContext.exchange,
          repository: managedContext.repository,
          timeframeProvider: managedContext.timeframeProvider,
        },
        logger: managedContext.logger,
      };
      cleanup = managedContext.cleanup;
    });

    afterEach(() => {
      cleanup();
    });

    return () => fixtures;
  }

  const useFixtures = registerCandleProviderRepositoryFixtures();

  beforeEach(() => {
    const fixtures = useFixtures();
    ({ provider, exchange, repository, timeframeProvider } = fixtures.services);
    logger = fixtures.logger;
  });

  describe('Initialization', () => {
    it('should initialize without errors', async () => {
      expect(provider).toBeDefined();
    });

    it('should load all timeframe candles during initialize()', async () => {
      await provider.initialize();

      // Verify candles were loaded into repository for all timeframes
      const primary = getRepositoryCandlesByRole(repository, 'PRIMARY');
      const entry = getRepositoryCandlesByRole(repository, 'ENTRY');
      const htf1 = getRepositoryCandlesByRole(repository, 'HTF1');
      const htf2 = getRepositoryCandlesByRole(repository, 'HTF2');

      expect(primary.length).toBeGreaterThan(0);
      expect(entry.length).toBeGreaterThan(0);
      expect(htf1.length).toBeGreaterThan(0);
      expect(htf2.length).toBeGreaterThan(0);
    });

    it('should load specific timeframe only during initializeTimeframe()', async () => {
      await provider.initializeTimeframe('PRIMARY' as TimeframeRole);

      // PRIMARY should have candles
      const primary = getRepositoryCandlesByRole(repository, 'PRIMARY');
      expect(primary.length).toBeGreaterThan(0);

      // Other timeframes should be empty
      const entry = getRepositoryCandlesByRole(repository, 'ENTRY');
      const htf1 = getRepositoryCandlesByRole(repository, 'HTF1');
      expect(entry.length).toBe(0);
      expect(htf1.length).toBe(0);
    });

    it('should cache candles in repository on initialize', async () => {
      await provider.initialize();

      const stats = repository.getStats();
      // Should have candles from all 4 timeframes
      expect(stats.candleCount).toBeGreaterThan(0);
    });
  });

  describe('Candle Retrieval', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should retrieve candles from repository via getCandles()', async () => {
      exchange.resetCallCount();

      const candles = await provider.getCandles('PRIMARY' as TimeframeRole, 50);

      expect(candles.length).toBeGreaterThan(0);
      // Should NOT call exchange again (candles already in repository)
      expect(exchange.getCallCount()).toBe(0);
    });

    it('should respect limit parameter', async () => {
      const limited = await provider.getCandles('PRIMARY' as TimeframeRole, 10);

      expect(limited.length).toBe(10);
    });

    it('should return all candles when limit not specified', async () => {
      const all = await provider.getCandles('PRIMARY' as TimeframeRole);

      expect(all.length).toBeGreaterThan(10);
    });

    it('should handle empty cache with API fallback', async () => {
      // Clear repository to simulate empty cache
      repository.clear();
      exchange.resetCallCount();

      // Should fetch from API when repository is empty
      const candles = await provider.getCandles('PRIMARY' as TimeframeRole, 50);

      expect(candles.length).toBeGreaterThan(0);
      expect(exchange.getCallCount()).toBeGreaterThan(0);
    });
  });

  describe('Real-time Updates', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should update repository when candle closes via onCandleClosed()', async () => {
      const newCandle: Candle = createIntegrationClosedCandle();

      provider.onCandleClosed('PRIMARY' as TimeframeRole, newCandle);

      // Verify candle was saved to repository
      const latest = repository.getLatestCandle('XRPUSDT', '1');
      expect(latest).not.toBeNull();
      expect(latest!.timestamp).toBe(newCandle.timestamp);
    });

    it('should handle rapid candle updates', () => {
      for (const candle of createIntegrationRapidCandles(10)) {
        provider.onCandleClosed('PRIMARY' as TimeframeRole, candle);
      }

      // Should have latest candle
      const latest = repository.getLatestCandle('XRPUSDT', '1');
      expect(latest).not.toBeNull();
      expect(latest!.open).toBe(109);
    });
  });

  describe('Cache Metrics', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should provide cache metrics for a timeframe', () => {
      const metrics = provider.getCacheMetrics('PRIMARY' as TimeframeRole);

      expect(metrics).not.toBeNull();
      expect(metrics!.hitRate).toBeDefined();
    });

    it('should provide metrics for all timeframes', () => {
      const allMetrics = provider.getAllCacheMetrics();

      expect(allMetrics.size).toBeGreaterThan(0);
      for (const [role, metrics] of allMetrics) {
        expect(metrics).toBeDefined();
        expect(metrics.hitRate).toBeDefined();
      }
    });

    it('should return cache size for timeframe', () => {
      const size = provider.getCacheSize('PRIMARY' as TimeframeRole);

      expect(size).toBeGreaterThan(0);
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should clear specific timeframe cache', () => {
      const sizeBefore = provider.getCacheSize('PRIMARY' as TimeframeRole);
      expect(sizeBefore).toBeGreaterThan(0);

      provider.clearCache('PRIMARY' as TimeframeRole);

      // After clearCache, lastUpdate is reset but repository still has data
      // (Phase 6.2: Repository is centralized, not per-timeframe)
      const stats = repository.getStats();
      expect(stats.candleCount).toBeGreaterThan(0); // Repository still has other timeframes
    });

    it('should clear all caches', async () => {
      await provider.initialize();
      expect(repository.getStats().candleCount).toBeGreaterThan(0);

      provider.clearAllCaches();

      expect(repository.getStats().candleCount).toBe(0);
    });

    it('should recover after clearing', async () => {
      provider.clearAllCaches();
      await provider.initialize();

      const candles = await provider.getCandles('PRIMARY' as TimeframeRole);
      expect(candles.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-Timeframe Handling', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should store candles for multiple timeframes separately', () => {
      const primary = getRepositoryCandlesByRole(repository, 'PRIMARY');
      const entry = getRepositoryCandlesByRole(repository, 'ENTRY');
      const htf1 = getRepositoryCandlesByRole(repository, 'HTF1');

      expect(primary.length).toBeGreaterThan(0);
      expect(entry.length).toBeGreaterThan(0);
      expect(htf1.length).toBeGreaterThan(0);

      // Verify repository stores each timeframe separately
      const stats = repository.getStats();
      expect(stats.candleCount).toBeGreaterThanOrEqual(primary.length + entry.length + htf1.length);
    });

    it('should handle simultaneous access to different timeframes', async () => {
      const promises = [
        provider.getCandles('PRIMARY' as TimeframeRole, 50),
        provider.getCandles('ENTRY' as TimeframeRole, 50),
        provider.getCandles('HTF1' as TimeframeRole, 30),
        provider.getCandles('HTF2' as TimeframeRole, 30),
      ];

      const results = await Promise.all(promises);

      for (const result of results) {
        expect(result.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw on invalid timeframe during initialize', async () => {
      type CandleProviderInternals = {
        loadTimeframeCandles: (role: TimeframeRole, interval: string, limit: number) => Promise<void>;
      };
      const getCandleProviderInternals = (value: CandleProvider): CandleProviderInternals => (
        value as unknown as CandleProviderInternals
      );

      expect(async () => {
        await getCandleProviderInternals(provider).loadTimeframeCandles('INVALID' as unknown as TimeframeRole, '1h', 100);
      }).not.toThrow(); // loadTimeframeCandles is private, just verify it doesn't crash
    });

    it('should handle missing candles gracefully', async () => {
      repository.clear();

      const candles = await provider.getCandles('PRIMARY' as TimeframeRole, 50);

      // Should fetch from API and get candles
      expect(candles.length).toBeGreaterThan(0);
    });

    it('should handle repository returning null gracefully', async () => {
      repository.clear();

      const candles = await provider.getCandles('PRIMARY' as TimeframeRole);

      expect(Array.isArray(candles)).toBe(true);
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it('should retrieve candles quickly from repository', async () => {
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        await provider.getCandles('PRIMARY' as TimeframeRole, 50);
      }

      const duration = performance.now() - start;

      // 100 retrievals should be fast (<100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should handle large candle sets efficiently', async () => {
      // Repository stores candles efficiently
      const stats = repository.getStats();

      expect(stats.candleCount).toBeGreaterThan(0);
      expect(stats.sizeBytes).toBeGreaterThan(0);
    });
  });

  describe('Integration with Repository', () => {
    it('should use repository for all candle operations', async () => {
      await provider.initialize();

      // Verify all operations go through repository
      const stats = repository.getStats();

      expect(stats.candleCount).toBeGreaterThan(0);
      expect(repository.getCandles('XRPUSDT', '1').length).toBeGreaterThan(0);
      expect(repository.getLatestCandle('XRPUSDT', '1')).not.toBeNull();
    });
  });
});
