/**
 * Timeframe Weighting Service (Phase 8.9.70)
 *
 * Applies weights to multi-timeframe analysis based on trading goal.
 * Combines trends from different timeframes using weights appropriate for:
 * - Swing trading (days)
 * - Day trading (hours)
 * - Scalping (minutes)
 *
 * Responsibilities:
 * - Store weighting strategies for different trading modes
 * - Combine weighted trends to calculate final bias
 * - Calculate consensus strength based on weighted average
 *
 * Error Handling Strategy (Phase 8.9.70):
 * - THROW: Input validation (null multiTF, invalid trading mode)
 * - THROW: Data validation (null timeframes, invalid bias/strength values)
 * - GRACEFUL_DEGRADE: Calculation failures (NaN/Infinity, division by zero) → safe defaults
 * - SKIP: Logging errors (silent fail for non-critical logging)
 */

import { LoggerService, MultiTimeframeAnalysis, TradingMode, TrendBias } from '../types';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';

// TrendBias enum values for comparisons

// ============================================================================
// TYPES
// ============================================================================

export interface TimeframeWeights {
  '5m': number;
  '15m': number;
  '1h': number;
  '4h': number;
}

export interface WeightedTrendResult {
  bias: TrendBias;
  strength: number;
  reasoning: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TRADING_MODE_WEIGHTS: Record<TradingMode, TimeframeWeights> = {
  [TradingMode.SWING]: {
    '5m': 0.1,  // Entry confirmation
    '15m': 0.2, // Micro-trend
    '1h': 0.3,  // Current trend
    '4h': 0.4,  // Primary trend
  },
  [TradingMode.DAY]: {
    '5m': 0.2,  // Entry confirmation
    '15m': 0.35, // Micro-trend (important)
    '1h': 0.4,  // Current trend (primary)
    '4h': 0.05, // Context (low weight)
  },
  [TradingMode.SCALP]: {
    '5m': 0.35, // Entry confirmation (critical)
    '15m': 0.4, // Micro-trend (primary)
    '1h': 0.05, // Context
    '4h': 0.2,  // Ignore shorter timeframes
  },
};

// ============================================================================
// SERVICE
// ============================================================================

export class TimeframeWeightingService {
  constructor(
    private readonly logger?: LoggerService,
    private readonly errorHandler?: ErrorHandler,
  ) {
    this.safeLog('info', '✅ TimeframeWeightingService initialized');
  }

  /**
   * Combine multi-timeframe analysis with weights based on trading mode
   *
   * @param multiTF - Multi-timeframe analysis result
   * @param tradingMode - Trading mode (swing, day, scalp)
   * @returns Weighted trend result with bias and strength
   * @throws On null/invalid multiTF or trading mode
   */
  combine(multiTF: MultiTimeframeAnalysis, tradingMode: TradingMode): WeightedTrendResult {
    // THROW: Input validation
    this.validateCombineInput(multiTF, tradingMode);

    try {
      // ========================================================================
      // GET WEIGHTS FOR TRADING MODE
      // ========================================================================

      const weights = TRADING_MODE_WEIGHTS[tradingMode];

      this.safeLog('debug', `⚖️  Combining trends for ${tradingMode} trading`, {
        weights,
      });

      // ========================================================================
      // EXTRACT BIASES AND STRENGTHS
      // ========================================================================

      const trends = {
        '5m': {
          bias: multiTF.byTimeframe['5m'].bias,
          strength: multiTF.byTimeframe['5m'].strength,
        },
        '15m': {
          bias: multiTF.byTimeframe['15m'].bias,
          strength: multiTF.byTimeframe['15m'].strength,
        },
        '1h': {
          bias: multiTF.byTimeframe['1h'].bias,
          strength: multiTF.byTimeframe['1h'].strength,
        },
        '4h': {
          bias: multiTF.byTimeframe['4h'].bias,
          strength: multiTF.byTimeframe['4h'].strength,
        },
      };

      // ========================================================================
      // CALCULATE WEIGHTED STRENGTH
      // ========================================================================

      const weightedStrength = this.calculateWeightedStrength(trends, weights);

      // Validate strength
      if (!Number.isFinite(weightedStrength)) {
        throw new Error('Weighted strength calculation resulted in invalid value');
      }

      // ========================================================================
      // DETERMINE FINAL BIAS USING VOTING + WEIGHTING
      // ========================================================================

      const finalBias = this.determineBiasByWeightedVoting(trends, weights);

      // ========================================================================
      // BUILD REASONING
      // ========================================================================

      const reasoning = this.buildReasoning(trends, weights, finalBias);

      // ========================================================================
      // LOG AND RETURN
      // ========================================================================

      this.safeLog('info', '✅ Weighted combination complete', {
        tradingMode,
        finalBias,
        weightedStrength: weightedStrength.toFixed(2),
        reasoning,
      });

      return {
        bias: finalBias,
        strength: weightedStrength,
        reasoning,
      };
    } catch (error) {
      // GRACEFUL_DEGRADE: Combination failures
      this.safeLog('error', `Weighting combination failed: ${error instanceof Error ? error.message : String(error)}`);
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      // Return safe default
      return {
        bias: TrendBias.NEUTRAL,
        strength: 0.5,
        reasoning: 'Combination failed, returning neutral',
      };
    }
  }

  /**
   * Validate combine input
   * @throws On invalid input
   */
  private validateCombineInput(multiTF: MultiTimeframeAnalysis, tradingMode: TradingMode): void {
    if (!multiTF || typeof multiTF !== 'object') {
      const error = new Error('MultiTF must be a valid object');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (!multiTF.byTimeframe || typeof multiTF.byTimeframe !== 'object') {
      const error = new Error('MultiTF.byTimeframe must be a valid object');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    const requiredTimeframes = ['5m', '15m', '1h', '4h'] as const;
    for (const tf of requiredTimeframes) {
      if (!multiTF.byTimeframe[tf]) {
        const error = new Error(`MultiTF.byTimeframe[${tf}] is missing`);
        if (this.errorHandler) {
          this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
        }
        throw error;
      }

      const tfData = multiTF.byTimeframe[tf];
      if (!tfData.bias || !Number.isFinite(tfData.strength)) {
        const error = new Error(`Invalid data for timeframe ${tf}: bias or strength is invalid`);
        if (this.errorHandler) {
          this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
        }
        throw error;
      }

      if (tfData.strength < 0 || tfData.strength > 1) {
        const error = new Error(`Strength for ${tf} must be between 0 and 1, got ${tfData.strength}`);
        if (this.errorHandler) {
          this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
        }
        throw error;
      }
    }

    if (!tradingMode || !Object.values(TradingMode).includes(tradingMode)) {
      const error = new Error(`Invalid trading mode: ${tradingMode}`);
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }
  }

  /**
   * Calculate weighted average strength across timeframes
   *
   * @param trends - Trend biases and strengths for each timeframe
   * @param weights - Weights for each timeframe
   * @returns Weighted average strength (0-1)
   */
  private calculateWeightedStrength(
    trends: Record<
      string,
      {
        strength: number;
      }
    >,
    weights: TimeframeWeights,
  ): number {
    const weighted =
      trends['5m'].strength * weights['5m'] +
      trends['15m'].strength * weights['15m'] +
      trends['1h'].strength * weights['1h'] +
      trends['4h'].strength * weights['4h'];

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, weighted));
  }

  /**
   * Determine final bias using weighted voting
   *
   * Each timeframe casts a "vote" with weight equal to its importance
   * BULLISH and BEARISH get full weight, NEUTRAL gets 0 weight
   *
   * @param trends - Trend biases for each timeframe
   * @param weights - Weights for each timeframe
   * @returns Final bias (BULLISH, BEARISH, or NEUTRAL)
   */
  private determineBiasByWeightedVoting(
    trends: Record<
      string,
      {
        bias: TrendBias;
      }
    >,
    weights: TimeframeWeights,
  ): TrendBias {
    // ========================================================================
    // CALCULATE WEIGHTED VOTES
    // ========================================================================

    let bullishWeight = 0;
    let bearishWeight = 0;

    const timeframes: (keyof TimeframeWeights)[] = ['5m', '15m', '1h', '4h'];

    for (const tf of timeframes) {
      const bias = trends[tf].bias;
      const weight = weights[tf];

      if (bias === TrendBias.BULLISH) {
        bullishWeight += weight;
      } else if (bias === TrendBias.BEARISH) {
        bearishWeight += weight;
      }
      // NEUTRAL doesn't contribute to either side
    }

    // ========================================================================
    // DETERMINE WINNER
    // ========================================================================

    // If one side has > 50% of weighted votes, it wins
    const total = bullishWeight + bearishWeight;

    if (total === 0) {
      // All NEUTRAL
      return TrendBias.NEUTRAL;
    }

    const bullishPercent = bullishWeight / total;
    const bearishPercent = bearishWeight / total;

    // Require > 50% consensus to be decisive
    if (bullishPercent > 0.5) {
      return TrendBias.BULLISH;
    }

    if (bearishPercent > 0.5) {
      return TrendBias.BEARISH;
    }

    // Close to 50-50 = NEUTRAL (conflicted)
    return TrendBias.NEUTRAL;
  }

  /**
   * Build reasoning explanation for the weighted combination
   *
   * @param trends - Trend biases for each timeframe
   * @param weights - Weights used
   * @param finalBias - Final bias result
   * @returns Reasoning string
   */
  private buildReasoning(
    trends: Record<
      string,
      {
        bias: TrendBias;
        strength: number;
      }
    >,
    weights: TimeframeWeights,
    finalBias: TrendBias,
  ): string {
    const parts: string[] = [];

    // Add individual timeframe opinions
    const timeframes: (keyof TimeframeWeights)[] = ['4h', '1h', '15m', '5m'];
    for (const tf of timeframes) {
      const bias = trends[tf].bias;
      const strength = trends[tf].strength;
      const weight = weights[tf];
      parts.push(
        `${tf}=${bias}(${strength.toFixed(2)},w=${(weight * 100).toFixed(0)}%)`,
      );
    }

    // Add final result
    parts.push(`→ Final=${finalBias}`);

    return parts.join(' ');
  }

  /**
   * Safe logging wrapper - SKIP strategy for logging errors
   */
  private safeLog(level: string, message: string, meta?: any): void {
    try {
      if (this.logger) {
        (this.logger as any)[level]?.(message, meta);
      }
    } catch (error) {
      // SKIP: Logging failures never block execution
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.SKIP });
      }
    }
  }
}
