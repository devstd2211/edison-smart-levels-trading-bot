/**
 * Phase 4: Strategy & Service Constants
 *
 * Multipliers, percentages, and confidence thresholds used in:
 * - Strategy files (level-based, trend-following, counter-trend)
 * - Service files (trading-orchestrator, bot)
 * - Decision logic and filtering
 */

// ============================================================================
// MULTIPLIERS (used for scaling and ratios)
// ============================================================================

export const MULTIPLIERS = {
  /** Neutral - no scaling */
  NEUTRAL: 1.0,

  /** Half - 50% */
  HALF: 0.5,

  /** One-fifth - 20% */
  FIFTH: 0.2,

  /** One-tenth - 10% */
  TENTH: 0.1,

  /** One-quarter - 25% */
  QUARTER: 0.25,

  /** Three-quarters - 75% */
  THREE_QUARTER: 0.75,

  /** One and a half - 150% */
  ONE_AND_HALF: 1.5,

  /** Double - 200% */
  DOUBLE: 2.0,

  /** 1.2x scaling */
  ONE_TWO: 1.2,

  /** 0.8x scaling */
  ZERO_EIGHT: 0.8,

  /** 1.1x scaling */
  ONE_ONE: 1.1,

  /** 0.9x scaling */
  ZERO_NINE: 0.9,

  /** 1.05x scaling */
  ONE_ZERO_FIVE: 1.05,

  /** 1.15x scaling */
  ONE_ONE_FIVE: 1.15,
} as const;

// ============================================================================
// PERCENTAGE THRESHOLDS (5-90%)
// ============================================================================

export const PERCENTAGE_THRESHOLDS = {
  /** Minimum threshold: 5% */
  MINIMUM: 5,

  /** Very low threshold: 10% */
  VERY_LOW: 10,

  /** Low threshold: 15% */
  LOW: 15,

  /** Low-moderate threshold: 20% */
  LOW_MODERATE: 20,

  /** Moderate threshold: 30% */
  MODERATE: 30,

  /** Moderate-high threshold: 40% */
  MODERATE_HIGH: 40,

  /** High threshold: 50% */
  HIGH: 50,

  /** Very high threshold: 60% */
  VERY_HIGH: 60,

  /** Ultra high threshold: 70% */
  ULTRA_HIGH: 70,

  /** Extreme threshold: 80% */
  EXTREME: 80,

  /** Maximum threshold: 90% */
  MAXIMUM: 90,
} as const;

// ============================================================================
// CONFIDENCE THRESHOLDS (for trading decisions)
// ============================================================================

export const CONFIDENCE_THRESHOLDS = {
  /** Minimum confidence: 50% */
  MINIMUM: 50,

  /** Low confidence: 60% */
  LOW: 60,

  /** Moderate confidence: 70% */
  MODERATE: 70,

  /** High confidence: 80% */
  HIGH: 80,

  /** Very high confidence: 85% */
  VERY_HIGH: 85,

  /** Maximum confidence: 90% */
  MAXIMUM: 90,

  /** Extreme confidence: 95% */
  EXTREME: 95,
} as const;

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
  MULTIPLIERS,
  PERCENTAGE_THRESHOLDS,
  CONFIDENCE_THRESHOLDS,
};
