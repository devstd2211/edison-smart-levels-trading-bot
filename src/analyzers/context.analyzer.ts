import { DECIMAL_PLACES, PERCENT_MULTIPLIER, INTEGER_MULTIPLIERS, RATIO_MULTIPLIERS, THRESHOLD_VALUES, MULTIPLIER_VALUES } from '../constants';
/**
 * Context Analyzer
 *
 * Analyzes higher timeframes (PRIMARY 5m, TREND 30m) to determine:
 * - Market trend and structure
 * - Trading filters (ATR, EMA distance)
 * - Whether context is valid for trading
 *
 * This provides the "big picture" context that filters entry signals.
 */

import {
  TradingContext,
  TrendBias,
  MarketStructure,
  TimeframeRole,
  LoggerService,
  ContextFilteringMode,
  ATRIndicator,
  EMAIndicator,
} from '../types';
import { CandleProvider } from '../providers/candle.provider';

import { MarketStructureAnalyzer } from './market-structure.analyzer';

// ============================================================================
// TYPES
// ============================================================================

interface ContextConfig {
  atrPeriod: number;
  emaPeriod: number;
  zigzagDepth: number;
  minimumATR: number;
  maximumATR: number;
  maxEmaDistance: number; // Max % distance from EMA50
  filteringMode: ContextFilteringMode; // HARD_BLOCK or WEIGHT_BASED
  atrFilterEnabled: boolean; // Whether to apply ATR filtering (from config.atrFilter.enabled)
}

// ============================================================================
// CONTEXT ANALYZER
// ============================================================================

export class ContextAnalyzer {
  private atr: ATRIndicator;
  private ema50: EMAIndicator;

  private structureAnalyzer: MarketStructureAnalyzer;

  constructor(
    private config: ContextConfig,
    private candleProvider: CandleProvider,
    private logger: LoggerService,
  ) {
    this.atr = new ATRIndicator(config.atrPeriod);
    this.ema50 = new EMAIndicator(config.emaPeriod);

    const marketStructureConfig = (config as any).marketStructureConfig || {
      chochAlignedBoost: MULTIPLIER_VALUES.ONE_POINT_THREE,
      chochAgainstPenalty: RATIO_MULTIPLIERS.HALF,
      bosAlignedBoost: MULTIPLIER_VALUES.ONE_POINT_ONE,
      noModification: RATIO_MULTIPLIERS.FULL,
    };
    this.structureAnalyzer = new MarketStructureAnalyzer(marketStructureConfig, logger);
  }

  /**
   * Analyze trading context from PRIMARY timeframe
   * Returns context that will be used to filter ENTRY signals
   */
  async analyze(): Promise<TradingContext> {
    const timestamp = Date.now();

    // Get PRIMARY candles
    const primaryCandles = await this.candleProvider.getCandles(TimeframeRole.PRIMARY);
    if (!primaryCandles || primaryCandles.length < INTEGER_MULTIPLIERS.FIFTY) {
      this.logger.warn('Not enough PRIMARY candles for context analysis', {
        count: primaryCandles?.length ?? 0,
      });
      return this.invalidContext(timestamp, ['INSUFFICIENT_DATA']);
    }

    // Calculate indicators on PRIMARY
    const atrPercent = this.atr.calculate(primaryCandles);
    const ema50Value = this.ema50.calculate(primaryCandles);
    // Legacy zigzag usage (deprecated with this analyzer)
    // const highs = this.zigzag.findSwingHighs(primaryCandles);
    // const lows = this.zigzag.findSwingLows(primaryCandles);

    // Placeholder to allow compilation as zigzag is removed from this legacy analyzer
    const highs: any[] = [];
    const lows: any[] = [];
    
    const currentPrice = primaryCandles[primaryCandles.length - 1].close;
    const emaDistance = Math.abs((currentPrice - ema50Value) / ema50Value) * PERCENT_MULTIPLIER;

    // Get market structure (will receive empty arrays for highs/lows if zigzag is removed)
    const marketStructure = this.structureAnalyzer.identifyStructure(highs, lows);
    const trend = this.structureAnalyzer.getTrendBias(highs, lows);

    // Decision based on filtering mode
    const filteringMode = this.config.filteringMode;
    const warnings: string[] = [];
    const blockedBy: string[] = [];
    let isValidContext = true;

    // ====================================================================
    // WEIGHT-BASED MODE: Calculate modifiers
    // ====================================================================
    let atrModifier = RATIO_MULTIPLIERS.FULL as number;
    let emaModifier = RATIO_MULTIPLIERS.FULL as number;
    let trendModifier = RATIO_MULTIPLIERS.FULL as number;

    if (filteringMode === ContextFilteringMode.WEIGHT_BASED) {
      // ATR modifier (0.5 - 1.0)
      if (atrPercent < this.config.minimumATR) {
        // Too low volatility - reduce confidence
        const ratio = atrPercent / this.config.minimumATR;
        atrModifier = Math.max(RATIO_MULTIPLIERS.HALF as number, ratio); // Min 0.5x
        warnings.push(`Low volatility (ATR ${atrPercent.toFixed(DECIMAL_PLACES.PERCENT)}%)`);
      } else if (atrPercent > this.config.maximumATR) {
        // Too high volatility - reduce confidence
        const excess = (atrPercent - this.config.maximumATR) / this.config.maximumATR;
        atrModifier = Math.max(RATIO_MULTIPLIERS.HALF as number, (RATIO_MULTIPLIERS.FULL as number) - excess * (RATIO_MULTIPLIERS.HALF as number)); // Max penalty 50%
        warnings.push(`High volatility (ATR ${atrPercent.toFixed(DECIMAL_PLACES.PERCENT)}%)`);
      }

      // EMA distance modifier (0.3 - 1.0)
      if (emaDistance > this.config.maxEmaDistance) {
        // Price too far from EMA - reduce confidence significantly
        const excess = (emaDistance - this.config.maxEmaDistance) / this.config.maxEmaDistance;
        emaModifier = Math.max(THRESHOLD_VALUES.THIRTY_PERCENT as number, (RATIO_MULTIPLIERS.FULL as number) - excess); // Min 0.3x
        warnings.push(`Price far from EMA50 (${emaDistance.toFixed(DECIMAL_PLACES.PERCENT)}%)`);
      }

      // Trend modifier (based on market structure)
      if (trend === TrendBias.NEUTRAL) {
        trendModifier = THRESHOLD_VALUES.EIGHTY_PERCENT as number; // Slightly reduce confidence in neutral market
        warnings.push('Neutral trend');
      }
    }

    // ====================================================================
    // HARD_BLOCK MODE: Check hard constraints
    // ====================================================================
    if (filteringMode === ContextFilteringMode.HARD_BLOCK) {
      // DEBUG: Log atrFilterEnabled status
      if (!this.config.atrFilterEnabled) {
        // ATR filtering is disabled - skip ATR checks
        warnings.push('DEBUG: ATR filtering disabled (atrFilterEnabled=false)');
      }

      // ATR check (only if enabled in config.atrFilter.enabled)
      if (this.config.atrFilterEnabled) {
        if (atrPercent < this.config.minimumATR) {
          blockedBy.push('ATR_TOO_LOW');
          isValidContext = false;
          warnings.push(`Low volatility (ATR ${atrPercent.toFixed(DECIMAL_PLACES.PERCENT)}%)`);
        } else if (atrPercent > this.config.maximumATR) {
          blockedBy.push('ATR_TOO_HIGH');
          isValidContext = false;
          warnings.push(`High volatility (ATR ${atrPercent.toFixed(DECIMAL_PLACES.PERCENT)}%)`);
        }
      }

      // EMA distance check
      if (emaDistance > this.config.maxEmaDistance) {
        blockedBy.push('PRICE_TOO_FAR');
        isValidContext = false;
        warnings.push(`Price far from EMA50 (${emaDistance.toFixed(DECIMAL_PLACES.PERCENT)}%)`);
      }

      // Trend check (neutral trend = soft warning, not hard block)
      if (trend === TrendBias.NEUTRAL) {
        warnings.push('Neutral trend');
      }

      // Set modifiers to 0 if blocked (for consistency)
      if (!isValidContext) {
        atrModifier = 0;
        emaModifier = 0;
        trendModifier = 0;
      }
    }

    // Overall modifier
    const overallModifier = atrModifier * emaModifier * trendModifier;

    this.logger.info('📊 Context Analysis', {
      filteringMode,
      atrPercent: atrPercent.toFixed(DECIMAL_PLACES.PERCENT),
      ema50: ema50Value.toFixed(DECIMAL_PLACES.PRICE),
      emaDistance: emaDistance.toFixed(DECIMAL_PLACES.PERCENT),
      trend,
      marketStructure,
      modifiers: {
        atr: atrModifier.toFixed(DECIMAL_PLACES.PERCENT),
        ema: emaModifier.toFixed(DECIMAL_PLACES.PERCENT),
        trend: trendModifier.toFixed(DECIMAL_PLACES.PERCENT),
        overall: overallModifier.toFixed(DECIMAL_PLACES.PERCENT),
      },
      isValidContext,
      blockedBy,
      warnings,
    });

    return {
      timestamp,
      trend,
      marketStructure,
      atrPercent,
      emaDistance,
      ema50: ema50Value,
      atrModifier,
      emaModifier,
      trendModifier,
      overallModifier,
      isValidContext,
      blockedBy,
      warnings,
    };
  }

  /**
   * Helper: return invalid context (insufficient data)
   */
  private invalidContext(timestamp: number, warnings: string[]): TradingContext {
    return {
      timestamp,
      trend: TrendBias.NEUTRAL,
      marketStructure: null,
      atrPercent: 0,
      emaDistance: 0,
      ema50: 0,
      atrModifier: 0,    // Zero modifier = effectively blocked
      emaModifier: 0,
      trendModifier: 0,
      overallModifier: 0,
      isValidContext: false,
      blockedBy: ['INSUFFICIENT_DATA'],
      warnings,
    };
  }
}
