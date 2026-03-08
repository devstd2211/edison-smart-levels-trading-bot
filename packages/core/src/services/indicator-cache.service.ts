import { IIndicatorCache } from '../types/legacy';
import { IMarketDataRepository } from '../repositories/IRepositories';
import { ErrorHandler, RecoveryStrategy, ErrorLogger } from '../errors/ErrorHandler';
import { LoggerService } from './logger.service';

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
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;

  // Optional: TTL for cached indicators (default 60s, overrideable per call)
  private readonly DEFAULT_TTL_MS = 60000; // 1 minute

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
    if (!key || typeof key !== 'string') {
      return this.errorHandler.handle(
        new Error('Indicator cache key must be a non-empty string'),
        { strategy: RecoveryStrategy.THROW }
      ) as unknown as number | null;
    }

    try {
      const value = this.marketDataRepo.getIndicator(key);
      if (value !== null && value !== undefined) {
        this.hits++;
        this.safeLog('debug', `Cache hit: ${key}`);
        return value;
      }
      this.misses++;
      return null;
    } catch (error) {
      // GRACEFUL_DEGRADE: Repository error, return null
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      this.safeLog('warn', `Cache get failed for ${key}, returning null`);
      this.misses++;
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
  set(key: string, value: number, ttlMs: number = this.DEFAULT_TTL_MS): void {
    // THROW: Validate inputs
    if (!key || typeof key !== 'string') {
      this.errorHandler.handle(
        new Error('Indicator cache key must be a non-empty string'),
        { strategy: RecoveryStrategy.THROW }
      );
      return;
    }

    if (typeof value !== 'number' || !isFinite(value)) {
      this.errorHandler.handle(
        new Error('Indicator cache value must be a finite number'),
        { strategy: RecoveryStrategy.THROW }
      );
      return;
    }

    if (ttlMs <= 0) {
      this.errorHandler.handle(
        new Error('Indicator cache TTL must be positive'),
        { strategy: RecoveryStrategy.THROW }
      );
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
    if (!key || typeof key !== 'string') {
      this.errorHandler.handle(
        new Error('Indicator cache key must be a non-empty string'),
        { strategy: RecoveryStrategy.THROW }
      );
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
  getStats(): {
    size: number;
    capacity: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
    totalRequests: number;
  } {
    try {
      const totalRequests = this.hits + this.misses;
      const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;

      // Get repository stats for accurate cache size
      const repoStats = this.marketDataRepo.getStats();

      const stats = {
        size: repoStats.indicatorCount, // Get actual indicator count from repository
        capacity: 500, // Max indicators in repository
        hits: this.hits,
        misses: this.misses,
        hitRate: parseFloat(hitRate.toFixed(2)),
        evictions: this.evictions,
        totalRequests,
      };

      this.safeLog('debug', 'Retrieved cache statistics', stats);
      return stats;
    } catch (error) {
      // GRACEFUL_DEGRADE: Return safe defaults on error
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      this.safeLog('warn', 'Failed to retrieve cache stats, returning defaults');

      return {
        size: 0,
        capacity: 500,
        hits: this.hits,
        misses: this.misses,
        hitRate: 0,
        evictions: this.evictions,
        totalRequests: this.hits + this.misses,
      };
    }
  }

  /**
   * Reset all local metrics (useful for session start)
   * SKIP: Logging failures
   * Note: Repository metrics are not reset (repository is shared resource)
   */
  resetMetrics(): void {
    try {
      this.hits = 0;
      this.misses = 0;
      this.evictions = 0;
      this.safeLog('debug', 'Cache metrics reset');
    } catch (error) {
      // SKIP: Logging error, continue
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
    }
  }
}

