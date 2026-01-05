import { DECIMAL_PLACES, MULTIPLIERS, PERCENT_MULTIPLIER } from '../constants';
import { INTEGER_MULTIPLIERS, RATIO_MULTIPLIERS, MATH_BOUNDS } from '../constants/technical.constants';
import {
  WeightMatrixConfig,
  WeightMatrixInput,
  IndicatorWeight,
  SignalScoreBreakdown,
  SignalDirection,
  LoggerService,
} from '../types';

/**
 * Weight Matrix Calculator Service
 *
 * Calculates signal confidence using gradient scoring instead of boolean filters.
 * Each indicator/factor contributes points based on thresholds (excellent/good/ok/weak).
 *
 * Example:
 * - RSI = 25 → 15 pts (good)
 * - Volume = 1.8x avg → 20 pts (good)
 * - Level touches = 4 → 20 pts (excellent)
 * Total: 55 pts → Confidence: 55%
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const SCORE_MULTIPLIERS = {
  EXCELLENT: MULTIPLIERS.NEUTRAL,      // 1.0 (full points)
  GOOD: MULTIPLIERS.THREE_QUARTER,     // 0.75 (75% of points)
  OK: MULTIPLIERS.HALF,                // 0.5 (50% of points)
  WEAK: MULTIPLIERS.QUARTER,           // 0.25 (25% of points)
} as const;

const RSI_DIVISOR = INTEGER_MULTIPLIERS.ONE_HUNDRED as number; // RSI inverted calculation (0-100 scale)

// ============================================================================
// WEIGHT MATRIX CALCULATOR SERVICE
// ============================================================================

export class WeightMatrixCalculatorService {
  constructor(
    private config: WeightMatrixConfig,
    private logger: LoggerService,
  ) {
    this.logger.info('WeightMatrixCalculatorService initialized', {
      enabled: config.enabled,
      minConfidenceToEnter: config.minConfidenceToEnter,
      minConfidenceForReducedSize: config.minConfidenceForReducedSize,
    });
  }

  /**
   * Calculate signal score from market data
   * @param input - Market data from analyzers/indicators
   * @param direction - Signal direction (LONG/SHORT)
   * @returns Score breakdown with confidence percentage
   */
  calculateScore(
    input: WeightMatrixInput,
    direction: SignalDirection,
  ): SignalScoreBreakdown {
    if (!this.config.enabled) {
      // Weight matrix disabled - return perfect score
      return {
        totalScore: MATH_BOUNDS.MAX_PERCENTAGE as number,
        maxPossibleScore: MATH_BOUNDS.MAX_PERCENTAGE as number,
        confidence: MATH_BOUNDS.MAX_PERCENTAGE as number,
        contributions: {},
      };
    }

    const contributions: SignalScoreBreakdown['contributions'] = {};
    let totalScore = 0;
    let maxPossibleScore = 0;

    // 1. RSI
    if (this.config.weights.rsi.enabled && input.rsi !== undefined) {
      const score = this.calculateRSIScore(input.rsi, direction, this.config.weights.rsi);
      contributions.rsi = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 2. Stochastic
    if (this.config.weights.stochastic.enabled && input.stochastic !== undefined) {
      const score = this.calculateStochasticScore(
        input.stochastic,
        direction,
        this.config.weights.stochastic,
      );
      contributions.stochastic = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 3. EMA
    if (this.config.weights.ema.enabled && input.ema !== undefined) {
      const score = this.calculateEMAScore(input.ema, direction, this.config.weights.ema);
      contributions.ema = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 4. Bollinger Bands
    if (this.config.weights.bollingerBands.enabled && input.bollingerBands !== undefined) {
      const score = this.calculateBollingerScore(
        input.bollingerBands,
        direction,
        this.config.weights.bollingerBands,
      );
      contributions.bollingerBands = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 5. ATR
    if (this.config.weights.atr.enabled && input.atr !== undefined) {
      const score = this.calculateATRScore(input.atr, this.config.weights.atr);
      contributions.atr = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 6. Volume
    if (this.config.weights.volume.enabled && input.volume !== undefined) {
      const score = this.calculateVolumeScore(input.volume, this.config.weights.volume);
      contributions.volume = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 7. Delta (Buy/Sell pressure)
    if (this.config.weights.delta.enabled && input.delta !== undefined) {
      const score = this.calculateDeltaScore(input.delta, direction, this.config.weights.delta);
      contributions.delta = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 8. Orderbook
    if (this.config.weights.orderbook.enabled && input.orderbook !== undefined) {
      const score = this.calculateOrderbookScore(input.orderbook, this.config.weights.orderbook);
      contributions.orderbook = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 9. Imbalance (Bid/Ask pressure)
    if (this.config.weights.imbalance.enabled && input.imbalance !== undefined) {
      const score = this.calculateImbalanceScore(input.imbalance, direction, this.config.weights.imbalance);
      contributions.imbalance = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 10. Level Strength
    if (this.config.weights.levelStrength.enabled && input.levelStrength !== undefined) {
      const score = this.calculateLevelStrengthScore(
        input.levelStrength,
        this.config.weights.levelStrength,
      );
      contributions.levelStrength = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 10. Level Distance
    if (this.config.weights.levelDistance.enabled && input.levelDistance !== undefined) {
      const score = this.calculateLevelDistanceScore(
        input.levelDistance,
        this.config.weights.levelDistance,
      );
      contributions.levelDistance = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 11. Swing Points
    if (this.config.weights.swingPoints.enabled && input.swingPoints !== undefined) {
      const score = this.calculateSwingPointsScore(
        input.swingPoints,
        this.config.weights.swingPoints,
      );
      contributions.swingPoints = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 12. Chart Patterns
    if (this.config.weights.chartPatterns.enabled && input.chartPatterns !== undefined) {
      const score = this.calculateChartPatternsScore(
        input.chartPatterns,
        this.config.weights.chartPatterns,
      );
      contributions.chartPatterns = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 13. Candle Patterns
    if (this.config.weights.candlePatterns.enabled && input.candlePatterns !== undefined) {
      const score = this.calculateCandlePatternsScore(
        input.candlePatterns,
        this.config.weights.candlePatterns,
      );
      contributions.candlePatterns = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 14. Senior TF Alignment
    if (this.config.weights.seniorTFAlignment.enabled && input.seniorTFAlignment !== undefined) {
      const score = this.calculateSeniorTFAlignmentScore(
        input.seniorTFAlignment,
        this.config.weights.seniorTFAlignment,
      );
      contributions.seniorTFAlignment = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 15. BTC Correlation
    if (this.config.weights.btcCorrelation.enabled && input.btcCorrelation !== undefined) {
      const score = this.calculateBTCCorrelationScore(
        input.btcCorrelation,
        this.config.weights.btcCorrelation,
      );
      contributions.btcCorrelation = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 16. TF Alignment (PHASE 6)
    if (this.config.weights.tfAlignment.enabled && input.tfAlignmentScore !== undefined) {
      const score = this.calculateTFAlignmentScore(
        input.tfAlignmentScore,
        this.config.weights.tfAlignment,
      );
      contributions.tfAlignment = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 17. Divergence
    if (this.config.weights.divergence.enabled && input.divergence !== undefined) {
      const score = this.calculateDivergenceScore(
        input.divergence,
        direction,
        this.config.weights.divergence,
      );
      contributions.divergence = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // 17. Liquidity Sweep
    if (this.config.weights.liquiditySweep.enabled && input.liquiditySweep !== undefined) {
      const score = this.calculateLiquiditySweepScore(
        input.liquiditySweep,
        this.config.weights.liquiditySweep,
      );
      contributions.liquiditySweep = score;
      totalScore += score.points;
      maxPossibleScore += score.maxPoints;
    }

    // Calculate confidence as decimal (0.0-1.0) - NOT percentage!
    const confidence = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) : 0;

    this.logger.debug('Signal score calculated', {
      totalScore,
      maxPossibleScore,
      confidence: (confidence * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PERCENT) + '%',
      factorsEvaluated: Object.keys(contributions).length,
    });

    return {
      totalScore,
      maxPossibleScore,
      confidence,
      contributions,
    };
  }

  /**
   * Check if signal confidence meets entry threshold
   * @param confidence - Confidence percentage (0-100)
   * @returns true if meets minimum threshold
   */
  shouldEnter(confidence: number): boolean {
    return confidence >= this.config.minConfidenceToEnter;
  }

  /**
   * Check if signal confidence meets reduced size threshold
   * @param confidence - Confidence percentage (0-100)
   * @returns true if meets reduced size threshold
   */
  shouldEnterWithReducedSize(confidence: number): boolean {
    return (
      confidence >= this.config.minConfidenceForReducedSize &&
      confidence < this.config.minConfidenceToEnter
    );
  }

  // ==========================================================================
  // INDIVIDUAL FACTOR SCORING METHODS
  // ==========================================================================

  /**
   * Calculate RSI score
   * LONG: Lower RSI = Higher score (oversold)
   * SHORT: Higher RSI = Higher score (overbought)
   */
  private calculateRSIScore(
    rsi: number,
    direction: SignalDirection,
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints, thresholds } = weight;

    // For LONG: RSI < threshold = better
    // For SHORT: RSI > (100 - threshold) = better
    const isLong = direction === SignalDirection.LONG;
    const targetRSI = isLong ? rsi : RSI_DIVISOR - rsi;

    if (thresholds.excellent && targetRSI <= thresholds.excellent) {
      return {
        points: maxPoints,
        maxPoints,
        reason: `RSI ${rsi.toFixed(1)} (excellent)`,
      };
    } else if (thresholds.good && targetRSI <= thresholds.good) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.GOOD,
        maxPoints,
        reason: `RSI ${rsi.toFixed(1)} (good)`,
      };
    } else if (thresholds.ok && targetRSI <= thresholds.ok) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.OK,
        maxPoints,
        reason: `RSI ${rsi.toFixed(1)} (ok)`,
      };
    } else if (thresholds.weak && targetRSI <= thresholds.weak) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.WEAK,
        maxPoints,
        reason: `RSI ${rsi.toFixed(1)} (weak)`,
      };
    }

    return {
      points: 0,
      maxPoints,
      reason: `RSI ${rsi.toFixed(1)} (not extreme)`,
    };
  }

  /**
   * Calculate Stochastic score
   * LONG: Lower %K = Higher score (oversold)
   * SHORT: Higher %K = Higher score (overbought)
   */
  private calculateStochasticScore(
    stochastic: { k: number; d: number },
    direction: SignalDirection,
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints, thresholds } = weight;
    const { k } = stochastic;

    const isLong = direction === SignalDirection.LONG;
    const targetK = isLong ? k : RSI_DIVISOR - k;

    if (thresholds.excellent && targetK <= thresholds.excellent) {
      return {
        points: maxPoints,
        maxPoints,
        reason: `Stoch %K ${k.toFixed(1)} (excellent)`,
      };
    } else if (thresholds.good && targetK <= thresholds.good) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.GOOD,
        maxPoints,
        reason: `Stoch %K ${k.toFixed(1)} (good)`,
      };
    } else if (thresholds.ok && targetK <= thresholds.ok) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.OK,
        maxPoints,
        reason: `Stoch %K ${k.toFixed(1)} (ok)`,
      };
    }

    return {
      points: 0,
      maxPoints,
      reason: `Stoch %K ${k.toFixed(1)} (not extreme)`,
    };
  }

  /**
   * Calculate EMA score
   * LONG: Price above EMA = Higher score
   * SHORT: Price below EMA = Higher score
   */
  private calculateEMAScore(
    ema: { fast: number; slow: number; price: number },
    direction: SignalDirection,
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints, thresholds } = weight;
    const { fast, slow, price } = ema;

    // Check EMA alignment
    const isLong = direction === SignalDirection.LONG;
    const correctAlignment = isLong ? fast > slow && price > fast : fast < slow && price < fast;

    if (!correctAlignment) {
      return {
        points: 0,
        maxPoints,
        reason: 'EMA not aligned',
      };
    }

    // Calculate distance to EMA (%)
    const distance = Math.abs((price - fast) / fast) * PERCENT_MULTIPLIER;

    if (thresholds.excellent && distance <= thresholds.excellent) {
      return {
        points: maxPoints,
        maxPoints,
        reason: `EMA distance ${distance.toFixed(DECIMAL_PLACES.PERCENT)}% (excellent)`,
      };
    } else if (thresholds.good && distance <= thresholds.good) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.GOOD,
        maxPoints,
        reason: `EMA distance ${distance.toFixed(DECIMAL_PLACES.PERCENT)}% (good)`,
      };
    } else if (thresholds.ok && distance <= thresholds.ok) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.OK,
        maxPoints,
        reason: `EMA distance ${distance.toFixed(DECIMAL_PLACES.PERCENT)}% (ok)`,
      };
    }

    return {
      points: 0,
      maxPoints,
      reason: `EMA distance ${distance.toFixed(DECIMAL_PLACES.PERCENT)}% (too far)`,
    };
  }

  /**
   * Calculate Bollinger Bands score
   * LONG: Price near lower band (position < 30) = Higher score
   * SHORT: Price near upper band (position > PERCENTAGE_THRESHOLDS.ULTRA_HIGH) = Higher score
   */
  private calculateBollingerScore(
    bollingerBands: { position: number },
    direction: SignalDirection,
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints, thresholds } = weight;
    const { position } = bollingerBands;

    // Convert position to extremity (0-100)
    // For LONG: lower position = higher extremity
    // For SHORT: higher position = higher extremity
    const isLong = direction === SignalDirection.LONG;
    const extremity = isLong ? RSI_DIVISOR - position : position;

    if (thresholds.excellent && extremity >= thresholds.excellent) {
      return {
        points: maxPoints,
        maxPoints,
        reason: `BB position ${position.toFixed(1)}% (excellent)`,
      };
    } else if (thresholds.good && extremity >= thresholds.good) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.GOOD,
        maxPoints,
        reason: `BB position ${position.toFixed(1)}% (good)`,
      };
    } else if (thresholds.ok && extremity >= thresholds.ok) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.OK,
        maxPoints,
        reason: `BB position ${position.toFixed(1)}% (ok)`,
      };
    }

    return {
      points: 0,
      maxPoints,
      reason: `BB position ${position.toFixed(1)}% (not extreme)`,
    };
  }

  /**
   * Calculate ATR score
   * Higher ATR = Higher volatility = Higher score
   */
  private calculateATRScore(
    atr: { current: number; average: number },
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints, thresholds } = weight;
    const { current, average } = atr;

    const ratio = current / average;

    if (thresholds.excellent && ratio >= thresholds.excellent) {
      return {
        points: maxPoints,
        maxPoints,
        reason: `ATR ${ratio.toFixed(DECIMAL_PLACES.PERCENT)}x avg (excellent)`,
      };
    } else if (thresholds.good && ratio >= thresholds.good) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.GOOD,
        maxPoints,
        reason: `ATR ${ratio.toFixed(DECIMAL_PLACES.PERCENT)}x avg (good)`,
      };
    } else if (thresholds.ok && ratio >= thresholds.ok) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.OK,
        maxPoints,
        reason: `ATR ${ratio.toFixed(DECIMAL_PLACES.PERCENT)}x avg (ok)`,
      };
    }

    return {
      points: 0,
      maxPoints,
      reason: `ATR ${ratio.toFixed(DECIMAL_PLACES.PERCENT)}x avg (low volatility)`,
    };
  }

  /**
   * Calculate Volume score
   * Higher volume = Higher score
   */
  private calculateVolumeScore(
    volume: { current: number; average: number },
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints, thresholds } = weight;
    const { current, average } = volume;

    const ratio = current / average;

    if (thresholds.excellent && ratio >= thresholds.excellent) {
      return {
        points: maxPoints,
        maxPoints,
        reason: `Volume ${ratio.toFixed(DECIMAL_PLACES.PERCENT)}x avg (excellent)`,
      };
    } else if (thresholds.good && ratio >= thresholds.good) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.GOOD,
        maxPoints,
        reason: `Volume ${ratio.toFixed(DECIMAL_PLACES.PERCENT)}x avg (good)`,
      };
    } else if (thresholds.ok && ratio >= thresholds.ok) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.OK,
        maxPoints,
        reason: `Volume ${ratio.toFixed(DECIMAL_PLACES.PERCENT)}x avg (ok)`,
      };
    } else if (thresholds.weak && ratio >= thresholds.weak) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.WEAK,
        maxPoints,
        reason: `Volume ${ratio.toFixed(DECIMAL_PLACES.PERCENT)}x avg (weak)`,
      };
    }

    return {
      points: 0,
      maxPoints,
      reason: `Volume ${ratio.toFixed(DECIMAL_PLACES.PERCENT)}x avg (too low)`,
    };
  }

  /**
   * Calculate Delta (Buy/Sell pressure) score
   * LONG: Buy pressure > Sell = Higher score
   * SHORT: Sell pressure > Buy = Higher score
   */
  private calculateDeltaScore(
    delta: { buyPressure: number; sellPressure: number },
    direction: SignalDirection,
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints, thresholds } = weight;
    const { buyPressure, sellPressure } = delta;

    const isLong = direction === SignalDirection.LONG;
    const ratio = isLong ? buyPressure / sellPressure : sellPressure / buyPressure;

    if (thresholds.excellent && ratio >= thresholds.excellent) {
      return {
        points: maxPoints,
        maxPoints,
        reason: `Delta ${ratio.toFixed(DECIMAL_PLACES.PERCENT)}:1 (excellent)`,
      };
    } else if (thresholds.good && ratio >= thresholds.good) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.GOOD,
        maxPoints,
        reason: `Delta ${ratio.toFixed(DECIMAL_PLACES.PERCENT)}:1 (good)`,
      };
    } else if (thresholds.ok && ratio >= thresholds.ok) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.OK,
        maxPoints,
        reason: `Delta ${ratio.toFixed(DECIMAL_PLACES.PERCENT)}:1 (ok)`,
      };
    }

    return {
      points: 0,
      maxPoints,
      reason: `Delta ${ratio.toFixed(DECIMAL_PLACES.PERCENT)}:1 (weak)`,
    };
  }

  /**
   * Calculate Orderbook (wall strength) score
   * Higher wall strength = Higher score
   */
  private calculateOrderbookScore(
    orderbook: { wallStrength: number },
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints, thresholds } = weight;
    const { wallStrength } = orderbook;

    if (thresholds.excellent && wallStrength >= thresholds.excellent) {
      return {
        points: maxPoints,
        maxPoints,
        reason: `Wall strength ${wallStrength.toFixed(0)} (excellent)`,
      };
    } else if (thresholds.good && wallStrength >= thresholds.good) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.GOOD,
        maxPoints,
        reason: `Wall strength ${wallStrength.toFixed(0)} (good)`,
      };
    } else if (thresholds.ok && wallStrength >= thresholds.ok) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.OK,
        maxPoints,
        reason: `Wall strength ${wallStrength.toFixed(0)} (ok)`,
      };
    }

    return {
      points: 0,
      maxPoints,
      reason: `Wall strength ${wallStrength.toFixed(0)} (weak)`,
    };
  }

  /**
   * Calculate Imbalance (Bid/Ask pressure) score
   * For LONG: BID imbalance (buying pressure) = Higher score
   * For SHORT: ASK imbalance (selling pressure) = Higher score
   */
  private calculateImbalanceScore(
    imbalance: { direction: 'BID' | 'ASK' | 'NEUTRAL'; strength: number },
    direction: SignalDirection,
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints, thresholds } = weight;
    const { direction: imbalanceDir, strength } = imbalance;

    // Check alignment: LONG wants BID imbalance, SHORT wants ASK imbalance
    const isLong = direction === SignalDirection.LONG;
    const aligned = (isLong && imbalanceDir === 'BID') || (!isLong && imbalanceDir === 'ASK');

    // No score if imbalance direction doesn't match signal direction or is NEUTRAL
    if (!aligned) {
      return {
        points: 0,
        maxPoints,
        reason: `Imbalance ${imbalanceDir} ${strength.toFixed(0)}% (not aligned)`,
      };
    }

    // Score based on strength thresholds
    if (thresholds.excellent && strength >= thresholds.excellent) {
      return {
        points: maxPoints,
        maxPoints,
        reason: `Imbalance ${imbalanceDir} ${strength.toFixed(0)}% (excellent)`,
      };
    } else if (thresholds.good && strength >= thresholds.good) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.GOOD,
        maxPoints,
        reason: `Imbalance ${imbalanceDir} ${strength.toFixed(0)}% (good)`,
      };
    } else if (thresholds.ok && strength >= thresholds.ok) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.OK,
        maxPoints,
        reason: `Imbalance ${imbalanceDir} ${strength.toFixed(0)}% (ok)`,
      };
    }

    return {
      points: 0,
      maxPoints,
      reason: `Imbalance ${imbalanceDir} ${strength.toFixed(0)}% (weak)`,
    };
  }

  /**
   * Calculate Level Strength score
   * More touches & bounces = Higher score
   */
  private calculateLevelStrengthScore(
    levelStrength: { touches: number; strength: number },
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints, thresholds } = weight;
    const { touches, strength } = levelStrength;

    if (thresholds.excellent && touches >= thresholds.excellent) {
      return {
        points: maxPoints,
        maxPoints,
        reason: `Level ${touches} touches (excellent)`,
      };
    } else if (thresholds.good && touches >= thresholds.good) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.GOOD,
        maxPoints,
        reason: `Level ${touches} touches (good)`,
      };
    } else if (thresholds.ok && touches >= thresholds.ok) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.OK,
        maxPoints,
        reason: `Level ${touches} touches (ok)`,
      };
    }

    return {
      points: 0,
      maxPoints,
      reason: `Level ${touches} touches (weak)`,
    };
  }

  /**
   * Calculate Level Distance score
   * Closer to level = Higher score
   */
  private calculateLevelDistanceScore(
    levelDistance: { percent: number },
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints, thresholds } = weight;
    const { percent } = levelDistance;

    if (thresholds.excellent && percent <= thresholds.excellent) {
      return {
        points: maxPoints,
        maxPoints,
        reason: `Level ${percent.toFixed(DECIMAL_PLACES.PERCENT)}% away (excellent)`,
      };
    } else if (thresholds.good && percent <= thresholds.good) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.GOOD,
        maxPoints,
        reason: `Level ${percent.toFixed(DECIMAL_PLACES.PERCENT)}% away (good)`,
      };
    } else if (thresholds.ok && percent <= thresholds.ok) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.OK,
        maxPoints,
        reason: `Level ${percent.toFixed(DECIMAL_PLACES.PERCENT)}% away (ok)`,
      };
    } else if (thresholds.weak && percent <= thresholds.weak) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.WEAK,
        maxPoints,
        reason: `Level ${percent.toFixed(DECIMAL_PLACES.PERCENT)}% away (weak)`,
      };
    }

    return {
      points: 0,
      maxPoints,
      reason: `Level ${percent.toFixed(DECIMAL_PLACES.PERCENT)}% away (too far)`,
    };
  }

  /**
   * Calculate Swing Points score
   * Higher quality swing = Higher score
   */
  private calculateSwingPointsScore(
    swingPoints: { quality: number },
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints } = weight;
    const { quality } = swingPoints;

    // Quality is 0-1, map to maxPoints
    const points = quality * maxPoints;

    return {
      points,
      maxPoints,
      reason: `Swing quality ${(quality * PERCENT_MULTIPLIER).toFixed(0)}%`,
    };
  }

  /**
   * Calculate Chart Patterns score
   * Stronger pattern = Higher score
   */
  private calculateChartPatternsScore(
    chartPatterns: { type: string; strength: number },
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints, thresholds } = weight;
    const { type, strength } = chartPatterns;

    if (thresholds.excellent && strength >= thresholds.excellent) {
      return {
        points: maxPoints,
        maxPoints,
        reason: `Pattern ${type} ${strength.toFixed(0)}% (excellent)`,
      };
    } else if (thresholds.good && strength >= thresholds.good) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.GOOD,
        maxPoints,
        reason: `Pattern ${type} ${strength.toFixed(0)}% (good)`,
      };
    } else if (thresholds.ok && strength >= thresholds.ok) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.OK,
        maxPoints,
        reason: `Pattern ${type} ${strength.toFixed(0)}% (ok)`,
      };
    }

    return {
      points: 0,
      maxPoints,
      reason: `Pattern ${type} ${strength.toFixed(0)}% (weak)`,
    };
  }

  /**
   * Calculate Candle Patterns score
   * Stronger pattern = Higher score
   */
  private calculateCandlePatternsScore(
    candlePatterns: { type: string; strength: number },
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints, thresholds } = weight;
    const { type, strength } = candlePatterns;

    if (thresholds.excellent && strength >= thresholds.excellent) {
      return {
        points: maxPoints,
        maxPoints,
        reason: `Candle ${type} ${strength.toFixed(0)}% (excellent)`,
      };
    } else if (thresholds.good && strength >= thresholds.good) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.GOOD,
        maxPoints,
        reason: `Candle ${type} ${strength.toFixed(0)}% (good)`,
      };
    } else if (thresholds.ok && strength >= thresholds.ok) {
      return {
        points: maxPoints * SCORE_MULTIPLIERS.OK,
        maxPoints,
        reason: `Candle ${type} ${strength.toFixed(0)}% (ok)`,
      };
    }

    return {
      points: 0,
      maxPoints,
      reason: `Candle ${type} ${strength.toFixed(0)}% (weak)`,
    };
  }

  /**
   * Calculate Senior TF Alignment score
   * Aligned with higher timeframe = Full points
   */
  private calculateSeniorTFAlignmentScore(
    seniorTFAlignment: { aligned: boolean; strength: number },
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints } = weight;
    const { aligned, strength } = seniorTFAlignment;

    if (aligned) {
      const points = maxPoints * strength;
      return {
        points,
        maxPoints,
        reason: `Senior TF aligned ${(strength * PERCENT_MULTIPLIER).toFixed(0)}%`,
      };
    }

    return {
      points: 0,
      maxPoints,
      reason: 'Senior TF not aligned',
    };
  }

  /**
   * Calculate BTC Correlation score
   * Aligned with BTC = Full points
   */
  private calculateBTCCorrelationScore(
    btcCorrelation: { correlation: number },
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints } = weight;
    const { correlation } = btcCorrelation;

    // Correlation is 0-1
    const points = correlation * maxPoints;

    return {
      points,
      maxPoints,
      reason: `BTC correlation ${(correlation * PERCENT_MULTIPLIER).toFixed(0)}%`,
    };
  }

  /**
   * Calculate Divergence score
   * LONG: Bullish divergence = Full points
   * SHORT: Bearish divergence = Full points
   */
  private calculateDivergenceScore(
    divergence: { type: string; strength: number },
    direction: SignalDirection,
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints } = weight;
    const { type, strength } = divergence;

    const isLong = direction === SignalDirection.LONG;
    const correctType = (isLong && type === 'BULLISH') || (!isLong && type === 'BEARISH');

    if (correctType) {
      const points = maxPoints * strength;
      return {
        points,
        maxPoints,
        reason: `Divergence ${type} ${(strength * PERCENT_MULTIPLIER).toFixed(0)}%`,
      };
    }

    return {
      points: 0,
      maxPoints,
      reason: `Divergence ${type} (wrong direction)`,
    };
  }

  /**
   * Calculate Liquidity Sweep score
   * Sweep detected = Full points
   */
  private calculateLiquiditySweepScore(
    liquiditySweep: { detected: boolean; confidence: number },
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints } = weight;
    const { detected, confidence } = liquiditySweep;

    if (detected) {
      const points = maxPoints * confidence;
      return {
        points,
        maxPoints,
        reason: `Liquidity sweep ${(confidence * PERCENT_MULTIPLIER).toFixed(0)}% confidence`,
      };
    }

    return {
      points: 0,
      maxPoints,
      reason: 'No liquidity sweep',
    };
  }

  /**
   * Calculate TF Alignment score (PHASE 6)
   * Higher alignment score = More points
   *
   * @param alignmentScore - Score from TFAlignmentService (0-100)
   * @param weight - Weight configuration
   * @returns Score breakdown
   */
  private calculateTFAlignmentScore(
    alignmentScore: number,
    weight: IndicatorWeight,
  ): { points: number; maxPoints: number; reason: string } {
    const { maxPoints, thresholds } = weight;

    // Use gradient scoring based on alignment score
    let points = 0;

    if (alignmentScore >= (thresholds.excellent ?? 90)) {
      // Excellent: 90%+ alignment → Full points
      points = maxPoints;
    } else if (alignmentScore >= (thresholds.good ?? 70)) {
      // Good: 70-89% alignment → 75% points
      points = maxPoints * (RATIO_MULTIPLIERS.THREE_QUARTER as number);
    } else if (alignmentScore >= (thresholds.ok ?? 50)) {
      // OK: 50-69% alignment → 50% points
      points = maxPoints * (RATIO_MULTIPLIERS.HALF as number);
    } else {
      // Weak: <50% alignment → 25% points
      points = maxPoints * (RATIO_MULTIPLIERS.QUARTER as number);
    }

    return {
      points,
      maxPoints,
      reason: `TF Alignment ${alignmentScore.toFixed(0)}%`,
    };
  }
}
