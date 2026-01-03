import { CONFIDENCE_BOUNDS, CONFIDENCE_THRESHOLDS, DECIMAL_PLACES, INTEGER_MULTIPLIERS, MULTIPLIERS, PERCENT_MULTIPLIER, PERCENTAGE_THRESHOLDS, RATIO_MULTIPLIERS, TIME_UNITS } from '../constants';
import { SwingPoint, SwingPointType, LoggerService } from '../types';

/**
 * Chart Patterns Detector
 *
 * Detects classic chart patterns for improved reversal trading:
 * - Head & Shoulders (bearish reversal)
 * - Inverse Head & Shoulders (bullish reversal)
 * - Double Top/Bottom (reversal patterns)
 *
 * Uses ZigZag swing points to identify pattern structure.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const PATTERN_THRESHOLDS = {
  RECENT_LOOKBACK: INTEGER_MULTIPLIERS.TEN,           // Look at last 10 swing points for patterns
  MIN_POINTS_HS: INTEGER_MULTIPLIERS.FIVE,            // Minimum points for H&S pattern
  MIN_POINTS_DOUBLE: INTEGER_MULTIPLIERS.THREE,       // Minimum points for double top/bottom
  RECENT_LOOKBACK_DOUBLE: INTEGER_MULTIPLIERS.SIX,    // Look at last 6 swing points for double patterns
} as const;

const PATTERN_CONFIDENCE = {
  SYMMETRY_THRESHOLD: RATIO_MULTIPLIERS.FULL,         // Symmetry bonus threshold for shoulders
  CONFIDENCE_ADJUSTMENT: INTEGER_MULTIPLIERS.TEN,     // Standard confidence adjustment amount
  STOP_LOSS_MULTIPLIER: RATIO_MULTIPLIERS.QUARTER,    // Stop loss as percentage of pattern height (0.1 = 10%)
  MIN_CONFIDENCE_DOUBLE: INTEGER_MULTIPLIERS.FIFTY,   // Minimum confidence for double patterns
  MAX_CONFIDENCE: INTEGER_MULTIPLIERS.ONE_HUNDRED,    // Maximum confidence value
} as const;

// ============================================================================
// TYPES
// ============================================================================

export enum ChartPatternType {
  HEAD_AND_SHOULDERS = 'HEAD_AND_SHOULDERS',           // Bearish reversal
  INVERSE_HEAD_AND_SHOULDERS = 'INVERSE_HEAD_AND_SHOULDERS', // Bullish reversal
  DOUBLE_TOP = 'DOUBLE_TOP',                           // Bearish reversal
  DOUBLE_BOTTOM = 'DOUBLE_BOTTOM',                     // Bullish reversal
  NONE = 'NONE',
}

export interface ChartPattern {
  type: ChartPatternType;
  detected: boolean;
  confidence: number;        // 0-100%
  neckline: number;          // Entry level (breakout point)
  target: number;            // Take profit level
  stopLoss: number;          // Stop loss level
  direction: 'LONG' | 'SHORT';
  points: SwingPoint[];      // Pattern structure points
  explanation: string;
}

export interface ChartPatternConfig {
  headTolerancePercent: number;     // Head vs shoulders height tolerance (default: 2%)
  shoulderTolerancePercent: number; // Shoulders level tolerance (default: 3%)
  necklineTolerancePercent: number; // Neckline level tolerance (default: 2%)
  minPatternBars: number;            // Minimum bars for pattern (default: 20)
  maxPatternBars: number;            // Maximum bars for pattern (default: 100)
}

// ============================================================================
// CHART PATTERNS DETECTOR
// ============================================================================

export class ChartPatternsDetector {
  private config: ChartPatternConfig;

  constructor(
    private logger: LoggerService,
    config: ChartPatternConfig,
  ) {
    this.config = config;
  }

  /**
   * Detect all chart patterns from swing points
   * Returns the first detected pattern with highest confidence
   */
  detect(swingPoints: SwingPoint[]): ChartPattern {
    if (swingPoints.length < PATTERN_THRESHOLDS.MIN_POINTS_DOUBLE) {
      return this.noPattern('Not enough swing points (need 3+ for any pattern)');
    }

    // Try to detect patterns in order of reliability (complex patterns first)
    const headAndShoulders = this.detectHeadAndShoulders(swingPoints);
    if (headAndShoulders.detected) {
      return headAndShoulders;
    }

    const inverseHeadAndShoulders = this.detectInverseHeadAndShoulders(swingPoints);
    if (inverseHeadAndShoulders.detected) {
      return inverseHeadAndShoulders;
    }

    const doubleTop = this.detectDoubleTop(swingPoints);
    if (doubleTop.detected) {
      return doubleTop;
    }

    const doubleBottom = this.detectDoubleBottom(swingPoints);
    if (doubleBottom.detected) {
      return doubleBottom;
    }

    return this.noPattern('No pattern detected');
  }

  // ==========================================================================
  // HEAD & SHOULDERS (Bearish Reversal)
  // ==========================================================================

  /**
   * Detect Head & Shoulders pattern
   *
   * Structure (5 points):
   *      Head (HIGH)
   *     /      \
   *  LS (HIGH)  RS (HIGH)
   *   \          /
   *    LV (LOW)  RV (LOW)  <- Neckline
   *
   * LS = Left Shoulder, LV = Left Valley
   * RS = Right Shoulder, RV = Right Valley
   */
  detectHeadAndShoulders(swingPoints: SwingPoint[]): ChartPattern {
    const recent = swingPoints.slice(-PATTERN_THRESHOLDS.RECENT_LOOKBACK); // Look at last 10 swing points

    // Need at least 5 points: LS, LV, Head, RV, RS
    if (recent.length < PATTERN_THRESHOLDS.MIN_POINTS_HS) {
      return this.noPattern('Not enough points for H&S');
    }

    // Search for pattern: HIGH, LOW, HIGH (head), LOW, HIGH
    // Pattern has 5 points: LS, LV, Head, RV, RS
    const HS_PATTERN_SIZE = PATTERN_THRESHOLDS.MIN_POINTS_HS; // 5 points
    const HS_IDX_LEFT_SHOULDER = INTEGER_MULTIPLIERS.ZERO;
    const HS_IDX_LEFT_VALLEY = INTEGER_MULTIPLIERS.ONE;
    const HS_IDX_HEAD = INTEGER_MULTIPLIERS.TWO;
    const HS_IDX_RIGHT_VALLEY = INTEGER_MULTIPLIERS.THREE;
    const HS_IDX_RIGHT_SHOULDER = INTEGER_MULTIPLIERS.FOUR;

    for (let i = 0; i <= recent.length - HS_PATTERN_SIZE; i++) {
      const leftShoulder = recent[i + HS_IDX_LEFT_SHOULDER];
      const leftValley = recent[i + HS_IDX_LEFT_VALLEY];
      const head = recent[i + HS_IDX_HEAD];
      const rightValley = recent[i + HS_IDX_RIGHT_VALLEY];
      const rightShoulder = recent[i + HS_IDX_RIGHT_SHOULDER];

      // Validate structure: HIGH -> LOW -> HIGH -> LOW -> HIGH
      if (
        leftShoulder.type !== SwingPointType.HIGH ||
        leftValley.type !== SwingPointType.LOW ||
        head.type !== SwingPointType.HIGH ||
        rightValley.type !== SwingPointType.LOW ||
        rightShoulder.type !== SwingPointType.HIGH
      ) {
        continue;
      }

      // Validate pattern geometry
      const validation = this.validateHeadAndShoulders(
        leftShoulder,
        leftValley,
        head,
        rightValley,
        rightShoulder,
      );

      if (validation.valid) {
        const neckline = (leftValley.price + rightValley.price) / INTEGER_MULTIPLIERS.TWO;
        const patternHeight = head.price - neckline;
        const target = neckline - patternHeight; // Project downward
        const stopLoss = rightShoulder.price + (patternHeight * PATTERN_CONFIDENCE.STOP_LOSS_MULTIPLIER); // 10% above RS

        return {
          type: ChartPatternType.HEAD_AND_SHOULDERS,
          detected: true,
          confidence: validation.confidence,
          neckline,
          target,
          stopLoss,
          direction: 'SHORT',
          points: [leftShoulder, leftValley, head, rightValley, rightShoulder],
          explanation: `H&S: Head ${head.price.toFixed(DECIMAL_PLACES.PRICE)}, Shoulders ${leftShoulder.price.toFixed(DECIMAL_PLACES.PRICE)}/${rightShoulder.price.toFixed(DECIMAL_PLACES.PRICE)}, Neckline ${neckline.toFixed(DECIMAL_PLACES.PRICE)}`,
        };
      }
    }

    return this.noPattern('No valid H&S pattern');
  }

  /**
   * Validate Head & Shoulders geometry
   */
  private validateHeadAndShoulders(
    ls: SwingPoint,
    lv: SwingPoint,
    head: SwingPoint,
    rv: SwingPoint,
    rs: SwingPoint,
  ): { valid: boolean; confidence: number } {
    let confidence = INTEGER_MULTIPLIERS.ONE_HUNDRED;

    // 1. Head must be higher than both shoulders
    if (head.price <= ls.price || head.price <= rs.price) {
      return { valid: false, confidence: 0 };
    }

    const headVsLeftShoulder = ((head.price - ls.price) / ls.price) * PERCENT_MULTIPLIER;
    const headVsRightShoulder = ((head.price - rs.price) / rs.price) * PERCENT_MULTIPLIER;

    if (
      headVsLeftShoulder < this.config.headTolerancePercent ||
      headVsRightShoulder < this.config.headTolerancePercent
    ) {
      return { valid: false, confidence: 0 };
    }

    // 2. Shoulders should be approximately at same level (±3%)
    const shoulderDiff = Math.abs((ls.price - rs.price) / ls.price) * PERCENT_MULTIPLIER;
    if (shoulderDiff > this.config.shoulderTolerancePercent) {
      confidence -= PERCENTAGE_THRESHOLDS.LOW_MODERATE;
    }

    // 3. Valleys (neckline) should be approximately at same level (±2%)
    const necklineDiff = Math.abs((lv.price - rv.price) / lv.price) * PERCENT_MULTIPLIER;
    if (necklineDiff > this.config.necklineTolerancePercent) {
      confidence -= PERCENTAGE_THRESHOLDS.LOW_MODERATE;
    }

    // 4. Check pattern timespan (assuming 1m candles)
    const patternMinutes = (rs.timestamp - ls.timestamp) / TIME_UNITS.MINUTE;
    if (patternMinutes < this.config.minPatternBars || patternMinutes > this.config.maxPatternBars) {
      confidence -= PATTERN_CONFIDENCE.CONFIDENCE_ADJUSTMENT;
    }

    // 5. Symmetry bonus: if shoulders are very close in price
    if (shoulderDiff < PATTERN_CONFIDENCE.SYMMETRY_THRESHOLD) {
      confidence += PATTERN_CONFIDENCE.CONFIDENCE_ADJUSTMENT;
    }

    return { valid: confidence >= CONFIDENCE_THRESHOLDS.MODERATE, confidence: Math.max(CONFIDENCE_BOUNDS.MINIMUM, Math.min(CONFIDENCE_BOUNDS.MAXIMUM, confidence)) };
  }

  // ==========================================================================
  // INVERSE HEAD & SHOULDERS (Bullish Reversal)
  // ==========================================================================

  /**
   * Detect Inverse Head & Shoulders pattern
   *
   * Structure (5 points):
   *    LV (HIGH) RV (HIGH)  <- Neckline
   *   /          \
   *  LS (LOW)    RS (LOW)
   *     \      /
   *      Head (LOW)
   */
  detectInverseHeadAndShoulders(swingPoints: SwingPoint[]): ChartPattern {
    const recent = swingPoints.slice(-PATTERN_THRESHOLDS.RECENT_LOOKBACK);

    if (recent.length < PATTERN_THRESHOLDS.MIN_POINTS_HS) {
      return this.noPattern('Not enough points for Inverse H&S');
    }

    // Search for pattern: LOW, HIGH, LOW (head), HIGH, LOW
    // Pattern has 5 points: LS, LV, Head, RV, RS (inverted)
    const IHS_PATTERN_SIZE = PATTERN_THRESHOLDS.MIN_POINTS_HS; // 5 points
    const IHS_IDX_LEFT_SHOULDER = INTEGER_MULTIPLIERS.ZERO;
    const IHS_IDX_LEFT_VALLEY = INTEGER_MULTIPLIERS.ONE;
    const IHS_IDX_HEAD = INTEGER_MULTIPLIERS.TWO;
    const IHS_IDX_RIGHT_VALLEY = INTEGER_MULTIPLIERS.THREE;
    const IHS_IDX_RIGHT_SHOULDER = INTEGER_MULTIPLIERS.FOUR;

    for (let i = 0; i <= recent.length - IHS_PATTERN_SIZE; i++) {
      const leftShoulder = recent[i + IHS_IDX_LEFT_SHOULDER];
      const leftValley = recent[i + IHS_IDX_LEFT_VALLEY];
      const head = recent[i + IHS_IDX_HEAD];
      const rightValley = recent[i + IHS_IDX_RIGHT_VALLEY];
      const rightShoulder = recent[i + IHS_IDX_RIGHT_SHOULDER];

      // Validate structure: LOW -> HIGH -> LOW -> HIGH -> LOW
      if (
        leftShoulder.type !== SwingPointType.LOW ||
        leftValley.type !== SwingPointType.HIGH ||
        head.type !== SwingPointType.LOW ||
        rightValley.type !== SwingPointType.HIGH ||
        rightShoulder.type !== SwingPointType.LOW
      ) {
        continue;
      }

      // Validate pattern geometry
      const validation = this.validateInverseHeadAndShoulders(
        leftShoulder,
        leftValley,
        head,
        rightValley,
        rightShoulder,
      );

      if (validation.valid) {
        const neckline = (leftValley.price + rightValley.price) / INTEGER_MULTIPLIERS.TWO;
        const patternHeight = neckline - head.price;
        const target = neckline + patternHeight; // Project upward
        const stopLoss = rightShoulder.price - (patternHeight * PATTERN_CONFIDENCE.STOP_LOSS_MULTIPLIER); // 10% below RS

        return {
          type: ChartPatternType.INVERSE_HEAD_AND_SHOULDERS,
          detected: true,
          confidence: validation.confidence,
          neckline,
          target,
          stopLoss,
          direction: 'LONG',
          points: [leftShoulder, leftValley, head, rightValley, rightShoulder],
          explanation: `Inverse H&S: Head ${head.price.toFixed(DECIMAL_PLACES.PRICE)}, Shoulders ${leftShoulder.price.toFixed(DECIMAL_PLACES.PRICE)}/${rightShoulder.price.toFixed(DECIMAL_PLACES.PRICE)}, Neckline ${neckline.toFixed(DECIMAL_PLACES.PRICE)}`,
        };
      }
    }

    return this.noPattern('No valid Inverse H&S pattern');
  }

  /**
   * Validate Inverse Head & Shoulders geometry
   */
  private validateInverseHeadAndShoulders(
    ls: SwingPoint,
    lv: SwingPoint,
    head: SwingPoint,
    rv: SwingPoint,
    rs: SwingPoint,
  ): { valid: boolean; confidence: number } {
    let confidence = INTEGER_MULTIPLIERS.ONE_HUNDRED;

    // 1. Head must be lower than both shoulders
    if (head.price >= ls.price || head.price >= rs.price) {
      return { valid: false, confidence: 0 };
    }

    const headVsLeftShoulder = ((ls.price - head.price) / head.price) * PERCENT_MULTIPLIER;
    const headVsRightShoulder = ((rs.price - head.price) / head.price) * PERCENT_MULTIPLIER;

    if (
      headVsLeftShoulder < this.config.headTolerancePercent ||
      headVsRightShoulder < this.config.headTolerancePercent
    ) {
      return { valid: false, confidence: 0 };
    }

    // 2. Shoulders should be approximately at same level (±3%)
    const shoulderDiff = Math.abs((ls.price - rs.price) / ls.price) * PERCENT_MULTIPLIER;
    if (shoulderDiff > this.config.shoulderTolerancePercent) {
      confidence -= PERCENTAGE_THRESHOLDS.LOW_MODERATE;
    }

    // 3. Valleys (neckline) should be approximately at same level (±2%)
    const necklineDiff = Math.abs((lv.price - rv.price) / lv.price) * PERCENT_MULTIPLIER;
    if (necklineDiff > this.config.necklineTolerancePercent) {
      confidence -= PERCENTAGE_THRESHOLDS.LOW_MODERATE;
    }

    // 4. Check pattern timespan (assuming 1m candles)
    const patternMinutes = (rs.timestamp - ls.timestamp) / TIME_UNITS.MINUTE;
    if (patternMinutes < this.config.minPatternBars || patternMinutes > this.config.maxPatternBars) {
      confidence -= PATTERN_CONFIDENCE.CONFIDENCE_ADJUSTMENT;
    }

    // 5. Symmetry bonus
    if (shoulderDiff < PATTERN_CONFIDENCE.SYMMETRY_THRESHOLD) {
      confidence += PATTERN_CONFIDENCE.CONFIDENCE_ADJUSTMENT;
    }

    return { valid: confidence >= CONFIDENCE_THRESHOLDS.MODERATE, confidence: Math.max(CONFIDENCE_BOUNDS.MINIMUM, Math.min(CONFIDENCE_BOUNDS.MAXIMUM, confidence)) };
  }

  // ==========================================================================
  // DOUBLE TOP (Bearish Reversal)
  // ==========================================================================

  /**
   * Detect Double Top pattern
   *
   * Structure (3 points):
   *  Peak1  Peak2
   *    |      |
   *    |      |
   *     \    /
   *      Valley  <- Neckline
   */
  detectDoubleTop(swingPoints: SwingPoint[]): ChartPattern {
    const recent = swingPoints.slice(-PATTERN_THRESHOLDS.RECENT_LOOKBACK_DOUBLE);

    if (recent.length < PATTERN_THRESHOLDS.MIN_POINTS_DOUBLE) {
      return this.noPattern('Not enough points for Double Top');
    }

    // Search for pattern: HIGH, LOW, HIGH
    // Pattern has 3 points: Peak1, Valley, Peak2
    const DT_PATTERN_SIZE = PATTERN_THRESHOLDS.MIN_POINTS_DOUBLE; // 3 points
    const DT_IDX_PEAK1 = INTEGER_MULTIPLIERS.ZERO;
    const DT_IDX_VALLEY = INTEGER_MULTIPLIERS.ONE;
    const DT_IDX_PEAK2 = INTEGER_MULTIPLIERS.TWO;

    for (let i = 0; i <= recent.length - DT_PATTERN_SIZE; i++) {
      const peak1 = recent[i + DT_IDX_PEAK1];
      const valley = recent[i + DT_IDX_VALLEY];
      const peak2 = recent[i + DT_IDX_PEAK2];

      // Validate structure: HIGH -> LOW -> HIGH
      if (
        peak1.type !== SwingPointType.HIGH ||
        valley.type !== SwingPointType.LOW ||
        peak2.type !== SwingPointType.HIGH
      ) {
        continue;
      }

      // Validate: peaks at approximately same level (±2%)
      const peakDiff = Math.abs((peak1.price - peak2.price) / peak1.price) * PERCENT_MULTIPLIER;
      if (peakDiff > this.config.shoulderTolerancePercent) {
        continue;
      }

      const confidence = PATTERN_CONFIDENCE.MAX_CONFIDENCE - peakDiff * PATTERN_CONFIDENCE.CONFIDENCE_ADJUSTMENT; // Closer peaks = higher confidence
      const neckline = valley.price;
      const patternHeight = ((peak1.price + peak2.price) / INTEGER_MULTIPLIERS.TWO) - neckline;
      const target = neckline - patternHeight;
      const stopLoss = Math.max(peak1.price, peak2.price) + (patternHeight * PATTERN_CONFIDENCE.STOP_LOSS_MULTIPLIER);

      return {
        type: ChartPatternType.DOUBLE_TOP,
        detected: true,
        confidence: Math.max(PATTERN_CONFIDENCE.MIN_CONFIDENCE_DOUBLE, Math.min(PATTERN_CONFIDENCE.MAX_CONFIDENCE, confidence)),
        neckline,
        target,
        stopLoss,
        direction: 'SHORT',
        points: [peak1, valley, peak2],
        explanation: `Double Top: Peaks ${peak1.price.toFixed(DECIMAL_PLACES.PRICE)}/${peak2.price.toFixed(DECIMAL_PLACES.PRICE)}, Neckline ${neckline.toFixed(DECIMAL_PLACES.PRICE)}`,
      };
    }

    return this.noPattern('No valid Double Top pattern');
  }

  // ==========================================================================
  // DOUBLE BOTTOM (Bullish Reversal)
  // ==========================================================================

  /**
   * Detect Double Bottom pattern
   *
   * Structure (3 points):
   *      Peak  <- Neckline
   *     /    \
   *    |      |
   *    |      |
   * Bottom1 Bottom2
   */
  detectDoubleBottom(swingPoints: SwingPoint[]): ChartPattern {
    const recent = swingPoints.slice(-PATTERN_THRESHOLDS.RECENT_LOOKBACK_DOUBLE);

    if (recent.length < PATTERN_THRESHOLDS.MIN_POINTS_DOUBLE) {
      return this.noPattern('Not enough points for Double Bottom');
    }

    // Search for pattern: LOW, HIGH, LOW
    // Pattern has 3 points: Bottom1, Peak, Bottom2
    const DB_PATTERN_SIZE = PATTERN_THRESHOLDS.MIN_POINTS_DOUBLE; // 3 points
    const DB_IDX_BOTTOM1 = INTEGER_MULTIPLIERS.ZERO;
    const DB_IDX_PEAK = INTEGER_MULTIPLIERS.ONE;
    const DB_IDX_BOTTOM2 = INTEGER_MULTIPLIERS.TWO;

    for (let i = 0; i <= recent.length - DB_PATTERN_SIZE; i++) {
      const bottom1 = recent[i + DB_IDX_BOTTOM1];
      const peak = recent[i + DB_IDX_PEAK];
      const bottom2 = recent[i + DB_IDX_BOTTOM2];

      // Validate structure: LOW -> HIGH -> LOW
      if (
        bottom1.type !== SwingPointType.LOW ||
        peak.type !== SwingPointType.HIGH ||
        bottom2.type !== SwingPointType.LOW
      ) {
        continue;
      }

      // Validate: bottoms at approximately same level (±2%)
      const bottomDiff = Math.abs((bottom1.price - bottom2.price) / bottom1.price) * PERCENT_MULTIPLIER;
      if (bottomDiff > this.config.shoulderTolerancePercent) {
        continue;
      }

      const confidence = PATTERN_CONFIDENCE.MAX_CONFIDENCE - bottomDiff * PATTERN_CONFIDENCE.CONFIDENCE_ADJUSTMENT;
      const neckline = peak.price;
      const patternHeight = neckline - ((bottom1.price + bottom2.price) / INTEGER_MULTIPLIERS.TWO);
      const target = neckline + patternHeight;
      const stopLoss = Math.min(bottom1.price, bottom2.price) - (patternHeight * PATTERN_CONFIDENCE.STOP_LOSS_MULTIPLIER);

      return {
        type: ChartPatternType.DOUBLE_BOTTOM,
        detected: true,
        confidence: Math.max(PATTERN_CONFIDENCE.MIN_CONFIDENCE_DOUBLE, Math.min(PATTERN_CONFIDENCE.MAX_CONFIDENCE, confidence)),
        neckline,
        target,
        stopLoss,
        direction: 'LONG',
        points: [bottom1, peak, bottom2],
        explanation: `Double Bottom: Bottoms ${bottom1.price.toFixed(DECIMAL_PLACES.PRICE)}/${bottom2.price.toFixed(DECIMAL_PLACES.PRICE)}, Neckline ${neckline.toFixed(DECIMAL_PLACES.PRICE)}`,
      };
    }

    return this.noPattern('No valid Double Bottom pattern');
  }

  // ==========================================================================
  // UTILITY
  // ==========================================================================

  private noPattern(reason: string): ChartPattern {
    return {
      type: ChartPatternType.NONE,
      detected: false,
      confidence: 0,
      neckline: 0,
      target: 0,
      stopLoss: 0,
      direction: 'LONG',
      points: [],
      explanation: reason,
    };
  }
}
