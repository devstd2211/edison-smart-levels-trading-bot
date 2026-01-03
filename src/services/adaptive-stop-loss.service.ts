import { DECIMAL_PLACES, MULTIPLIERS, PERCENT_MULTIPLIER, TIME_UNITS } from '../constants';
/**
 * Adaptive Stop Loss Service (Phase 3)
 *
 * Multi-factor stop loss placement based on market structure.
 * Priority order: SWEEP > ORDER_BLOCK > SWING > LEVEL > ATR > PERCENT
 *
 * Why adaptive SL is better:
 * - Structure-based SL (sweeps, OBs, swings) respects market mechanics
 * - Prevents tight SL that gets swept by MM algos
 * - Reduces "fake-out" stop-outs on local wicks
 * - Better R/R ratio (wider but smarter placement)
 *
 * Example:
 * Entry: 1.2000 LONG
 * - Swing low: 1.1950 (recent swing)
 * - ATR SL: 1.1920 (1.5x ATR)
 * - Result: SL @ 1.1945 (swing - 0.3 ATR buffer) ✅
 * - Why: Respects structure + small buffer for noise
 */

import {
  AdaptiveStopLossConfig,
  StopLossCalculation,
  StopLossType,
  LoggerService,
  SignalDirection,
  SwingPoint,
  SwingPointType,
} from '../types';
import { BUFFER_MIN, BUFFER_MAX, MS_PER_24_HOURS, MAX_ORDERBLOCK_DISTANCE_PERCENT, MAX_SWING_DISTANCE_PERCENT, MAX_LEVEL_DISTANCE_PERCENT, DEFAULT_ATR_SL_MULTIPLIER } from '../constants/technical.constants';

// ============================================================================
// CONSTANTS
// ============================================================================

// BUFFER_MIN and BUFFER_MAX imported from technical.constants

// ============================================================================
// INTERFACES
// ============================================================================

interface MarketStructure {
  swingPoints?: SwingPoint[];
  liquidityZones?: Array<{
    price: number;
    type: 'BUY_SIDE' | 'SELL_SIDE';
    timestamp: number;
    sweepCount?: number;
  }>;
  orderBlocks?: Array<{ price: number; strength: number }>;
  supportResistance?: Array<{ price: number; strength: number; touches: number }>;
  atr?: number;
}

// ============================================================================
// ADAPTIVE STOP LOSS SERVICE
// ============================================================================

export class AdaptiveStopLossService {
  constructor(
    private config: AdaptiveStopLossConfig,
    private logger: LoggerService,
  ) {
    this.logger.info('AdaptiveStopLossService initialized', {
      enabled: config.enabled,
      priorityOrder: config.priorityOrder,
      bufferMultiplier: config.bufferMultiplier,
      minDistance: `${config.minDistancePercent}%`,
      maxDistance: `${config.maxDistancePercent}%`,
    });
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Calculate optimal stop loss based on market structure
   *
   * @param entryPrice Entry price
   * @param direction Trade direction (LONG/SHORT)
   * @param structure Market structure data (swings, zones, levels, etc)
   * @param currentPrice Current market price (for validation)
   * @returns Stop loss calculation with reasoning
   */
  calculateStopLoss(
    entryPrice: number,
    direction: SignalDirection,
    structure: MarketStructure,
    currentPrice: number,
  ): StopLossCalculation {
    if (!this.config.enabled) {
      return this.fallbackPercentSL(entryPrice, direction, 'Adaptive SL disabled');
    }

    // Try each method in priority order
    for (const type of this.config.priorityOrder) {
      let result: StopLossCalculation | null = null;

      switch (type) {
      case StopLossType.SWEEP:
        result = this.calculateSweepBasedSL(entryPrice, direction, structure);
        break;
      case StopLossType.ORDER_BLOCK:
        result = this.calculateOrderBlockBasedSL(entryPrice, direction, structure);
        break;
      case StopLossType.SWING:
        result = this.calculateSwingBasedSL(entryPrice, direction, structure);
        break;
      case StopLossType.LEVEL:
        result = this.calculateLevelBasedSL(entryPrice, direction, structure);
        break;
      case StopLossType.ATR:
        result = this.calculateATRBasedSL(entryPrice, direction, structure);
        break;
      case StopLossType.PERCENT:
        result = this.fallbackPercentSL(entryPrice, direction, 'Fallback to fixed percent');
        break;
      }

      if (result) {
        // Validate distance
        const distancePercent = Math.abs((result.price - entryPrice) / entryPrice) * PERCENT_MULTIPLIER;

        if (distancePercent < this.config.minDistancePercent) {
          this.logger.debug(`${type} SL too tight: ${distancePercent.toFixed(DECIMAL_PLACES.PERCENT)}%`, {
            minRequired: this.config.minDistancePercent,
          });
          continue; // Try next method
        }

        if (distancePercent > this.config.maxDistancePercent) {
          this.logger.debug(`${type} SL too wide: ${distancePercent.toFixed(DECIMAL_PLACES.PERCENT)}%`, {
            maxAllowed: this.config.maxDistancePercent,
          });
          continue; // Try next method
        }

        // Valid SL found
        result.distancePercent = distancePercent;
        this.logger.info(`✅ Adaptive SL selected: ${type}`, {
          slPrice: result.price.toFixed(DECIMAL_PLACES.PRICE),
          distance: `${distancePercent.toFixed(DECIMAL_PLACES.PERCENT)}%`,
          reason: result.reason,
        });

        return result;
      }
    }

    // All methods failed - use emergency fallback
    this.logger.warn('⚠️ All adaptive SL methods failed - using emergency fallback');
    return this.fallbackPercentSL(entryPrice, direction, 'Emergency fallback (all methods failed)');
  }

  // ==========================================================================
  // PRIVATE: SL CALCULATION METHODS (Priority Order)
  // ==========================================================================

  /**
   * 1. SWEEP-BASED SL (Highest Priority)
   * Place SL beyond recent liquidity sweep to avoid re-sweep
   */
  private calculateSweepBasedSL(
    entryPrice: number,
    direction: SignalDirection,
    structure: MarketStructure,
  ): StopLossCalculation | null {
    if (!structure.liquidityZones || structure.liquidityZones.length === 0) {
      return null;
    }

    const isLong = direction === SignalDirection.LONG;

    // Find recent sweep zone on opposite side
    const recentSweeps = structure.liquidityZones
      .filter((zone) => {
        const isOpposite = isLong ? zone.type === 'SELL_SIDE' : zone.type === 'BUY_SIDE';
        const isRecent = Date.now() - zone.timestamp < TIME_UNITS.HOUR; // Last 1 hour
        const hasBeenSwept = zone.sweepCount && zone.sweepCount > 0;
        return isOpposite && isRecent && hasBeenSwept;
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    if (recentSweeps.length === 0) {
      return null;
    }

    const sweepZone = recentSweeps[0];
    const buffer = this.calculateBuffer(structure.atr);

    // Place SL beyond sweep with buffer
    const slPrice = isLong
      ? sweepZone.price - buffer
      : sweepZone.price + buffer;

    return {
      type: StopLossType.SWEEP,
      price: slPrice,
      distancePercent: 0, // Will be calculated in main method
      reason: `Beyond liquidity sweep @ ${sweepZone.price.toFixed(DECIMAL_PLACES.PRICE)}`,
      structurePrice: sweepZone.price,
      buffer,
    };
  }

  /**
   * 2. ORDER BLOCK-BASED SL
   * Place SL beyond order block that caused reversal
   */
  private calculateOrderBlockBasedSL(
    entryPrice: number,
    direction: SignalDirection,
    structure: MarketStructure,
  ): StopLossCalculation | null {
    if (!structure.orderBlocks || structure.orderBlocks.length === 0) {
      return null;
    }

    const isLong = direction === SignalDirection.LONG;

    // Find strongest OB below/above entry
    const relevantOBs = structure.orderBlocks
      .filter((ob) => (isLong ? ob.price < entryPrice : ob.price > entryPrice))
      .sort((a, b) => b.strength - a.strength);

    if (relevantOBs.length === 0) {
      return null;
    }

    const ob = relevantOBs[0];

    // OB should be within reasonable distance
    const obDistance = Math.abs((ob.price - entryPrice) / entryPrice) * PERCENT_MULTIPLIER;
    if (obDistance > MAX_ORDERBLOCK_DISTANCE_PERCENT) {
      // OB too far
      return null;
    }

    const buffer = this.calculateBuffer(structure.atr);
    const slPrice = isLong ? ob.price - buffer : ob.price + buffer;

    return {
      type: StopLossType.ORDER_BLOCK,
      price: slPrice,
      distancePercent: 0,
      reason: `Beyond order block @ ${ob.price.toFixed(DECIMAL_PLACES.PRICE)} (strength: ${ob.strength.toFixed(DECIMAL_PLACES.PERCENT)})`,
      structurePrice: ob.price,
      buffer,
    };
  }

  /**
   * 3. SWING-BASED SL
   * Place SL beyond recent swing low/high
   */
  private calculateSwingBasedSL(
    entryPrice: number,
    direction: SignalDirection,
    structure: MarketStructure,
  ): StopLossCalculation | null {
    if (!structure.swingPoints || structure.swingPoints.length === 0) {
      return null;
    }

    const isLong = direction === SignalDirection.LONG;
    const targetType = isLong ? SwingPointType.LOW : SwingPointType.HIGH;

    // Find nearest swing point of correct type
    const relevantSwings = structure.swingPoints
      .filter((sp) => {
        const correctType = sp.type === targetType;
        const correctSide = isLong ? sp.price < entryPrice : sp.price > entryPrice;
        const notTooOld = Date.now() - sp.timestamp < MS_PER_24_HOURS; // Last 24h
        return correctType && correctSide && notTooOld;
      })
      .sort((a, b) => {
        // Prefer closer swing points
        const distA = Math.abs(a.price - entryPrice);
        const distB = Math.abs(b.price - entryPrice);
        return distA - distB;
      });

    if (relevantSwings.length === 0) {
      return null;
    }

    const swing = relevantSwings[0];

    // Swing should be within reasonable distance
    const swingDistance = Math.abs((swing.price - entryPrice) / entryPrice) * PERCENT_MULTIPLIER;
    if (swingDistance > MAX_SWING_DISTANCE_PERCENT) {
      return null;
    }

    const buffer = this.calculateBuffer(structure.atr);
    const slPrice = isLong ? swing.price - buffer : swing.price + buffer;

    return {
      type: StopLossType.SWING,
      price: slPrice,
      distancePercent: 0,
      reason: `Beyond swing ${targetType.toLowerCase()} @ ${swing.price.toFixed(DECIMAL_PLACES.PRICE)}`,
      structurePrice: swing.price,
      buffer,
    };
  }

  /**
   * 4. LEVEL-BASED SL
   * Place SL beyond support/resistance level
   */
  private calculateLevelBasedSL(
    entryPrice: number,
    direction: SignalDirection,
    structure: MarketStructure,
  ): StopLossCalculation | null {
    if (!structure.supportResistance || structure.supportResistance.length === 0) {
      return null;
    }

    const isLong = direction === SignalDirection.LONG;

    // Find nearest strong level on correct side
    const relevantLevels = structure.supportResistance
      .filter((level) => {
        const correctSide = isLong ? level.price < entryPrice : level.price > entryPrice;
        const strongEnough = level.touches >= 2 && level.strength >= MULTIPLIERS.HALF;
        return correctSide && strongEnough;
      })
      .sort((a, b) => {
        // Prefer closer + stronger
        const distA = Math.abs(a.price - entryPrice);
        const distB = Math.abs(b.price - entryPrice);
        const scoreA = a.strength / distA;
        const scoreB = b.strength / distB;
        return scoreB - scoreA;
      });

    if (relevantLevels.length === 0) {
      return null;
    }

    const level = relevantLevels[0];

    // Level should be within reasonable distance
    const levelDistance = Math.abs((level.price - entryPrice) / entryPrice) * PERCENT_MULTIPLIER;
    if (levelDistance > MAX_LEVEL_DISTANCE_PERCENT) {
      return null;
    }

    const buffer = this.calculateBuffer(structure.atr);
    const slPrice = isLong ? level.price - buffer : level.price + buffer;

    return {
      type: StopLossType.LEVEL,
      price: slPrice,
      distancePercent: 0,
      reason: `Beyond ${isLong ? 'support' : 'resistance'} @ ${level.price.toFixed(DECIMAL_PLACES.PRICE)} (${level.touches} touches)`,
      structurePrice: level.price,
      buffer,
    };
  }

  /**
   * 5. ATR-BASED SL (Fallback)
   * Standard ATR-based stop loss
   */
  private calculateATRBasedSL(
    entryPrice: number,
    direction: SignalDirection,
    structure: MarketStructure,
  ): StopLossCalculation | null {
    if (!structure.atr || structure.atr <= 0) {
      return null;
    }

    const isLong = direction === SignalDirection.LONG;
    const atrDistance = structure.atr * this.config.bufferMultiplier * DEFAULT_ATR_SL_MULTIPLIER;

    const slPrice = isLong ? entryPrice - atrDistance : entryPrice + atrDistance;

    return {
      type: StopLossType.ATR,
      price: slPrice,
      distancePercent: 0,
      reason: `ATR-based (${this.config.bufferMultiplier * DEFAULT_ATR_SL_MULTIPLIER}x ATR = ${atrDistance.toFixed(DECIMAL_PLACES.PRICE)})`,
    };
  }

  /**
   * 6. PERCENT-BASED SL (Emergency Fallback)
   * Fixed percentage stop loss when all else fails
   */
  private fallbackPercentSL(
    entryPrice: number,
    direction: SignalDirection,
    reason: string,
  ): StopLossCalculation {
    const isLong = direction === SignalDirection.LONG;
    const distance = (this.config.fallbackPercent / PERCENT_MULTIPLIER) * entryPrice;
    const slPrice = isLong ? entryPrice - distance : entryPrice + distance;

    return {
      type: StopLossType.PERCENT,
      price: slPrice,
      distancePercent: this.config.fallbackPercent,
      reason: `Fixed ${this.config.fallbackPercent}% (${reason})`,
    };
  }

  // ==========================================================================
  // PRIVATE: HELPERS
  // ==========================================================================

  /**
   * Calculate buffer size based on ATR
   * Buffer prevents SL from being exactly at structure (prone to false triggers)
   */
  private calculateBuffer(atr?: number): number {
    if (!atr || atr <= 0) {
      return BUFFER_MIN;
    }

    const buffer = atr * this.config.bufferMultiplier;

    // Clamp to min/max
    return Math.max(BUFFER_MIN, Math.min(BUFFER_MAX, buffer));
  }

  /**
   * Get config (for testing/monitoring)
   */
  getConfig(): AdaptiveStopLossConfig {
    return { ...this.config };
  }
}
