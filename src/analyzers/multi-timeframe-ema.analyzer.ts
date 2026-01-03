import { DECIMAL_PLACES } from '../constants';
/**
 * Multi-Timeframe EMA Analyzer
 *
 * Calculates Fast and Slow EMA across multiple timeframes using TimeframeProvider and CandleProvider.
 * Supports optional caching of EMA values on candle close.
 * Detects EMA crossovers for trend identification.
 */

import { TimeframeRole, LoggerService, EMAIndicator } from '../types';
import { TimeframeProvider } from '../providers/timeframe.provider';
import { CandleProvider } from '../providers/candle.provider';

export interface EMAValues {
  fast: number;
  slow: number;
}

export interface MultiTimeframeEMA {
  entry?: EMAValues; // ENTRY timeframe EMA
  primary: EMAValues; // PRIMARY timeframe EMA (required)
  trend1?: EMAValues; // TREND1 timeframe EMA
  trend2?: EMAValues; // TREND2 timeframe EMA
  context?: EMAValues; // CONTEXT timeframe EMA
}

export enum CrossoverType {
  BULLISH = 'BULLISH', // Fast crosses above slow
  BEARISH = 'BEARISH', // Fast crosses below slow
  NONE = 'NONE', // No crossover
}

export interface EMACrossover {
  type: CrossoverType;
  fast: number;
  slow: number;
  difference: number; // fast - slow
}

export class MultiTimeframeEMAAnalyzer {
  private fastIndicators: Map<TimeframeRole, EMAIndicator> = new Map();
  private slowIndicators: Map<TimeframeRole, EMAIndicator> = new Map();
  private emaCache: Map<TimeframeRole, EMAValues> = new Map();
  private lastCacheUpdate: Map<TimeframeRole, number> = new Map();
  private cacheEnabled: boolean;

  constructor(
    private timeframeProvider: TimeframeProvider,
    private candleProvider: CandleProvider,
    private logger: LoggerService,
    private fastPeriod: number = 9,
    private slowPeriod: number = 21,
    cacheEnabled: boolean = false,
  ) {
    if (fastPeriod >= slowPeriod) {
      throw new Error(`Fast period (${fastPeriod}) must be less than slow period (${slowPeriod})`);
    }

    this.cacheEnabled = cacheEnabled;
    this.initializeIndicators();
  }

  /**
   * Initialize EMA indicators for all enabled timeframes
   */
  private initializeIndicators(): void {
    const timeframes = this.timeframeProvider.getAllTimeframes();

    for (const [role] of timeframes) {
      const fastIndicator = new EMAIndicator(this.fastPeriod);
      const slowIndicator = new EMAIndicator(this.slowPeriod);

      this.fastIndicators.set(role, fastIndicator);
      this.slowIndicators.set(role, slowIndicator);
      this.lastCacheUpdate.set(role, 0);

      this.logger.debug(`Initialized EMA indicators for ${role}`, {
        fastPeriod: this.fastPeriod,
        slowPeriod: this.slowPeriod,
      });
    }
  }

  /**
   * Calculate EMA for all enabled timeframes
   */
  async calculateAll(): Promise<MultiTimeframeEMA> {
    const result: MultiTimeframeEMA = {
      primary: { fast: 0, slow: 0 }, // Will be set below
    };

    const timeframes = this.timeframeProvider.getAllTimeframes();

    for (const [role] of timeframes) {
      try {
        const ema = await this.calculate(role);
        this.assignEMAToResult(result, role, ema);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to calculate EMA for ${role}`, {
          error: errorMsg,
        });
      }
    }

    return result;
  }

  /**
   * Calculate EMA for a specific timeframe
   */
  async calculate(role: TimeframeRole): Promise<EMAValues> {
    // Check cache first (if enabled)
    if (this.cacheEnabled) {
      const cachedEMA = this.emaCache.get(role);
      if (cachedEMA !== undefined) {
        this.logger.debug(`Using cached EMA for ${role}`, {
          fast: cachedEMA.fast,
          slow: cachedEMA.slow,
        });
        return cachedEMA;
      }
    }

    // Get candles for this timeframe
    const candles = await this.candleProvider.getCandles(role);

    // Need enough candles for slow EMA
    if (candles.length < this.slowPeriod) {
      throw new Error(
        `Not enough candles for EMA calculation on ${role}. Need ${this.slowPeriod}, got ${candles.length}`,
      );
    }

    // Get indicators for this timeframe
    const fastIndicator = this.fastIndicators.get(role);
    const slowIndicator = this.slowIndicators.get(role);

    if (!fastIndicator || !slowIndicator) {
      throw new Error(`EMA indicators not found for ${role}`);
    }

    // Calculate EMAs
    const fast = fastIndicator.calculate(candles);
    const slow = slowIndicator.calculate(candles);

    const emaValues: EMAValues = { fast, slow };

    // Cache the result (if enabled)
    if (this.cacheEnabled) {
      this.emaCache.set(role, emaValues);
      this.lastCacheUpdate.set(role, Date.now());
    }

    this.logger.debug(`Calculated EMA for ${role}`, {
      fast: fast.toFixed(DECIMAL_PLACES.PERCENT),
      slow: slow.toFixed(DECIMAL_PLACES.PERCENT),
      candles: candles.length,
    });

    return emaValues;
  }

  /**
   * Detect EMA crossover for a specific timeframe
   */
  async detectCrossover(role: TimeframeRole): Promise<EMACrossover> {
    const emaValues = await this.calculate(role);

    const difference = emaValues.fast - emaValues.slow;
    let type = CrossoverType.NONE;

    if (emaValues.fast > emaValues.slow) {
      type = CrossoverType.BULLISH;
    } else if (emaValues.fast < emaValues.slow) {
      type = CrossoverType.BEARISH;
    }

    return {
      type,
      fast: emaValues.fast,
      slow: emaValues.slow,
      difference,
    };
  }

  /**
   * Detect crossovers for all timeframes
   */
  async detectAllCrossovers(): Promise<Map<TimeframeRole, EMACrossover>> {
    const crossovers = new Map<TimeframeRole, EMACrossover>();
    const timeframes = this.timeframeProvider.getAllTimeframes();

    for (const [role] of timeframes) {
      try {
        const crossover = await this.detectCrossover(role);
        crossovers.set(role, crossover);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to detect crossover for ${role}`, {
          error: errorMsg,
        });
      }
    }

    return crossovers;
  }

  /**
   * Update EMA cache when a candle closes
   * (Only works if caching is enabled)
   */
  onCandleClosed(role: TimeframeRole): void {
    if (!this.cacheEnabled) {
      return;
    }

    // Invalidate cache for this timeframe
    this.emaCache.delete(role);

    this.logger.debug(`EMA cache invalidated for ${role} (candle closed)`);
  }

  /**
   * Assign EMA values to the correct field in result object
   */
  private assignEMAToResult(
    result: MultiTimeframeEMA,
    role: TimeframeRole,
    ema: EMAValues,
  ): void {
    switch (role) {
    case TimeframeRole.ENTRY:
      result.entry = ema;
      break;
    case TimeframeRole.PRIMARY:
      result.primary = ema;
      break;
    case TimeframeRole.TREND1:
      result.trend1 = ema;
      break;
    case TimeframeRole.TREND2:
      result.trend2 = ema;
      break;
    case TimeframeRole.CONTEXT:
      result.context = ema;
      break;
    }
  }

  /**
   * Get cached EMA values for a timeframe (if available)
   */
  getCached(role: TimeframeRole): EMAValues | undefined {
    if (!this.cacheEnabled) {
      return undefined;
    }

    return this.emaCache.get(role);
  }

  /**
   * Clear all cached EMA values
   */
  clearCache(): void {
    this.emaCache.clear();
    this.lastCacheUpdate.clear();
    this.logger.debug('EMA cache cleared');
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
      size: this.emaCache.size,
      timeframes: Array.from(this.emaCache.keys()).map((r) => r.toString()),
    };
  }

  /**
   * Get EMA periods configuration
   */
  getConfig(): { fastPeriod: number; slowPeriod: number } {
    return {
      fastPeriod: this.fastPeriod,
      slowPeriod: this.slowPeriod,
    };
  }
}
