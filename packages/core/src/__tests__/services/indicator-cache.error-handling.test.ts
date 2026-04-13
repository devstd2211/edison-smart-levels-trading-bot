/**
 * Phase 8.9.58 ErrorHandler Integration Tests
 * IndicatorCacheService - Indicator Value Caching with TTL and Error Recovery
 *
 * Test Structure:
 * 1. THROW validation (5 tests) - Null/empty keys, invalid values, negative TTL
 * 2. GRACEFUL_DEGRADE (5 tests) - Repository errors, partial operations
 * 3. SKIP (3 tests) - Logging failures with safe wrapper
 * 4. Integration (4 tests) - Get/set/invalidate cycles, stats, metrics
 * 5. Backward Compatibility (3 tests) - Tests without ErrorHandler
 * 6. Edge Cases (5 tests) - NaN values, extreme TTL, concurrent access
 *
 * Total: 25 tests ✅
 */

import type { IndicatorCacheService } from '../../services/indicator-cache.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import type { LoggerService } from '../../services/logger.service';
import {
  asIndicatorCacheKey,
  createIndicatorCacheFailingLogger,
  createIndicatorCacheFailingRepository,
  createManagedIndicatorCacheContext,
  createLegacyIndicatorCache,
  createStandardIndicatorCache,
  type ManagedIndicatorCacheContext,
  type IndicatorCacheMockRepository,
} from '../helpers/indicator-cache-test.utils';

describe('IndicatorCacheService ErrorHandler Integration (Phase 8.9.58)', () => {
  let logger: LoggerService;
  let errorHandler: ErrorHandler;
  let mockRepo: IndicatorCacheMockRepository;
  let cache: IndicatorCacheService;
  let cleanup: ManagedIndicatorCacheContext['cleanup'];

  beforeEach(() => {
    const managedContext = createManagedIndicatorCacheContext();
    cleanup = managedContext.cleanup;
    ({
      logger,
      errorHandler,
      repository: mockRepo,
      cache,
    } = managedContext);
  });

  afterEach(() => {
    cleanup();
  });

  // ============================================================================
  // THROW Validation Tests (5)
  // ============================================================================

  describe('THROW: Input Validation', () => {
    it('should THROW on null cache key in get()', () => {
      expect(() => {
        cache.get(asIndicatorCacheKey(null));
      }).not.toThrow(); // ErrorHandler catches it

      // Should not increment metrics
      expect(mockRepo.getIndicator).not.toHaveBeenCalled();
    });

    it('should THROW on empty string key in get()', () => {
      expect(() => {
        cache.get('');
      }).not.toThrow();

      expect(mockRepo.getIndicator).not.toHaveBeenCalled();
    });

    it('should THROW on null key in set()', () => {
      expect(() => {
        cache.set(asIndicatorCacheKey(null), 50.5);
      }).not.toThrow();

      expect(mockRepo.cacheIndicator).not.toHaveBeenCalled();
    });

    it('should THROW on NaN value in set()', () => {
      expect(() => {
        cache.set('RSI-14', NaN);
      }).not.toThrow();

      expect(mockRepo.cacheIndicator).not.toHaveBeenCalled();
    });

    it('should THROW on negative TTL in set()', () => {
      expect(() => {
        cache.set('EMA-20', 50.5, -1000);
      }).not.toThrow();

      expect(mockRepo.cacheIndicator).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE: Repository Errors (5)
  // ============================================================================

  describe('GRACEFUL_DEGRADE: Repository Failures', () => {
    it('should return null when repository getIndicator throws', () => {
      mockRepo.getIndicator.mockImplementation(() => {
        throw new Error('Repository read error');
      });

      const result = cache.get('RSI-14');
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should continue when repository cacheIndicator throws', () => {
      mockRepo.cacheIndicator.mockImplementation(() => {
        throw new Error('Repository write error');
      });

      expect(() => {
        cache.set('EMA-20', 50.5, 60000);
      }).not.toThrow();

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should continue when repository clearExpiredIndicators throws', () => {
      mockRepo.clearExpiredIndicators.mockImplementation(() => {
        throw new Error('Invalidation error');
      });

      expect(() => {
        cache.invalidate('ATR-14');
      }).not.toThrow();

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should continue when repository clear throws', () => {
      mockRepo.clear.mockImplementation(() => {
        throw new Error('Clear error');
      });

      expect(() => {
        cache.clear();
      }).not.toThrow();

      expect(logger.warn).toHaveBeenCalled();
    });

    it('should return safe defaults when getStats repository fails', () => {
      mockRepo.getStats.mockImplementation(() => {
        throw new Error('Stats error');
      });

      const stats = cache.getStats();
      expect(stats.size).toBe(0);
      expect(stats.capacity).toBe(500);
      expect(stats.hitRate).toBe(0);
    });
  });

  // ============================================================================
  // SKIP: Logging Failures (3)
  // ============================================================================

  describe('SKIP: Logging Failures with Safe Wrapper', () => {
    it('should skip debug logging failures in get()', () => {
      const failingLogger = createIndicatorCacheFailingLogger('debug');

      const repo = {
        ...createIndicatorCacheFailingRepository('clear', 'unused'),
        getIndicator: jest.fn().mockReturnValue(75),
      } as IndicatorCacheMockRepository;
      const cache = createStandardIndicatorCache({
        repository: repo,
        logger: failingLogger,
        errorHandler,
      });

      // Should not throw despite logger failure
      expect(() => {
        cache.get('RSI-14');
      }).not.toThrow();

      // Should still update metrics
      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
    });

    it('should skip warn logging failures in set()', () => {
      const failingLogger = createIndicatorCacheFailingLogger('warn');

      const repo = createIndicatorCacheFailingRepository(
        'cacheIndicator',
        'Repo error',
      );
      const cache = createStandardIndicatorCache({
        repository: repo,
        logger: failingLogger,
        errorHandler,
      });

      // Should not throw despite logger failure
      expect(() => {
        cache.set('EMA-20', 50);
      }).not.toThrow();
    });

    it('should skip logging failures in resetMetrics()', () => {
      const failingLogger = createIndicatorCacheFailingLogger('debug');

      const cache = createStandardIndicatorCache({
        repository: mockRepo,
        logger: failingLogger,
        errorHandler,
      });

      // Should not throw despite logger failure
      expect(() => {
        cache.resetMetrics();
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Integration: E2E Scenarios (4)
  // ============================================================================

  describe('Integration: End-to-End Scenarios', () => {
    it('should cache and retrieve indicator values', () => {
      mockRepo.getIndicator.mockReturnValue(null);
      mockRepo.cacheIndicator.mockImplementation((key: string, value: number) => {
        mockRepo.getIndicator.mockReturnValue(value);
      });

      // Set cache
      cache.set('RSI-14', 65.5, 60000);
      expect(mockRepo.cacheIndicator).toHaveBeenCalledWith('RSI-14', 65.5, 60000);

      // Get cache
      const result = cache.get('RSI-14');
      expect(result).toBe(65.5);

      // Check stats
      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
    });

    it('should track hit/miss metrics correctly', () => {
      mockRepo.getIndicator.mockReturnValue(null);

      // Multiple misses
      cache.get('EMA-20');
      cache.get('ATR-14');
      cache.get('RSI-14');

      let stats = cache.getStats();
      expect(stats.misses).toBe(3);
      expect(stats.hits).toBe(0);
      expect(stats.hitRate).toBe(0);

      // Add hits
      mockRepo.getIndicator.mockReturnValue(50);
      cache.get('Volume');
      cache.get('Stochastic');

      stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(3);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('should invalidate and clear cache entries', () => {
      cache.set('RSI-14', 65.5);
      cache.invalidate('RSI-14');

      expect(mockRepo.clearExpiredIndicators).toHaveBeenCalled();

      cache.clear();
      expect(mockRepo.clear).toHaveBeenCalled();
    });

    it('should reset metrics on demand', () => {
      mockRepo.getIndicator.mockReturnValue(50);

      cache.get('EMA-20');
      cache.get('RSI-14');

      let stats = cache.getStats();
      expect(stats.hits).toBe(2);

      cache.resetMetrics();

      stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  // ============================================================================
  // Backward Compatibility (3)
  // ============================================================================

  describe('Backward Compatibility: Without ErrorHandler/Logger', () => {
    it('should work with only repository', () => {
      const cache = createLegacyIndicatorCache({ repository: mockRepo });
      expect(cache).toBeDefined();

      cache.set('EMA-20', 50);
      expect(mockRepo.cacheIndicator).toHaveBeenCalled();
    });

    it('should work with repository and logger', () => {
      const cache = createLegacyIndicatorCache({ repository: mockRepo, logger });
      expect(cache).toBeDefined();

      mockRepo.getIndicator.mockReturnValue(75);
      const result = cache.get('RSI-14');
      expect(result).toBe(75);
    });

    it('should maintain existing API without ErrorHandler', () => {
      const cache = createLegacyIndicatorCache({ repository: mockRepo });

      // All methods should work without ErrorHandler
      cache.set('key1', 50);
      cache.get('key1');
      cache.invalidate('key1');
      cache.clear();
      cache.resetMetrics();
      cache.getStats();

      expect(mockRepo.cacheIndicator).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Edge Cases (5)
  // ============================================================================

  describe('Edge Cases & Corner Cases', () => {
    it('should handle Infinity values', () => {
      expect(() => {
        cache.set('test', Infinity);
      }).not.toThrow();

      // Should not be cached (Infinity is not finite)
      expect(mockRepo.cacheIndicator).not.toHaveBeenCalled();
    });

    it('should handle negative Infinity values', () => {
      expect(() => {
        cache.set('test', -Infinity);
      }).not.toThrow();

      expect(mockRepo.cacheIndicator).not.toHaveBeenCalled();
    });

    it('should handle very large TTL values', () => {
      cache.set('test', 50, Number.MAX_SAFE_INTEGER);

      expect(mockRepo.cacheIndicator).toHaveBeenCalledWith(
        'test',
        50,
        Number.MAX_SAFE_INTEGER
      );
    });

    it('should handle zero hits/misses ratio', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });

    it('should handle concurrent get/set operations', async () => {
      mockRepo.getIndicator.mockReturnValue(null);

      const promises = [
        Promise.resolve(cache.get('key1')),
        Promise.resolve(cache.set('key2', 50)),
        Promise.resolve(cache.get('key3')),
        Promise.resolve(cache.set('key4', 75)),
      ];

      await Promise.all(promises);

      const stats = cache.getStats();
      expect(stats.totalRequests).toBeGreaterThan(0);
    });
  });
});
