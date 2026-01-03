/**
 * Trend Confirmation Service
 *
 * Confirms entry signals against multiple timeframes.
 * - ENTRY (1m): Source of signal direction
 * - PRIMARY (5m): Must confirm entry direction
 * - TREND1 (15m): Additional confirmation
 * - TREND2 (30m): Optional context
 *
 * Returns alignment score (0-100) and confidence boost.
 */

import {
  SignalDirection,
  TrendBias,
  TimeframeRole,
  MarketStructure,
  TrendConfirmationResult,
  TrendConfirmationConfig,
  TimeframeTrendData,
  LoggerService,
  SwingPointType,
  EMAIndicator,
  MarketStructureAnalyzer,
} from '../types';
import { CandleProvider } from '../providers/candle.provider';
import { INTEGER_MULTIPLIERS } from '../constants';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_WEIGHTS = {
  primary: 0.4,
  trend1: 0.35,
  trend2: 0.25,
};

const TREND_CONFIDENCE_BY_BIAS: Record<TrendBias, number> = {
  [TrendBias.BULLISH]: 80,
  [TrendBias.BEARISH]: 80,
  [TrendBias.NEUTRAL]: 40,
};

const STRUCTURE_CONFIDENCE: Record<MarketStructure, number> = {
  [MarketStructure.HIGHER_HIGH]: 75, // Higher High - bullish
  [MarketStructure.HIGHER_LOW]: 70, // Higher Low - bullish
  [MarketStructure.LOWER_HIGH]: 70, // Lower High - bearish
  [MarketStructure.LOWER_LOW]: 75, // Lower Low - bearish
  [MarketStructure.EQUAL_HIGH]: 50, // Equal High
  [MarketStructure.EQUAL_LOW]: 50, // Equal Low
};

// ============================================================================
// TREND CONFIRMATION SERVICE
// ============================================================================

export class TrendConfirmationService {
  private emaIndicators: Map<TimeframeRole, EMAIndicator> = new Map();
  private structureAnalyzer: MarketStructureAnalyzer;

  constructor(
    private config: TrendConfirmationConfig,
    private candleProvider: CandleProvider,
    private logger: LoggerService,
  ) {
    this.logger.info('TrendConfirmationService initialized', {
      enabled: config.enabled,
      requirePrimary: config.requirePrimaryAlignment,
      requireTrend1: config.requireTrend1Alignment,
      threshold: config.alignmentScoreThreshold,
    });

    const marketStructureConfig = (config as any).marketStructureConfig || {
      chochAlignedBoost: 1.3,
      chochAgainstPenalty: 0.5,
      bosAlignedBoost: 1.1,
      noModification: 1.0,
    };
    this.structureAnalyzer = new MarketStructureAnalyzer(marketStructureConfig, logger);

    // Initialize EMA indicators for each timeframe
    this.emaIndicators.set(TimeframeRole.ENTRY, new EMAIndicator(20));
    this.emaIndicators.set(TimeframeRole.PRIMARY, new EMAIndicator(50));
    this.emaIndicators.set(TimeframeRole.TREND1, new EMAIndicator(50));
    this.emaIndicators.set(TimeframeRole.TREND2, new EMAIndicator(50));
  }

  /**
   * Confirm entry signal against multiple timeframes
   */
  async confirmTrend(entryDirection: SignalDirection): Promise<TrendConfirmationResult> {
    if (!this.config.enabled) {
      return {
        isAligned: true,
        alignmentScore: INTEGER_MULTIPLIERS.ONE_HUNDRED,
        confirmedCount: 0,
        totalCount: 0,
        details: {},
        confidenceBoost: 0,
        reason: 'Trend confirmation disabled',
      };
    }

    try {
      // Analyze each timeframe
      const primaryTrend = await this.analyzeTrendForTF(TimeframeRole.PRIMARY);
      const trend1Trend = await this.analyzeTrendForTF(TimeframeRole.TREND1);
      const trend2Trend = await this.analyzeTrendForTF(TimeframeRole.TREND2);

      // Calculate alignment
      const alignmentResult = this.calculateAlignment(
        entryDirection,
        primaryTrend,
        trend1Trend,
        trend2Trend,
      );

      this.logger.debug('Trend confirmation result', {
        entryDirection,
        isAligned: alignmentResult.isAligned,
        alignmentScore: alignmentResult.alignmentScore,
        reason: alignmentResult.reason,
      });

      return alignmentResult;
    } catch (error) {
      this.logger.warn('Trend confirmation failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return neutral result on error
      return {
        isAligned: true,
        alignmentScore: 0,
        confirmedCount: 0,
        totalCount: 0,
        details: {},
        confidenceBoost: 0,
        reason: 'Trend confirmation error',
      };
    }
  }

  /**
   * Analyze trend for specific timeframe
   */
  private async analyzeTrendForTF(timeframe: TimeframeRole): Promise<TimeframeTrendData | null> {
    try {
      const candles = await this.candleProvider.getCandles(timeframe);
      if (!candles || candles.length < 30) {
        return null;
      }

      // Get EMA
      const emaIndicator = this.emaIndicators.get(timeframe);
      if (!emaIndicator) {
        return null;
      }

      const emaValue = emaIndicator.calculate(candles);
      const currentPrice = candles[candles.length - 1].close;

      // Get market structure (from last 50 candles for better analysis)
      const analysisCandles = candles.slice(-50);
      const highs = analysisCandles.map((c, idx) => ({
        price: c.high,
        timestamp: c.timestamp,
        type: SwingPointType.HIGH,
        index: idx,
      }));
      const lows = analysisCandles.map((c, idx) => ({
        price: c.low,
        timestamp: c.timestamp,
        type: SwingPointType.LOW,
        index: idx,
      }));

      const structure = this.structureAnalyzer.identifyStructure(highs, lows);
      const trend = this.structureAnalyzer.getTrendBias(highs, lows);

      // Determine EMA state
      const emaState = this.getEmaState(currentPrice, emaValue);

      // Calculate confidence - default to HIGHER_LOW if structure is null
      const marketStructure: MarketStructure = structure || MarketStructure.HIGHER_LOW;
      const confidence = this.calculateConfidence(trend, emaState, marketStructure);

      return {
        timeframe,
        trend,
        emaState,
        structure: marketStructure,
        confidence,
      };
    } catch (error) {
      this.logger.debug(`Failed to analyze trend for ${timeframe}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get EMA state (price position relative to EMA)
   */
  private getEmaState(price: number, emaValue: number): 'ABOVE' | 'BELOW' | 'CROSS' {
    const tolerance = emaValue * 0.001; // 0.1% tolerance
    if (Math.abs(price - emaValue) < tolerance) {
      return 'CROSS';
    }
    return price > emaValue ? 'ABOVE' : 'BELOW';
  }

  /**
   * Calculate confidence for trend based on indicators
   */
  private calculateConfidence(
    trend: TrendBias,
    emaState: 'ABOVE' | 'BELOW' | 'CROSS',
    structure: MarketStructure,
  ): number {
    let confidence = TREND_CONFIDENCE_BY_BIAS[trend];

    // Boost if EMA aligned with trend
    if (trend === TrendBias.BULLISH && emaState === 'ABOVE') {
      confidence += 10;
    } else if (trend === TrendBias.BEARISH && emaState === 'BELOW') {
      confidence += 10;
    } else if (emaState === 'CROSS') {
      confidence -= 10;
    }

    // Boost if structure confirms
    confidence += STRUCTURE_CONFIDENCE[structure] / 10;

    return Math.min(INTEGER_MULTIPLIERS.ONE_HUNDRED, confidence);
  }

  /**
   * Calculate alignment score between entry signal and timeframe trends
   */
  private calculateAlignment(
    entryDirection: SignalDirection,
    primaryTrend: TimeframeTrendData | null,
    trend1Trend: TimeframeTrendData | null,
    trend2Trend: TimeframeTrendData | null,
  ): TrendConfirmationResult {
    let alignmentScore = 0;
    let confirmedCount = 0;
    let totalCount = 0;
    let reason = '';

    const weights = this.config.weights || DEFAULT_WEIGHTS;
    const details: TrendConfirmationResult['details'] = {
      primary: primaryTrend || undefined,
      trend1: trend1Trend || undefined,
      trend2: trend2Trend || undefined,
    };

    // Check PRIMARY (always required)
    if (primaryTrend) {
      totalCount++;
      if (this.isTrendAligned(entryDirection, primaryTrend.trend)) {
        confirmedCount++;
        alignmentScore += weights.primary * INTEGER_MULTIPLIERS.ONE_HUNDRED;
        reason += 'Primary ✓ ';
      } else {
        reason += 'Primary ✗ ';
      }
    } else {
      reason += 'Primary ? ';
    }

    // Check TREND1 (optional)
    if (trend1Trend && this.config.requireTrend1Alignment) {
      totalCount++;
      if (this.isTrendAligned(entryDirection, trend1Trend.trend)) {
        confirmedCount++;
        alignmentScore += weights.trend1 * INTEGER_MULTIPLIERS.ONE_HUNDRED;
        reason += 'Trend1 ✓ ';
      } else {
        reason += 'Trend1 ✗ ';
      }
    } else if (trend1Trend) {
      totalCount++;
      if (this.isTrendAligned(entryDirection, trend1Trend.trend)) {
        confirmedCount++;
        alignmentScore += weights.trend1 * INTEGER_MULTIPLIERS.ONE_HUNDRED;
        reason += 'Trend1 ✓ ';
      } else {
        reason += 'Trend1 ~ ';
      }
    }

    // Check TREND2 (context only)
    if (trend2Trend) {
      totalCount++;
      if (this.isTrendAligned(entryDirection, trend2Trend.trend)) {
        confirmedCount++;
        alignmentScore += weights.trend2 * INTEGER_MULTIPLIERS.ONE_HUNDRED;
        reason += 'Trend2 ✓ ';
      } else {
        reason += 'Trend2 ~ ';
      }
    }

    // Normalize score
    alignmentScore = totalCount > 0 ? (alignmentScore / totalCount) * INTEGER_MULTIPLIERS.ONE_HUNDRED : 0;

    // Determine if aligned
    const isAligned = alignmentScore >= this.config.alignmentScoreThreshold;

    // Calculate confidence boost
    const confidenceBoost = isAligned ? this.config.confidenceBoost : 0;

    return {
      isAligned,
      alignmentScore: Math.round(alignmentScore),
      confirmedCount,
      totalCount,
      details,
      confidenceBoost,
      reason: reason.trim(),
    };
  }

  /**
   * Check if timeframe trend aligns with entry direction
   */
  private isTrendAligned(direction: SignalDirection, trend: TrendBias): boolean {
    if (trend === TrendBias.NEUTRAL) {
      return false; // Neutral doesn't confirm either direction
    }

    if (direction === SignalDirection.LONG) {
      return trend === TrendBias.BULLISH;
    } else if (direction === SignalDirection.SHORT) {
      return trend === TrendBias.BEARISH;
    }

    return false;
  }
}
