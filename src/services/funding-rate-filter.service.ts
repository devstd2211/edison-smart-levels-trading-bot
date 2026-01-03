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
 */

import { LoggerService, SignalDirection, FundingRateFilterConfig } from '../types';

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
  ) {}

  /**
   * Check if signal is allowed based on funding rate
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
          this.logger.warn('🚫 Funding Rate Filter: LONG blocked', {
            fundingRate: (fundingRate * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE) + '%',
            threshold: (this.config.blockLongThreshold * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE) + '%',
            reason: 'Funding too high (too many longs)',
          });

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
          this.logger.warn('🚫 Funding Rate Filter: SHORT blocked', {
            fundingRate: (fundingRate * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE) + '%',
            threshold: (this.config.blockShortThreshold * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE) + '%',
            reason: 'Funding too low (too many shorts)',
          });

          return {
            allowed: false,
            reason: `Funding rate too low: ${(fundingRate * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE)}% (threshold: ${(this.config.blockShortThreshold * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE)}%)`,
            fundingRate,
          };
        }
      }

      // Signal allowed
      this.logger.debug('✅ Funding Rate Filter: Signal allowed', {
        direction,
        fundingRate: (fundingRate * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE) + '%',
      });

      return {
        allowed: true,
        fundingRate,
      };
    } catch (error) {
      this.logger.error('Error checking funding rate filter', { error });
      // Allow signal if filter fails (fail-safe)
      return { allowed: true, reason: 'Filter error (allowed by default)' };
    }
  }

  /**
   * Get current funding rate (from cache or API)
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
      this.logger.debug('📦 Using cached funding rate', {
        fundingRate: (this.cachedFundingRate.fundingRate * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE) + '%',
        cacheAge: Math.floor((now - this.lastFetchTime) / INTEGER_MULTIPLIERS.ONE_THOUSAND) + 's',
      });
      return this.cachedFundingRate;
    }

    // Fetch from API
    this.logger.debug('🔄 Fetching funding rate from API');
    const fundingData = await this.getFundingRate();

    // Update cache
    this.cachedFundingRate = fundingData;
    this.lastFetchTime = now;

    this.logger.info('📊 Funding rate updated', {
      fundingRate: (fundingData.fundingRate * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PRICE) + '%',
      nextFundingTime: new Date(fundingData.nextFundingTime).toISOString(),
    });

    return fundingData;
  }

  /**
   * Clear cache (for testing)
   */
  clearCache(): void {
    this.cachedFundingRate = null;
    this.lastFetchTime = 0;
    this.logger.debug('🗑️ Funding rate cache cleared');
  }

  /**
   * Get current cached funding rate (if available)
   */
  getCachedFundingRate(): FundingRateData | null {
    return this.cachedFundingRate;
  }
}
