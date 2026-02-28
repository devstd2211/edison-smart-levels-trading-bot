/**
 * Pattern Recognition Interface
 * Phase 10.2.2
 *
 * Provides candlestick pattern recognition, fibonacci levels calculation,
 * and supply/demand zone identification.
 */

import type { Candle } from '../core';

/**
 * Candlestick pattern types
 */
export type PatternType =
  | 'doji'
  | 'hammer'
  | 'shooting_star'
  | 'engulfing_bullish'
  | 'engulfing_bearish'
  | 'morning_star'
  | 'evening_star'
  | 'three_white_soldiers'
  | 'three_black_crows'
  | 'harami_bullish'
  | 'harami_bearish'
  | 'piercing'
  | 'dark_cloud'
  | 'tweezer_top'
  | 'tweezer_bottom'
  | 'unknown';

/**
 * Pattern direction
 */
export type PatternDirection = 'bullish' | 'bearish' | 'neutral';

/**
 * Swing point type
 */
export type SwingPointType = 'high' | 'low';

/**
 * Zone type
 */
export type ZoneType = 'supply' | 'demand' | 'neutral';

/**
 * Recognized candlestick pattern
 */
export interface Pattern {
  /** Pattern type */
  type: PatternType;

  /** Pattern direction */
  direction: PatternDirection;

  /** Pattern strength (0-100) */
  strength: number;

  /** Pattern reliability score (0-100) */
  reliability: number;

  /** Start candle index */
  startIndex: number;

  /** End candle index */
  endIndex: number;

  /** Price level where pattern formed */
  priceLevel: number;

  /** Timestamp of pattern formation */
  timestamp: number;

  /** Number of candles in pattern */
  candleCount: number;

  /** Pattern confidence (0-100) */
  confidence: number;
}

/**
 * Fibonacci retracement level
 */
export interface FibLevel {
  /** Level percentage (0, 23.6, 38.2, 50, 61.8, 100, etc.) */
  level: number;

  /** Price at this fibonacci level */
  price: number;

  /** Level strength (0-100) - how often price reacts here */
  strength: number;

  /** Whether this level is currently being tested */
  isBeingTested: boolean;

  /** Distance from current price (percentage) */
  distanceFromPrice: number;
}

/**
 * Swing point (high or low)
 */
export interface SwingPoint {
  /** Swing type */
  type: SwingPointType;

  /** Price at swing point */
  price: number;

  /** Timestamp of swing point */
  timestamp: number;

  /** Candle index */
  index: number;

  /** Strength of swing (0-100) - how significant the swing is */
  strength: number;
}

/**
 * Supply or demand zone
 */
export interface Zone {
  /** Zone type */
  type: ZoneType;

  /** Upper boundary price */
  upperBound: number;

  /** Lower boundary price */
  lowerBound: number;

  /** Zone strength (0-100) */
  strength: number;

  /** Number of times zone was tested */
  touchCount: number;

  /** Timestamp when zone was created */
  createdAt: number;

  /** Timestamp of last test */
  lastTestedAt: number;

  /** Whether zone is still valid (not broken) */
  isValid: boolean;

  /** Average volume in zone */
  averageVolume: number;
}

/**
 * Pattern recognition result
 */
export interface PatternRecognitionResult {
  /** Recognized patterns */
  patterns: Pattern[];

  /** Fibonacci levels */
  fibonacciLevels: FibLevel[];

  /** Supply/demand zones */
  zones: Zone[];

  /** Overall pattern strength (0-100) */
  overallStrength: number;

  /** Most significant pattern */
  primaryPattern: Pattern | null;

  /** Recommended direction based on patterns */
  recommendedDirection: PatternDirection;
}

/**
 * Configuration for PatternRecognitionService
 */
export interface PatternRecognitionConfig {
  /** Minimum candles required for pattern recognition (default: 10) */
  minCandlesRequired: number;

  /** Minimum pattern strength to consider valid (default: 40) */
  minPatternStrength: number;

  /** Minimum pattern reliability to consider valid (default: 50) */
  minPatternReliability: number;

  /** Doji body threshold (% of range, default: 0.1 = 10%) */
  dojiBodyThreshold: number;

  /** Hammer/shooting star body ratio threshold (default: 0.33) */
  hammerBodyRatio: number;

  /** Engulfing pattern body overlap threshold (default: 0.9 = 90%) */
  engulfingOverlapThreshold: number;

  /** Fibonacci extension levels (default: [0, 23.6, 38.2, 50, 61.8, 78.6, 100, 161.8, 261.8]) */
  fibLevels: number[];

  /** Swing point lookback period (default: 20) */
  swingLookback: number;

  /** Minimum swing strength to use for fibonacci (default: 60) */
  minSwingStrength: number;

  /** Zone width threshold (% of price, default: 0.5 = 0.5%) */
  zoneWidthThreshold: number;

  /** Minimum zone touches to consider valid (default: 2) */
  minZoneTouches: number;

  /** Zone validity period (ms, default: 7 days) */
  zoneValidityPeriod: number;

  /** Enable reversal patterns only (default: false) */
  reversalPatternsOnly: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_PATTERN_RECOGNITION_CONFIG: PatternRecognitionConfig = {
  minCandlesRequired: 10,
  minPatternStrength: 40,
  minPatternReliability: 50,
  dojiBodyThreshold: 0.1,
  hammerBodyRatio: 0.33,
  engulfingOverlapThreshold: 0.9,
  fibLevels: [0, 23.6, 38.2, 50, 61.8, 78.6, 100, 161.8, 261.8],
  swingLookback: 20,
  minSwingStrength: 60,
  zoneWidthThreshold: 0.005, // 0.5%
  minZoneTouches: 2,
  zoneValidityPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  reversalPatternsOnly: false,
};

/**
 * Pattern statistics
 */
export interface PatternStats {
  /** Pattern type */
  type: PatternType;

  /** Total patterns recognized */
  totalRecognized: number;

  /** Average strength */
  avgStrength: number;

  /** Average reliability */
  avgReliability: number;

  /** Success rate when pattern led to expected move */
  successRate: number;
}
