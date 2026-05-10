/**
 * FILTER ORCHESTRATOR
 * Central orchestrator for all signal-blocking filters
 *
 * Applies configured filters in sequence:
 * 1. Blind Zone Filter (minimum signal count)
 * 2. Flat Market Filter (market structure)
 * 3. Funding Rate Filter (perpetual funding)
 * 4. BTC Correlation Filter (alt market sentiment)
 * 5. Trend Alignment Filter (directional bias)
 * 6. Post-TP Filter (FOMO prevention)
 * 7. Time-Based Filter (session restrictions)
 * 8. Volatility Regime Filter (ATR constraints)
 * 9. Neutral Trend Strength Filter (confidence boost on weak trends)
 *
 * All filters are JSON-configurable via strategy.filters section
 */

import { LoggerService } from '../services/logger.service';
import { FilterOverrides } from '../types/strategy-config';
import { correlateCandles, determineBtcTrend, isBtcAligned } from '../utils/correlation';
import { Candle } from '../types/core';
import { ErrorHandler } from '../errors/ErrorHandler'; // Phase 8.9.29
import { ICONS } from '../cli/cli-runtime';

export interface FilterResult {
  allowed: boolean;
  reason?: string;
  appliedFilters: string[];
  blockedBy?: string;
}

interface FilterSignal {
  direction: string;
  confidence: number;
}

interface FlatMarketAnalysis {
  confidence: number;
}

interface MarketData {
  flatMarketAnalysis?: FlatMarketAnalysis;
}

interface TrendAnalysis {
  bias?: string;
  strength: number;
}

interface FilterContext {
  signal?: FilterSignal; // Trade signal (direction, confidence)
  accountBalance: number;
  openPositions: unknown[];
  marketData: MarketData; // flat market analysis, BTC correlation, etc
  fundingRate?: number;
  lastTPTimestamp?: number; // timestamp of last TP
  trend?: TrendAnalysis; // current trend analysis (bias, strength)
  btcCandles?: Candle[]; // BTC candles for correlation analysis
  altCandles?: Candle[]; // Target asset candles (XRP, etc)
}

type FilterContextWithSignal = FilterContext & { signal: FilterSignal };

export class FilterOrchestrator {
  constructor(
    private logger: LoggerService,
    private filterConfig: FilterOverrides = {},
    private readonly errorHandler?: ErrorHandler, // Phase 8.9.29
  ) {
    this.filterConfig = this.disableUnsupportedFilters(filterConfig);
  }

  /**
   * Evaluate signal against all configured filters
   * Returns immediately on first blocking filter
   * Phase 8.9.29: Input validation with THROW strategy
   */
  evaluateFilters(context: FilterContext): FilterResult {
    // Phase 8.9.29: Input validation with THROW strategy
    try {
      if (!context || !context.signal) {
        if (this.errorHandler) {
          this.logger.warn('Invalid filter context: missing signal', { context });
        }
        throw new Error('Filter context missing required signal field');
      }
    } catch (error) {
      if (this.errorHandler) {
        this.logger.warn('Filter context validation failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      // Continue with validation - non-critical
    }

    const appliedFilters: string[] = [];
    if (!context.signal) {
      return {
        allowed: false,
        reason: 'Missing signal for filter evaluation',
        appliedFilters,
      };
    }
    const safeContext: FilterContextWithSignal = context as FilterContextWithSignal;

    // FILTER 1: Blind Zone
    if (
      typeof this.filterConfig.blindZone?.minSignalsForLong === 'number' ||
      typeof this.filterConfig.blindZone?.minSignalsForShort === 'number'
    ) {
      const blindZoneResult = this.evaluateBlindZone(safeContext);
      appliedFilters.push('BlindZone');
      if (!blindZoneResult.allowed) {
        return { ...blindZoneResult, appliedFilters, blockedBy: 'BlindZone' };
      }
    }

    // FILTER 2: Flat Market
    if (this.filterConfig.flatMarket?.enabled !== false) {
      const flatMarketResult = this.evaluateFlatMarket(safeContext);
      appliedFilters.push('FlatMarket');
      if (!flatMarketResult.allowed) {
        return { ...flatMarketResult, appliedFilters, blockedBy: 'FlatMarket' };
      }
    }

    // FILTER 3: Funding Rate
    if (this.filterConfig.fundingRate?.enabled !== false && safeContext.fundingRate !== undefined) {
      const fundingRateResult = this.evaluateFundingRate(safeContext);
      appliedFilters.push('FundingRate');
      if (!fundingRateResult.allowed) {
        return { ...fundingRateResult, appliedFilters, blockedBy: 'FundingRate' };
      }
    }

    // FILTER 4: BTC Correlation
    if (this.filterConfig.btcCorrelation?.enabled !== false) {
      const btcResult = this.evaluateBtcCorrelation(safeContext);
      appliedFilters.push('BtcCorrelation');
      if (!btcResult.allowed) {
        return { ...btcResult, appliedFilters, blockedBy: 'BtcCorrelation' };
      }
    }

    // FILTER 5: Trend Alignment
    if (this.filterConfig.trendAlignment?.enabled !== false) {
      const trendResult = this.evaluateTrendAlignment(safeContext);
      appliedFilters.push('TrendAlignment');
      if (!trendResult.allowed) {
        return { ...trendResult, appliedFilters, blockedBy: 'TrendAlignment' };
      }
    }

    // FILTER 6: Post-TP Filter
    if (this.filterConfig.postTpFilter?.enabled !== false && safeContext.lastTPTimestamp) {
      const postTpResult = this.evaluatePostTpFilter(safeContext);
      appliedFilters.push('PostTp');
      if (!postTpResult.allowed) {
        return { ...postTpResult, appliedFilters, blockedBy: 'PostTp' };
      }
    }

    // FILTER 7: Time-Based Filter
    if (this.filterConfig.timeBasedFilter?.enabled !== false) {
      const timeResult = this.evaluateTimeBasedFilter(safeContext);
      appliedFilters.push('TimeBased');
      if (!timeResult.allowed) {
        return { ...timeResult, appliedFilters, blockedBy: 'TimeBased' };
      }
    }

    // FILTER 8: Volatility Regime
    if (this.filterConfig.volatilityRegime?.enabled !== false) {
      const volResult = this.evaluateVolatilityRegime(safeContext);
      appliedFilters.push('VolatilityRegime');
      if (!volResult.allowed) {
        return { ...volResult, appliedFilters, blockedBy: 'VolatilityRegime' };
      }
    }

    // FILTER 9: Neutral Trend Strength
    if (this.filterConfig.neutralTrendStrength?.enabled !== false) {
      const neutralResult = this.evaluateNeutralTrendStrength(safeContext);
      appliedFilters.push('NeutralTrendStrength');
      if (!neutralResult.allowed) {
        return { ...neutralResult, appliedFilters, blockedBy: 'NeutralTrendStrength' };
      }
    }

    // All filters passed
    return {
      allowed: true,
      appliedFilters,
    };
  }

  /**
   * FILTER 1: Blind Zone - require minimum signal consensus
   */
  private evaluateBlindZone(_context: FilterContextWithSignal): FilterResult {
    const config = this.filterConfig.blindZone;
    const signalCount = this.getSignalCount(_context.signal);

    if (!config || signalCount <= 0) {
      return { allowed: true, appliedFilters: [] };
    }

    const minSignals = _context.signal.direction === 'LONG'
      ? config.minSignalsForLong
      : config.minSignalsForShort;

    if (typeof minSignals === 'number' && signalCount < minSignals) {
      return {
        allowed: false,
        reason: `Blind zone: ${signalCount} ${_context.signal.direction} signals < required ${minSignals}`,
        appliedFilters: [],
      };
    }

    return { allowed: true, appliedFilters: [] };
  }

  /**
   * FILTER 2: Flat Market - block entries when market is ranging
   * Phase 8.9.29: Logger failures use SKIP strategy
   */
  private evaluateFlatMarket(context: FilterContextWithSignal): FilterResult {
    const config = this.filterConfig.flatMarket;
    if (!config?.enabled && config?.enabled !== undefined) {
      return { allowed: true, appliedFilters: [] };
    }

    const flatMarketAnalysis = context.marketData?.flatMarketAnalysis;
    if (!flatMarketAnalysis) {
      return { allowed: true, appliedFilters: [] }; // No flat market data available
    }

    // Phase 8.9.29: Handle NaN confidence with validation
    if (isNaN(flatMarketAnalysis.confidence)) {
      if (this.errorHandler) {
        this.logger.warn('Invalid flat market confidence (NaN), allowing entry', {
          confidence: flatMarketAnalysis.confidence,
        });
      }
      return { allowed: true, appliedFilters: [] };
    }

    const threshold = config?.flatThreshold ?? 70;
    if (flatMarketAnalysis.confidence >= threshold) {
      try {
        this.logger.info(`${ICONS.no_entry} Entry blocked: Flat market detected`, {
          flatConfidence: flatMarketAnalysis.confidence.toFixed(1),
          threshold,
        });
      } catch (error) {
        if (this.errorHandler) {
          // SKIP: logger failure is non-blocking
        }
      }
      return {
        allowed: false,
        reason: `Flat market (${flatMarketAnalysis.confidence.toFixed(1)}% confidence)`,
        appliedFilters: [],
      };
    }

    return { allowed: true, appliedFilters: [] };
  }

  /**
   * FILTER 3: Funding Rate - prevent overheated positions
   * Phase 8.9.29: Handle NaN/Infinity funding rates
   */
  private evaluateFundingRate(context: FilterContextWithSignal): FilterResult {
    const config = this.filterConfig.fundingRate;
    if (!config?.enabled && config?.enabled !== undefined) {
      return { allowed: true, appliedFilters: [] };
    }

    const fundingRate = context.fundingRate;
    if (fundingRate === undefined) {
      return { allowed: true, appliedFilters: [] };
    }

    // Phase 8.9.29: Validate funding rate
    if (isNaN(fundingRate) || !isFinite(fundingRate)) {
      if (this.errorHandler) {
        this.logger.warn('Invalid funding rate, allowing entry', {
          fundingRate,
        });
      }
      return { allowed: true, appliedFilters: [] };
    }

    const blockLongAbove = config?.blockLongAbove ?? 0.0005;
    const blockShortBelow = config?.blockShortBelow ?? -0.0005;

    if (context.signal.direction === 'LONG' && fundingRate > blockLongAbove) {
      try {
        this.logger.info(`${ICONS.no_entry} Entry blocked: Funding rate too high for LONG`, {
          fundingRate: fundingRate.toFixed(6),
          threshold: blockLongAbove.toFixed(6),
        });
      } catch (error) {
        if (this.errorHandler) {
          // SKIP: logger failure is non-blocking
        }
      }
      return {
        allowed: false,
        reason: `Funding rate too high (${fundingRate.toFixed(6)})`,
        appliedFilters: [],
      };
    }

    if (context.signal.direction === 'SHORT' && fundingRate < blockShortBelow) {
      try {
        this.logger.info(`${ICONS.no_entry} Entry blocked: Funding rate too low for SHORT`, {
          fundingRate: fundingRate.toFixed(6),
          threshold: blockShortBelow.toFixed(6),
        });
      } catch (error) {
        if (this.errorHandler) {
          // SKIP: logger failure is non-blocking
        }
      }
      return {
        allowed: false,
        reason: `Funding rate too low (${fundingRate.toFixed(6)})`,
        appliedFilters: [],
      };
    }

    return { allowed: true, appliedFilters: [] };
  }

  /**
   * FILTER 4: BTC Correlation - block alt when BTC moves against us
   *
   * Prevents counter-trend entries by checking BTC correlation and trend.
   * With strict blocking: blocks entries that go against BTC trend if correlation is high.
   * Phase 8.9.29: GRACEFUL_DEGRADE strategy with enhanced validation
   */
  private evaluateBtcCorrelation(context: FilterContextWithSignal): FilterResult {
    const config = this.filterConfig.btcCorrelation;
    if (!config?.enabled && config?.enabled !== undefined) {
      return { allowed: true, appliedFilters: [] };
    }

    // Need BTC and alt candles for correlation analysis
    if (!context.btcCandles || !context.altCandles || !Array.isArray(context.btcCandles) || !Array.isArray(context.altCandles)) {
      return { allowed: true, appliedFilters: [] };
    }

    if (context.btcCandles.length < 2 || context.altCandles.length < 2) {
      return { allowed: true, appliedFilters: [] };
    }

    try {
      // Phase 8.9.29: Validate candle data before processing
      const hasValidBtcCandles = context.btcCandles.every((c) => isFinite(c.close));
      const hasValidAltCandles = context.altCandles.every((c) => isFinite(c.close));

      if (!hasValidBtcCandles || !hasValidAltCandles) {
        if (this.errorHandler) {
          this.logger.warn('Invalid candle data in BTC correlation, allowing entry', {
            validBtc: hasValidBtcCandles,
            validAlt: hasValidAltCandles,
          });
        }
        return { allowed: true, appliedFilters: [] }; // GRACEFUL_DEGRADE
      }

      // Calculate correlation
      const lookbackPeriod = 20; // Last 20 candles
      const correlationResult = correlateCandles(context.btcCandles, context.altCandles, lookbackPeriod, 'close');
      const correlation = correlationResult.correlation;

      // Phase 8.9.29: Validate correlation result
      if (isNaN(correlation) || !isFinite(correlation)) {
        if (this.errorHandler) {
          this.logger.warn('Invalid correlation value, allowing entry', { correlation });
        }
        return { allowed: true, appliedFilters: [] }; // GRACEFUL_DEGRADE
      }

      // Determine BTC trend
      const btcTrend = determineBtcTrend(context.btcCandles, lookbackPeriod);
      const signalDirection = context.signal.direction === 'LONG' ? 'LONG' : 'SHORT';

      // Get threshold from config (default: moderate = 0.4)
      const threshold = config?.thresholds?.moderate ?? 0.4;

      // Check if aligned
      const aligned = isBtcAligned(btcTrend, signalDirection, correlation, threshold);

      if (!aligned) {
        try {
          this.logger.warn(`${ICONS.no_entry} Entry blocked: BTC Correlation filter`, {
            signal: `${signalDirection}`,
            correlation: correlation.toFixed(3),
            btcTrend,
            threshold: threshold.toFixed(2),
            correlationStrength: correlationResult.strength,
            reason: `${signalDirection} signal conflicts with BTC trend`,
          });
        } catch (logError) {
          if (this.errorHandler) {
            // SKIP: logger failure is non-blocking
          }
        }

        return {
          allowed: false,
          reason: `BTC correlation mismatch: ${signalDirection} vs BTC ${btcTrend} (corr=${correlation.toFixed(2)})`,
          appliedFilters: [],
        };
      }

      // If we're here, BTC correlation is not blocking
      if (Math.abs(correlation) >= threshold) {
        try {
          this.logger.debug(`${ICONS.success} Signal passed BTC Correlation check`, {
            signal: `${signalDirection}`,
            correlation: correlation.toFixed(3),
            btcTrend,
            note: 'Aligned with BTC trend',
          });
        } catch (logError) {
          if (this.errorHandler) {
            // SKIP: logger failure is non-blocking
          }
        }
      }

      return { allowed: true, appliedFilters: [] };
    } catch (error: unknown) {
      try {
        this.logger.error('Error in BTC Correlation filter', {
          error: error instanceof Error ? error.message : String(error),
        });
      } catch (logError) {
        if (this.errorHandler) {
          // SKIP: logger failure is non-blocking
        }
      }

      // Phase 8.9.29: GRACEFUL_DEGRADE: On error, allow the trade (fail open)
      if (this.errorHandler) {
        this.logger.warn('BTC correlation filter failed, allowing entry (graceful degrade)', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return { allowed: true, appliedFilters: [] };
    }
  }

  /**
   * FILTER 5: Trend Alignment - block against trend (handled in EntryOrchestrator)
   */
  private evaluateTrendAlignment(_context: FilterContextWithSignal): FilterResult {
    // EntryOrchestrator handles this filter
    return { allowed: true, appliedFilters: [] };
  }

  /**
   * FILTER 6: Post-TP Filter - prevent FOMO after TP
   * Phase 8.9.29: Handle timestamp validation
   */
  private evaluatePostTpFilter(context: FilterContextWithSignal): FilterResult {
    const config = this.filterConfig.postTpFilter;
    if (!config?.enabled && config?.enabled !== undefined) {
      return { allowed: true, appliedFilters: [] };
    }

    if (!context.lastTPTimestamp) {
      return { allowed: true, appliedFilters: [] };
    }

    // Phase 8.9.29: Validate timestamp
    if (isNaN(context.lastTPTimestamp) || !isFinite(context.lastTPTimestamp)) {
      if (this.errorHandler) {
        this.logger.warn('Invalid lastTPTimestamp, allowing entry', {
          timestamp: context.lastTPTimestamp,
        });
      }
      return { allowed: true, appliedFilters: [] };
    }

    const blockDurationSec = config?.blockDurationSeconds ?? 300;
    const timeSinceTP = (Date.now() - context.lastTPTimestamp) / 1000;

    if (timeSinceTP < blockDurationSec) {
      try {
        this.logger.info(`${ICONS.no_entry} Entry blocked: Post-TP cooldown period`, {
          timeSinceTPSeconds: timeSinceTP.toFixed(0),
          blockDurationSeconds: blockDurationSec,
        });
      } catch (error) {
        if (this.errorHandler) {
          // SKIP: logger failure is non-blocking
        }
      }
      return {
        allowed: false,
        reason: `Post-TP cooldown (${timeSinceTP.toFixed(0)}s of ${blockDurationSec}s)`,
        appliedFilters: [],
      };
    }

    return { allowed: true, appliedFilters: [] };
  }

  /**
   * FILTER 7: Time-Based Filter - block entries during specific hours
   */
  private evaluateTimeBasedFilter(_context: FilterContextWithSignal): FilterResult {
    const config = this.filterConfig.timeBasedFilter;
    if (!config?.enabled && config?.enabled !== undefined) {
      return { allowed: true, appliedFilters: [] };
    }

    // To be implemented in Phase 3
    // Requires time-based restrictions
    return { allowed: true, appliedFilters: [] };
  }

  /**
   * FILTER 8: Volatility Regime - block during extreme volatility
   */
  private evaluateVolatilityRegime(_context: FilterContextWithSignal): FilterResult {
    const config = this.filterConfig.volatilityRegime;
    if (!config?.enabled && config?.enabled !== undefined) {
      return { allowed: true, appliedFilters: [] };
    }

    // To be implemented in Phase 3
    // Requires ATR analysis
    return { allowed: true, appliedFilters: [] };
  }

  /**
   * FILTER 9: Neutral Trend Strength - require higher confidence on weak NEUTRAL trends
   *
   * Problem: SHORT entries with 65-70% confidence on weak NEUTRAL trends (< 40% strength)
   * have 50% win rate and are losing money.
   * Root cause: Weak NEUTRAL trends lack directional bias, creating high risk of chop.
   *
   * Solution: On weak NEUTRAL trends, require higher confidence (70%+) to ensure
   * entries are made only when signal quality is very high.
   * Phase 8.9.29: Handle NaN trend strength with GRACEFUL_DEGRADE
   */
  private evaluateNeutralTrendStrength(context: FilterContextWithSignal): FilterResult {
    const config = this.filterConfig.neutralTrendStrength;
    if (!config?.enabled && config?.enabled !== undefined) {
      return { allowed: true, appliedFilters: [] };
    }

    const trend = context.trend;
    if (!trend || trend.bias !== 'NEUTRAL') {
      // Filter doesn't apply if not on NEUTRAL trend
      return { allowed: true, appliedFilters: [] };
    }

    // Phase 8.9.29: Validate trend strength
    if (isNaN(trend.strength) || !isFinite(trend.strength)) {
      if (this.errorHandler) {
        this.logger.warn('Invalid trend strength value, allowing entry', {
          strength: trend.strength,
        });
      }
      return { allowed: true, appliedFilters: [] }; // GRACEFUL_DEGRADE
    }

    const minConfidence = config?.minConfidenceForWeakNeutral ?? 0.70; // 70%
    const weakThreshold = config?.weakTrendThreshold ?? 40; // 40% strength

    // NEUTRAL trend with good strength (>= 40%) = allow all signals
    if (trend.strength >= weakThreshold) {
      return { allowed: true, appliedFilters: [] };
    }

    // Weak NEUTRAL trend (< 40%) = require high confidence
    // Phase 8.9.29: Validate signal confidence
    if (isNaN(context.signal.confidence) || !isFinite(context.signal.confidence)) {
      if (this.errorHandler) {
        this.logger.warn('Invalid signal confidence, allowing entry', {
          confidence: context.signal.confidence,
        });
      }
      return { allowed: true, appliedFilters: [] }; // GRACEFUL_DEGRADE
    }

    const signalConfidence = context.signal.confidence / 100; // Convert 0-100 to 0-1
    if (signalConfidence < minConfidence) {
      try {
        this.logger.warn(`${ICONS.no_entry} Entry blocked: Weak NEUTRAL trend requires higher confidence`, {
          trendStrength: trend.strength.toFixed(1) + '%',
          signalConfidence: (signalConfidence * 100).toFixed(0) + '%',
          requiredConfidence: (minConfidence * 100).toFixed(0) + '%',
          reason: 'Weak NEUTRAL trends lack directional bias - high risk of chop',
        });
      } catch (error) {
        if (this.errorHandler) {
          // SKIP: logger failure is non-blocking
        }
      }
      return {
        allowed: false,
        reason: `Weak NEUTRAL trend (${trend.strength.toFixed(0)}% strength) requires ${(minConfidence * 100).toFixed(0)}% confidence, signal has only ${(signalConfidence * 100).toFixed(0)}%`,
        appliedFilters: [],
      };
    }

    return { allowed: true, appliedFilters: [] };
  }

  /**
   * Update filter configuration at runtime
   */
  updateFilterConfig(filterConfig: FilterOverrides): void {
    this.filterConfig = this.disableUnsupportedFilters({ ...this.filterConfig, ...filterConfig });
    this.logger.info('Filter configuration updated', {
      filters: Object.keys(filterConfig),
    });
  }

  private disableUnsupportedFilters(filterConfig: FilterOverrides): FilterOverrides {
    const nextConfig = { ...filterConfig };

    if (nextConfig.timeBasedFilter?.enabled !== false) {
      this.logger.warn('TimeBasedFilter is configured but not implemented; disabling it for live execution');
      nextConfig.timeBasedFilter = { ...nextConfig.timeBasedFilter, enabled: false };
    }

    if (nextConfig.volatilityRegime?.enabled !== false) {
      this.logger.warn('VolatilityRegime filter is configured but not implemented; disabling it for live execution');
      nextConfig.volatilityRegime = { ...nextConfig.volatilityRegime, enabled: false };
    }

    return nextConfig;
  }

  private getSignalCount(signal: FilterSignal & {
    signalCount?: number;
    aggregationContext?: {
      signalCount?: number;
      longSignalCount?: number;
      shortSignalCount?: number;
    };
  }): number {
    const directCount = typeof signal.signalCount === 'number' ? signal.signalCount : undefined;
    const contextCount = typeof signal.aggregationContext?.signalCount === 'number'
      ? signal.aggregationContext.signalCount
      : undefined;
    const fallbackCount = signal.direction === 'LONG' || signal.direction === 'SHORT' ? 1 : 0;
    return Math.max(0, Math.floor(directCount ?? contextCount ?? fallbackCount));
  }
}

export default FilterOrchestrator;

