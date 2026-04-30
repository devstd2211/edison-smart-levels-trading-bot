export const INDICATOR_CACHE_DEFAULT_TTL_MS = 60_000;
export const INDICATOR_CACHE_CAPACITY = 500;

export const INDICATOR_CACHE_INVALID_KEY_MESSAGE =
  'Indicator cache key must be a non-empty string';
export const INDICATOR_CACHE_INVALID_VALUE_MESSAGE =
  'Indicator cache value must be a finite number';
export const INDICATOR_CACHE_INVALID_TTL_MESSAGE =
  'Indicator cache TTL must be positive';

export interface IndicatorCacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
}

export interface IndicatorCacheStats {
  size: number;
  capacity: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  totalRequests: number;
}

export interface IndicatorCacheRepositoryStats {
  indicatorCount: number;
}

export function isValidIndicatorCacheKey(key: string): boolean {
  return Boolean(key) && typeof key === 'string';
}

export function isFiniteIndicatorCacheValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isPositiveIndicatorCacheTtl(ttlMs: number): boolean {
  return ttlMs > 0;
}

export function createIndicatorCacheStats(
  metrics: IndicatorCacheMetrics,
  repositoryStats: IndicatorCacheRepositoryStats,
): IndicatorCacheStats {
  const totalRequests = metrics.hits + metrics.misses;
  const hitRate = totalRequests > 0 ? (metrics.hits / totalRequests) * 100 : 0;

  return {
    size: repositoryStats.indicatorCount,
    capacity: INDICATOR_CACHE_CAPACITY,
    hits: metrics.hits,
    misses: metrics.misses,
    hitRate: Number(hitRate.toFixed(2)),
    evictions: metrics.evictions,
    totalRequests,
  };
}

export function createFallbackIndicatorCacheStats(
  metrics: IndicatorCacheMetrics,
): IndicatorCacheStats {
  return createIndicatorCacheStats(metrics, { indicatorCount: 0 });
}
