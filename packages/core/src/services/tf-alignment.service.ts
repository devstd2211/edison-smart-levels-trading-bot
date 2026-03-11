import { CONFIDENCE_THRESHOLDS, PERCENT_MULTIPLIER } from '../constants';
/**
 * Timeframe Alignment Service (PHASE 6 + Phase 8.9.69)
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
 * Error Handling Strategy (Phase 8.9.69):
 * - THROW: Invalid input validation (null/undefined indicators, invalid direction)
 * - THROW: Config validation (null config, invalid weights, invalid minAlignmentScore)
 * - GRACEFUL_DEGRADE: Calculation failures (NaN/Infinity in prices/EMAs) → safe defaults
 * - SKIP: Logging errors (silent fail for non-critical logging)
 *
 * Example:
 * LONG signal at $100
 * - Entry M1: $100 > EMA20($99) ✅ +20 points
 * - Primary M5: $100 > EMA20($98) ✅ +30, $100 > EMA50($97) ✅ +20
 * - Trend1 M30: EMA20($99) > EMA50($96) ✅ +30 points
 * Total: 100 points → fully aligned → boost confidence
 */

import { TFAlignmentConfig, TFAlignmentResult, LoggerService } from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { getErrorMessage, normalizeError } from '../utils/error.utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const PRIMARY_EMA20_WEIGHT = CONFIDENCE_THRESHOLDS.LOW / PERCENT_MULTIPLIER; // 0.6 (60% of primary weight)
const PRIMARY_EMA50_WEIGHT = 0.4; // 40% of primary weight

// ============================================================================
// TF ALIGNMENT SERVICE
// ============================================================================

export class TFAlignmentService {
  private static isWeightedTimeframe(
    value: unknown,
  ): value is { weight: number } {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const weighted = value as { weight?: unknown };
    return Number.isFinite(weighted.weight);
  }

  constructor(
    private config?: TFAlignmentConfig,
    private logger?: LoggerService,
    private errorHandler?: ErrorHandler,
  ) {
    // THROW: Config validation
    if (this.config) {
      this.validateConfig(this.config);
    }
  }

  private handleRecoveryError(error: unknown, strategy: RecoveryStrategy): void {
    if (!this.errorHandler) {
      return;
    }

    this.errorHandler.handle(normalizeError(error), { strategy }).catch(() => { /* Silent */ });
  }

  /**
   * Calculate timeframe alignment score
   *
   * @param direction - Trade direction ('LONG' or 'SHORT')
   * @param currentPrice - Current market price
   * @param indicators - Indicator values from all timeframes
   * @returns TFAlignmentResult with score, aligned flag, contributions, and details
   * @throws On invalid input or disabled config
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
    // THROW: Input validation
    this.validateAlignmentInput(direction, currentPrice, indicators);

    if (!this.config || !this.config.enabled) {
      return this.createDisabledResult();
    }

    try {
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

      // Validate score
      if (!Number.isFinite(score)) {
        throw new Error('Score calculation resulted in invalid value');
      }

      // ========================================================================
      // Result
      // ========================================================================
      const aligned = score >= this.config.minAlignmentScore;

      const details = `Entry: ${contributions.entry}, Primary: ${contributions.primary.toFixed(0)}, Trend1: ${contributions.trend1}`;

      this.safeLog('debug', 'TF Alignment calculated', {
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
    } catch (error) {
      // GRACEFUL_DEGRADE: Calculation failures
      this.safeLog('error', `Alignment calculation failed: ${getErrorMessage(error)}`);
      this.handleRecoveryError(error, RecoveryStrategy.GRACEFUL_DEGRADE);
      return this.createDisabledResult();
    }
  }

  /**
   * Validate alignment input
   * @throws On invalid input
   */
  private validateAlignmentInput(
    direction: 'LONG' | 'SHORT',
    currentPrice: number,
    indicators: {
      entry: { ema20: number };
      primary: { ema20: number; ema50: number };
      trend1: { ema20: number; ema50: number };
    },
  ): void {
    if (direction !== 'LONG' && direction !== 'SHORT') {
      const error = new Error("Direction must be 'LONG' or 'SHORT'");
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (!Number.isFinite(currentPrice)) {
      const error = new Error('Current price must be a valid finite number');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (!indicators || typeof indicators !== 'object') {
      const error = new Error('Indicators must be a valid object');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (!indicators.entry || !Number.isFinite(indicators.entry.ema20)) {
      const error = new Error('Invalid entry indicator data');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (!indicators.primary || !Number.isFinite(indicators.primary.ema20) || !Number.isFinite(indicators.primary.ema50)) {
      const error = new Error('Invalid primary indicator data');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (!indicators.trend1 || !Number.isFinite(indicators.trend1.ema20) || !Number.isFinite(indicators.trend1.ema50)) {
      const error = new Error('Invalid trend1 indicator data');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }
  }

  /**
   * Validate config
   * @throws On invalid config
   */
  private validateConfig(config: TFAlignmentConfig): void {
    if (!config || typeof config !== 'object') {
      const error = new Error('Config must be a valid object');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (typeof config.enabled !== 'boolean') {
      const error = new Error('Config.enabled must be a boolean');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (!Number.isFinite(config.minAlignmentScore) || config.minAlignmentScore < 0 || config.minAlignmentScore > 100) {
      const error = new Error('Config.minAlignmentScore must be a number between 0 and 100');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (!config.timeframes || typeof config.timeframes !== 'object') {
      const error = new Error('Config.timeframes must be a valid object');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    const validateTFWeights = (tf: unknown, tfName: string) => {
      if (!TFAlignmentService.isWeightedTimeframe(tf) || tf.weight < 0) {
        const error = new Error(`Config.timeframes.${tfName}.weight must be a positive number`);
        if (this.errorHandler) {
          this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
        }
        throw error;
      }
    };

    validateTFWeights(config.timeframes.entry, 'entry');
    validateTFWeights(config.timeframes.primary, 'primary');
    validateTFWeights(config.timeframes.trend1, 'trend1');
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
  getConfig(): TFAlignmentConfig | undefined {
    return this.config ? { ...this.config } : undefined;
  }

  /**
   * Safe logging wrapper - SKIP strategy for logging errors
   */
  private safeLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.logger) {
        this.logger[level]?.(message, meta);
      }
    } catch (error) {
      // SKIP: Logging failures never block execution
      this.handleRecoveryError(error, RecoveryStrategy.SKIP);
    }
  }
}
