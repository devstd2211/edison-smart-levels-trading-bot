import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';
/**
 * Volume Profile Service (PHASE 4 Feature 3)
 *
 * Calculates volume distribution across price levels to find:
 * - POC (Point of Control) = Price with highest volume
 * - VAH (Value Area High) = Top of 70% volume range
 * - VAL (Value Area Low) = Bottom of 70% volume range
 *
 * Use Cases:
 * - Support/Resistance levels (POC acts as magnet)
 * - Entry zones (near VAL for LONG, VAH for SHORT)
 * - Breakout targets (above VAH = bullish, below VAL = bearish)
 */

import { VolumeProfileConfig, VolumeProfileResult, VolumeNode, Candle, LoggerService } from '../types';

// ============================================================================
// VOLUME PROFILE SERVICE
// ============================================================================

export class VolumeProfileService {
  constructor(
    private config: VolumeProfileConfig,
    private logger: LoggerService,
  ) {
    this.logger.info('VolumeProfileService initialized', {
      enabled: config.enabled,
      lookbackCandles: config.lookbackCandles,
      valueAreaPercent: config.valueAreaPercent,
      priceTickSize: config.priceTickSize,
    });
  }

  /**
   * Calculate volume profile from candles
   * @param candles - Array of candles (oldest first)
   * @returns Volume profile with POC, VAH, VAL
   */
  calculate(candles: Candle[]): VolumeProfileResult | null {
    if (!this.config.enabled) {
      return null;
    }

    if (candles.length === 0) {
      this.logger.warn('Cannot calculate volume profile: no candles');
      return null;
    }

    // Take last N candles
    const lookback = Math.min(this.config.lookbackCandles, candles.length);
    const relevantCandles = candles.slice(-lookback);

    // Build volume distribution (price → volume map)
    const volumeMap = new Map<number, number>();

    for (const candle of relevantCandles) {
      // Get price levels within candle range
      const priceLevels = this.getPriceLevels(candle);

      // Distribute candle volume evenly across price levels
      const volumePerLevel = candle.volume / priceLevels.length;

      for (const priceLevel of priceLevels) {
        const existing = volumeMap.get(priceLevel) || 0;
        volumeMap.set(priceLevel, existing + volumePerLevel);
      }
    }

    // Convert to nodes and sort by volume (descending)
    const nodes: VolumeNode[] = Array.from(volumeMap.entries())
      .map(([price, volume]) => ({ price, volume }))
      .sort((a, b) => b.volume - a.volume);

    if (nodes.length === 0) {
      this.logger.warn('Cannot calculate volume profile: no volume nodes');
      return null;
    }

    const totalVolume = nodes.reduce((sum, n) => sum + n.volume, 0);

    // POC = price with highest volume
    const poc = nodes[0].price;

    // Value Area = range containing N% of total volume
    const valueVolume = totalVolume * (this.config.valueAreaPercent / PERCENT_MULTIPLIER);
    let accumulatedVolume = 0;
    const valueNodes: VolumeNode[] = [];

    for (const node of nodes) {
      valueNodes.push(node);
      accumulatedVolume += node.volume;
      if (accumulatedVolume >= valueVolume) {
        break;
      }
    }

    // VAH/VAL = top/bottom of value area (sort by price)
    const valuePrices = valueNodes.map((n) => n.price).sort((a, b) => a - b);
    const val = valuePrices[0];
    const vah = valuePrices[valuePrices.length - 1];

    this.logger.debug('📊 Volume Profile calculated', {
      poc: poc.toFixed(DECIMAL_PLACES.PRICE),
      vah: vah.toFixed(DECIMAL_PLACES.PRICE),
      val: val.toFixed(DECIMAL_PLACES.PRICE),
      totalVolume: totalVolume.toFixed(0),
      nodesCount: nodes.length,
    });

    return {
      poc,
      vah,
      val,
      totalVolume,
      nodes,
    };
  }

  /**
   * Get price levels within candle range based on tick size
   * @param candle - Candle to extract price levels from
   * @returns Array of price levels
   */
  private getPriceLevels(candle: Candle): number[] {
    const tickSize = this.config.priceTickSize;
    const levels: number[] = [];

    // Start from low and go to high by tick increments
    let price = Math.floor(candle.low / tickSize) * tickSize;
    const high = candle.high;

    while (price <= high) {
      levels.push(parseFloat(price.toFixed(8))); // Round to avoid floating point issues
      price += tickSize;
    }

    // Fallback: if no levels generated (shouldn't happen), use close price
    return levels.length > 0 ? levels : [candle.close];
  }
}
