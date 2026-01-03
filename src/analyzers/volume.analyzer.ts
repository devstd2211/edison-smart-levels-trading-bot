import { DECIMAL_PLACES, MULTIPLIERS, PERCENT_MULTIPLIER, INTEGER_MULTIPLIERS } from '../constants';
import { DEFAULT_BLOCKING_CHECK_DISTANCE_PERCENT } from '../constants/technical.constants';
/**
 * Volume Analyzer
 *
 * Analyzes volume by price levels (Volume Profile / VPVR).
 * Identifies:
 * - High Volume Nodes (HVN) - strong support/resistance zones
 * - Low Volume Nodes (LVN) - weak zones that price moves through quickly
 * - Point of Control (POC) - price level with maximum volume
 * - Volume imbalance by price level
 *
 * Single Responsibility: Analyze volume data ONLY
 * Does NOT make trading decisions - only provides analysis
 */

import { Candle, LoggerService } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface VolumeLevel {
  price: number; // Price level (rounded)
  volume: number; // Total volume at this level
  buyVolume: number; // Volume from bullish candles
  sellVolume: number; // Volume from bearish candles
  buySellRatio: number; // Buy / Sell ratio
}

export interface VolumeNode {
  type: 'HVN' | 'LVN'; // High Volume Node or Low Volume Node
  priceStart: number; // Start of price zone
  priceEnd: number; // End of price zone
  volume: number; // Total volume in this zone
  percentOfTotal: number; // % of total volume
  distance: number; // Distance from current price (%)
}

export interface VolumeAnalysis {
  poc: VolumeLevel | null; // Point of Control (max volume level)
  hvns: VolumeNode[]; // High Volume Nodes (strong support/resistance)
  lvns: VolumeNode[]; // Low Volume Nodes (weak zones)
  volumeByPrice: VolumeLevel[]; // All volume levels (sorted by price)
  totalVolume: number; // Total volume across all levels
  avgVolume: number; // Average volume per level
  currentPriceVolume: VolumeLevel | null; // Volume at current price
}

export interface VolumeConfig {
  enabled: boolean;
  priceBuckets: number; // Number of price buckets (50-200)
  hvnThreshold: number; // Min % of avg volume to be HVN (1.5 = 150%)
  lvnThreshold: number; // Max % of avg volume to be LVN (0.5 = CONFIDENCE_THRESHOLDS.MODERATE%)
  minNodeSize: number; // Min price range for node (% of total range)
}

// ============================================================================
// VOLUME ANALYZER
// ============================================================================

export class VolumeAnalyzer {
  constructor(
    private config: VolumeConfig | null = null,
    private logger: LoggerService | null = null,
  ) {}

  /**
   * Calculate average volume over last N candles
   */
  calculateAverage(candles: Candle[], periods: number = 20): number {
    if (candles.length === 0) return 0;

    const recentCandles = candles.slice(-periods);
    const totalVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0);
    return totalVolume / recentCandles.length;
  }

  /**
   * Analyze volume distribution by price
   *
   * @param candles - Historical candles
   * @param currentPrice - Current market price
   * @returns Volume analysis
   */
  analyze(candles: Candle[], currentPrice: number): VolumeAnalysis {
    if (candles.length === 0) {
      if (this.logger) {
        this.logger.warn('No candles available for volume analysis');
      }
      return this.getEmptyAnalysis();
    }

    // 1. Build volume profile (volume by price)
    const volumeByPrice = this.buildVolumeProfile(candles);

    // 2. Calculate total and average volume
    const totalVolume = volumeByPrice.reduce((sum, level) => sum + level.volume, 0);
    const avgVolume = volumeByPrice.length > 0 ? totalVolume / volumeByPrice.length : 0;

    // 3. Find Point of Control (max volume)
    const poc = this.findPOC(volumeByPrice);

    // 4. Detect High Volume Nodes (HVN)
    const hvns = this.detectHVN(volumeByPrice, avgVolume, currentPrice);

    // 5. Detect Low Volume Nodes (LVN)
    const lvns = this.detectLVN(volumeByPrice, avgVolume, currentPrice);

    // 6. Find volume at current price
    const currentPriceVolume = this.findVolumeAtPrice(volumeByPrice, currentPrice);

    if (this.logger) {
      this.logger.debug('Volume analysis complete', {
        totalVolume: totalVolume.toFixed(DECIMAL_PLACES.PERCENT),
        avgVolume: avgVolume.toFixed(DECIMAL_PLACES.PERCENT),
        poc: poc ? `${poc.price.toFixed(DECIMAL_PLACES.PERCENT)} (${poc.volume.toFixed(DECIMAL_PLACES.PERCENT)})` : 'N/A',
        hvns: hvns.length,
        lvns: lvns.length,
      });
    }

    return {
      poc,
      hvns,
      lvns,
      volumeByPrice,
      totalVolume,
      avgVolume,
      currentPriceVolume,
    };
  }

  // ============================================================================
  // PRIVATE METHODS - Volume Profile
  // ============================================================================

  /**
   * Build volume profile (volume by price)
   */
  private buildVolumeProfile(candles: Candle[]): VolumeLevel[] {
    // Find price range
    let minPrice = candles[0].low;
    let maxPrice = candles[0].high;

    for (const candle of candles) {
      if (candle.low < minPrice) {
        minPrice = candle.low;
      }
      if (candle.high > maxPrice) {
        maxPrice = candle.high;
      }
    }

    const priceRange = maxPrice - minPrice;
    const priceBuckets = this.config?.priceBuckets ?? INTEGER_MULTIPLIERS.ONE_HUNDRED; // Default to 100 buckets
    const bucketSize = priceRange / priceBuckets;

    // Create buckets
    const buckets = new Map<number, { volume: number; buyVolume: number; sellVolume: number }>();

    // Fill buckets with volume
    for (const candle of candles) {
      const isBullish = candle.close > candle.open;
      const bucketIndex = Math.floor((candle.close - minPrice) / bucketSize);
      const bucketPrice = minPrice + bucketIndex * bucketSize;

      if (!buckets.has(bucketPrice)) {
        buckets.set(bucketPrice, { volume: 0, buyVolume: 0, sellVolume: 0 });
      }

      const bucket = buckets.get(bucketPrice)!;
      bucket.volume += candle.volume;

      if (isBullish) {
        bucket.buyVolume += candle.volume;
      } else {
        bucket.sellVolume += candle.volume;
      }
    }

    // Convert to array and sort by price
    const volumeByPrice: VolumeLevel[] = Array.from(buckets.entries())
      .map(([price, data]) => ({
        price,
        volume: data.volume,
        buyVolume: data.buyVolume,
        sellVolume: data.sellVolume,
        buySellRatio: data.sellVolume > 0 ? data.buyVolume / data.sellVolume : 0,
      }))
      .sort((a, b) => a.price - b.price);

    return volumeByPrice;
  }

  // ============================================================================
  // PRIVATE METHODS - POC
  // ============================================================================

  /**
   * Find Point of Control (price level with max volume)
   */
  private findPOC(volumeByPrice: VolumeLevel[]): VolumeLevel | null {
    if (volumeByPrice.length === 0) {
      return null;
    }

    let poc = volumeByPrice[0];
    for (const level of volumeByPrice) {
      if (level.volume > poc.volume) {
        poc = level;
      }
    }

    return poc;
  }

  // ============================================================================
  // PRIVATE METHODS - HVN/LVN Detection
  // ============================================================================

  /**
   * Detect High Volume Nodes (strong support/resistance)
   */
  private detectHVN(
    volumeByPrice: VolumeLevel[],
    avgVolume: number,
    currentPrice: number,
  ): VolumeNode[] {
    const nodes: VolumeNode[] = [];
    const hvnThreshold = this.config?.hvnThreshold ?? 1.5; // Default 1.5x average
    const threshold = avgVolume * hvnThreshold;

    let nodeStart: VolumeLevel | null = null;
    let nodeVolume = 0;

    for (let i = 0; i < volumeByPrice.length; i++) {
      const level = volumeByPrice[i];

      if (level.volume >= threshold) {
        // Start or continue HVN
        if (!nodeStart) {
          nodeStart = level;
          nodeVolume = level.volume;
        } else {
          nodeVolume += level.volume;
        }
      } else {
        // End HVN if one was in progress
        if (nodeStart) {
          const prevLevel = volumeByPrice[i - 1];
          nodes.push(this.createNode('HVN', nodeStart, prevLevel, nodeVolume, currentPrice));
          nodeStart = null;
          nodeVolume = 0;
        }
      }
    }

    // Handle last node if still open
    if (nodeStart) {
      const lastLevel = volumeByPrice[volumeByPrice.length - 1];
      nodes.push(this.createNode('HVN', nodeStart, lastLevel, nodeVolume, currentPrice));
    }

    return nodes;
  }

  /**
   * Detect Low Volume Nodes (weak zones)
   */
  private detectLVN(
    volumeByPrice: VolumeLevel[],
    avgVolume: number,
    currentPrice: number,
  ): VolumeNode[] {
    const nodes: VolumeNode[] = [];
    const lvnThreshold = this.config?.lvnThreshold ?? 0.7; // Default 0.7x average
    const threshold = avgVolume * lvnThreshold;

    let nodeStart: VolumeLevel | null = null;
    let nodeVolume = 0;

    for (let i = 0; i < volumeByPrice.length; i++) {
      const level = volumeByPrice[i];

      if (level.volume <= threshold) {
        // Start or continue LVN
        if (!nodeStart) {
          nodeStart = level;
          nodeVolume = level.volume;
        } else {
          nodeVolume += level.volume;
        }
      } else {
        // End LVN if one was in progress
        if (nodeStart) {
          const prevLevel = volumeByPrice[i - 1];
          nodes.push(this.createNode('LVN', nodeStart, prevLevel, nodeVolume, currentPrice));
          nodeStart = null;
          nodeVolume = 0;
        }
      }
    }

    // Handle last node if still open
    if (nodeStart) {
      const lastLevel = volumeByPrice[volumeByPrice.length - 1];
      nodes.push(this.createNode('LVN', nodeStart, lastLevel, nodeVolume, currentPrice));
    }

    return nodes;
  }

  /**
   * Create volume node
   */
  private createNode(
    type: 'HVN' | 'LVN',
    startLevel: VolumeLevel,
    endLevel: VolumeLevel,
    volume: number,
    currentPrice: number,
  ): VolumeNode {
    const percentOfTotal = 0; // Will be calculated later if needed
    const midPrice = (startLevel.price + endLevel.price) / INTEGER_MULTIPLIERS.TWO;
    const distance = ((midPrice - currentPrice) / currentPrice) * PERCENT_MULTIPLIER;

    return {
      type,
      priceStart: startLevel.price,
      priceEnd: endLevel.price,
      volume,
      percentOfTotal,
      distance,
    };
  }

  // ============================================================================
  // PRIVATE METHODS - Utilities
  // ============================================================================

  /**
   * Find volume at specific price
   */
  private findVolumeAtPrice(volumeByPrice: VolumeLevel[], price: number): VolumeLevel | null {
    // Find closest level
    let closest: VolumeLevel | null = null;
    let minDistance = Infinity;

    for (const level of volumeByPrice) {
      const distance = Math.abs(level.price - price);
      if (distance < minDistance) {
        minDistance = distance;
        closest = level;
      }
    }

    return closest;
  }

  /**
   * Get empty analysis (when no data)
   */
  private getEmptyAnalysis(): VolumeAnalysis {
    return {
      poc: null,
      hvns: [],
      lvns: [],
      volumeByPrice: [],
      totalVolume: 0,
      avgVolume: 0,
      currentPriceVolume: null,
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get human-readable summary
   */
  getSummary(analysis: VolumeAnalysis): string {
    const parts: string[] = [];

    // POC
    if (analysis.poc) {
      parts.push(`POC: ${analysis.poc.price.toFixed(DECIMAL_PLACES.PERCENT)} (${analysis.poc.volume.toFixed(0)})`);
    } else {
      parts.push('No POC');
    }

    // HVNs
    if (analysis.hvns.length > 0) {
      const nearest = analysis.hvns.reduce((prev, curr) =>
        Math.abs(curr.distance) < Math.abs(prev.distance) ? curr : prev,
      );
      parts.push(
        `Nearest HVN: ${nearest.priceStart.toFixed(DECIMAL_PLACES.PERCENT)}-${nearest.priceEnd.toFixed(DECIMAL_PLACES.PERCENT)} (${nearest.distance.toFixed(DECIMAL_PLACES.PERCENT)}% away)`,
      );
    } else {
      parts.push('No HVNs');
    }

    // LVNs
    parts.push(`LVNs: ${analysis.lvns.length}`);

    // Total volume
    parts.push(`Total volume: ${analysis.totalVolume.toFixed(0)}`);

    return parts.join(' | ');
  }

  /**
   * Check if there's a HVN blocking the path
   *
   * @param analysis - Volume analysis
   * @param direction - Trade direction (LONG/SHORT)
   * @param maxDistance - Max distance to check (% from current price)
   * @returns True if HVN is blocking
   */
  hasBlockingHVN(
    analysis: VolumeAnalysis,
    direction: 'LONG' | 'SHORT',
    maxDistance: number = DEFAULT_BLOCKING_CHECK_DISTANCE_PERCENT,
  ): boolean {
    for (const hvn of analysis.hvns) {
      // For LONG: check HVNs above current price
      if (direction === 'LONG' && hvn.distance > 0 && hvn.distance <= maxDistance) {
        return true;
      }

      // For SHORT: check HVNs below current price
      if (direction === 'SHORT' && hvn.distance < 0 && Math.abs(hvn.distance) <= maxDistance) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if current price is in a LVN (weak zone)
   *
   * @param analysis - Volume analysis
   * @param currentPrice - Current market price
   * @returns True if in LVN
   */
  isInLVN(analysis: VolumeAnalysis, currentPrice: number): boolean {
    for (const lvn of analysis.lvns) {
      if (currentPrice >= lvn.priceStart && currentPrice <= lvn.priceEnd) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if current price is near POC
   *
   * @param analysis - Volume analysis
   * @param currentPrice - Current market price
   * @param threshold - Max distance % to be considered "near"
   * @returns True if near POC
   */
  isNearPOC(analysis: VolumeAnalysis, currentPrice: number, threshold: number = MULTIPLIERS.HALF): boolean {
    if (!analysis.poc) {
      return false;
    }

    const distance = Math.abs(((currentPrice - analysis.poc.price) / currentPrice) * PERCENT_MULTIPLIER);
    return distance <= threshold;
  }
}
