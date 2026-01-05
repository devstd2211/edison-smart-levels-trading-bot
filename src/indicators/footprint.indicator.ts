/**
 * Footprint Indicator
 *
 * Trade-by-trade aggression analysis. Shows WHERE institutional volume
 * is being used (bid vs ask side) at specific price levels.
 *
 * Key insights:
 * - BUY ticks = aggressive buyers hitting asks (bullish)
 * - SELL ticks = aggressive sellers hitting bids (bearish)
 * - Imbalance ratio = dominance of one side
 *
 * Smart Money Concepts (SMC) component for identifying institutional activity.
 */

import { Candle, FootprintLevel, FootprintCandle, FootprintAnalysis, FootprintConfig, LoggerService, Tick } from '../types';
import { MULTIPLIER_VALUES, RATIO_MULTIPLIERS, INTEGER_MULTIPLIERS } from '../constants';

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_TICKS_REQUIRED = INTEGER_MULTIPLIERS.ONE;

// ============================================================================
// FOOTPRINT INDICATOR
// ============================================================================

export class FootprintIndicator {
  constructor(
    private config: FootprintConfig,
    private logger: LoggerService,
  ) {
    if (!config.enabled) {
      this.logger.info('Footprint Indicator: Disabled in config');
    }
  }

  /**
   * Build footprint candle from trade ticks
   *
   * Algorithm:
   * 1. Group ticks by price level (round to tickLevels)
   * 2. For each tick:
   *    - If side = 'BUY': add size to ASK volume (taker bought from asks)
   *    - If side = 'SELL': add size to BID volume (taker sold to bids)
   * 3. Calculate delta for each level: askVolume - bidVolume
   * 4. Find POV (Point of Control): level with max volume
   * 5. Determine dominant side and imbalance ratio
   *
   * @param ticks - Trade ticks array with { price, size, side: 'BUY' | 'SELL' }
   * @param candle - The candle these ticks belong to
   * @returns Footprint candle with aggregated price level data
   */
  buildFootprintCandle(ticks: Tick[], candle: Candle): FootprintCandle {
    if (!this.config.enabled) {
      return this.createEmptyFootprintCandle(candle);
    }

    if (ticks.length < MIN_TICKS_REQUIRED) {
      return this.createEmptyFootprintCandle(candle);
    }

    // Group ticks by price level
    const levelMap = new Map<number, FootprintLevel>();

    for (const tick of ticks) {
      const priceLevel = this.roundToPriceLevel(tick.price);

      if (!levelMap.has(priceLevel)) {
        levelMap.set(priceLevel, {
          price: priceLevel,
          bidVolume: 0,
          askVolume: 0,
          delta: 0,
          timestamp: tick.timestamp,
        });
      }

      const level = levelMap.get(priceLevel)!;

      // Normalize side to uppercase
      const side = typeof tick.side === 'string' ? tick.side.toUpperCase() : tick.side;

      if (side === 'BUY') {
        // Aggressive buyer taking ask liquidity
        level.askVolume += tick.size;
      } else if (side === 'SELL') {
        // Aggressive seller hitting bid liquidity
        level.bidVolume += tick.size;
      }

      level.delta = level.askVolume - level.bidVolume;
      level.timestamp = Math.max(level.timestamp, tick.timestamp);
    }

    // Sort levels by price (descending)
    const levels = Array.from(levelMap.values()).sort((a, b) => b.price - a.price);

    // Calculate total delta and volumes
    let totalDelta = 0;
    let totalAskVolume = 0;
    let totalBidVolume = 0;
    let maxVolume = 0;
    let povPrice: number | null = null;

    for (const level of levels) {
      totalDelta += level.delta;
      totalAskVolume += level.askVolume;
      totalBidVolume += level.bidVolume;

      const levelVolume = level.askVolume + level.bidVolume;
      if (levelVolume > maxVolume) {
        maxVolume = levelVolume;
        povPrice = level.price;
      }
    }

    // Determine dominant side
    let dominantSide: 'BID' | 'ASK' | 'NEUTRAL' = 'NEUTRAL';
    if (totalAskVolume > totalBidVolume * MULTIPLIER_VALUES.ONE_POINT_ONE) {
      // 10% threshold for NEUTRAL
      dominantSide = 'ASK';
    } else if (totalBidVolume > totalAskVolume * MULTIPLIER_VALUES.ONE_POINT_ONE) {
      dominantSide = 'BID';
    }

    // Calculate imbalance ratio (largest imbalance at any level)
    let maxImbalanceRatio = RATIO_MULTIPLIERS.FULL as number;
    for (const level of levels) {
      if (level.bidVolume > 0 && level.askVolume > 0) {
        const ratio = Math.max(level.askVolume / level.bidVolume, level.bidVolume / level.askVolume);
        maxImbalanceRatio = Math.max(maxImbalanceRatio, ratio);
      }
    }

    return {
      candle,
      levels,
      totalDelta,
      dominantSide,
      imbalanceRatio: maxImbalanceRatio,
      povPoint: povPrice,
    };
  }

  /**
   * Analyze footprint for signal confirmation
   *
   * Algorithm:
   * 1. Determine current market aggression (BUY/SELL/NEUTRAL)
   * 2. Detect large imbalances at key levels
   * 3. Calculate aggression strength
   *
   * @param footprintCandles - Array of footprint candles
   * @returns Footprint analysis with aggression metrics
   */
  analyze(footprintCandles: FootprintCandle[]): FootprintAnalysis {
    if (!this.config.enabled) {
      return this.createEmptyAnalysis();
    }

    if (footprintCandles.length === 0) {
      return this.createEmptyAnalysis();
    }

    const latestCandle = footprintCandles[footprintCandles.length - 1];

    // Determine current aggression from dominant side
    let currentAggression: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    let aggressionStrength = 0;

    if (latestCandle.dominantSide === 'ASK') {
      currentAggression = 'BUY';
      // Strength increases with larger ask volume proportion
      aggressionStrength = Math.min(
        latestCandle.levels.reduce((sum, l) => sum + l.askVolume, 0) /
          (latestCandle.levels.reduce((sum, l) => sum + l.askVolume + l.bidVolume, 0) || 1),
        1.0,
      );
    } else if (latestCandle.dominantSide === 'BID') {
      currentAggression = 'SELL';
      // Strength increases with larger bid volume proportion
      aggressionStrength = Math.min(
        latestCandle.levels.reduce((sum, l) => sum + l.bidVolume, 0) /
          (latestCandle.levels.reduce((sum, l) => sum + l.askVolume + l.bidVolume, 0) || 1),
        1.0,
      );
    } else {
      aggressionStrength = RATIO_MULTIPLIERS.HALF; // Neutral
    }

    // Detect large imbalances
    let imbalanceDetected = false;
    let imbalanceLevel: FootprintLevel | null = null;

    for (const level of latestCandle.levels) {
      if (level.bidVolume > 0 && level.askVolume > 0) {
        const ratio = Math.max(level.askVolume / level.bidVolume, level.bidVolume / level.askVolume);
        const totalVolume = level.bidVolume + level.askVolume;

        if (ratio >= this.config.minImbalanceRatio && totalVolume >= this.config.minVolumeForImbalance) {
          imbalanceDetected = true;
          imbalanceLevel = level;
          break; // Use first (highest) imbalanced level
        }
      }
    }

    return {
      candles: footprintCandles,
      currentAggression,
      aggressionStrength,
      imbalanceDetected,
      imbalanceLevel,
    };
  }

  /**
   * Round price to configured tick level
   *
   * Example: price=101.234, tickLevels=0.01 → 101.23
   *
   * @private
   */
  private roundToPriceLevel(price: number): number {
    if (this.config.tickLevels <= 0) {
      return price; // No rounding if invalid
    }
    return Math.round(price / this.config.tickLevels) * this.config.tickLevels;
  }

  /**
   * Create empty footprint candle
   *
   * @private
   */
  private createEmptyFootprintCandle(candle: Candle): FootprintCandle {
    return {
      candle,
      levels: [],
      totalDelta: 0,
      dominantSide: 'NEUTRAL',
      imbalanceRatio: 1.0,
      povPoint: null,
    };
  }

  /**
   * Create empty analysis
   *
   * @private
   */
  private createEmptyAnalysis(): FootprintAnalysis {
    return {
      candles: [],
      currentAggression: 'NEUTRAL',
      aggressionStrength: 0,
      imbalanceDetected: false,
      imbalanceLevel: null,
    };
  }
}
