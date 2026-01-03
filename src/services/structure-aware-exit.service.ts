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

export class StructureAwareExitService {
  constructor(
    private config: StructureAwareExitConfig,
    private logger: LoggerService,
  ) {}

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
    const candidates: (StructureLevel & { sortPrice: number })[] = [];
    const isLong = direction === SignalDirection.LONG;

    // 1. Swing Points (lowest priority)
    if (this.config.dynamicTP2.useSwingPoints && swingPoints.length > 0) {
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
    }

    // 2. Liquidity Zones (high priority - has strength scores)
    if (this.config.dynamicTP2.useLiquidityZones && liquidityZones.length > 0) {
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
    }

    // 3. Volume Profile HVN (medium priority - has volume validation)
    if (this.config.dynamicTP2.useVolumeProfile && volumeProfile?.nodes?.length) {
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
    const isLong = direction === SignalDirection.LONG;

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

    // Calculate final TP2 price from constrained percent
    const finalTP2Price = isLong ? entryPrice * (1 + tp2Percent / 100) : entryPrice * (1 - tp2Percent / 100);

    this.logger.info('🎯 Dynamic TP2 calculated from structure level', {
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
