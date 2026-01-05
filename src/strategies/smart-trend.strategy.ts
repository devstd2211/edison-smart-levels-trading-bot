import { DECIMAL_PLACES, MULTIPLIERS, PERCENTAGE_THRESHOLDS, PERCENT_MULTIPLIER } from '../constants';
import { THRESHOLD_VALUES, MULTIPLIER_VALUES } from '../constants/technical.constants';
/**
 * Smart Trend Strategy
 *
 * Implements the trading algorithm from АЛГОРИТМ.md:
 * 1. Determine trend on 5m (PRIMARY): EMA20 > EMA50 + ZigZag HH/HL
 * 2. Find pullback on 1m (ENTRY): Price retraces to EMA20, ZigZag forms HL
 * 3. Confirm entry: Candle closes above EMA, RSI crosses 50, ZigZag confirms wave
 *
 * Uses hybrid logic: hard filters + optional weights
 */

import {
  SignalDirection,
  TrendState,
  PullbackState,
  EntryConfirmation,
  TrendBias,
  EMACrossover,
  MarketStructure,
  StrategyConfig,
  SwingPoint,
  Candle,
  ATRFilterConfig,
  LoggerService,
  WeightMatrixInput,
  MarketStructureAnalyzer,
  ATRIndicator,
  WeightMatrixCalculatorService,
} from '../types';
import { IStrategy, StrategyEvaluation } from './strategy.interface';

// ============================================================================
// TYPES
// ============================================================================

interface MultiTimeframeRSI {
  primary?: number;
  entry?: number;
  trend1?: number;
}

interface TimeframeEMA {
  fast?: number;
  slow?: number;
  crossover?: EMACrossover;
}

interface MultiTimeframeEMA {
  primary?: TimeframeEMA;
  entry?: TimeframeEMA;
  trend1?: TimeframeEMA;
}

interface SmartTrendData {
  rsi: MultiTimeframeRSI;
  ema: MultiTimeframeEMA;
  zigzagHighs: SwingPoint[];
  zigzagLows: SwingPoint[];
  currentPrice: number;
  candles?: Candle[]; // Candles for ATR calculation (PRIMARY timeframe)
  tfAlignment?: {
    long: { score: number };
    short: { score: number };
  };
}

interface SmartTrendEvaluation extends StrategyEvaluation {
  trendState: TrendState;
  pullbackState: PullbackState;
  entryConfirmation: EntryConfirmation;
}

// ============================================================================
// SMART TREND STRATEGY
// ============================================================================

export class SmartTrendStrategy implements IStrategy<SmartTrendData> {
  private atrIndicator: ATRIndicator | null = null;
  private atrFilterConfig: ATRFilterConfig | null = null;
  private weightMatrix: WeightMatrixCalculatorService | null = null;

  constructor(
    private config: StrategyConfig,
    private structureAnalyzer: MarketStructureAnalyzer,
    private logger: LoggerService,
    atrFilterConfig?: ATRFilterConfig,
    weightMatrix?: WeightMatrixCalculatorService,
  ) {
    if (atrFilterConfig?.enabled) {
      this.atrFilterConfig = atrFilterConfig;
      this.atrIndicator = new ATRIndicator(atrFilterConfig.period);
      this.logger.info('ATR volatility filter enabled', {
        period: atrFilterConfig.period,
        minimumATR: atrFilterConfig.minimumATR,
        maximumATR: atrFilterConfig.maximumATR,
      });
    }

    // Initialize weight matrix if provided
    if (weightMatrix) {
      this.weightMatrix = weightMatrix;
      this.logger.info('SmartTrend Strategy: Weight Matrix enabled');
    }
  }

  /**
   * Get strategy name
   */
  getName(): string {
    return 'SmartTrend';
  }

  /**
   * Get strategy description
   */
  getDescription(): string {
    return 'Multi-timeframe trend following with pullback entries';
  }

  /**
   * Evaluate market conditions with fully typed data
   *
   * @param data - Properly typed SmartTrendData (no casting needed)
   * @returns Strategy evaluation result
   */
  evaluate(data: SmartTrendData): SmartTrendEvaluation {
    const strategyData = data;

    // STEP 1: Hard filters (must pass all)
    const filterResult = this.applyHardFilters(strategyData);
    if (filterResult.blockedBy.length > 0) {
      return {
        shouldEnter: false,
        direction: SignalDirection.HOLD,
        reason: filterResult.reason,
        blockedBy: filterResult.blockedBy,
        confidence: 0,
        trendState: filterResult.trendState,
        pullbackState: filterResult.pullbackState,
        entryConfirmation: filterResult.entryConfirmation,
      };
    }

    // STEP 2: Determine trend on 5m (PRIMARY)
    const trendState = this.determineTrend5m(
      strategyData.ema.primary,
      strategyData.rsi.primary,
      strategyData.zigzagHighs,
      strategyData.zigzagLows,
      strategyData.currentPrice,
    );

    if (!trendState.isValid) {
      return {
        shouldEnter: false,
        direction: SignalDirection.HOLD,
        reason: trendState.reason,
        blockedBy: ['NO_VALID_TREND_5M'],
        confidence: 0,
        trendState,
        pullbackState: {
          detected: false,
          emaFast: 0,
          emaSlow: 0,
          price: strategyData.currentPrice,
          structure: null,
          isComplete: false,
          reason: 'Trend not valid',
        },
        entryConfirmation: {
          confirmed: false,
          rsi: strategyData.rsi.entry || 0,
          rsiCrossed: false,
          candleClosed: false,
          zigzagConfirmed: false,
          reason: 'Trend not valid',
        },
      };
    }

    // STEP 3: Detect pullback on 1m (ENTRY)
    const pullbackState = this.detectPullback1m(
      strategyData.ema.entry,
      strategyData.currentPrice,
      strategyData.zigzagHighs,
      strategyData.zigzagLows,
      trendState.bias,
    );

    // STEP 4: Confirm entry
    const entryConfirmation = this.confirmEntry(
      strategyData.ema.entry,
      strategyData.rsi.entry,
      strategyData.zigzagHighs,
      strategyData.zigzagLows,
      strategyData.currentPrice,
      trendState.bias,
    );

    // STEP 5: Calculate confidence (weighted)
    const confidence = this.calculateConfidence(
      trendState,
      pullbackState,
      entryConfirmation,
      strategyData,
    );

    // STEP 6: Determine if should enter
    const minThreshold = this.config.minConfidenceThreshold || (THRESHOLD_VALUES.SIXTY_PERCENT as number);
    const shouldEnter = confidence >= minThreshold;

    // Build reason
    const reason = shouldEnter
      ? `${trendState.bias} trend confirmed, confidence ${(confidence * PERCENT_MULTIPLIER).toFixed(1)}%`
      : `Confidence too low: ${(confidence * PERCENT_MULTIPLIER).toFixed(1)}% < ${(minThreshold * PERCENT_MULTIPLIER).toFixed(1)}%`;

    const blockedBy: string[] = [];
    if (!trendState.isValid) {
      blockedBy.push('NO_TREND');
    }
    if (!pullbackState.detected) {
      blockedBy.push('NO_PULLBACK');
    }
    if (!entryConfirmation.confirmed) {
      blockedBy.push('NO_ENTRY_CONFIRMATION');
    }

    return {
      shouldEnter,
      direction: trendState.bias === TrendBias.BULLISH ? SignalDirection.LONG : SignalDirection.SHORT,
      reason,
      blockedBy,
      confidence,
      trendState,
      pullbackState,
      entryConfirmation,
    };
  }

  // ============================================================================
  // HARD FILTERS
  // ============================================================================

  /**
   * Apply hard filters (must pass all)
   */
  private applyHardFilters(data: SmartTrendData): {
    blockedBy: string[];
    reason: string;
    trendState: TrendState;
    pullbackState: PullbackState;
    entryConfirmation: EntryConfirmation;
  } {
    const blockedBy: string[] = [];
    const reasons: string[] = [];

    const emptyTrendState: TrendState = {
      bias: TrendBias.NEUTRAL,
      emaFast: data.ema.primary?.fast || 0,
      emaSlow: data.ema.primary?.slow || 0,
      emaCrossover: EMACrossover.NONE,
      price: data.currentPrice,
      structure: null,
      isValid: false,
      reason: '',
    };

    const emptyPullbackState: PullbackState = {
      detected: false,
      emaFast: data.ema.entry?.fast || 0,
      emaSlow: data.ema.entry?.slow || 0,
      price: data.currentPrice,
      structure: null,
      isComplete: false,
      reason: '',
    };

    const emptyEntryConfirmation: EntryConfirmation = {
      confirmed: false,
      rsi: data.rsi.entry || 0,
      rsiCrossed: false,
      candleClosed: false,
      zigzagConfirmed: false,
      reason: '',
    };

    // Filter 1: EMA flat (EMA20 ≈ EMA50)
    if (data.ema.primary && this.isEmaFlat(data.ema.primary.fast!, data.ema.primary.slow!)) {
      blockedBy.push('EMA_FLAT');
      reasons.push('EMA20 ≈ EMA50 (flat market)');
    }

    // Filter 2: RSI neutral zone (45-55)
    if (data.rsi.primary && this.isRsiNeutral(data.rsi.primary)) {
      blockedBy.push('RSI_NEUTRAL');
      reasons.push(`RSI in neutral zone (${data.rsi.primary.toFixed(DECIMAL_PLACES.PERCENT)})`);
    }

    // Filter 3: Price too far from EMA50
    if (
      data.ema.primary?.slow &&
      this.isPriceTooFar(data.currentPrice, data.ema.primary.slow)
    ) {
      blockedBy.push('PRICE_TOO_FAR');
      reasons.push(`Price too far from EMA50:${data.ema.primary.slow}  (>${this.config.emaDistanceThreshold}%)`);
    }

    // Filter 4: ATR volatility (if enabled)
    if (this.atrIndicator && this.atrFilterConfig && data.candles) {
      const atrResult = this.checkATR(data.candles);
      if (!atrResult.isValid) {
        blockedBy.push('ATR_OUT_OF_RANGE');
        reasons.push(atrResult.reason!);
      }
    }

    return {
      blockedBy,
      reason: blockedBy.length > 0 ? reasons.join(', ') : '',
      trendState: emptyTrendState,
      pullbackState: emptyPullbackState,
      entryConfirmation: emptyEntryConfirmation,
    };
  }

  // ============================================================================
  // TREND ANALYSIS (5m / PRIMARY)
  // ============================================================================

  /**
   * Determine trend on 5m timeframe
   */
  private determineTrend5m(
    ema: TimeframeEMA | undefined,
    rsi: number | undefined,
    highs: SwingPoint[],
    lows: SwingPoint[],
    price: number,
  ): TrendState {
    if (!ema?.fast || !ema.slow) {
      return {
        bias: TrendBias.NEUTRAL,
        emaFast: 0,
        emaSlow: 0,
        emaCrossover: EMACrossover.NONE,
        price,
        structure: null,
        isValid: false,
        reason: 'Missing EMA data',
      };
    }

    // Get structure and pattern
    const structure = this.structureAnalyzer.identifyStructure(highs, lows);
    const pattern = this.structureAnalyzer.getLastPattern(highs, lows);
    const bias = this.structureAnalyzer.getTrendBias(highs, lows);

    // Determine EMA crossover
    const emaCrossover =
      ema.fast > ema.slow
        ? EMACrossover.BULLISH
        : ema.fast < ema.slow
          ? EMACrossover.BEARISH
          : EMACrossover.NONE;

    // Check if trend is valid for LONG
    const isValidLong =
      ema.fast > ema.slow && // EMA20 > EMA50
      price > ema.fast && // Price above EMA20
      price > ema.slow && // Price above EMA50
      pattern === 'HH_HL'; // ZigZag confirms HH/HL

    // Check if trend is valid for SHORT
    const isValidShort =
      ema.fast < ema.slow && // EMA20 < EMA50
      price < ema.fast && // Price below EMA20
      price < ema.slow && // Price below EMA50
      pattern === 'LH_LL'; // ZigZag confirms LH/LL

    const isValid = isValidLong || isValidShort;
    const finalBias = isValidLong
      ? TrendBias.BULLISH
      : isValidShort
        ? TrendBias.BEARISH
        : TrendBias.NEUTRAL;

    const reason = isValid
      ? `${finalBias} trend: EMA${ema.fast > ema.slow ? '20>50' : '20<50'}, price ${price > ema.fast ? 'above' : 'below'} EMA, pattern ${pattern}`
      : `No clear trend: EMA crossover=${emaCrossover}, price position unclear, pattern=${pattern}`;

    return {
      bias: finalBias,
      emaFast: ema.fast,
      emaSlow: ema.slow,
      emaCrossover,
      price,
      structure,
      isValid,
      reason,
    };
  }

  // ============================================================================
  // PULLBACK ANALYSIS (1m / ENTRY)
  // ============================================================================

  /**
   * Detect pullback on 1m timeframe
   */
  private detectPullback1m(
    ema: TimeframeEMA | undefined,
    price: number,
    highs: SwingPoint[],
    lows: SwingPoint[],
    trendBias: TrendBias,
  ): PullbackState {
    if (!ema?.fast || !ema.slow) {
      return {
        detected: false,
        emaFast: 0,
        emaSlow: 0,
        price,
        structure: null,
        isComplete: false,
        reason: 'Missing EMA data',
      };
    }

    const structure = this.structureAnalyzer.identifyStructure(highs, lows);

    // For LONG: pullback = price retraces below EMA20, forms HL
    const isLongPullback =
      trendBias === TrendBias.BULLISH &&
      structure === MarketStructure.HIGHER_LOW;

    // For SHORT: pullback = price retraces above EMA20, forms LH
    const isShortPullback =
      trendBias === TrendBias.BEARISH &&
      structure === MarketStructure.LOWER_HIGH;

    const detected = isLongPullback || isShortPullback;

    // Pullback is complete when price returns to EMA
    const isComplete =
      (isLongPullback && price >= ema.fast) ||
      (isShortPullback && price <= ema.fast);

    const reason = detected
      ? `Pullback detected: ${structure}, ${isComplete ? 'complete' : 'incomplete'}`
      : `No pullback: structure=${structure}, bias=${trendBias}`;

    return {
      detected,
      emaFast: ema.fast,
      emaSlow: ema.slow,
      price,
      structure,
      isComplete,
      reason,
    };
  }

  // ============================================================================
  // ENTRY CONFIRMATION (1m / ENTRY)
  // ============================================================================

  /**
   * Confirm entry conditions
   */
  private confirmEntry(
    ema: TimeframeEMA | undefined,
    rsi: number | undefined,
    highs: SwingPoint[],
    lows: SwingPoint[],
    price: number,
    trendBias: TrendBias,
  ): EntryConfirmation {
    if (!ema?.fast || !ema.slow || rsi === undefined) {
      return {
        confirmed: false,
        rsi: rsi || 0,
        rsiCrossed: false,
        candleClosed: false,
        zigzagConfirmed: false,
        reason: 'Missing data',
      };
    }

    // RSI crossed threshold
    const rsiCrossed =
      (trendBias === TrendBias.BULLISH && rsi > this.config.rsiLongThreshold) ||
      (trendBias === TrendBias.BEARISH && rsi < this.config.rsiShortThreshold);

    // Candle closed above/below EMAs
    const candleClosed =
      (trendBias === TrendBias.BULLISH && price > ema.fast && price > ema.slow) ||
      (trendBias === TrendBias.BEARISH && price < ema.fast && price < ema.slow);

    // ZigZag confirms new wave (HH for LONG, LL for SHORT)
    const structure = this.structureAnalyzer.identifyStructure(highs, lows);
    const zigzagConfirmed =
      (trendBias === TrendBias.BULLISH && structure === MarketStructure.HIGHER_HIGH) ||
      (trendBias === TrendBias.BEARISH && structure === MarketStructure.LOWER_LOW);

    const confirmed = rsiCrossed && candleClosed && zigzagConfirmed;

    const reason = confirmed
      ? 'Entry confirmed: RSI crossed, candle closed, ZigZag confirms'
      : `Entry not confirmed: RSI=${rsiCrossed}, candle=${candleClosed}, ZigZag=${zigzagConfirmed}`;

    return {
      confirmed,
      rsi,
      rsiCrossed,
      candleClosed,
      zigzagConfirmed,
      reason,
    };
  }

  // ============================================================================
  // FILTERS
  // ============================================================================

  /**
   * Check if EMA20 ≈ EMA50 (flat market)
   */
  private isEmaFlat(fast: number, slow: number): boolean {
    const diff = Math.abs(fast - slow) / slow;
    return diff < this.config.emaFlatThreshold;
  }

  /**
   * Check if RSI is in neutral zone (45-55)
   */
  private isRsiNeutral(rsi: number): boolean {
    return rsi >= this.config.rsiNeutralZone.min && rsi <= this.config.rsiNeutralZone.max;
  }

  /**
   * Check if price is too far from EMA50
   */
  private isPriceTooFar(price: number, ema50: number): boolean {
    const distance = Math.abs(price - ema50) / ema50;
    return distance > this.config.emaDistanceThreshold / PERCENT_MULTIPLIER;
  }

  /**
   * Check ATR volatility
   *
   * @param candles - PRIMARY timeframe candles
   * @returns ATRAnalysis result
   */
  private checkATR(candles: Candle[]): { isValid: boolean; value?: number; reason?: string } {
    if (!this.atrIndicator || !this.atrFilterConfig) {
      return { isValid: true }; // If not enabled, always valid
    }

    try {
      const atr = this.atrIndicator.calculate(candles);
      const { minimumATR, maximumATR } = this.atrFilterConfig;

      // Check if ATR is within valid range
      if (atr < minimumATR) {
        return {
          isValid: false,
          value: atr,
          reason: `ATR too low (${atr.toFixed(DECIMAL_PLACES.PERCENT)}% < ${minimumATR}%) - low volatility/flat market`,
        };
      }

      if (atr > maximumATR) {
        return {
          isValid: false,
          value: atr,
          reason: `ATR too high (${atr.toFixed(DECIMAL_PLACES.PERCENT)}% > ${maximumATR}%) - extreme volatility/risk`,
        };
      }

      // ATR is valid
      this.logger.debug(`ATR valid: ${atr.toFixed(DECIMAL_PLACES.PERCENT)}% (range: ${minimumATR}%-${maximumATR}%)`);
      return {
        isValid: true,
        value: atr,
      };
    } catch (error) {
      // If ATR calculation fails (e.g., not enough candles), treat as invalid
      this.logger.warn(`ATR calculation failed: ${error}`);
      return {
        isValid: false,
        reason: 'ATR calculation failed (not enough candles)',
      };
    }
  }

  // ============================================================================
  // CONFIDENCE CALCULATION
  // ============================================================================

  /**
   * Calculate confidence score (0-1)
   * Uses weights from config or defaults
   */
  private calculateConfidence(
    trend: TrendState,
    pullback: PullbackState,
    entry: EntryConfirmation,
    data?: SmartTrendData,
  ): number {
    // Use Weight Matrix if enabled and data provided
    if (this.weightMatrix && data) {
      const direction =
        trend.bias === TrendBias.BULLISH ? SignalDirection.LONG : SignalDirection.SHORT;

      // Build WeightMatrixInput
      const input: WeightMatrixInput = {
        rsi: data.rsi.entry,
        ema: data.ema.entry
          ? {
            fast: data.ema.entry.fast || 0,
            slow: data.ema.entry.slow || 0,
            price: data.currentPrice,
          }
          : undefined,
        swingPoints: { quality: trend.isValid ? MULTIPLIERS.NEUTRAL : 0.0 },
        seniorTFAlignment: {
          aligned: trend.isValid && pullback.detected,
          strength: trend.isValid && pullback.isComplete ? MULTIPLIERS.NEUTRAL : MULTIPLIERS.HALF,
        },
        tfAlignmentScore:
          data.tfAlignment && direction === SignalDirection.LONG
            ? data.tfAlignment.long.score
            : data.tfAlignment
              ? data.tfAlignment.short.score
              : undefined, // PHASE 6: Multi-timeframe alignment
      };

      const scoreBreakdown = this.weightMatrix.calculateScore(input, direction);
      const confidence = scoreBreakdown.confidence / PERCENT_MULTIPLIER; // Convert to 0-1 range

      // Log contributions for transparency
      this.logger.info('📊 SmartTrend Weight Matrix Score', {
        confidence: (confidence * PERCENT_MULTIPLIER).toFixed(1) + '%',
        totalScore: `${scoreBreakdown.totalScore.toFixed(1)}/${scoreBreakdown.maxPossibleScore}`,
        rsi: scoreBreakdown.contributions.rsi?.reason,
        ema: scoreBreakdown.contributions.ema?.reason,
        swingPoints: scoreBreakdown.contributions.swingPoints?.reason,
        seniorTF: scoreBreakdown.contributions.seniorTFAlignment?.reason,
      });

      return confidence;
    }

    // Legacy confidence calculation
    let confidence = 0;

    // Trend on 5m (critical - 50%)
    if (trend.isValid) {
      confidence += MULTIPLIERS.HALF;
    }

    // Pullback on 1m (important - 30%)
    if (pullback.detected) {
      confidence += pullback.isComplete ? (THRESHOLD_VALUES.THIRTY_PERCENT as number) : PERCENTAGE_THRESHOLDS.VERY_LOW;
    }

    // Entry confirmation (desirable - 20%)
    if (entry.confirmed) {
      confidence += THRESHOLD_VALUES.TWENTY_PERCENT as number;
    } else {
      // Partial credit for individual confirmations
      if (entry.rsiCrossed) {
        confidence += THRESHOLD_VALUES.TEN_PERCENT as number * (MULTIPLIER_VALUES.ZERO_POINT_NINE as number) * (THRESHOLD_VALUES.EIGHTY_PERCENT as number); // 0.10 * 0.9 * 0.8 ≈ 0.072 ≈ 0.07
      }
      if (entry.candleClosed) {
        confidence += THRESHOLD_VALUES.TEN_PERCENT as number * (MULTIPLIER_VALUES.ZERO_POINT_NINE as number) * (THRESHOLD_VALUES.EIGHTY_PERCENT as number); // 0.10 * 0.9 * 0.8 ≈ 0.072 ≈ 0.07
      }
      if (entry.zigzagConfirmed) {
        confidence += THRESHOLD_VALUES.SIXTY_PERCENT as number * (THRESHOLD_VALUES.TEN_PERCENT as number); // 0.6 * 0.1 = 0.06
      }
    }

    return Math.min(confidence, MULTIPLIER_VALUES.ONE as number);
  }
}
