/**
 * Swing Point Detector Service
 *
 * Dedicated service for detecting swing points (local highs and lows) from candle data.
 * Separated from TrendAnalyzer for:
 * - Single Responsibility: Only detects swing points
 * - Testability: Can test detection logic independently
 * - Reusability: Used by TrendAnalyzer, EntryScanner, and other components
 * - Debugging: Easier to analyze why swing points are detected/missed
 *
 * Algorithm:
 * - Scans through candles looking for local highs and lows
 * - Uses configurable lookback period (default: 2 candles before/after)
 * - A candle is a swing high if its high is greater than lookback*2 neighbors
 * - A candle is a swing low if its low is less than lookback*2 neighbors
 */

import { Candle, SwingPoint, SwingPointType, LoggerService } from '../types';
import { DECIMAL_PLACES } from '../constants';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_LOOKBACK_PERIOD = 2; // Look 2 candles back and forward
const MIN_CANDLES_REQUIRED = 5; // Need at least 5 candles (2 + 1 + 2)

// ============================================================================
// SERVICE
// ============================================================================

export class SwingPointDetectorService {
  private readonly lookbackPeriod: number;

  constructor(
    private readonly logger: LoggerService,
    lookbackPeriod: number = DEFAULT_LOOKBACK_PERIOD,
  ) {
    this.lookbackPeriod = lookbackPeriod;

    if (lookbackPeriod < 1) {
      throw new Error(`[SwingPointDetectorService] Lookback period must be >= 1, got: ${lookbackPeriod}`);
    }

    this.logger.info('✅ SwingPointDetectorService initialized', {
      lookbackPeriod: this.lookbackPeriod,
    });
  }

  /**
   * Detect swing points from candle data
   *
   * @param candles - Array of candles to analyze
   * @returns Object with detected highs and lows arrays
   */
  detectSwingPoints(candles: Candle[]): { highs: SwingPoint[]; lows: SwingPoint[] } {
    const highs: SwingPoint[] = [];
    const lows: SwingPoint[] = [];

    // ========================================================================
    // VALIDATION
    // ========================================================================

    if (!candles || !Array.isArray(candles)) {
      this.logger.warn('Invalid candles input', { got: typeof candles });
      return { highs, lows };
    }

    if (candles.length < MIN_CANDLES_REQUIRED) {
      this.logger.debug('Not enough candles to detect swing points', {
        required: MIN_CANDLES_REQUIRED,
        got: candles.length,
      });
      return { highs, lows };
    }

    // ========================================================================
    // DETECTION ALGORITHM
    // ========================================================================

    for (let i = this.lookbackPeriod; i < candles.length - this.lookbackPeriod; i++) {
      const current = candles[i];

      // Check if this is a local high or low
      let isSwingHigh = true;
      let isSwingLow = true;

      // Compare with all neighbors within lookback period
      for (let j = 1; j <= this.lookbackPeriod; j++) {
        const prevCandle = candles[i - j];
        const nextCandle = candles[i + j];

        // For swing high: current.high must be > all neighbors' highs
        if (prevCandle.high >= current.high || nextCandle.high >= current.high) {
          isSwingHigh = false;
        }

        // For swing low: current.low must be < all neighbors' lows
        if (prevCandle.low <= current.low || nextCandle.low <= current.low) {
          isSwingLow = false;
        }
      }

      // ====================================================================
      // RECORD DETECTIONS
      // ====================================================================

      if (isSwingHigh) {
        const swingHigh: SwingPoint = {
          price: current.high,
          timestamp: current.timestamp,
          type: SwingPointType.HIGH,
        };

        highs.push(swingHigh);

        this.logger.debug('📈 Swing high detected', {
          candleIndex: i,
          price: current.high.toFixed(DECIMAL_PLACES.PRICE),
          timestamp: new Date(current.timestamp).toISOString(),
        });
      }

      if (isSwingLow) {
        const swingLow: SwingPoint = {
          price: current.low,
          timestamp: current.timestamp,
          type: SwingPointType.LOW,
        };

        lows.push(swingLow);

        this.logger.debug('📉 Swing low detected', {
          candleIndex: i,
          price: current.low.toFixed(DECIMAL_PLACES.PRICE),
          timestamp: new Date(current.timestamp).toISOString(),
        });
      }
    }

    // ========================================================================
    // SUMMARY LOG
    // ========================================================================

    this.logger.debug('🔍 Swing point detection complete', {
      totalCandles: candles.length,
      swingHighsDetected: highs.length,
      swingLowsDetected: lows.length,
      lookbackPeriod: this.lookbackPeriod,
    });

    return { highs, lows };
  }

  /**
   * Get the latest swing high (most recent)
   *
   * @param highs - Array of swing highs
   * @returns Latest swing high or null
   */
  getLatestHigh(highs: SwingPoint[]): SwingPoint | null {
    if (!highs || highs.length === 0) return null;
    return highs[highs.length - 1];
  }

  /**
   * Get the latest swing low (most recent)
   *
   * @param lows - Array of swing lows
   * @returns Latest swing low or null
   */
  getLatestLow(lows: SwingPoint[]): SwingPoint | null {
    if (!lows || lows.length === 0) return null;
    return lows[lows.length - 1];
  }

  /**
   * Check pattern: Higher Highs + Higher Lows (BULLISH)
   */
  isHigherHigherLow(highs: SwingPoint[], lows: SwingPoint[]): boolean {
    if (highs.length < 2 || lows.length < 2) return false;

    const lastHigh = highs[highs.length - 1].price;
    const prevHigh = highs[highs.length - 2].price;
    const lastLow = lows[lows.length - 1].price;
    const prevLow = lows[lows.length - 2].price;

    return lastHigh > prevHigh && lastLow > prevLow;
  }

  /**
   * Check pattern: Lower Highs + Lower Lows (BEARISH)
   */
  isLowerHigherLow(highs: SwingPoint[], lows: SwingPoint[]): boolean {
    if (highs.length < 2 || lows.length < 2) return false;

    const lastHigh = highs[highs.length - 1].price;
    const prevHigh = highs[highs.length - 2].price;
    const lastLow = lows[lows.length - 1].price;
    const prevLow = lows[lows.length - 2].price;

    return lastHigh < prevHigh && lastLow < prevLow;
  }

  /**
   * Calculate trend strength based on swing point consistency
   * More swing points + consistent pattern = higher strength
   *
   * @param bias - BULLISH, BEARISH, or NEUTRAL
   * @param highs - Array of swing highs
   * @param lows - Array of swing lows
   * @returns Strength value between 0.0 and 1.0
   */
  calculateStrengthFromSwingPoints(
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    highs: SwingPoint[],
    lows: SwingPoint[],
  ): number {
    // NEUTRAL = 30%
    if (bias === 'NEUTRAL') {
      return 0.3;
    }

    // For BULLISH/BEARISH, strength depends on swing point count
    const swingPointCount = highs.length + lows.length;

    // 0-2 swing points = weak signal (50%)
    if (swingPointCount <= 2) {
      return 0.5;
    }

    // 3-5 swing points = medium signal (70%)
    if (swingPointCount <= 5) {
      return 0.7;
    }

    // 6+ swing points = strong signal (90%)
    return 0.9;
  }
}
