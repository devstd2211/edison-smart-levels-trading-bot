import { IIndicatorCache } from '../types/legacy';
import { IMarketDataRepository } from '../repositories/IRepositories';
import { ErrorHandler, RecoveryStrategy, ErrorLogger } from '../errors/ErrorHandler';
import { LoggerService } from './logger.service';
import {
  createFallbackIndicatorCacheStats,
  createIndicatorCacheStats,
  INDICATOR_CACHE_DEFAULT_TTL_MS,
  INDICATOR_CACHE_INVALID_KEY_MESSAGE,
  INDICATOR_CACHE_INVALID_TTL_MESSAGE,
  INDICATOR_CACHE_INVALID_VALUE_MESSAGE,
  isFiniteIndicatorCacheValue,
  isPositiveIndicatorCacheTtl,
  isValidIndicatorCacheKey,
  type IndicatorCacheMetrics,
  type IndicatorCacheStats,
} from './indicator-cache/indicator-cache.utils';

/**
 * Indicator Cache Service - Phase 6.2 TIER 2
 *
 * Wraps IMarketDataRepository for indicator caching
 * Uses repository's TTL-based expiration instead of manual LRU
 *
 * Features:
 * - Repository-backed storage (Phase 6.1)
 * - TTL-based automatic expiration
 * - Hit/Miss tracking for monitoring cache effectiveness
 * - Backward compatible metrics (local tracking)
 */
export class IndicatorCacheService implements IIndicatorCache {
  private static readonly defaultErrorLogger: ErrorLogger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };

  // Local metrics tracking (for backward compatibility with getStats/resetMetrics)
  private metrics: IndicatorCacheMetrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  private errorHandler: ErrorHandler;
  private logger?: LoggerService;

  constructor(
    private marketDataRepo: IMarketDataRepository,
    logger?: LoggerService,
    errorHandler?: ErrorHandler
  ) {
    this.logger = logger;
    this.errorHandler =
      errorHandler ?? new ErrorHandler((logger as ErrorLogger | undefined) ?? IndicatorCacheService.defaultErrorLogger);
  }

  private handleInvalidKey(message: string): number | null {
    void this.errorHandler.handle(
      new Error(message),
      { strategy: RecoveryStrategy.THROW }
    );
    return null;
  }

  private handleValidationError(message: string): void {
    void this.errorHandler.handle(new Error(message), {
      strategy: RecoveryStrategy.THROW,
    });
  }

  private incrementHits(): void {
    this.metrics.hits += 1;
  }

  private incrementMisses(): void {
    this.metrics.misses += 1;
  }

  private getMetricsSnapshot(): IndicatorCacheMetrics {
    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      evictions: this.metrics.evictions,
    };
  }

  /**
   * Safe logging wrapper - SKIP strategy for all logger errors
   */
  private safeLog(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: Record<string, unknown>,
  ): void {
    if (!this.logger) return;
    try {
      this.logger[level](message, data);
    } catch (error) {
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
    }
  }

  /**
   * Get cached indicator value
   * THROW: Invalid key (null/empty)
   * GRACEFUL_DEGRADE: Repository errors (return null, continue operation)
   * Tracks hit/miss metrics for monitoring
   * @param key - Indicator key (e.g., "RSI-14-1h")
   * @returns Cached value or null if not found/expired
   */
  get(key: string): number | null {
    // THROW: Validate key
    if (!isValidIndicatorCacheKey(key)) {
      return this.handleInvalidKey(INDICATOR_CACHE_INVALID_KEY_MESSAGE);
    }

    try {
      const value = this.marketDataRepo.getIndicator(key);
      if (isFiniteIndicatorCacheValue(value)) {
        this.incrementHits();
        this.safeLog('debug', `Cache hit: ${key}`);
        return value;
      }
      this.incrementMisses();
      return null;
    } catch (error) {
      // GRACEFUL_DEGRADE: Repository error, return null
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      this.safeLog('warn', `Cache get failed for ${key}, returning null`);
      this.incrementMisses();
      return null;
    }
  }

  /**
   * Cache indicator value with TTL
   * THROW: Invalid key or value
   * GRACEFUL_DEGRADE: Repository errors (continue without caching)
   * Repository handles eviction and expiration
   * @param key - Indicator key
   * @param value - Calculated indicator value
   * @param ttlMs - Time to live in milliseconds (default 60s)
   */
  set(key: string, value: number, ttlMs: number = INDICATOR_CACHE_DEFAULT_TTL_MS): void {
    // THROW: Validate inputs
    if (!isValidIndicatorCacheKey(key)) {
      this.handleValidationError(INDICATOR_CACHE_INVALID_KEY_MESSAGE);
      return;
    }

    if (!isFiniteIndicatorCacheValue(value)) {
      this.handleValidationError(INDICATOR_CACHE_INVALID_VALUE_MESSAGE);
      return;
    }

    if (!isPositiveIndicatorCacheTtl(ttlMs)) {
      this.handleValidationError(INDICATOR_CACHE_INVALID_TTL_MESSAGE);
      return;
    }

    try {
      this.marketDataRepo.cacheIndicator(key, value, ttlMs);
      this.safeLog('debug', `Cached indicator: ${key}`, { value, ttl: ttlMs });
    } catch (error) {
      // GRACEFUL_DEGRADE: Repository error, continue without caching
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      this.safeLog('warn', `Cache set failed for ${key}, continuing without cache`);
    }
  }

  /**
   * Invalidate specific cache entry
   * GRACEFUL_DEGRADE: Repository errors (continue operation)
   * SKIP: Logging failures
   * @param key - Indicator key to remove
   */
  invalidate(key: string): void {
    // THROW: Validate key
    if (!isValidIndicatorCacheKey(key)) {
      this.handleValidationError(INDICATOR_CACHE_INVALID_KEY_MESSAGE);
      return;
    }

    try {
      // Clear expired indicators (this will remove old entries including the target if expired)
      this.marketDataRepo.clearExpiredIndicators();
      this.safeLog('debug', `Invalidated cache entry: ${key}`);
    } catch (error) {
      // GRACEFUL_DEGRADE: Repository error, continue
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      this.safeLog('warn', `Cache invalidate failed for ${key}`);
    }
  }

  /**
   * Clear all cache entries
   * GRACEFUL_DEGRADE: Repository errors (continue operation)
   * Called on new candle or on critical error
   */
  clear(): void {
    try {
      this.marketDataRepo.clear();
      this.safeLog('debug', 'Cache cleared');
    } catch (error) {
      // GRACEFUL_DEGRADE: Repository error, continue
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      this.safeLog('warn', 'Cache clear failed, continuing');
    }
  }

  /**
   * Get cache statistics for monitoring
   * GRACEFUL_DEGRADE: Repository stats errors (return safe defaults)
   * SKIP: Logging failures
   * Returns hits, misses, hit rate, and current repository state
   * @returns Statistics object with cache metrics
   */
  getStats(): IndicatorCacheStats {
    try {
      const stats = createIndicatorCacheStats(
        this.getMetricsSnapshot(),
        this.marketDataRepo.getStats(),
      );

      this.safeLog('debug', 'Retrieved cache statistics', { ...stats });
      return stats;
    } catch (error) {
      // GRACEFUL_DEGRADE: Return safe defaults on error
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      this.safeLog('warn', 'Failed to retrieve cache stats, returning defaults');

      return createFallbackIndicatorCacheStats(this.getMetricsSnapshot());
    }
  }

  /**
   * Reset all local metrics (useful for session start)
   * SKIP: Logging failures
   * Note: Repository metrics are not reset (repository is shared resource)
   */
  resetMetrics(): void {
    try {
      this.metrics = {
        hits: 0,
        misses: 0,
        evictions: 0,
      };
      this.safeLog('debug', 'Cache metrics reset');
    } catch (error) {
      // SKIP: Logging error, continue
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
    }
  }
}

