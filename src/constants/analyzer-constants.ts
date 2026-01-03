/**
 * Analyzer-Specific Constants
 *
 * Technical thresholds, periods, and multipliers for each analyzer.
 * These are fixed values that define the behavior of analyzers.
 *
 * RULE: Don't add configurable parameters here!
 * Use config.json for business-level configuration:
 * - RSI periods, thresholds, confidence levels
 * - Strategy entry/exit parameters
 * - Risk management multipliers
 *
 * Only add here if it's a TECHNICAL constant that won't change:
 * - Default analysis periods
 * - Standard deviation multipliers
 * - Mathematical thresholds (like neutral zones)
 */

// ============================================================================
// BTC ANALYZER CONSTANTS
// ============================================================================

export const BTC_ANALYZER_CONSTANTS = {
  /** Neutral zone threshold (±0.1% price change) */
  NEUTRAL_THRESHOLD: 0.1,

  /** Momentum reduction factor for moderate correlation (70% of minimum) */
  MOMENTUM_REDUCTION_FACTOR: 0.7,

  /** Default correlation lookback period if not configured */
  DEFAULT_CORRELATION_PERIOD: 50,
} as const;

// ============================================================================
// CHART PATTERN CONSTANTS
// ============================================================================

export const CHART_PATTERN_CONSTANTS = {
  /** Minimum touches required to form a pattern */
  MIN_TOUCHES: 2,

  /** Minimum touches for strong/reliable patterns */
  MIN_TOUCHES_STRONG: 3,

  /** Maximum percentage variance in pattern (e.g., 0.5% tolerance) */
  MAX_VARIANCE_PERCENT: 0.5,

  /** Minimum pattern strength (0-1) */
  MIN_PATTERN_STRENGTH: 0.6,
} as const;

// ============================================================================
// BREAKOUT PREDICTOR CONSTANTS
// ============================================================================

export const BREAKOUT_CONSTANTS = {
  /** Scalp TP target: 0.3% */
  TP_SCALP: 0.3,

  /** Moderate TP target: 0.5% */
  TP_MODERATE: 0.5,

  /** Stop Loss multiplier for breakout */
  SL_MULTIPLIER: 1.5,

  /** Minimum volume ratio to confirm breakout */
  MIN_VOLUME_RATIO: 1.2,
} as const;

// ============================================================================
// CONTEXT ANALYZER CONSTANTS
// ============================================================================

export const CONTEXT_ANALYZER_CONSTANTS = {
  /** London session start (UTC hour) */
  LONDON_START: 13,

  /** New York session end (UTC hour) */
  NEWYORK_END: 21,

  /** Minimum context strength (0-1) */
  MIN_CONTEXT_STRENGTH: 0.5,
} as const;

// ============================================================================
// CORRELATION CONSTANTS
// ============================================================================

export const CORRELATION_CONSTANTS = {
  /** Weak correlation strength (0-0.5) */
  STRENGTH_WEAK: 0.3,

  /** Moderate correlation strength (0.5-0.7) */
  STRENGTH_MODERATE: 0.6,

  /** Strong correlation strength (0.7-1.0) */
  STRENGTH_STRONG: 0.8,

  /** Very strong correlation (0.9-1.0) */
  STRENGTH_VERY_STRONG: 0.9,
} as const;

// ============================================================================
// SUPPORT/RESISTANCE CONSTANTS
// ============================================================================

export const SUPPORT_RESISTANCE_CONSTANTS = {
  /** Minimum price distance for level validation (0.01%) */
  MIN_DISTANCE_PERCENT: 0.01,

  /** Strong level requires minimum touches */
  MIN_TOUCHES_STRONG: 3,

  /** Weak level minimum touches */
  MIN_TOUCHES_WEAK: 2,

  /** Level strength multiplier for each touch */
  STRENGTH_PER_TOUCH: 0.2,
} as const;

// ============================================================================
// VOLUME ANALYSIS CONSTANTS
// ============================================================================

export const VOLUME_ANALYSIS_CONSTANTS = {
  /** Low volume ratio (below average) */
  RATIO_LOW: 0.5,

  /** Normal volume ratio (around average) */
  RATIO_NORMAL: 1.0,

  /** High volume ratio (above average) */
  RATIO_HIGH: 1.5,

  /** Very high volume ratio (significantly above) */
  RATIO_VERY_HIGH: 2.0,
} as const;

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
  BTC_ANALYZER_CONSTANTS,
  CHART_PATTERN_CONSTANTS,
  BREAKOUT_CONSTANTS,
  CONTEXT_ANALYZER_CONSTANTS,
  CORRELATION_CONSTANTS,
  SUPPORT_RESISTANCE_CONSTANTS,
  VOLUME_ANALYSIS_CONSTANTS,
};
