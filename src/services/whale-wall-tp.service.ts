/**
 * Whale Wall TP Service
 *
 * Uses orderbook walls for Take Profit and Stop Loss optimization:
 * - BID walls = support levels (TP for SHORT, SL protection for LONG)
 * - ASK walls = resistance levels (TP for LONG, SL protection for SHORT)
 *
 * Features:
 * - Wall-based TP targeting (price will react at large walls)
 * - Wall-protected SL (place SL beyond opposing walls)
 * - Wall quality filtering (size, distance, spoofing detection)
 * - Integration with WallTrackerService for advanced filtering
 */

import { LoggerService, SignalDirection, OrderBookWall, TakeProfit } from '../types';
import { WallTrackerService } from './wall-tracker.service';
import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface WhaleWallTPConfig {
  enabled: boolean;

  // Wall filtering
  minWallPercent: number; // Min % of total volume to consider (default: 5%)
  maxDistancePercent: number; // Max distance from price (default: 2%)
  minDistancePercent: number; // Min distance from price - avoid walls too close (default: 0.3%)

  // TP targeting
  tpTargeting: {
    enabled: boolean;
    // Use wall as TP target if within this distance of calculated TP
    alignmentThresholdPercent: number; // default: 0.5%
    // Scale TP to wall location (move TP closer to wall)
    scaleToWall: boolean; // default: true
    // Minimum size to use wall as TP target
    minWallSizeForTP: number; // default: 8%
  };

  // SL protection
  slProtection: {
    enabled: boolean;
    // Move SL behind wall if wall is between entry and SL
    moveSlBehindWall: boolean; // default: true
    // Buffer beyond wall (additional % to place SL)
    bufferPercent: number; // default: 0.1%
    // Minimum wall size for SL protection
    minWallSizeForSL: number; // default: 10%
  };

  // Wall quality validation (requires WallTrackerService)
  qualityValidation: {
    enabled: boolean;
    // Reject spoofing walls
    rejectSpoofing: boolean; // default: true
    // Boost iceberg walls
    boostIceberg: boolean; // default: true
    icebergBoostFactor: number; // default: 1.2
    // Minimum wall strength score (0-1)
    minStrength: number; // default: 0.3
  };
}

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface WhaleWallTPResult {
  // TP adjustments
  tpAdjusted: boolean;
  originalTPPrice?: number;
  adjustedTPPrice?: number;
  tpWall?: OrderBookWall;
  tpReason?: string;

  // SL adjustments
  slAdjusted: boolean;
  originalSLPrice?: number;
  adjustedSLPrice?: number;
  slWall?: OrderBookWall;
  slReason?: string;

  // Summary
  wallsAnalyzed: number;
  qualifiedWalls: number;
}

export interface WallAnalysis {
  wall: OrderBookWall;
  isQualified: boolean;
  strength: number; // 0-1
  reason: string;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: WhaleWallTPConfig = {
  enabled: true,
  minWallPercent: 5,
  maxDistancePercent: 2.0,
  minDistancePercent: 0.3,
  tpTargeting: {
    enabled: true,
    alignmentThresholdPercent: 0.5,
    scaleToWall: true,
    minWallSizeForTP: 8,
  },
  slProtection: {
    enabled: true,
    moveSlBehindWall: true,
    bufferPercent: 0.1,
    minWallSizeForSL: 10,
  },
  qualityValidation: {
    enabled: false, // Requires WallTrackerService
    rejectSpoofing: true,
    boostIceberg: true,
    icebergBoostFactor: 1.2,
    minStrength: 0.3,
  },
};

// ============================================================================
// WHALE WALL TP SERVICE
// ============================================================================

export class WhaleWallTPService {
  private config: WhaleWallTPConfig;

  constructor(
    private logger: LoggerService,
    config?: Partial<WhaleWallTPConfig>,
    private wallTracker?: WallTrackerService,
  ) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, config);

    // Enable quality validation if WallTrackerService is provided
    if (wallTracker && !config?.qualityValidation) {
      this.config.qualityValidation.enabled = true;
    }
  }

  /**
   * Deep merge configuration
   */
  private mergeConfig(
    defaults: WhaleWallTPConfig,
    overrides?: Partial<WhaleWallTPConfig>,
  ): WhaleWallTPConfig {
    if (!overrides) return { ...defaults };

    return {
      enabled: overrides.enabled ?? defaults.enabled,
      minWallPercent: overrides.minWallPercent ?? defaults.minWallPercent,
      maxDistancePercent: overrides.maxDistancePercent ?? defaults.maxDistancePercent,
      minDistancePercent: overrides.minDistancePercent ?? defaults.minDistancePercent,
      tpTargeting: { ...defaults.tpTargeting, ...overrides.tpTargeting },
      slProtection: { ...defaults.slProtection, ...overrides.slProtection },
      qualityValidation: { ...defaults.qualityValidation, ...overrides.qualityValidation },
    };
  }

  /**
   * Adjust TP/SL based on whale walls
   *
   * @param walls - Orderbook walls from analysis
   * @param entryPrice - Entry price
   * @param direction - Trade direction
   * @param originalTP - Original TP price (from other calculations)
   * @param originalSL - Original SL price
   */
  adjustTPSL(
    walls: OrderBookWall[],
    entryPrice: number,
    direction: SignalDirection,
    originalTP: number,
    originalSL: number,
  ): WhaleWallTPResult {
    if (!this.config.enabled) {
      return this.noAdjustment('Whale Wall TP disabled');
    }

    // Filter walls by basic criteria
    const relevantWalls = this.filterWalls(walls, entryPrice, direction);

    if (relevantWalls.length === 0) {
      return this.noAdjustment('No relevant walls found');
    }

    // Analyze wall quality
    const analyzedWalls = relevantWalls.map((wall) => this.analyzeWall(wall, entryPrice));
    const qualifiedWalls = analyzedWalls.filter((w) => w.isQualified);

    this.logger.debug('🐋 Whale Wall Analysis', {
      total: walls.length,
      relevant: relevantWalls.length,
      qualified: qualifiedWalls.length,
    });

    const result: WhaleWallTPResult = {
      tpAdjusted: false,
      slAdjusted: false,
      wallsAnalyzed: walls.length,
      qualifiedWalls: qualifiedWalls.length,
    };

    // TP targeting
    if (this.config.tpTargeting.enabled) {
      const tpResult = this.calculateWallBasedTP(
        qualifiedWalls,
        entryPrice,
        direction,
        originalTP,
      );
      if (tpResult.adjusted) {
        result.tpAdjusted = true;
        result.originalTPPrice = originalTP;
        result.adjustedTPPrice = tpResult.price;
        result.tpWall = tpResult.wall;
        result.tpReason = tpResult.reason;
      }
    }

    // SL protection
    if (this.config.slProtection.enabled) {
      const slResult = this.calculateWallProtectedSL(
        qualifiedWalls,
        entryPrice,
        direction,
        originalSL,
      );
      if (slResult.adjusted) {
        result.slAdjusted = true;
        result.originalSLPrice = originalSL;
        result.adjustedSLPrice = slResult.price;
        result.slWall = slResult.wall;
        result.slReason = slResult.reason;
      }
    }

    // Log results
    if (result.tpAdjusted || result.slAdjusted) {
      this.logger.info('🐋 Whale Wall Adjustment', {
        tpAdjusted: result.tpAdjusted,
        slAdjusted: result.slAdjusted,
        tpChange: result.tpAdjusted
          ? `${originalTP.toFixed(DECIMAL_PLACES.PRICE)} → ${result.adjustedTPPrice?.toFixed(DECIMAL_PLACES.PRICE)}`
          : 'N/A',
        slChange: result.slAdjusted
          ? `${originalSL.toFixed(DECIMAL_PLACES.PRICE)} → ${result.adjustedSLPrice?.toFixed(DECIMAL_PLACES.PRICE)}`
          : 'N/A',
      });
    }

    return result;
  }

  /**
   * Filter walls by direction and distance criteria
   */
  private filterWalls(
    walls: OrderBookWall[],
    entryPrice: number,
    direction: SignalDirection,
  ): OrderBookWall[] {
    return walls.filter((wall) => {
      // Check minimum size
      if (wall.percentOfTotal < this.config.minWallPercent) {
        return false;
      }

      // Check distance range
      const distance = Math.abs(wall.distance);
      if (distance > this.config.maxDistancePercent) {
        return false;
      }
      if (distance < this.config.minDistancePercent) {
        return false;
      }

      // Filter by direction relevance:
      // LONG: ASK walls are TP targets (above price), BID walls are SL protection (below)
      // SHORT: BID walls are TP targets (below price), ASK walls are SL protection (above)
      if (direction === SignalDirection.LONG) {
        // For LONG: consider ASK walls above price OR BID walls below price
        if (wall.side === 'ASK' && wall.price > entryPrice) return true; // TP target
        if (wall.side === 'BID' && wall.price < entryPrice) return true; // SL protection
      } else {
        // For SHORT: consider BID walls below price OR ASK walls above price
        if (wall.side === 'BID' && wall.price < entryPrice) return true; // TP target
        if (wall.side === 'ASK' && wall.price > entryPrice) return true; // SL protection
      }

      return false;
    });
  }

  /**
   * Analyze wall quality
   */
  private analyzeWall(wall: OrderBookWall, entryPrice: number): WallAnalysis {
    let strength = 0;
    let isQualified = true;
    const reasons: string[] = [];

    // Base strength from size (0-0.5)
    const sizeScore = Math.min(wall.percentOfTotal / 20, 0.5);
    strength += sizeScore;

    // Distance score (closer = stronger, 0-0.3)
    const distanceScore = Math.max(0, 0.3 - (Math.abs(wall.distance) / 10));
    strength += distanceScore;

    // Quality validation using WallTrackerService
    if (this.config.qualityValidation.enabled && this.wallTracker) {
      // Check for spoofing
      if (this.config.qualityValidation.rejectSpoofing) {
        const isSpoofing = this.wallTracker.isSpoofing(wall.price, wall.side);
        if (isSpoofing) {
          isQualified = false;
          reasons.push('SPOOFING');
        }
      }

      // Check wall strength from tracker
      const trackerStrength = this.wallTracker.getWallStrength(wall.price, wall.side);
      if (trackerStrength < this.config.qualityValidation.minStrength) {
        isQualified = false;
        reasons.push(`LOW_STRENGTH:${trackerStrength.toFixed(2)}`);
      }
      strength += trackerStrength * 0.2; // Add tracker strength (0-0.2)

      // Boost iceberg walls
      if (this.config.qualityValidation.boostIceberg) {
        const isIceberg = this.wallTracker.isIceberg(wall.price, wall.side);
        if (isIceberg) {
          strength *= this.config.qualityValidation.icebergBoostFactor;
          reasons.push('ICEBERG');
        }
      }
    }

    return {
      wall,
      isQualified,
      strength: Math.min(strength, 1),
      reason: reasons.length > 0 ? reasons.join(', ') : 'OK',
    };
  }

  /**
   * Calculate wall-based TP
   */
  private calculateWallBasedTP(
    analyzedWalls: WallAnalysis[],
    entryPrice: number,
    direction: SignalDirection,
    originalTP: number,
  ): { adjusted: boolean; price?: number; wall?: OrderBookWall; reason?: string } {
    // Find TP-relevant walls (in the direction of profit)
    const tpWalls = analyzedWalls.filter((w) => {
      if (direction === SignalDirection.LONG) {
        return w.wall.side === 'ASK' && w.wall.price > entryPrice;
      } else {
        return w.wall.side === 'BID' && w.wall.price < entryPrice;
      }
    });

    if (tpWalls.length === 0) {
      return { adjusted: false };
    }

    // Filter by minimum size for TP
    const qualifiedTPWalls = tpWalls.filter(
      (w) => w.wall.percentOfTotal >= this.config.tpTargeting.minWallSizeForTP,
    );

    if (qualifiedTPWalls.length === 0) {
      return { adjusted: false };
    }

    // Sort by distance (closest first for LONG, furthest first for SHORT)
    const sorted = qualifiedTPWalls.sort((a, b) => {
      if (direction === SignalDirection.LONG) {
        return a.wall.price - b.wall.price; // Closest ASK wall
      } else {
        return b.wall.price - a.wall.price; // Closest BID wall
      }
    });

    const targetWall = sorted[0];

    // Check if wall is within alignment threshold of original TP
    const distanceToTP =
      (Math.abs(targetWall.wall.price - originalTP) / originalTP) * PERCENT_MULTIPLIER;

    if (distanceToTP <= this.config.tpTargeting.alignmentThresholdPercent) {
      // Wall is close to TP - align TP to wall
      return {
        adjusted: true,
        price: targetWall.wall.price,
        wall: targetWall.wall,
        reason: `Aligned to ${targetWall.wall.side} wall (${targetWall.wall.percentOfTotal.toFixed(1)}%)`,
      };
    }

    // Check if wall is between entry and TP
    const wallBetween =
      direction === SignalDirection.LONG
        ? targetWall.wall.price > entryPrice && targetWall.wall.price < originalTP
        : targetWall.wall.price < entryPrice && targetWall.wall.price > originalTP;

    if (wallBetween && this.config.tpTargeting.scaleToWall) {
      // Wall blocks the way to TP - use wall as conservative TP
      return {
        adjusted: true,
        price: targetWall.wall.price,
        wall: targetWall.wall,
        reason: `Scaled to blocking ${targetWall.wall.side} wall (${targetWall.wall.percentOfTotal.toFixed(1)}%)`,
      };
    }

    return { adjusted: false };
  }

  /**
   * Calculate wall-protected SL
   */
  private calculateWallProtectedSL(
    analyzedWalls: WallAnalysis[],
    entryPrice: number,
    direction: SignalDirection,
    originalSL: number,
  ): { adjusted: boolean; price?: number; wall?: OrderBookWall; reason?: string } {
    if (!this.config.slProtection.moveSlBehindWall) {
      return { adjusted: false };
    }

    // Find SL-relevant walls (protecting the trade)
    // LONG: BID walls below entry protect against drops
    // SHORT: ASK walls above entry protect against rises
    const slWalls = analyzedWalls.filter((w) => {
      if (direction === SignalDirection.LONG) {
        return w.wall.side === 'BID' && w.wall.price < entryPrice;
      } else {
        return w.wall.side === 'ASK' && w.wall.price > entryPrice;
      }
    });

    if (slWalls.length === 0) {
      return { adjusted: false };
    }

    // Filter by minimum size for SL
    const qualifiedSLWalls = slWalls.filter(
      (w) => w.wall.percentOfTotal >= this.config.slProtection.minWallSizeForSL,
    );

    if (qualifiedSLWalls.length === 0) {
      return { adjusted: false };
    }

    // Sort by distance (closest to entry first)
    const sorted = qualifiedSLWalls.sort((a, b) => {
      if (direction === SignalDirection.LONG) {
        return b.wall.price - a.wall.price; // Highest BID wall (closest to entry)
      } else {
        return a.wall.price - b.wall.price; // Lowest ASK wall (closest to entry)
      }
    });

    const protectingWall = sorted[0];

    // Check if wall is between entry and original SL
    const wallProtects =
      direction === SignalDirection.LONG
        ? protectingWall.wall.price > originalSL && protectingWall.wall.price < entryPrice
        : protectingWall.wall.price < originalSL && protectingWall.wall.price > entryPrice;

    if (!wallProtects) {
      return { adjusted: false };
    }

    // Move SL just beyond the wall
    const buffer = protectingWall.wall.price * (this.config.slProtection.bufferPercent / PERCENT_MULTIPLIER);
    const adjustedSL =
      direction === SignalDirection.LONG
        ? protectingWall.wall.price - buffer // Below BID wall
        : protectingWall.wall.price + buffer; // Above ASK wall

    // Only adjust if new SL is tighter (closer to entry) than original
    const newSLTighter =
      direction === SignalDirection.LONG
        ? adjustedSL > originalSL
        : adjustedSL < originalSL;

    if (!newSLTighter) {
      return { adjusted: false };
    }

    return {
      adjusted: true,
      price: adjustedSL,
      wall: protectingWall.wall,
      reason: `Protected by ${protectingWall.wall.side} wall (${protectingWall.wall.percentOfTotal.toFixed(1)}%)`,
    };
  }

  /**
   * Return no adjustment result
   */
  private noAdjustment(reason: string): WhaleWallTPResult {
    return {
      tpAdjusted: false,
      slAdjusted: false,
      wallsAnalyzed: 0,
      qualifiedWalls: 0,
    };
  }

  /**
   * Apply TP adjustments to take profit array
   */
  applyTPAdjustment(
    takeProfits: TakeProfit[],
    adjustment: WhaleWallTPResult,
    entryPrice: number,
    direction: SignalDirection,
  ): TakeProfit[] {
    if (!adjustment.tpAdjusted || !adjustment.adjustedTPPrice) {
      return takeProfits;
    }

    // Adjust first TP to wall price
    return takeProfits.map((tp, index) => {
      if (index === 0) {
        const adjustedPercent =
          direction === SignalDirection.LONG
            ? ((adjustment.adjustedTPPrice! - entryPrice) / entryPrice) * PERCENT_MULTIPLIER
            : ((entryPrice - adjustment.adjustedTPPrice!) / entryPrice) * PERCENT_MULTIPLIER;

        return {
          ...tp,
          price: adjustment.adjustedTPPrice!,
          percent: adjustedPercent,
        };
      }
      return tp;
    });
  }

  /**
   * Get configuration
   */
  getConfig(): WhaleWallTPConfig {
    return { ...this.config };
  }
}
