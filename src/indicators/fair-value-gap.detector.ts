/**
 * Fair Value Gap (FVG) Detector
 *
 * Detects price gaps between consecutive candles that indicate unfilled orders.
 * FVGs are areas where price moved too quickly (gapping), creating imbalance
 * that price tends to return and "fill" later.
 *
 * Smart Money Concepts (SMC) component for institutional-level analysis.
 */

import { Candle, FairValueGap, FVGAnalysis, FVGConfig, FVGStatus, FVGType, LoggerService, SignalDirection } from '../types';
import { INTEGER_MULTIPLIERS, PERCENT_MULTIPLIER } from '../constants';

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_CANDLES_REQUIRED = INTEGER_MULTIPLIERS.THREE;

// ============================================================================
// FAIR VALUE GAP DETECTOR
// ============================================================================

export class FairValueGapDetector {
  private detectedGaps: FairValueGap[] = [];

  constructor(
    private config: FVGConfig,
    private logger: LoggerService,
  ) {
    if (!config.enabled) {
      this.logger.info('FVG Detector: Disabled in config');
    }
  }

  /**
   * Detect Fair Value Gaps from candle array
   *
   * Algorithm:
   * 1. Scan for 3-candle patterns (i, i+1, i+2)
   * 2. Bullish FVG: if candle[i+2].low > candle[i].high → gap exists
   * 3. Bearish FVG: if candle[i+2].high < candle[i].low → gap exists
   * 4. Track fill status as price moves
   * 5. Clean up old/filled gaps
   *
   * @param candles - Candle array (OHLCV)
   * @returns Array of detected FVGs
   */
  detectGaps(candles: Candle[]): FairValueGap[] {
    if (!this.config.enabled) {
      return [];
    }

    if (candles.length < MIN_CANDLES_REQUIRED) {
      return [];
    }

    // Reset gaps for fresh detection
    // This prevents accumulation of duplicate gaps when detectGaps is called multiple times
    this.detectedGaps = [];

    const newGaps: FairValueGap[] = [];

    // Scan for 3-candle FVG patterns
    for (let i = 0; i < candles.length - INTEGER_MULTIPLIERS.TWO; i++) {
      const candle1 = candles[i];
      const candle2 = candles[i + INTEGER_MULTIPLIERS.ONE];
      const candle3 = candles[i + INTEGER_MULTIPLIERS.TWO];

      // Check for bullish FVG
      const bullishGap = this.detectBullishFVG(candle1, candle2, candle3);
      if (bullishGap) {
        newGaps.push(bullishGap);
      }

      // Check for bearish FVG
      const bearishGap = this.detectBearishFVG(candle1, candle2, candle3);
      if (bearishGap) {
        newGaps.push(bearishGap);
      }
    }

    // Store detected gaps
    this.detectedGaps = newGaps;

    // Update gap fill status with all candles after gap creation
    for (let i = 0; i < candles.length; i++) {
      this.updateGaps(candles[i]);
    }

    // Clean up old/filled gaps
    this.cleanupGaps();

    return this.detectedGaps;
  }

  /**
   * Detect bullish FVG (gap up)
   *
   * Pattern:
   * - Candle 1: Down candle
   * - Candle 2: Strong up (gap creator)
   * - Candle 3: Continuation
   * - Gap: space between C1.high and C3.low
   *
   * @private
   */
  private detectBullishFVG(candle1: Candle, candle2: Candle, candle3: Candle): FairValueGap | null {
    // Check if there's a gap: C3.low > C1.high
    if (candle3.low <= candle1.high) {
      return null;
    }

    const gapSize = candle3.low - candle1.high;
    const gapPercent = (gapSize / candle1.high) * PERCENT_MULTIPLIER;

    // Filter small gaps
    if (gapPercent < this.config.minGapPercent) {
      return null;
    }

    return {
      type: FVGType.BULLISH,
      status: FVGStatus.UNFILLED,
      gapHigh: candle3.low,
      gapLow: candle1.high,
      gapSize,
      gapPercent,
      timestamp: candle3.timestamp,
      candles: [candle1, candle2, candle3],
      filledPercent: 0,
      filledAt: null,
    };
  }

  /**
   * Detect bearish FVG (gap down)
   *
   * Pattern:
   * - Candle 1: Up candle
   * - Candle 2: Strong down (gap creator)
   * - Candle 3: Continuation
   * - Gap: space between C3.high and C1.low
   *
   * @private
   */
  private detectBearishFVG(candle1: Candle, candle2: Candle, candle3: Candle): FairValueGap | null {
    // Check if there's a gap: C3.high < C1.low
    if (candle3.high >= candle1.low) {
      return null;
    }

    const gapSize = candle1.low - candle3.high;
    const gapPercent = (gapSize / candle1.low) * PERCENT_MULTIPLIER;

    // Filter small gaps
    if (gapPercent < this.config.minGapPercent) {
      return null;
    }

    return {
      type: FVGType.BEARISH,
      status: FVGStatus.UNFILLED,
      gapHigh: candle1.low,
      gapLow: candle3.high,
      gapSize,
      gapPercent,
      timestamp: candle3.timestamp,
      candles: [candle1, candle2, candle3],
      filledPercent: 0,
      filledAt: null,
    };
  }

  /**
   * Update gap fill status with current candle
   *
   * Algorithm:
   * 1. For each unfilled gap:
   *    - Calculate how much of gap was filled by latest candle
   *    - Update filledPercent
   *    - Change status if threshold reached (75%)
   *
   * @private
   */
  private updateGaps(latestCandle: Candle): void {
    for (const gap of this.detectedGaps) {
      if (gap.status === FVGStatus.FILLED) {
        continue; // Skip already filled gaps
      }

      // Skip if this candle is before or at the gap creation time
      if (latestCandle.timestamp <= gap.timestamp) {
        continue;
      }

      // Calculate how much of the gap was filled by this candle
      let filledAmount = 0;

      if (gap.type === FVGType.BULLISH) {
        // Bullish gap fills when price drops back into gap range
        // Gap range: [gapLow, gapHigh]
        if (latestCandle.low <= gap.gapHigh && latestCandle.low >= gap.gapLow) {
          // Price partially entered gap from top
          filledAmount = gap.gapHigh - latestCandle.low;
        } else if (latestCandle.low < gap.gapLow) {
          // Price fully filled gap (went below bottom)
          filledAmount = gap.gapSize;
        }
      } else {
        // Bearish gap fills when price rises back into gap range
        // Gap range: [gapLow, gapHigh]
        if (latestCandle.high >= gap.gapLow && latestCandle.high <= gap.gapHigh) {
          // Price partially entered gap from bottom
          filledAmount = latestCandle.high - gap.gapLow;
        } else if (latestCandle.high > gap.gapHigh) {
          // Price fully filled gap (went above top)
          filledAmount = gap.gapSize;
        }
      }

      // Update filledPercent (use max to prevent it from decreasing)
      const newFilledPercent = (filledAmount / gap.gapSize) * PERCENT_MULTIPLIER;
      if (newFilledPercent > gap.filledPercent) {
        gap.filledPercent = newFilledPercent;
      }

      // Update status based on fill percentage
      if (gap.filledPercent >= this.config.fillThreshold * PERCENT_MULTIPLIER) {
        gap.status = FVGStatus.FILLED;
        gap.filledAt = latestCandle.timestamp;
      } else if (gap.filledPercent > 0) {
        gap.status = FVGStatus.PARTIALLY_FILLED;
      }
    }
  }

  /**
   * Clean up old gaps
   *
   * Rules:
   * 1. Remove gaps older than maxGapAge
   * 2. Keep filled gaps for reference (they might be useful for analysis)
   *
   * @private
   */
  private cleanupGaps(): void {
    const currentTime = Date.now();
    const maxAge = this.config.maxGapAge;

    this.detectedGaps = this.detectedGaps.filter((gap) => {
      // Keep if gap is recent
      const age = currentTime - gap.timestamp;
      return age <= maxAge;
    });
  }

  /**
   * Analyze FVGs for signal confirmation
   *
   * Returns analysis with:
   * - All detected gaps
   * - Unfilled gaps only
   * - Nearest bullish/bearish gaps
   * - Distance to nearest gap
   * - Whether price is expecting to fill a gap
   *
   * @param currentPrice - Current market price
   * @param direction - Signal direction (LONG/SHORT)
   * @returns FVG analysis
   */
  analyze(currentPrice: number, direction: SignalDirection): FVGAnalysis {
    const unfilledGaps = this.detectedGaps.filter((g) => g.status === FVGStatus.UNFILLED);

    // Find gaps in relevant direction
    const bullishGaps = unfilledGaps.filter((g) => g.type === FVGType.BULLISH && g.gapHigh < currentPrice);
    const bearishGaps = unfilledGaps.filter((g) => g.type === FVGType.BEARISH && g.gapLow > currentPrice);

    // Sort to find nearest
    const nearestBullishGap = bullishGaps.sort((a, b) => b.gapHigh - a.gapHigh)[0] || null;
    const nearestBearishGap = bearishGaps.sort((a, b) => a.gapLow - b.gapLow)[0] || null;

    let distanceToNearestGap = Infinity;
    let expectingFill = false;

    if (direction === SignalDirection.LONG && nearestBullishGap) {
      // For LONG: check distance to nearest bullish gap (below current price)
      distanceToNearestGap = ((currentPrice - nearestBullishGap.gapHigh) / currentPrice) * PERCENT_MULTIPLIER;
      expectingFill = distanceToNearestGap <= this.config.maxDistancePercent;
    } else if (direction === SignalDirection.SHORT && nearestBearishGap) {
      // For SHORT: check distance to nearest bearish gap (above current price)
      distanceToNearestGap = ((nearestBearishGap.gapLow - currentPrice) / currentPrice) * PERCENT_MULTIPLIER;
      expectingFill = distanceToNearestGap <= this.config.maxDistancePercent;
    }

    return {
      gaps: this.detectedGaps,
      unfilledGaps,
      nearestBullishGap,
      nearestBearishGap,
      distanceToNearestGap,
      expectingFill,
    };
  }

  /**
   * Get all detected gaps (for testing/debugging)
   */
  getAllGaps(): FairValueGap[] {
    return [...this.detectedGaps];
  }

  /**
   * Reset detector state (for testing)
   */
  reset(): void {
    this.detectedGaps = [];
  }
}
