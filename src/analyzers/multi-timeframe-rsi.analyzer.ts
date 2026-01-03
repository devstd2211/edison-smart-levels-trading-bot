import { DECIMAL_PLACES } from '../constants';
/**
 * Multi-Timeframe RSI Analyzer
 *
 * Calculates RSI across multiple timeframes using TimeframeProvider and CandleProvider.
 * Supports optional caching of RSI values on candle close.
 */

import { TimeframeRole, LoggerService, RSIIndicator } from '../types';
import { TimeframeProvider } from '../providers/timeframe.provider';
import { CandleProvider } from '../providers/candle.provider';

export interface MultiTimeframeRSI {
  entry?: number; // ENTRY timeframe RSI
  primary: number; // PRIMARY timeframe RSI (required)
  trend1?: number; // TREND1 timeframe RSI
  trend2?: number; // TREND2 timeframe RSI
  context?: number; // CONTEXT timeframe RSI
}

export class MultiTimeframeRSIAnalyzer {
  private rsiIndicators: Map<TimeframeRole, RSIIndicator> = new Map();
  private rsiCache: Map<TimeframeRole, number> = new Map();
  private lastCacheUpdate: Map<TimeframeRole, number> = new Map();
  private cacheEnabled: boolean;

  constructor(
    private timeframeProvider: TimeframeProvider,
    private candleProvider: CandleProvider,
    private logger: LoggerService,
    private rsiPeriod: number = 14,
    cacheEnabled: boolean = false,
  ) {
    this.cacheEnabled = cacheEnabled;
    this.initializeIndicators();
  }

  /**
   * Initialize RSI indicators for all enabled timeframes
   */
  private initializeIndicators(): void {
    const timeframes = this.timeframeProvider.getAllTimeframes();

    for (const [role] of timeframes) {
      const indicator = new RSIIndicator(this.rsiPeriod);
      this.rsiIndicators.set(role, indicator);
      this.lastCacheUpdate.set(role, 0);

      this.logger.debug(`Initialized RSI indicator for ${role}`, {
        period: this.rsiPeriod,
      });
    }
  }

  /**
   * Calculate RSI for all enabled timeframes
   */
  async calculateAll(): Promise<MultiTimeframeRSI> {
    const result: MultiTimeframeRSI = {
      primary: 0, // Will be set below
    };

    const timeframes = this.timeframeProvider.getAllTimeframes();

    for (const [role] of timeframes) {
      try {
        const rsi = await this.calculate(role);
        this.assignRSIToResult(result, role, rsi);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to calculate RSI for ${role}`, {
          error: errorMsg,
        });
      }
    }

    return result;
  }

  /**
   * Calculate RSI for a specific timeframe
   */
  async calculate(role: TimeframeRole): Promise<number> {
    // Check cache first (if enabled)
    if (this.cacheEnabled) {
      const cachedRSI = this.rsiCache.get(role);
      if (cachedRSI !== undefined) {
        this.logger.debug(`Using cached RSI for ${role}`, { rsi: cachedRSI });
        return cachedRSI;
      }
    }

    // Get candles for this timeframe
    const candles = await this.candleProvider.getCandles(role);

    if (candles.length < this.rsiPeriod + 1) {
      throw new Error(
        `Not enough candles for RSI calculation on ${role}. Need ${
          this.rsiPeriod + 1
        }, got ${candles.length}`,
      );
    }

    // Get indicator for this timeframe
    const indicator = this.rsiIndicators.get(role);
    if (!indicator) {
      throw new Error(`RSI indicator not found for ${role}`);
    }

    // Calculate RSI
    const rsi = indicator.calculate(candles);

    // Cache the result (if enabled)
    if (this.cacheEnabled) {
      this.rsiCache.set(role, rsi);
      this.lastCacheUpdate.set(role, Date.now());
    }

    this.logger.debug(`Calculated RSI for ${role}`, {
      rsi: rsi.toFixed(DECIMAL_PLACES.PERCENT),
      candles: candles.length,
    });

    return rsi;
  }

  /**
   * Update RSI cache when a candle closes
   * (Only works if caching is enabled)
   */
  onCandleClosed(role: TimeframeRole): void {
    if (!this.cacheEnabled) {
      return;
    }

    // Invalidate cache for this timeframe
    this.rsiCache.delete(role);

    this.logger.debug(`RSI cache invalidated for ${role} (candle closed)`);
  }

  /**
   * Assign RSI value to the correct field in result object
   */
  private assignRSIToResult(
    result: MultiTimeframeRSI,
    role: TimeframeRole,
    rsi: number,
  ): void {
    switch (role) {
    case TimeframeRole.ENTRY:
      result.entry = rsi;
      break;
    case TimeframeRole.PRIMARY:
      result.primary = rsi;
      break;
    case TimeframeRole.TREND1:
      result.trend1 = rsi;
      break;
    case TimeframeRole.TREND2:
      result.trend2 = rsi;
      break;
    case TimeframeRole.CONTEXT:
      result.context = rsi;
      break;
    }
  }

  /**
   * Get cached RSI value for a timeframe (if available)
   */
  getCached(role: TimeframeRole): number | undefined {
    if (!this.cacheEnabled) {
      return undefined;
    }

    return this.rsiCache.get(role);
  }

  /**
   * Clear all cached RSI values
   */
  clearCache(): void {
    this.rsiCache.clear();
    this.lastCacheUpdate.clear();
    this.logger.debug('RSI cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    enabled: boolean;
    size: number;
    timeframes: string[];
    } {
    return {
      enabled: this.cacheEnabled,
      size: this.rsiCache.size,
      timeframes: Array.from(this.rsiCache.keys()).map((r) => r.toString()),
    };
  }
}
