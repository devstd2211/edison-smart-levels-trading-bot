/**
 * Phase 11.1: Dynamic Position Sizer Service
 *
 * Calculates optimal position size based on:
 * - Kelly Criterion (fractional)
 * - Account risk limits
 * - Signal confidence
 * - Market volatility (ATR)
 *
 * Recovery Strategies:
 * - THROW: Invalid config, invalid inputs (null, NaN, negative values)
 * - GRACEFUL_DEGRADE: Calculation failures → return minimum position size
 * - SKIP: Logging failures
 *
 * Created: 2026-02-09 (Session 96)
 */

import { LoggerService } from './logger.service';
import { ErrorHandler, RecoveryStrategy } from '../errors';
import {
  MAX_KELLY_FRACTION,
  MIN_WIN_PROBABILITY,
  DEFAULT_RISK_REWARD_RATIO,
  MIN_RISK_REWARD_RATIO,
  MIN_ATR_VALUE,
  MAX_VOLATILITY_ADJUSTMENT,
  MIN_VOLATILITY_ADJUSTMENT,
  DEFAULT_RISK_PERCENT,
  ABSOLUTE_MAX_RISK_PERCENT,
  MIN_ACCOUNT_BALANCE,
  MAX_ACCOUNT_UTILIZATION,
  MIN_POSITION_SIZE_USD,
  MAX_POSITION_SIZE_PERCENT,
  POSITION_SIZE_DUST_THRESHOLD,
  MIN_CONFIDENCE_THRESHOLD,
  REDUCED_SIZE_CONFIDENCE_THRESHOLD,
  INCREASED_SIZE_CONFIDENCE_THRESHOLD,
  MAX_CONFIDENCE_MULTIPLIER,
  MIN_CONFIDENCE_MULTIPLIER,
  POSITION_SIZE_DECIMALS,
  MIN_PRICE_DIFFERENCE,
  FALLBACK_POSITION_SIZE,
  FALLBACK_SIZING_DECISION,
} from '../constants/phase-11-constants';
import {
  calculateConfidenceMultiplierValue,
  calculateKellyPositionSize,
  calculateRiskAdjustedSize,
  calculateVolatilityAdjustmentValue,
  roundPositionSizeValue,
} from './dynamic-position-sizer/dynamic-position-sizer-state.utils';

export interface SizingConfig {
  baseRiskPercent: number; // % of account to risk per trade (e.g., 1.0 = 1%)
  maxRiskPercent: number; // Maximum risk % (e.g., 3.0 = 3%)
  minPositionSize: number; // Minimum position size in USD
  maxPositionSize: number; // Maximum position size in USD
  volatilityMultiplier: number; // ATR adjustment factor (1.0 = neutral)
  confidenceThreshold: number; // Minimum confidence to trade (0-1)
}

export interface SizingDecision {
  baseSize: number; // Initial calculated size (USD)
  adjustedSize: number; // Final size after all adjustments (USD)
  riskPercent: number; // Risk as % of account
  maxRisk: number; // Maximum allowed risk (USD)
  recommendation: 'increase' | 'maintain' | 'reduce';
  confidence: number; // Signal confidence factor
  volatilityAdjustment: number; // ATR-based multiplier
}

export class DynamicPositionSizerService {
  private readonly config: SizingConfig;

  constructor(
    config: SizingConfig,
    private logger?: LoggerService,
    private errorHandler?: ErrorHandler
  ) {
    // THROW validation - must be BEFORE try-catch
    if (!config) {
      throw new Error('DynamicPositionSizerService: config is required');
    }
    if (config.baseRiskPercent == null || config.baseRiskPercent < 0) {
      throw new Error(
        'DynamicPositionSizerService: baseRiskPercent must be >= 0'
      );
    }
    if (config.maxRiskPercent == null || config.maxRiskPercent < 0) {
      throw new Error(
        'DynamicPositionSizerService: maxRiskPercent must be >= 0'
      );
    }
    if (config.baseRiskPercent > config.maxRiskPercent) {
      throw new Error(
        'DynamicPositionSizerService: baseRiskPercent cannot exceed maxRiskPercent'
      );
    }
    if (config.minPositionSize == null || config.minPositionSize < 0) {
      throw new Error(
        'DynamicPositionSizerService: minPositionSize must be >= 0'
      );
    }
    if (config.maxPositionSize == null || config.maxPositionSize < 0) {
      throw new Error(
        'DynamicPositionSizerService: maxPositionSize must be >= 0'
      );
    }
    if (config.minPositionSize > config.maxPositionSize) {
      throw new Error(
        'DynamicPositionSizerService: minPositionSize cannot exceed maxPositionSize'
      );
    }

    this.config = config;
  }

  /**
   * Calculate optimal position size for entry
   *
   * @param entryPrice Entry price
   * @param stopLoss Stop loss price
   * @param accountBalance Current account balance
   * @param confidence Signal confidence (0-1)
   * @param currentATR Current ATR value
   * @param averageATR Average ATR over period
   * @param riskRewardRatio Expected RR ratio (default: 1.5)
   * @returns SizingDecision with optimal size
   */
  async calculateOptimalSize(
    entryPrice: number,
    stopLoss: number,
    accountBalance: number,
    confidence: number,
    currentATR?: number,
    averageATR?: number,
    riskRewardRatio: number = DEFAULT_RISK_REWARD_RATIO
  ): Promise<SizingDecision> {
    // THROW validation - must be OUTSIDE try-catch
    if (entryPrice == null || isNaN(entryPrice) || entryPrice <= 0) {
      throw new Error(
        'DynamicPositionSizerService.calculateOptimalSize: entryPrice must be a positive number'
      );
    }
    if (stopLoss == null || isNaN(stopLoss) || stopLoss <= 0) {
      throw new Error(
        'DynamicPositionSizerService.calculateOptimalSize: stopLoss must be a positive number'
      );
    }
    if (
      accountBalance == null ||
      isNaN(accountBalance) ||
      accountBalance < 0
    ) {
      throw new Error(
        'DynamicPositionSizerService.calculateOptimalSize: accountBalance must be >= 0'
      );
    }
    if (confidence == null || isNaN(confidence)) {
      throw new Error(
        'DynamicPositionSizerService.calculateOptimalSize: confidence must be a number'
      );
    }
    if (riskRewardRatio != null && riskRewardRatio < 0) {
      throw new Error(
        'DynamicPositionSizerService.calculateOptimalSize: riskRewardRatio must be >= 0'
      );
    }

    try {
      // Check minimum account balance
      if (accountBalance < MIN_ACCOUNT_BALANCE) {
        this.safeLog(
          'warn',
          `Account balance ${accountBalance} below minimum ${MIN_ACCOUNT_BALANCE}`
        );
        return { ...FALLBACK_SIZING_DECISION, recommendation: 'reduce' as const };
      }

      // Check minimum confidence
      if (confidence < MIN_CONFIDENCE_THRESHOLD) {
        this.safeLog(
          'info',
          `Confidence ${confidence} below threshold ${MIN_CONFIDENCE_THRESHOLD}`
        );
        return { ...FALLBACK_SIZING_DECISION, confidence, recommendation: 'reduce' as const };
      }

      // Calculate base size using Kelly Criterion
      const kellySize = this.calculateKellySize(
        confidence,
        riskRewardRatio,
        accountBalance
      );

      // Adjust for volatility if ATR provided
      let volatilityAdjustment = 1.0;
      if (currentATR != null && averageATR != null) {
        volatilityAdjustment = this.adjustForVolatility(
          kellySize,
          currentATR,
          averageATR
        );
      }

      const sizeAfterVolatility = kellySize * volatilityAdjustment;

      // Adjust for confidence level
      const confidenceMultiplier =
        this.calculateConfidenceMultiplier(confidence);
      const sizeAfterConfidence = sizeAfterVolatility * confidenceMultiplier;

      // Calculate risk % based on stop distance
      const stopDistance = Math.abs(entryPrice - stopLoss);
      if (stopDistance < MIN_PRICE_DIFFERENCE) {
        this.safeLog(
          'warn',
          `Stop distance ${stopDistance} too small, using fallback`
        );
        return { ...FALLBACK_SIZING_DECISION, confidence, volatilityAdjustment };
      }

      // Apply account risk limits
      const adjustedSize = this.adjustForAccountRisk(
        sizeAfterConfidence,
        accountBalance,
        entryPrice,
        stopDistance
      );

      // Calculate final risk %
      const riskPercent = (adjustedSize * stopDistance / entryPrice / accountBalance) * 100;

      // Determine recommendation
      let recommendation: 'increase' | 'maintain' | 'reduce';
      if (confidence >= INCREASED_SIZE_CONFIDENCE_THRESHOLD && volatilityAdjustment >= 1.0) {
        recommendation = 'increase';
      } else if (confidence < REDUCED_SIZE_CONFIDENCE_THRESHOLD || volatilityAdjustment < 0.7) {
        recommendation = 'reduce';
      } else {
        recommendation = 'maintain';
      }

      // Round to precision
      const finalSize = this.roundToDecimals(
        Math.max(adjustedSize, this.config.minPositionSize),
        POSITION_SIZE_DECIMALS
      );

      return {
        baseSize: this.roundToDecimals(kellySize, POSITION_SIZE_DECIMALS),
        adjustedSize: finalSize,
        riskPercent: this.roundToDecimals(riskPercent, 2),
        maxRisk: this.roundToDecimals(
          (accountBalance * this.config.maxRiskPercent) / 100,
          POSITION_SIZE_DECIMALS
        ),
        recommendation,
        confidence,
        volatilityAdjustment: this.roundToDecimals(volatilityAdjustment, 2),
      };
    } catch (error) {
      // GRACEFUL_DEGRADE: return fallback on error
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        });
      }
      this.safeLog('error', 'Failed to calculate optimal size, using fallback');
      return { ...FALLBACK_SIZING_DECISION, confidence };
    }
  }

  /**
   * Adjust position size based on volatility (ATR)
   *
   * @param baseSize Base position size
   * @param currentATR Current ATR value
   * @param averageATR Average ATR over period
   * @returns Volatility adjustment multiplier
   */
  adjustForVolatility(
    baseSize: number,
    currentATR: number,
    averageATR: number
  ): number {
    // THROW validation
    if (baseSize == null || isNaN(baseSize) || baseSize < 0) {
      throw new Error(
        'DynamicPositionSizerService.adjustForVolatility: baseSize must be >= 0'
      );
    }
    if (currentATR == null || isNaN(currentATR) || currentATR < 0) {
      throw new Error(
        'DynamicPositionSizerService.adjustForVolatility: currentATR must be >= 0'
      );
    }
    if (averageATR == null || isNaN(averageATR) || averageATR < 0) {
      throw new Error(
        'DynamicPositionSizerService.adjustForVolatility: averageATR must be >= 0'
      );
    }

    try {
      return calculateVolatilityAdjustmentValue({
        currentATR,
        averageATR,
        minimumAtrValue: MIN_ATR_VALUE,
        volatilityMultiplier: this.config.volatilityMultiplier,
        minVolatilityAdjustment: MIN_VOLATILITY_ADJUSTMENT,
        maxVolatilityAdjustment: MAX_VOLATILITY_ADJUSTMENT,
      });
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
        });
      }
      return 1.0; // Neutral adjustment on error
    }
  }

  /**
   * Adjust position size for account risk limits
   *
   * @param size Desired position size
   * @param accountBalance Account balance
   * @param entryPrice Entry price
   * @param stopDistance Distance to stop loss
   * @returns Adjusted size within risk limits
   */
  adjustForAccountRisk(
    size: number,
    accountBalance: number,
    entryPrice: number,
    stopDistance: number
  ): number {
    // THROW validation
    if (size == null || isNaN(size) || size < 0) {
      throw new Error(
        'DynamicPositionSizerService.adjustForAccountRisk: size must be >= 0'
      );
    }
    if (
      accountBalance == null ||
      isNaN(accountBalance) ||
      accountBalance < 0
    ) {
      throw new Error(
        'DynamicPositionSizerService.adjustForAccountRisk: accountBalance must be >= 0'
      );
    }

    try {
      const adjustedSize = calculateRiskAdjustedSize({
        size,
        accountBalance,
        entryPrice,
        stopDistance,
        maxRiskPercent: this.config.maxRiskPercent,
        absoluteMaxRiskPercent: ABSOLUTE_MAX_RISK_PERCENT,
        maxPositionSize: this.config.maxPositionSize,
        maxPositionSizePercent: MAX_POSITION_SIZE_PERCENT,
        dustThreshold: POSITION_SIZE_DUST_THRESHOLD,
        minPositionSize: this.config.minPositionSize,
      });

      const positionRisk = (size * stopDistance) / entryPrice;
      const maxRiskUSD = (accountBalance * this.config.maxRiskPercent) / 100;
      const maxRiskUSDAbsolute =
        (accountBalance * ABSOLUTE_MAX_RISK_PERCENT) / 100;

      if (positionRisk > maxRiskUSD) {
        this.safeLog(
          'info',
          `Size reduced from ${size} to ${adjustedSize} to meet max risk ${maxRiskUSD}`
        );
      }

      if (positionRisk > maxRiskUSDAbsolute) {
        this.safeLog(
          'warn',
          `Size capped at ${adjustedSize} due to absolute max risk ${maxRiskUSDAbsolute}`
        );
      }

      return adjustedSize;
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
        });
      }
      return Math.max(FALLBACK_POSITION_SIZE, this.config.minPositionSize);
    }
  }

  /**
   * Calculate maximum allowed position based on risk %
   *
   * @param maxRiskPercent Maximum risk as % of account
   * @param accountBalance Current account balance
   * @returns Maximum position size in USD
   */
  calculateMaxPosition(
    maxRiskPercent: number,
    accountBalance: number
  ): number {
    // THROW validation
    if (maxRiskPercent == null || isNaN(maxRiskPercent) || maxRiskPercent < 0) {
      throw new Error(
        'DynamicPositionSizerService.calculateMaxPosition: maxRiskPercent must be >= 0'
      );
    }
    if (
      accountBalance == null ||
      isNaN(accountBalance) ||
      accountBalance < 0
    ) {
      throw new Error(
        'DynamicPositionSizerService.calculateMaxPosition: accountBalance must be >= 0'
      );
    }

    try {
      // Clamp risk percent to absolute maximum
      const safeRiskPercent = Math.min(
        maxRiskPercent,
        ABSOLUTE_MAX_RISK_PERCENT
      );

      // Calculate max position as % of account
      const maxPosition = accountBalance * MAX_POSITION_SIZE_PERCENT;

      // Also limit by max account utilization
      const maxByUtilization = accountBalance * MAX_ACCOUNT_UTILIZATION;

      return Math.min(maxPosition, maxByUtilization);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
        });
      }
      return FALLBACK_POSITION_SIZE;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Calculate position size using Kelly Criterion
   * Formula: f* = (p * b - q) / b
   * Where: p = win probability, q = loss probability, b = RR ratio
   *
   * Uses fractional Kelly (MAX_KELLY_FRACTION) to reduce volatility
   */
  private calculateKellySize(
    winProbability: number,
    riskRewardRatio: number,
    accountBalance: number
  ): number {
    try {
      return calculateKellyPositionSize({
        winProbability,
        riskRewardRatio,
        accountBalance,
        minimumRiskRewardRatio: MIN_RISK_REWARD_RATIO,
        maxKellyFraction: MAX_KELLY_FRACTION,
      });
    } catch (error) {
      this.safeLog('error', 'Kelly calculation failed, using base risk %');
      return (accountBalance * DEFAULT_RISK_PERCENT) / 100;
    }
  }

  /**
   * Calculate confidence multiplier
   * High confidence → larger size (up to MAX_CONFIDENCE_MULTIPLIER)
   * Low confidence → smaller size (down to MIN_CONFIDENCE_MULTIPLIER)
   */
  private calculateConfidenceMultiplier(confidence: number): number {
    try {
      return calculateConfidenceMultiplierValue({
        confidence,
        increasedSizeConfidenceThreshold: INCREASED_SIZE_CONFIDENCE_THRESHOLD,
        reducedSizeConfidenceThreshold: REDUCED_SIZE_CONFIDENCE_THRESHOLD,
        minimumConfidenceThreshold: MIN_CONFIDENCE_THRESHOLD,
        maxConfidenceMultiplier: MAX_CONFIDENCE_MULTIPLIER,
        minConfidenceMultiplier: MIN_CONFIDENCE_MULTIPLIER,
      });
    } catch (error) {
      return 1.0; // Neutral on error
    }
  }

  /**
   * Round number to specified decimal places
   */
  private roundToDecimals(value: number, decimals: number): number {
    return roundPositionSizeValue(value, decimals);
  }

  /**
   * Safe logging wrapper (SKIP strategy for logging failures)
   */
  private safeLog(
    level: 'info' | 'warn' | 'error',
    message: string,
    meta?: unknown
  ): void {
    if (!this.logger) return;
    try {
      const context = this.asRecord(meta) ?? undefined;
      this.logger[level](message, context);
    } catch (error) {
      // SKIP - never throw on logging failure
    }
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  }
}
