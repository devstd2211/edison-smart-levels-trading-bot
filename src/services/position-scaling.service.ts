/**
 * Phase 11.2: Position Scaling Service
 *
 * Dynamic position scaling (pyramiding) based on:
 * - Current profit level
 * - Profit targets (TP1, TP2, TP3)
 * - Risk management (move SL to breakeven)
 * - Maximum scale limits
 *
 * Recovery Strategies:
 * - THROW: Invalid config, invalid position state
 * - GRACEFUL_DEGRADE: Calculation failures → return 'hold' action
 * - SKIP: Logging failures
 *
 * Created: 2026-02-09 (Session 96)
 */

import { LoggerService } from './logger.service';
import { ErrorHandler, RecoveryStrategy } from '../errors';
import {
  MAX_SCALE_INS,
  SCALE_SIZE_REDUCTION_FACTOR,
  MIN_PROFIT_FOR_SCALE,
  BREAKEVEN_PROFIT_THRESHOLD,
  MIN_POSITION_SIZE_FOR_SCALING,
  FALLBACK_SCALE_ACTION,
} from '../constants/phase-11-constants';

export interface ScalingConfig {
  scaleInThreshold: number; // % profit to scale in (e.g., 0.5 = 50% of TP1)
  maxScales: number; // Maximum number of scale-ins
  scaleReduction: number; // Size reduction per scale (e.g., 0.5 = 50% of previous)
  breakevenThreshold: number; // Move SL to BE at X% profit (e.g., 0.5 = 50% of TP1)
}

export interface ScaleAction {
  action: 'add' | 'reduce' | 'hold';
  size: number; // Size to add/reduce (USD)
  newStopLoss: number; // Updated SL after scale
  reasoning: string; // Why this action
  confidence: number; // Confidence in scale decision (0-1)
}

export interface PositionState {
  entryPrice: number;
  currentPrice: number;
  size: number; // Current position size (USD)
  stopLoss: number;
  profitTarget: number; // Next profit target (TP1, TP2, or TP3)
  scaleCount: number; // Number of scales already done
  side: 'long' | 'short';
}

export class PositionScalingService {
  private readonly config: ScalingConfig;

  constructor(
    config: ScalingConfig,
    private logger?: LoggerService,
    private errorHandler?: ErrorHandler
  ) {
    // THROW validation - must be BEFORE try-catch
    if (!config) {
      throw new Error('PositionScalingService: config is required');
    }
    if (config.scaleInThreshold == null || config.scaleInThreshold < 0) {
      throw new Error(
        'PositionScalingService: scaleInThreshold must be >= 0'
      );
    }
    if (config.maxScales == null || config.maxScales < 0) {
      throw new Error('PositionScalingService: maxScales must be >= 0');
    }
    if (config.scaleReduction == null || config.scaleReduction < 0 || config.scaleReduction > 1) {
      throw new Error(
        'PositionScalingService: scaleReduction must be between 0 and 1'
      );
    }
    if (config.breakevenThreshold == null || config.breakevenThreshold < 0) {
      throw new Error(
        'PositionScalingService: breakevenThreshold must be >= 0'
      );
    }

    this.config = config;
  }

  /**
   * Determine if position should be scaled in/out
   *
   * @param position Current position state
   * @returns ScaleAction with recommended action
   */
  async shouldScale(position: PositionState): Promise<ScaleAction> {
    // THROW validation - must be OUTSIDE try-catch
    this.validatePosition(position);

    try {
      // Calculate current profit %
      const profitPercent = this.calculateProfitPercent(position);

      // Check if already at max scales
      if (position.scaleCount >= this.config.maxScales) {
        return {
          action: 'hold',
          size: 0,
          newStopLoss: position.stopLoss,
          reasoning: `Max scales (${this.config.maxScales}) reached`,
          confidence: 1.0,
        };
      }

      // Check if position too small to scale
      if (position.size < MIN_POSITION_SIZE_FOR_SCALING) {
        return {
          action: 'hold',
          size: 0,
          newStopLoss: position.stopLoss,
          reasoning: `Position size ${position.size} too small to scale`,
          confidence: 1.0,
        };
      }

      // Check if profit threshold reached for scaling
      if (profitPercent >= this.config.scaleInThreshold) {
        // Calculate scale size
        const scaleSize = this.calculateScaleSize(position);

        // Calculate new stop loss
        const newStopLoss = this.calculateNewStopLoss(
          position,
          profitPercent
        );

        return {
          action: 'add',
          size: scaleSize,
          newStopLoss,
          reasoning: `Profit ${(profitPercent * 100).toFixed(1)}% >= threshold ${(this.config.scaleInThreshold * 100).toFixed(1)}%`,
          confidence: Math.min(profitPercent / this.config.scaleInThreshold, 1.0),
        };
      }

      // No scaling needed
      return {
        action: 'hold',
        size: 0,
        newStopLoss: position.stopLoss,
        reasoning: `Profit ${(profitPercent * 100).toFixed(1)}% below threshold ${(this.config.scaleInThreshold * 100).toFixed(1)}%`,
        confidence: 0.5,
      };
    } catch (error) {
      // GRACEFUL_DEGRADE: return 'hold' on error
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        });
      }
      this.safeLog('error', 'Failed to determine scale action, using fallback');
      return { ...FALLBACK_SCALE_ACTION };
    }
  }

  /**
   * Scale into winning position
   *
   * @param position Current position state
   * @param currentProfit Current profit in USD
   * @returns ScaleAction with recommended scale-in
   */
  async scaleIntoWinner(
    position: PositionState,
    currentProfit: number
  ): Promise<ScaleAction> {
    // THROW validation
    this.validatePosition(position);
    if (currentProfit == null || isNaN(currentProfit)) {
      throw new Error(
        'PositionScalingService.scaleIntoWinner: currentProfit must be a number'
      );
    }

    try {
      const profitPercent = this.calculateProfitPercent(position);

      // Check if profit meets threshold
      if (profitPercent < this.config.scaleInThreshold) {
        return {
          action: 'hold',
          size: 0,
          newStopLoss: position.stopLoss,
          reasoning: `Profit ${(profitPercent * 100).toFixed(1)}% below scale threshold`,
          confidence: 0.3,
        };
      }

      // Check scale limits
      if (position.scaleCount >= this.config.maxScales) {
        return {
          action: 'hold',
          size: 0,
          newStopLoss: position.stopLoss,
          reasoning: 'Max scales reached',
          confidence: 1.0,
        };
      }

      // Calculate scale size
      const scaleSize = this.calculateScaleSize(position);

      // Calculate new stop loss (move closer to breakeven)
      const newStopLoss = this.calculateNewStopLoss(position, profitPercent);

      return {
        action: 'add',
        size: scaleSize,
        newStopLoss,
        reasoning: `Scale #${position.scaleCount + 1} at ${(profitPercent * 100).toFixed(1)}% profit`,
        confidence: Math.min(profitPercent / this.config.scaleInThreshold, 1.0),
      };
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        });
      }
      this.safeLog('error', 'Failed to scale into winner, using fallback');
      return { ...FALLBACK_SCALE_ACTION };
    }
  }

  /**
   * Reduce risk by moving stop-loss to breakeven
   *
   * @param position Current position state
   * @returns ScaleAction with updated stop-loss
   */
  async reduceRiskOnProfit(position: PositionState): Promise<ScaleAction> {
    // THROW validation
    this.validatePosition(position);

    try {
      const profitPercent = this.calculateProfitPercent(position);

      // Check if profit meets breakeven threshold
      if (profitPercent < this.config.breakevenThreshold) {
        return {
          action: 'hold',
          size: 0,
          newStopLoss: position.stopLoss,
          reasoning: `Profit ${(profitPercent * 100).toFixed(1)}% below breakeven threshold ${(this.config.breakevenThreshold * 100).toFixed(1)}%`,
          confidence: 0.5,
        };
      }

      // Move SL to breakeven (entry price)
      return {
        action: 'hold', // Not adding/reducing, just updating SL
        size: 0,
        newStopLoss: position.entryPrice,
        reasoning: `Move SL to breakeven at ${(profitPercent * 100).toFixed(1)}% profit`,
        confidence: 0.9,
      };
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        });
      }
      this.safeLog('error', 'Failed to reduce risk, using fallback');
      return { ...FALLBACK_SCALE_ACTION };
    }
  }

  /**
   * Calculate size for next scale-in
   *
   * @param position Current position state
   * @returns Scale size in USD
   */
  calculateScaleSize(position: PositionState): number {
    // THROW validation
    if (!position || position.size == null || position.size < 0) {
      throw new Error(
        'PositionScalingService.calculateScaleSize: invalid position size'
      );
    }
    if (position.scaleCount == null || position.scaleCount < 0) {
      throw new Error(
        'PositionScalingService.calculateScaleSize: invalid scaleCount'
      );
    }

    try {
      // Each scale is reduced by scaleReduction factor
      // Scale 1: size * reduction^1
      // Scale 2: size * reduction^2
      // Scale 3: size * reduction^3
      const scaleFactor = Math.pow(
        this.config.scaleReduction,
        position.scaleCount + 1
      );

      const scaleSize = position.size * scaleFactor;

      // Ensure minimum size
      return Math.max(scaleSize, MIN_POSITION_SIZE_FOR_SCALING);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
        });
      }
      return MIN_POSITION_SIZE_FOR_SCALING;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Validate position state (THROW strategy)
   */
  private validatePosition(position: PositionState): void {
    if (!position) {
      throw new Error('PositionScalingService: position is required');
    }
    if (position.entryPrice == null || isNaN(position.entryPrice) || position.entryPrice <= 0) {
      throw new Error('PositionScalingService: entryPrice must be > 0');
    }
    if (position.currentPrice == null || isNaN(position.currentPrice) || position.currentPrice <= 0) {
      throw new Error('PositionScalingService: currentPrice must be > 0');
    }
    if (position.size == null || isNaN(position.size) || position.size < 0) {
      throw new Error('PositionScalingService: size must be >= 0');
    }
    if (position.stopLoss == null || isNaN(position.stopLoss) || position.stopLoss <= 0) {
      throw new Error('PositionScalingService: stopLoss must be > 0');
    }
    if (position.profitTarget == null || isNaN(position.profitTarget) || position.profitTarget <= 0) {
      throw new Error('PositionScalingService: profitTarget must be > 0');
    }
    if (position.scaleCount == null || isNaN(position.scaleCount) || position.scaleCount < 0) {
      throw new Error('PositionScalingService: scaleCount must be >= 0');
    }
    if (position.side !== 'long' && position.side !== 'short') {
      throw new Error('PositionScalingService: side must be "long" or "short"');
    }
  }

  /**
   * Calculate current profit as % of distance to profit target
   */
  private calculateProfitPercent(position: PositionState): number {
    try {
      if (position.side === 'long') {
        // Long: profit when price rises
        const priceMove = position.currentPrice - position.entryPrice;
        const targetMove = position.profitTarget - position.entryPrice;
        return targetMove > 0 ? priceMove / targetMove : 0;
      } else {
        // Short: profit when price falls
        const priceMove = position.entryPrice - position.currentPrice;
        const targetMove = position.entryPrice - position.profitTarget;
        return targetMove > 0 ? priceMove / targetMove : 0;
      }
    } catch (error) {
      this.safeLog('error', 'Failed to calculate profit percent');
      return 0;
    }
  }

  /**
   * Calculate new stop loss position
   * Moves SL closer to entry as position becomes more profitable
   */
  private calculateNewStopLoss(
    position: PositionState,
    profitPercent: number
  ): number {
    try {
      // If profit exceeds breakeven threshold, move to breakeven
      if (profitPercent >= this.config.breakevenThreshold) {
        return position.entryPrice;
      }

      // Otherwise, move SL proportionally toward breakeven
      const movePercent = profitPercent / this.config.breakevenThreshold;

      if (position.side === 'long') {
        // Long: move SL up toward entry
        const slDistance = position.entryPrice - position.stopLoss;
        return position.stopLoss + slDistance * movePercent;
      } else {
        // Short: move SL down toward entry
        const slDistance = position.stopLoss - position.entryPrice;
        return position.stopLoss - slDistance * movePercent;
      }
    } catch (error) {
      this.safeLog('error', 'Failed to calculate new stop loss');
      return position.stopLoss; // Keep current SL on error
    }
  }

  /**
   * Safe logging wrapper (SKIP strategy for logging failures)
   */
  private safeLog(
    level: 'info' | 'warn' | 'error',
    message: string,
    meta?: any
  ): void {
    if (!this.logger) return;
    try {
      this.logger[level](message, meta);
    } catch (error) {
      // SKIP - never throw on logging failure
    }
  }
}
