/**
 * Structure-Aware Exit Service
 *
 * Detects nearest resistance/support levels from:
 * - Swing points (ZigZag highs/lows)
 * - Liquidity zones (SMC resistance/support)
 * - Volume Profile HVN levels
 *
 * Calculates optimal TP2 with safety buffer before resistance.
 * Activates Bybit native trailing stop after TP1 hit.
 */

import { LoggerService, StructureAwareExitConfig, StructureLevel, DynamicTPResult, SignalDirection, SwingPoint, SwingPointType, LiquidityZone } from '../types';
import { ErrorHandler } from '../errors/ErrorHandler';
import { RecoveryStrategy } from '../errors/ErrorHandler';

export class StructureAwareExitService {
  constructor(
    private config: StructureAwareExitConfig,
    private logger: LoggerService,
    private errorHandler?: ErrorHandler,
  ) {
    this.validateConfig();
  }

  /**
   * Validate configuration on construction
   * THROW: Invalid config parameters prevent service creation
   */
  private validateConfig(): void {
    // Validate dynamicTP2 config
    if (this.config.dynamicTP2) {
      if (this.config.dynamicTP2.bufferPercent < 0 || this.config.dynamicTP2.bufferPercent > 10) {
        const error = new Error(
          `Invalid bufferPercent: ${this.config.dynamicTP2.bufferPercent}. Must be between 0 and 10.`,
        );
        if (this.errorHandler) {
          this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
        }
        throw error;
      }

      if (this.config.dynamicTP2.minTP2Percent <= 0 || this.config.dynamicTP2.minTP2Percent > 50) {
        const error = new Error(
          `Invalid minTP2Percent: ${this.config.dynamicTP2.minTP2Percent}. Must be between 0 and 50.`,
        );
        if (this.errorHandler) {
          this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
        }
        throw error;
      }

      if (this.config.dynamicTP2.maxTP2Percent <= 0 || this.config.dynamicTP2.maxTP2Percent > 50) {
        const error = new Error(
          `Invalid maxTP2Percent: ${this.config.dynamicTP2.maxTP2Percent}. Must be between 0 and 50.`,
        );
        if (this.errorHandler) {
          this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
        }
        throw error;
      }

      if (this.config.dynamicTP2.minTP2Percent > this.config.dynamicTP2.maxTP2Percent) {
        const error = new Error(
          `Invalid TP2 range: minTP2Percent (${this.config.dynamicTP2.minTP2Percent}) > maxTP2Percent (${this.config.dynamicTP2.maxTP2Percent})`,
        );
        if (this.errorHandler) {
          this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
        }
        throw error;
      }

      if (this.config.dynamicTP2.minZoneStrength < 0 || this.config.dynamicTP2.minZoneStrength > 1) {
        const error = new Error(
          `Invalid minZoneStrength: ${this.config.dynamicTP2.minZoneStrength}. Must be between 0 and 1.`,
        );
        if (this.errorHandler) {
          this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
        }
        throw error;
      }
    }

    // Validate trailingStopAfterTP1 config
    if (this.config.trailingStopAfterTP1) {
      if (this.config.trailingStopAfterTP1.trailingDistancePercent <= 0 || this.config.trailingStopAfterTP1.trailingDistancePercent > 10) {
        const error = new Error(
          `Invalid trailingDistancePercent: ${this.config.trailingStopAfterTP1.trailingDistancePercent}. Must be between 0 and 10.`,
        );
        if (this.errorHandler) {
          this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
        }
        throw error;
      }
    }
  }

  /**
   * Safe logging wrapper - SKIP logging failures
   */
  private safeLog(level: 'info' | 'debug' | 'warn' | 'error', message: string, context?: any): void {
    try {
      this.logger[level](message, context);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.SKIP });
      }
    }
  }

  /**
   * Detect nearest resistance (for LONG) or support (for SHORT) from multiple structure sources
   *
   * Priority: Liquidity Zones (strength) > Volume HVN (volume) > Swing Points (base)
   *
   * @param currentPrice - Current market price
   * @param direction - Signal direction (LONG/SHORT)
   * @param swingPoints - Swing highs/lows from ZigZag
   * @param liquidityZones - Resistance/support zones from LiquidityDetector
   * @param volumeProfile - HVN levels from VolumeProfileService (optional)
   * @returns StructureLevel or null if not found
   */
  detectNearestResistance(
    currentPrice: number,
    direction: SignalDirection,
    swingPoints: SwingPoint[],
    liquidityZones: LiquidityZone[],
    volumeProfile: { nodes: Array<{ price: number; volume: number }> } | null,
  ): StructureLevel | null {
    try {
      // GRACEFUL_DEGRADE: Validate inputs
      if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
        throw new Error(`Invalid currentPrice: ${currentPrice}`);
      }

      const candidates: (StructureLevel & { sortPrice: number })[] = [];
      const isLong = direction === SignalDirection.LONG;

      // 1. Swing Points (lowest priority)
      if (this.config.dynamicTP2.useSwingPoints && swingPoints.length > 0) {
        try {
          const relevantSwings = swingPoints.filter((p) =>
            isLong ? p.type === SwingPointType.HIGH && p.price > currentPrice : p.type === SwingPointType.LOW && p.price < currentPrice,
          );

          candidates.push(
            ...relevantSwings.map((s) => ({
              price: s.price,
              type: 'SWING_POINT' as const,
              strength: 0.5,
              sortPrice: s.price,
            })),
          );
        } catch (error) {
          if (this.errorHandler) {
            this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
          }
          // Continue without swing points
        }
      }

      // 2. Liquidity Zones (high priority - has strength scores)
      if (this.config.dynamicTP2.useLiquidityZones && liquidityZones.length > 0) {
        try {
          const relevantZones = liquidityZones.filter(
            (z) =>
              z.strength >= this.config.dynamicTP2.minZoneStrength &&
              (isLong ? z.type === 'RESISTANCE' && z.price > currentPrice : z.type === 'SUPPORT' && z.price < currentPrice),
          );

          candidates.push(
            ...relevantZones.map((z) => ({
              price: z.price,
              type: 'LIQUIDITY_ZONE' as const,
              strength: z.strength,
              touches: z.touches,
              sortPrice: z.price,
            })),
          );
        } catch (error) {
          if (this.errorHandler) {
            this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
          }
          // Continue without liquidity zones
        }
      }

      // 3. Volume Profile HVN (medium priority - has volume validation)
      if (this.config.dynamicTP2.useVolumeProfile && volumeProfile?.nodes?.length) {
        try {
          const avgVolume = volumeProfile.nodes.reduce((sum, n) => sum + n.volume, 0) / volumeProfile.nodes.length;
          const hvnNodes = volumeProfile.nodes.filter((n) => n.volume > avgVolume * 1.5 && (isLong ? n.price > currentPrice : n.price < currentPrice));

          candidates.push(
            ...hvnNodes.map((n) => ({
              price: n.price,
              type: 'VOLUME_HVN' as const,
              strength: Math.min(n.volume / avgVolume / 3, 1),
              volume: n.volume,
              sortPrice: n.price,
            })),
          );
        } catch (error) {
          if (this.errorHandler) {
            this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
          }
          // Continue without volume profile
        }
      }

      if (candidates.length === 0) {
        return null;
      }

      // Sort by proximity: nearest = closest distance to current price
      candidates.sort((a, b) => {
        const distA = Math.abs(a.sortPrice - currentPrice);
        const distB = Math.abs(b.sortPrice - currentPrice);
        return distA - distB;
      });

      // Return nearest with highest priority type
      const priorityOrder = { LIQUIDITY_ZONE: 0, VOLUME_HVN: 1, SWING_POINT: 2 };
      candidates.sort((a, b) => {
        const distA = Math.abs(a.sortPrice - currentPrice);
        const distB = Math.abs(b.sortPrice - currentPrice);
        const distDiff = distA - distB;

        // If within 0.1% proximity, prioritize by type
        if (Math.abs(distDiff) < currentPrice * 0.001) {
          return (priorityOrder[a.type as keyof typeof priorityOrder] ?? 3) - (priorityOrder[b.type as keyof typeof priorityOrder] ?? 3);
        }
        return distDiff;
      });

      return candidates[0];
    } catch (error) {
      // GRACEFUL_DEGRADE: Return null on unexpected errors
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      return null;
    }
  }

  /**
   * Calculate dynamic TP2 from structure level with safety buffer
   *
   * Logic:
   * 1. Apply buffer before structure level (e.g., 0.4%)
   * 2. Calculate resulting TP2 percent from entry
   * 3. Enforce min/max constraints
   *
   * @param entryPrice - Position entry price
   * @param direction - LONG/SHORT
   * @param structureLevel - Detected structure level
   * @returns DynamicTPResult with price and constraints applied
   */
  calculateDynamicTP2(entryPrice: number, direction: SignalDirection, structureLevel: StructureLevel): DynamicTPResult {
    try {
      // Validate inputs
      if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
        throw new Error(`Invalid entryPrice: ${entryPrice}`);
      }

      if (!structureLevel || !Number.isFinite(structureLevel.price) || structureLevel.price <= 0) {
        throw new Error(`Invalid structureLevel.price: ${structureLevel?.price}`);
      }

      const isLong = direction === SignalDirection.LONG;

      try {
        // Apply safety buffer before resistance/support
        const bufferAmount = structureLevel.price * (this.config.dynamicTP2.bufferPercent / 100);
        const tp2Price = isLong ? structureLevel.price - bufferAmount : structureLevel.price + bufferAmount;

        // Calculate distance from entry as percentage
        let tp2Percent = Math.abs((tp2Price - entryPrice) / entryPrice) * 100;

        // Track if constrained by min/max
        let wasConstrained = false;

        // Apply constraints
        if (tp2Percent < this.config.dynamicTP2.minTP2Percent) {
          tp2Percent = this.config.dynamicTP2.minTP2Percent;
          wasConstrained = true;
        } else if (tp2Percent > this.config.dynamicTP2.maxTP2Percent) {
          tp2Percent = this.config.dynamicTP2.maxTP2Percent;
          wasConstrained = true;
        }

        // Validate calculations
        if (!Number.isFinite(tp2Percent)) {
          throw new Error(`Calculation resulted in NaN: tp2Percent = ${tp2Percent}`);
        }

        // Calculate final TP2 price from constrained percent
        const finalTP2Price = isLong ? entryPrice * (1 + tp2Percent / 100) : entryPrice * (1 - tp2Percent / 100);

        if (!Number.isFinite(finalTP2Price)) {
          throw new Error(`Calculation resulted in invalid price: ${finalTP2Price}`);
        }

        this.safeLog('info', '🎯 Dynamic TP2 calculated from structure level', {
          entryPrice: entryPrice.toFixed(4),
          structurePrice: structureLevel.price.toFixed(4),
          structureType: structureLevel.type,
          structureStrength: structureLevel.strength.toFixed(2),
          bufferPercent: this.config.dynamicTP2.bufferPercent.toFixed(2) + '%',
          tp2Price: finalTP2Price.toFixed(4),
          tp2Percent: tp2Percent.toFixed(2) + '%',
          wasConstrained: wasConstrained ? 'YES (min/max applied)' : 'NO',
        });

        return {
          price: finalTP2Price,
          percent: tp2Percent,
          structureLevel: structureLevel.price,
          structureType: structureLevel.type,
          confidence: structureLevel.strength,
          wasConstrained,
        };
      } catch (calcError) {
        // GRACEFUL_DEGRADE: Return safe defaults on calculation failure
        if (this.errorHandler) {
          this.errorHandler.handle(calcError as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
        }

        // Return safe default: min TP2 percent
        const fallbackPercent = this.config.dynamicTP2.minTP2Percent;
        const fallbackPrice = isLong ? entryPrice * (1 + fallbackPercent / 100) : entryPrice * (1 - fallbackPercent / 100);

        return {
          price: fallbackPrice,
          percent: fallbackPercent,
          structureLevel: structureLevel.price,
          structureType: structureLevel.type,
          confidence: 0.3, // Reduced confidence due to fallback
          wasConstrained: true,
        };
      }
    } catch (error) {
      // GRACEFUL_DEGRADE: Return safe defaults for validation errors
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }

      // Return minimal safe default
      const fallbackPercent = this.config.dynamicTP2.minTP2Percent;
      const fallbackPrice = entryPrice * (1 + fallbackPercent / 100);

      return {
        price: fallbackPrice,
        percent: fallbackPercent,
        structureLevel: entryPrice,
        structureType: 'UNKNOWN' as any,
        confidence: 0.1, // Very low confidence
        wasConstrained: true,
      };
    }
  }

  /**
   * Check if trailing stop should be activated after TP1
   *
   * @returns true if trailing stop is enabled and configured
   */
  shouldActivateTrailing(): boolean {
    return this.config.trailingStopAfterTP1.enabled && this.config.trailingStopAfterTP1.useBybitNativeTrailing;
  }

  /**
   * Get trailing stop distance in percent
   *
   * @returns Trailing distance as percentage
   */
  getTrailingDistance(): number {
    return this.config.trailingStopAfterTP1.trailingDistancePercent;
  }
}
