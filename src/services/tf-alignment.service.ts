import { CONFIDENCE_THRESHOLDS, PERCENT_MULTIPLIER } from '../constants';
/**
 * Timeframe Alignment Service (PHASE 6)
 *
 * Calculates multi-timeframe alignment score to boost signal confidence.
 * When all timeframes agree on direction, signal gets higher confidence.
 *
 * Scoring Logic:
 * - Entry TF (M1): price > EMA20 → +20 points
 * - Primary TF (M5): price > EMA20 → +30, price > EMA50 → +20
 * - Trend1 TF (M30): EMA20 > EMA50 → +30 points
 *
 * Total: 0-100 points
 * If score >= minAlignmentScore → aligned = true
 *
 * Example:
 * LONG signal at $100
 * - Entry M1: $100 > EMA20($99) ✅ +20 points
 * - Primary M5: $100 > EMA20($98) ✅ +30, $100 > EMA50($97) ✅ +20
 * - Trend1 M30: EMA20($99) > EMA50($96) ✅ +30 points
 * Total: 100 points → fully aligned → boost confidence
 */

import { TFAlignmentConfig, TFAlignmentResult, LoggerService } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

const PRIMARY_EMA20_WEIGHT = CONFIDENCE_THRESHOLDS.LOW / PERCENT_MULTIPLIER; // 0.6 (60% of primary weight)
const PRIMARY_EMA50_WEIGHT = 0.4; // 40% of primary weight

// ============================================================================
// TF ALIGNMENT SERVICE
// ============================================================================

export class TFAlignmentService {
  constructor(
    private config: TFAlignmentConfig,
    private logger: LoggerService,
  ) {}

  /**
   * Calculate timeframe alignment score
   *
   * @param direction - Trade direction ('LONG' or 'SHORT')
   * @param currentPrice - Current market price
   * @param indicators - Indicator values from all timeframes
   * @returns TFAlignmentResult with score, aligned flag, contributions, and details
   */
  calculateAlignment(
    direction: 'LONG' | 'SHORT',
    currentPrice: number,
    indicators: {
      entry: { ema20: number };
      primary: { ema20: number; ema50: number };
      trend1: { ema20: number; ema50: number };
    },
  ): TFAlignmentResult {
    if (!this.config.enabled) {
      return this.createDisabledResult();
    }

    let score = 0;
    const contributions = { entry: 0, primary: 0, trend1: 0 };

    // ========================================================================
    // Entry TF (M1): Price vs EMA20
    // ========================================================================
    const entryAligned =
      direction === 'LONG'
        ? currentPrice > indicators.entry.ema20
        : currentPrice < indicators.entry.ema20;

    if (entryAligned) {
      contributions.entry = this.config.timeframes.entry.weight;
      score += contributions.entry;
    }

    // ========================================================================
    // Primary TF (M5): Price vs EMA20 + EMA50
    // ========================================================================
    const primaryEMA20Aligned =
      direction === 'LONG'
        ? currentPrice > indicators.primary.ema20
        : currentPrice < indicators.primary.ema20;

    const primaryEMA50Aligned =
      direction === 'LONG'
        ? currentPrice > indicators.primary.ema50
        : currentPrice < indicators.primary.ema50;

    if (primaryEMA20Aligned) {
      contributions.primary +=
        this.config.timeframes.primary.weight * PRIMARY_EMA20_WEIGHT;
    }

    if (primaryEMA50Aligned) {
      contributions.primary +=
        this.config.timeframes.primary.weight * PRIMARY_EMA50_WEIGHT;
    }

    score += contributions.primary;

    // ========================================================================
    // Trend1 TF (M30): EMA20 vs EMA50 (trend direction)
    // ========================================================================
    const trend1Aligned =
      direction === 'LONG'
        ? indicators.trend1.ema20 > indicators.trend1.ema50
        : indicators.trend1.ema20 < indicators.trend1.ema50;

    if (trend1Aligned) {
      contributions.trend1 = this.config.timeframes.trend1.weight;
      score += contributions.trend1;
    }

    // ========================================================================
    // Result
    // ========================================================================
    const aligned = score >= this.config.minAlignmentScore;

    const details = `Entry: ${contributions.entry}, Primary: ${contributions.primary.toFixed(0)}, Trend1: ${contributions.trend1}`;

    this.logger.debug('TF Alignment calculated', {
      direction,
      score: score.toFixed(0),
      aligned,
      details,
    });

    return {
      score,
      aligned,
      contributions,
      details,
    };
  }

  /**
   * Create result for disabled service
   */
  private createDisabledResult(): TFAlignmentResult {
    return {
      score: 0,
      aligned: false,
      contributions: { entry: 0, primary: 0, trend1: 0 },
      details: 'TF Alignment disabled',
    };
  }

  /**
   * Get configuration
   */
  getConfig(): TFAlignmentConfig {
    return { ...this.config };
  }
}
