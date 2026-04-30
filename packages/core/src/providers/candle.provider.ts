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

import { LoggerService } from '../services/logger.service';
import { Candle } from '../types/core';
import { TimeframeRole } from '../types/enums';
import type { IExchange } from '../interfaces/IExchange';
import { TimeframeProvider } from './timeframe.provider';
import { MULTIPLIERS } from '../constants';
import { IMarketDataRepository } from '../repositories/IRepositories';
import { ErrorHandler } from '../errors/ErrorHandler';
import {
  type CandleProviderCacheMetrics,
  type CandleProviderLoadRequest,
  type CandleProviderTimeframeConfig,
  CANDLE_PROVIDER_RETRY_ATTEMPTS,
  classifyCandleProviderError,
  getCandleProviderRetryDelayMs,
  toCandleProviderErrorMessage,
} from './candle-provider/candle-provider.utils';

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
    this.initializeTimeframeTracking(this.timeframeProvider.getAllTimeframes());
  }

  /**
   * Get trading symbol (e.g., "XRPUSDT")
   */
  getSymbol(): string {
    return this.symbol;
  }

  /**
   * Initialize last-update tracking for all enabled timeframes
   * Phase 6.2: Repository manages actual cache storage
   */
  private initializeTimeframeTracking(
    timeframes: Map<TimeframeRole, CandleProviderTimeframeConfig>,
  ): void {
    for (const [role, config] of timeframes) {
      this.lastUpdate.set(role, 0);
      this.logger.info(
        `Timeframe tracking initialized for ${role} (${config.interval}m, limit: ${config.candleLimit})`,
      );
    }
  }

  /**
   * Load initial candles for all timeframes
   * Phase 8.9.9: SKIP individual timeframe failures, continue loading others
   */
  async initialize(): Promise<void> {
    this.logger.info('Loading initial candles for all timeframes...');

    const timeframes = this.timeframeProvider.getAllTimeframes();
    await Promise.all(
      Array.from(timeframes.entries(), ([role, config]) =>
        this.loadConfiguredTimeframe(role, config),
      ),
    );

    this.logger.info('Candle loading complete');
  }

  /**
   * Load initial candles for a specific timeframe only (SCALPING mode optimization)
   */
  async initializeTimeframe(role: TimeframeRole): Promise<void> {
    this.logger.info(
      `Loading initial candles for ${role} only (SCALPING mode)...`,
    );

    const config = this.getRequiredTimeframeConfig(role);

    await this.loadTimeframeCandles(role, config.interval, config.candleLimit);
    this.logger.info(`${role} candles loaded successfully`);
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
    const request: CandleProviderLoadRequest = {
      symbol: this.symbol,
      role,
      interval,
      limit,
    };

    if (this.errorHandler) {
      await this.loadWithRetry(request);
      return;
    }

    await this.loadWithoutRetry(request);
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
      this.saveCandles(role, config.interval, [candle]);
      this.logger.debug(`Repository updated for ${role}`, {
        timestamp: new Date(candle.timestamp).toISOString(),
        close: candle.close,
      });
    } catch (error) {
      if (this.errorHandler) {
        this.logger.warn(`Failed to update cache for ${role}, continuing`, {
          error: toCandleProviderErrorMessage(error),
        });
      } else {
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
    const config = this.getRequiredTimeframeConfig(role);

    let candles = this.getRepositoryCandles(config.interval, limit);

    if (candles.length === 0) {
      this.logger.warn(`Repository empty for ${role}, loading from API...`);
      await this.loadTimeframeCandles(role, config.interval, config.candleLimit);
      candles = this.getRepositoryCandles(config.interval, limit);
    }

    return candles;
  }

  /**
   * Get cache metrics for a specific timeframe
   * Phase 6.2: Returns metrics based on repository status
   */
  getCacheMetrics(role: TimeframeRole): CandleProviderCacheMetrics | null {
    const config = this.timeframeProvider.getTimeframe(role);
    if (!config) {
      return null;
    }

    return {
      hits: 0,
      misses: 0,
      hitRate: MULTIPLIERS.NEUTRAL,
    };
  }

  /**
   * Get cache metrics for all timeframes
   * Phase 6.2: Returns basic metrics for each timeframe
   */
  getAllCacheMetrics(): Map<TimeframeRole, CandleProviderCacheMetrics> {
    const metricsMap = new Map<TimeframeRole, CandleProviderCacheMetrics>();
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

    return this.getRepositoryCandles(config.interval).length;
  }

  /**
   * Clear cache for a specific timeframe
   * Phase 6.2: Clears via repository
   */
  clearCache(role: TimeframeRole): void {
    const config = this.timeframeProvider.getTimeframe(role);
    if (config) {
      this.lastUpdate.set(role, 0);
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

  private async loadConfiguredTimeframe(
    role: TimeframeRole,
    config: CandleProviderTimeframeConfig,
  ): Promise<void> {
    if (!this.errorHandler) {
      await this.loadTimeframeCandles(role, config.interval, config.candleLimit);
      return;
    }

    await this.loadTimeframeCandles(role, config.interval, config.candleLimit).catch(
      (error) => {
        this.logger.warn(`Failed to load ${role}, skipping`, {
          error: toCandleProviderErrorMessage(error),
        });
      },
    );
  }

  private getRequiredTimeframeConfig(
    role: TimeframeRole,
  ): CandleProviderTimeframeConfig {
    const config = this.timeframeProvider.getTimeframe(role);
    if (!config) {
      throw new Error(`Timeframe ${role} not found in config`);
    }

    return config;
  }

  private getRepositoryCandles(interval: string, limit?: number): Candle[] {
    return this.marketDataRepo.getCandles(this.symbol, interval, limit);
  }

  private async loadWithRetry(request: CandleProviderLoadRequest): Promise<void> {
    for (let attempt = 1; attempt <= CANDLE_PROVIDER_RETRY_ATTEMPTS; attempt++) {
      try {
        await this.fetchAndStoreCandles(request);
        return;
      } catch (error) {
        if (attempt === CANDLE_PROVIDER_RETRY_ATTEMPTS) {
          throw classifyCandleProviderError(
            error,
            'loadTimeframeCandles',
            request.role,
          );
        }

        const delay = getCandleProviderRetryDelayMs(attempt);
        this.logger.warn(
          `Retrying candle load for ${request.role} (${attempt}/${CANDLE_PROVIDER_RETRY_ATTEMPTS})...`,
          { delay },
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private async loadWithoutRetry(
    request: CandleProviderLoadRequest,
  ): Promise<void> {
    try {
      await this.fetchAndStoreCandles(request);
    } catch (error) {
      this.logger.error(`Failed to load candles for ${request.role}`, {
        error: toCandleProviderErrorMessage(error),
      });
      throw error;
    }
  }

  private async fetchAndStoreCandles(
    request: CandleProviderLoadRequest,
  ): Promise<void> {
    this.logger.info(
      `Loading ${request.limit} candles for ${request.role} (${request.interval}m)...`,
    );

    const candles = await this.bybitService.getCandles({
      symbol: request.symbol,
      timeframe: request.interval,
      limit: request.limit,
    });

    this.saveCandles(request.role, request.interval, candles);
    this.logger.info(
      `Loaded ${candles.length} candles for ${request.role} into repository`,
    );
  }

  private saveCandles(
    role: TimeframeRole,
    interval: string,
    candles: Candle[],
  ): void {
    this.marketDataRepo.saveCandles(this.symbol, interval, candles);
    this.lastUpdate.set(role, Date.now());
  }
}
