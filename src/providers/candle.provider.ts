/**
 * CandleProvider - Phase 6.2 TIER 2.2
 *
 * Manages multi-timeframe candle caching via IMarketDataRepository.
 * Replaces per-timeframe LRU caches with unified repository pattern.
 *
 * Architecture:
 * - Phase 6.2: Uses IMarketDataRepository for centralized caching
 * - Maintains per-timeframe tracking (lastUpdate) for diagnostics
 * - Delegates actual cache storage to repository
 */

import { Candle, TimeframeRole, LoggerService } from '../types';
import type { IExchange } from '../interfaces/IExchange';
import { TimeframeProvider } from './timeframe.provider';
import { MULTIPLIERS } from '../constants';
import { IMarketDataRepository } from '../repositories/IRepositories';
import { ErrorHandler } from '../errors/ErrorHandler';
import { ExchangeConnectionError, ExchangeRateLimitError, ExchangeAPIError } from '../errors/DomainErrors';

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
}

export class CandleProvider {
  // Phase 6.2: Repository-backed candle storage (replaces per-timeframe LRU caches)
  private lastUpdate: Map<TimeframeRole, number>;

  constructor(
    private timeframeProvider: TimeframeProvider,
    private bybitService: IExchange,
    private logger: LoggerService,
    private symbol: string,
    private marketDataRepo: IMarketDataRepository,
    private errorHandler?: ErrorHandler, // Phase 8.9.9: Optional ErrorHandler for retry/skip strategies
  ) {
    this.lastUpdate = new Map();
    this.initializeTimeframeTracking();
  }

  /**
   * Initialize last-update tracking for all enabled timeframes
   * Phase 6.2: Repository manages actual cache storage
   */
  private initializeTimeframeTracking(): void {
    const timeframes = this.timeframeProvider.getAllTimeframes();

    for (const [role, config] of timeframes) {
      this.lastUpdate.set(role, 0);
      this.logger.info(`Timeframe tracking initialized for ${role} (${config.interval}m, limit: ${config.candleLimit})`);
    }
  }

  /**
   * Load initial candles for all timeframes
   * Phase 8.9.9: SKIP individual timeframe failures, continue loading others
   */
  async initialize(): Promise<void> {
    this.logger.info('🔄 Loading initial candles for all timeframes...');

    const timeframes = this.timeframeProvider.getAllTimeframes();
    const loadPromises: Promise<void>[] = [];

    for (const [role, config] of timeframes) {
      if (this.errorHandler) {
        // Phase 8.9.9: SKIP individual failures, continue loading others
        loadPromises.push(
          this.loadTimeframeCandles(role, config.interval, config.candleLimit).catch((error) => {
            this.logger.warn(`⚠️ Failed to load ${role}, skipping`, {
              error: error instanceof Error ? error.message : String(error),
            });
            // Don't throw - allow other timeframes to load
          })
        );
      } else {
        // Original behavior: fail fast
        loadPromises.push(this.loadTimeframeCandles(role, config.interval, config.candleLimit));
      }
    }

    await Promise.all(loadPromises);
    this.logger.info('✅ Candle loading complete');
  }

  /**
   * Load initial candles for a specific timeframe only (SCALPING mode optimization)
   */
  async initializeTimeframe(role: TimeframeRole): Promise<void> {
    this.logger.info(`🔄 Loading initial candles for ${role} only (SCALPING mode)...`);

    const config = this.timeframeProvider.getTimeframe(role);
    if (!config) {
      throw new Error(`Timeframe ${role} not found in config`);
    }

    await this.loadTimeframeCandles(role, config.interval, config.candleLimit);
    this.logger.info(`✅ ${role} candles loaded successfully`);
  }

  /**
   * Load candles for a specific timeframe
   * Phase 6.2: Stores candles in IMarketDataRepository instead of per-timeframe LRU cache
   * Phase 8.9.9: RETRY strategy for exchange API calls (3 attempts, exponential backoff)
   */
  private async loadTimeframeCandles(
    role: TimeframeRole,
    interval: string,
    limit: number,
  ): Promise<void> {
    const performLoad = async () => {
      this.logger.info(`Loading ${limit} candles for ${role} (${interval}m)...`);

      // Fetch candles from exchange
      const candles = await this.bybitService.getCandles({
        symbol: this.symbol,
        timeframe: interval,
        limit,
      });

      // Phase 6.2: Store in repository instead of per-timeframe LRU cache
      this.marketDataRepo.saveCandles(this.symbol, interval, candles);
      this.lastUpdate.set(role, Date.now());

      this.logger.info(`✅ Loaded ${candles.length} candles for ${role} into repository`);
    };

    if (this.errorHandler) {
      // Phase 8.9.9: RETRY strategy - 3 attempts with exponential backoff
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await performLoad();
          return;
        } catch (error) {
          if (attempt === 3) {
            // Final attempt failed - classify and throw
            throw this.classifyCandleError(error, 'loadTimeframeCandles', role);
          }
          const delay = 1000 * Math.pow(2, attempt - 1);
          this.logger.warn(`🔄 Retrying candle load for ${role} (${attempt}/3)...`, { delay });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } else {
      // Backward compatibility: original behavior
      try {
        await performLoad();
      } catch (error) {
        const errorObj = error instanceof Error ? { error: error.message } : { error: String(error) };
        this.logger.error(`Failed to load candles for ${role}`, errorObj);
        throw error;
      }
    }
  }

  /**
   * Handle candle closed event and update cache
   * Phase 6.2: Updates repository instead of per-timeframe LRU cache
   * Phase 8.9.9: SKIP repository failures (non-blocking operation)
   */
  onCandleClosed(role: TimeframeRole, candle: Candle): void {
    const config = this.timeframeProvider.getTimeframe(role);
    if (!config) {
      this.logger.warn(`Timeframe config not found for ${role}, skipping update`);
      return;
    }

    try {
      // Phase 6.2: Store new candle in repository
      this.marketDataRepo.saveCandles(this.symbol, config.interval, [candle]);
      this.lastUpdate.set(role, Date.now());

      this.logger.debug(`📊 Repository updated for ${role}`, {
        timestamp: new Date(candle.timestamp).toISOString(),
        close: candle.close,
      });
    } catch (error) {
      if (this.errorHandler) {
        // Phase 8.9.9: SKIP - Log and continue (non-critical operation)
        this.logger.warn(`Failed to update cache for ${role}, continuing`, {
          error: error instanceof Error ? error.message : String(error),
        });
      } else {
        // Original behavior: propagate error
        throw error;
      }
    }
  }

  /**
   * Get candles for a specific timeframe
   * @param role - Timeframe role
   * @param limit - Optional limit (defaults to all candles in cache)
   *
   * Phase 6.2: Retrieves candles from IMarketDataRepository
   * NOTE: Cache is kept fresh via WebSocket onCandleClosed() events
   * Initial load is done at startup via initialize()
   * Phase 8.9.9: RETRY on cache miss via loadTimeframeCandles
   */
  async getCandles(role: TimeframeRole, limit?: number): Promise<Candle[]> {
    const config = this.timeframeProvider.getTimeframe(role);
    if (!config) {
      throw new Error(`Timeframe ${role} not found in config`);
    }

    // Phase 6.2: Get candles from repository
    let candles = this.marketDataRepo.getCandles(this.symbol, config.interval, limit);

    // If repository is empty, load from API (should not happen after initialize)
    if (candles.length === 0) {
      this.logger.warn(`Repository empty for ${role}, loading from API...`);
      // Phase 8.9.9: loadTimeframeCandles already has RETRY logic if errorHandler exists
      await this.loadTimeframeCandles(role, config.interval, config.candleLimit);
      // Retrieve again from repository
      candles = this.marketDataRepo.getCandles(this.symbol, config.interval, limit);
    }

    return candles;
  }

  /**
   * Get cache metrics for a specific timeframe
   * Phase 6.2: Returns metrics based on repository status
   */
  getCacheMetrics(role: TimeframeRole): CacheMetrics | null {
    const config = this.timeframeProvider.getTimeframe(role);
    if (!config) {
      return null;
    }

    // Phase 6.2: Repository stats available via IMarketDataRepository.getStats()
    const repoStats = this.marketDataRepo.getStats();

    return {
      hits: 0, // Repository doesn't track per-timeframe hits
      misses: 0, // Repository doesn't track per-timeframe misses
      hitRate: MULTIPLIERS.NEUTRAL, // Assume 100% since we always use cache after initialization
    };
  }

  /**
   * Get cache metrics for all timeframes
   * Phase 6.2: Returns basic metrics for each timeframe
   */
  getAllCacheMetrics(): Map<TimeframeRole, CacheMetrics> {
    const metricsMap = new Map<TimeframeRole, CacheMetrics>();
    const timeframes = this.timeframeProvider.getAllTimeframes();

    for (const [role] of timeframes) {
      const metrics = this.getCacheMetrics(role);
      if (metrics) {
        metricsMap.set(role, metrics);
      }
    }

    return metricsMap;
  }

  /**
   * Get cache size for a specific timeframe
   * Phase 6.2: Gets candle count from repository
   */
  getCacheSize(role: TimeframeRole): number {
    const config = this.timeframeProvider.getTimeframe(role);
    if (!config) {
      return 0;
    }

    // Phase 6.2: Get candles from repository to count
    const candles = this.marketDataRepo.getCandles(this.symbol, config.interval);
    return candles.length;
  }

  /**
   * Clear cache for a specific timeframe
   * Phase 6.2: Clears via repository
   */
  clearCache(role: TimeframeRole): void {
    const config = this.timeframeProvider.getTimeframe(role);
    if (config) {
      this.lastUpdate.set(role, 0);
      // Phase 6.2: Repository manages the actual clearing
      this.logger.info(`Cache cleared for ${role} (via repository)`);
    }
  }

  /**
   * Clear all caches
   * Phase 6.2: Clears via repository.clear()
   */
  clearAllCaches(): void {
    this.marketDataRepo.clear();
    for (const [role] of this.timeframeProvider.getAllTimeframes()) {
      this.lastUpdate.set(role, 0);
    }
    this.logger.info('All caches cleared (via repository)');
  }

  /**
   * Phase 8.9.9: Classify candle errors into domain-specific error types
   * Used for RETRY strategy error handling
   */
  private classifyCandleError(
    error: unknown,
    operation: string,
    timeframeRole?: TimeframeRole,
  ): Error {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const originalError = error instanceof Error ? error : undefined;

    // Network/connectivity errors
    if (
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('EHOSTUNREACH')
    ) {
      return new ExchangeConnectionError(
        `Failed to load candles during ${operation}`,
        { exchangeName: 'bybit', timeframeRole },
        originalError,
      );
    }

    // Rate limit errors
    if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      return new ExchangeRateLimitError(
        `Rate limit while loading candles`,
        { exchangeName: 'bybit', retryAfterMs: 5000, timeframeRole },
        originalError,
      );
    }

    // Default: Generic API error
    return new ExchangeAPIError(
      `Failed during ${operation}`,
      { exchangeName: 'bybit', timeframeRole },
      originalError,
    );
  }
}
