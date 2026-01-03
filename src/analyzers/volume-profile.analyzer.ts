/**
 * Volume Profile Analyzer
 *
 * Analyzes volume distribution across price levels to identify:
 * - POC (Point of Control) - price level with highest volume
 * - VAH/VAL (Value Area High/Low) - 70% volume concentration zone
 * - HVN (High Volume Nodes) - strong S/R levels
 * - LVN (Low Volume Nodes) - price levels that break easily
 *
 * Used for:
 * - Identifying strong support/resistance levels based on volume
 * - Predicting price reaction at key levels
 * - Confirming entries near high volume nodes
 */

import {
  Candle,
  SignalDirection,
  AnalyzerSignal,
  LoggerService,
} from '../types';

// ============================================================================
// INTERFACES
// ============================================================================

export interface VolumeProfileConfig {
  lookbackCandles: number; // Number of candles to analyze (default: 200)
  valueAreaPercent: number; // Percentage of volume for value area (default: 70)
  priceTickSize: number; // Price bucket size in percent (default: 0.1%)
  hvnThreshold: number; // Multiplier for HVN detection (default: 1.5x avg)
  lvnThreshold: number; // Multiplier for LVN detection (default: 0.5x avg)
  maxDistancePercent: number; // Max distance to POC/HVN for signal (default: 1.0%)
  baseConfidence: number; // Base confidence for signals (default: 60)
  maxConfidence: number; // Maximum confidence cap (default: 85)
}

export interface PriceLevel {
  price: number;
  volume: number;
  percentage: number; // Percentage of total volume
}

export interface VolumeProfileResult {
  poc: PriceLevel; // Point of Control
  vah: number; // Value Area High
  val: number; // Value Area Low
  hvnLevels: PriceLevel[]; // High Volume Nodes
  lvnLevels: PriceLevel[]; // Low Volume Nodes
  totalVolume: number;
  priceLevels: PriceLevel[];
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: VolumeProfileConfig = {
  lookbackCandles: 200,
  valueAreaPercent: 70,
  priceTickSize: 0.1, // 0.1% price buckets
  hvnThreshold: 1.5,
  lvnThreshold: 0.5,
  maxDistancePercent: 1.0,
  baseConfidence: 60,
  maxConfidence: 85,
};

// ============================================================================
// VOLUME PROFILE ANALYZER
// ============================================================================

export class VolumeProfileAnalyzer {
  private config: VolumeProfileConfig;

  constructor(
    private logger: LoggerService,
    config?: Partial<VolumeProfileConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate volume profile from candles
   */
  calculateProfile(candles: Candle[]): VolumeProfileResult | null {
    if (candles.length < 20) {
      return null;
    }

    // Use last N candles
    const analysisCandles = candles.slice(-this.config.lookbackCandles);

    // Find price range
    const prices = analysisCandles.flatMap(c => [c.high, c.low]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    if (priceRange === 0) {
      return null;
    }

    // Calculate bucket size
    const bucketSize = (minPrice * this.config.priceTickSize) / 100;
    const numBuckets = Math.ceil(priceRange / bucketSize);

    if (numBuckets < 5 || numBuckets > 1000) {
      return null;
    }

    // Initialize volume buckets
    const volumeByPrice: Map<number, number> = new Map();

    // Distribute volume across price levels
    for (const candle of analysisCandles) {
      const candleRange = candle.high - candle.low;
      if (candleRange === 0) {
        // Doji - all volume at one price
        const bucketPrice = this.getBucketPrice(candle.close, minPrice, bucketSize);
        volumeByPrice.set(bucketPrice, (volumeByPrice.get(bucketPrice) || 0) + candle.volume);
      } else {
        // Distribute volume proportionally across price range
        const numCandleBuckets = Math.max(1, Math.ceil(candleRange / bucketSize));
        const volumePerBucket = candle.volume / numCandleBuckets;

        for (let price = candle.low; price <= candle.high; price += bucketSize) {
          const bucketPrice = this.getBucketPrice(price, minPrice, bucketSize);
          volumeByPrice.set(bucketPrice, (volumeByPrice.get(bucketPrice) || 0) + volumePerBucket);
        }
      }
    }

    // Convert to sorted price levels
    const totalVolume = Array.from(volumeByPrice.values()).reduce((sum, v) => sum + v, 0);
    const priceLevels: PriceLevel[] = Array.from(volumeByPrice.entries())
      .map(([price, volume]) => ({
        price,
        volume,
        percentage: (volume / totalVolume) * 100,
      }))
      .sort((a, b) => b.volume - a.volume);

    if (priceLevels.length === 0) {
      return null;
    }

    // Find POC (highest volume level)
    const poc = priceLevels[0];

    // Calculate Value Area (70% of volume around POC)
    const { vah, val } = this.calculateValueArea(priceLevels, totalVolume);

    // Find HVN and LVN levels
    const avgVolume = totalVolume / priceLevels.length;
    const hvnLevels = priceLevels.filter(l => l.volume >= avgVolume * this.config.hvnThreshold);
    const lvnLevels = priceLevels.filter(l => l.volume <= avgVolume * this.config.lvnThreshold);

    return {
      poc,
      vah,
      val,
      hvnLevels,
      lvnLevels,
      totalVolume,
      priceLevels,
    };
  }

  /**
   * Get bucket price for a given price
   */
  private getBucketPrice(price: number, minPrice: number, bucketSize: number): number {
    const bucketIndex = Math.floor((price - minPrice) / bucketSize);
    return minPrice + bucketIndex * bucketSize + bucketSize / 2;
  }

  /**
   * Calculate Value Area High and Low
   */
  private calculateValueArea(
    priceLevels: PriceLevel[],
    totalVolume: number,
  ): { vah: number; val: number } {
    const targetVolume = totalVolume * (this.config.valueAreaPercent / 100);
    let accumulatedVolume = 0;

    // Sort by price for value area calculation
    const sortedByPrice = [...priceLevels].sort((a, b) => a.price - b.price);

    // Find POC index in sorted array
    const pocPrice = priceLevels[0].price;
    let pocIndex = sortedByPrice.findIndex(l => l.price === pocPrice);
    if (pocIndex === -1) {
      pocIndex = Math.floor(sortedByPrice.length / 2);
    }

    // Expand from POC until we reach target volume
    let lowIndex = pocIndex;
    let highIndex = pocIndex;
    accumulatedVolume = sortedByPrice[pocIndex].volume;

    while (accumulatedVolume < targetVolume && (lowIndex > 0 || highIndex < sortedByPrice.length - 1)) {
      const lowVolume = lowIndex > 0 ? sortedByPrice[lowIndex - 1].volume : 0;
      const highVolume = highIndex < sortedByPrice.length - 1 ? sortedByPrice[highIndex + 1].volume : 0;

      if (lowVolume >= highVolume && lowIndex > 0) {
        lowIndex--;
        accumulatedVolume += sortedByPrice[lowIndex].volume;
      } else if (highIndex < sortedByPrice.length - 1) {
        highIndex++;
        accumulatedVolume += sortedByPrice[highIndex].volume;
      } else if (lowIndex > 0) {
        lowIndex--;
        accumulatedVolume += sortedByPrice[lowIndex].volume;
      } else {
        break;
      }
    }

    return {
      val: sortedByPrice[lowIndex].price,
      vah: sortedByPrice[highIndex].price,
    };
  }

  /**
   * Generate trading signal based on volume profile
   */
  generateSignal(
    candles: Candle[],
    currentPrice: number,
  ): AnalyzerSignal | null {
    const profile = this.calculateProfile(candles);

    if (!profile) {
      return null;
    }

    const { poc, vah, val, hvnLevels } = profile;

    // Calculate distance to key levels
    const distanceToPoc = Math.abs((currentPrice - poc.price) / poc.price) * 100;
    const distanceToVah = Math.abs((currentPrice - vah) / vah) * 100;
    const distanceToVal = Math.abs((currentPrice - val) / val) * 100;

    // Check if price is near any HVN
    let nearestHvn: PriceLevel | null = null;
    let minHvnDistance = Infinity;
    for (const hvn of hvnLevels) {
      const distance = Math.abs((currentPrice - hvn.price) / hvn.price) * 100;
      if (distance < minHvnDistance && distance <= this.config.maxDistancePercent) {
        nearestHvn = hvn;
        minHvnDistance = distance;
      }
    }

    // Determine signal based on price position relative to volume profile
    let direction: SignalDirection = SignalDirection.HOLD;
    let confidence = this.config.baseConfidence;
    let reason = '';

    // Near VAL (Value Area Low) - potential LONG
    if (currentPrice <= val && distanceToVal <= this.config.maxDistancePercent) {
      direction = SignalDirection.LONG;
      confidence += 10 + (1 - distanceToVal / this.config.maxDistancePercent) * 10;
      reason = `Near VAL ${val.toFixed(4)} (dist: ${distanceToVal.toFixed(2)}%)`;
    }
    // Near VAH (Value Area High) - potential SHORT
    else if (currentPrice >= vah && distanceToVah <= this.config.maxDistancePercent) {
      direction = SignalDirection.SHORT;
      confidence += 10 + (1 - distanceToVah / this.config.maxDistancePercent) * 10;
      reason = `Near VAH ${vah.toFixed(4)} (dist: ${distanceToVah.toFixed(2)}%)`;
    }
    // Near POC (Point of Control) - strong level
    else if (distanceToPoc <= this.config.maxDistancePercent) {
      // At POC, direction depends on whether price is above or below
      if (currentPrice < poc.price) {
        direction = SignalDirection.LONG;
        reason = `Below POC ${poc.price.toFixed(4)} - expect reversion`;
      } else {
        direction = SignalDirection.SHORT;
        reason = `Above POC ${poc.price.toFixed(4)} - expect reversion`;
      }
      confidence += 15 + poc.percentage; // Boost based on POC strength
    }
    // Near HVN (High Volume Node) - strong S/R
    else if (nearestHvn) {
      if (currentPrice < nearestHvn.price) {
        direction = SignalDirection.LONG;
      } else {
        direction = SignalDirection.SHORT;
      }
      confidence += 10 + nearestHvn.percentage;
      reason = `Near HVN ${nearestHvn.price.toFixed(4)} (${nearestHvn.percentage.toFixed(1)}% vol)`;
    }

    if (direction === SignalDirection.HOLD) {
      return null;
    }

    confidence = Math.min(Math.round(confidence), this.config.maxConfidence);

    this.logger.debug('📊 VolumeProfileAnalyzer signal', {
      direction,
      confidence,
      poc: poc.price.toFixed(4),
      vah: vah.toFixed(4),
      val: val.toFixed(4),
      currentPrice: currentPrice.toFixed(4),
      reason,
    });

    return {
      source: 'VOLUME_PROFILE',
      direction,
      confidence,
      weight: 0.18,
      priority: 7,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<VolumeProfileConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): VolumeProfileConfig {
    return { ...this.config };
  }
}
