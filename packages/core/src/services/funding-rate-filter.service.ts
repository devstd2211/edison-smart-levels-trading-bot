import { DECIMAL_PLACES, PERCENT_MULTIPLIER, INTEGER_MULTIPLIERS } from '../constants';
/**
 * Funding Rate Filter Service
 *
 * Filters trading signals based on funding rate to avoid overheated positions.
 *
 * Logic:
 * - Positive funding rate = longs pay shorts → too many longs → risky to LONG
 * - Negative funding rate = shorts pay longs → too many shorts → risky to SHORT
 *
 * Example:
 * - Funding rate = +0.1% → block LONG signals (market too bullish, risk of reversal)
 * - Funding rate = -0.1% → block SHORT signals (market too bearish, risk of reversal)
 *
 * Phase 8.9.32: ErrorHandler Integration
 * - RETRY strategy for API calls (transient network failures)
 * - GRACEFUL_DEGRADE strategy for cache operations (fallback to old cache)
 * - SKIP strategy for logging failures (non-blocking)
 * - Backward compatible (works with or without ErrorHandler)
 */

import { LoggerService, SignalDirection, FundingRateFilterConfig } from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors';
import { FundingRateApiError, FundingRateCacheError } from '../errors/DomainErrors';
import { normalizeError } from '../utils/error.utils';

// ============================================================================
// INTERFACES
// ============================================================================

export interface FundingRateData {
  fundingRate: number; // Current funding rate (e.g., 0.0001 = 0.01%)
  timestamp: number; // Timestamp of funding rate
  nextFundingTime: number; // Next funding timestamp
}

export interface FilterResult {
  allowed: boolean; // Whether signal is allowed
  reason?: string; // Reason for blocking (if blocked)
  fundingRate?: number; // Current funding rate
}

// ============================================================================
// SERVICE
// ============================================================================

export class FundingRateFilterService {
  private cachedFundingRate: FundingRateData | null = null;
  private lastFetchTime: number = 0;

  constructor(
    private config: FundingRateFilterConfig,
    private getFundingRate: () => Promise<FundingRateData>, // Injected Bybit API call
    private logger: LoggerService,
    private readonly errorHandler?: ErrorHandler, // Phase 8.9.32
  ) {}

  private async handleSkipError(error: unknown, context: string): Promise<void> {
    if (!this.errorHandler) {
      return;
    }

    await this.errorHandler.handle(normalizeError(error), {
      strategy: RecoveryStrategy.SKIP,
      context,
    });
  }

  /**
   * Check if signal is allowed based on funding rate
   * Phase 8.9.32: Logger errors are skipped (non-blocking)
   *
   * @param direction - Signal direction (LONG/SHORT)
   * @returns FilterResult with allowed flag and reason
   */
  async checkSignal(direction: SignalDirection): Promise<FilterResult> {
    // Check if filter is enabled
    if (!this.config.enabled) {
      return { allowed: true };
    }

    // Skip if direction is HOLD
    if (direction === SignalDirection.HOLD) {
      return { allowed: true };
    }

    try {
      // Get current funding rate (from cache or API)
      const fundingData = await this.getCurrentFundingRate();
      const fundingRate = fundingData.fundingRate;

      // Check LONG signal
      if (direction === SignalDirection.LONG) {
        if (fundingRate > this.config.blockLongThreshold) {
          // Phase 8.9.32: SKIP logger errors
          try {
            this.logger.warn('🚫 Funding Rate Filter: LONG blocked', {
              fundingRate: (fundingRate * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE) + '%',
              threshold: (this.config.blockLongThreshold * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE) + '%',
              reason: 'Funding too high (too many longs)',
            });
          } catch (logError) {
            await this.handleSkipError(logError, 'FundingRateFilterService.checkSignal.longBlockLogging');
          }

          return {
            allowed: false,
            reason: `Funding rate too high: ${(fundingRate * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE)}% (threshold: ${(this.config.blockLongThreshold * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE)}%)`,
            fundingRate,
          };
        }
      }

      // Check SHORT signal
      if (direction === SignalDirection.SHORT) {
        if (fundingRate < this.config.blockShortThreshold) {
          // Phase 8.9.32: SKIP logger errors
          try {
            this.logger.warn('🚫 Funding Rate Filter: SHORT blocked', {
              fundingRate: (fundingRate * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE) + '%',
              threshold: (this.config.blockShortThreshold * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE) + '%',
              reason: 'Funding too low (too many shorts)',
            });
          } catch (logError) {
            await this.handleSkipError(logError, 'FundingRateFilterService.checkSignal.shortBlockLogging');
          }

          return {
            allowed: false,
            reason: `Funding rate too low: ${(fundingRate * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE)}% (threshold: ${(this.config.blockShortThreshold * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE)}%)`,
            fundingRate,
          };
        }
      }

      // Signal allowed - Phase 8.9.32: SKIP logger errors
      try {
        this.logger.debug('✅ Funding Rate Filter: Signal allowed', {
          direction,
          fundingRate: (fundingRate * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE) + '%',
        });
      } catch (logError) {
        await this.handleSkipError(logError, 'FundingRateFilterService.checkSignal.allowedLogging');
      }

      return {
        allowed: true,
        fundingRate,
      };
    } catch (error) {
      // Phase 8.9.32: SKIP logger errors
      try {
        this.logger.error('Error checking funding rate filter', { error });
      } catch (logError) {
        await this.handleSkipError(logError, 'FundingRateFilterService.checkSignal.errorLogging');
      }
      // Allow signal if filter fails (fail-safe)
      return { allowed: true, reason: 'Filter error (allowed by default)' };
    }
  }

  /**
   * Get current funding rate (from cache or API)
   * Phase 8.9.32: Uses RETRY for API calls + GRACEFUL_DEGRADE for cache
   *
   * @returns FundingRateData
   */
  private async getCurrentFundingRate(): Promise<FundingRateData> {
    const now = Date.now();

    // Check if cache is valid
    if (
      this.cachedFundingRate &&
      now - this.lastFetchTime < this.config.cacheTimeMs
    ) {
      // Phase 8.9.32: SKIP logger errors (non-blocking)
      try {
        this.logger.debug('📦 Using cached funding rate', {
          fundingRate: (this.cachedFundingRate.fundingRate * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE) + '%',
          cacheAge: Math.floor((now - this.lastFetchTime) / INTEGER_MULTIPLIERS.ONE_THOUSAND) + 's',
        });
      } catch (error) {
        await this.handleSkipError(error, 'FundingRateFilterService.getCurrentFundingRate.cacheLogging');
      }
      return this.cachedFundingRate;
    }

    // Fetch from API - Phase 8.9.32: RETRY strategy with exponential backoff
    try {
      this.logger.debug('🔄 Fetching funding rate from API');
    } catch (error) {
      await this.handleSkipError(error, 'FundingRateFilterService.getCurrentFundingRate.fetchLogging');
    }

    let fundingData: FundingRateData;

    if (this.errorHandler) {
      // Phase 8.9.32: RETRY strategy for API calls (3 attempts with exponential backoff)
      const result = await ErrorHandler.executeAsync(
        () => this.getFundingRate(),
        {
          strategy: RecoveryStrategy.RETRY,
          retryConfig: {
            maxAttempts: 3,
            initialDelayMs: 100,
            backoffMultiplier: 2,
            maxDelayMs: 1000,
          },
          context: 'FundingRateFilterService.getCurrentFundingRate.apiCall',
        },
      );

      if (result.success && result.value) {
        fundingData = result.value;
      } else if (this.cachedFundingRate) {
        // Phase 8.9.32: GRACEFUL_DEGRADE to fallback to old cache if available
        try {
          this.logger.warn('⚠️ Funding rate API failed, using degraded cache', {
            error: result.error?.message || 'Unknown error',
            cacheAge: Math.floor((now - this.lastFetchTime) / INTEGER_MULTIPLIERS.ONE_THOUSAND) + 's',
          });
        } catch (logError) {
          // SKIP logger errors
        }
        return this.cachedFundingRate; // GRACEFUL_DEGRADE: return old cache
      } else {
        // No cache and API failed
        throw result.error || new FundingRateApiError('Failed to fetch funding rate and no cache available', {
          reason: 'API request failed',
        });
      }
    } else {
      // Backward compatibility: no ErrorHandler, use original behavior
      fundingData = await this.getFundingRate();
    }

    // Update cache
    try {
      this.cachedFundingRate = fundingData;
      this.lastFetchTime = now;
    } catch (error) {
      // Phase 8.9.32: GRACEFUL_DEGRADE on cache write failure
      if (this.errorHandler) {
        await this.errorHandler.handle(
          new FundingRateCacheError('Failed to update funding rate cache', {
            operation: 'set',
            reason: error instanceof Error ? error.message : String(error),
          }),
          {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'FundingRateFilterService.getCurrentFundingRate.cacheWrite',
          },
        );
      }
      // Continue anyway (we still have the current funding data)
    }

    // Log success - Phase 8.9.32: SKIP logger errors
    try {
      this.logger.info('📊 Funding rate updated', {
        fundingRate: (fundingData.fundingRate * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE) + '%',
        nextFundingTime: new Date(fundingData.nextFundingTime).toISOString(),
      });
    } catch (error) {
      await this.handleSkipError(error, 'FundingRateFilterService.getCurrentFundingRate.successLogging');
    }

    return fundingData;
  }

  /**
   * Clear cache (for testing)
   * Phase 8.9.32: Logger errors are skipped
   */
  async clearCache(): Promise<void> {
    this.cachedFundingRate = null;
    this.lastFetchTime = 0;
    // Phase 8.9.32: SKIP logger errors
    try {
      this.logger.debug('🗑️ Funding rate cache cleared');
    } catch (error) {
      await this.handleSkipError(error, 'FundingRateFilterService.clearCache.logging');
    }
  }

  /**
   * Get current cached funding rate (if available)
   */
  getCachedFundingRate(): FundingRateData | null {
    return this.cachedFundingRate;
  }
}
