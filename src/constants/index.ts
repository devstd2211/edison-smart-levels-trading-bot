/**
 * Technical Constants
 *
 * IMPORTANT: This file contains ONLY technical/mathematical constants that NEVER change.
 * - Time units (milliseconds)
 * - Decimal precision
 * - Math operations
 * - Timezone offsets
 *
 * DO NOT add configurable parameters here! Use config.json instead.
 * Configurable: EMA periods, RSI thresholds, Confidence levels, TP/SL multipliers, etc.
 */

// ============================================================================
// BASIC MATH & PERCENT
// ============================================================================

// Note: PERCENT_MULTIPLIER and DECIMAL_PLACES are now defined in technical.constants.ts
// and exported below. Keeping these imports here for backward compatibility.

// Import technical constants for default export
import {
  PERCENT_MULTIPLIER as PM,
  PERCENT_DECIMAL_PLACES as PDP,
  DECIMAL_PLACES as DP,
  TIME_MULTIPLIERS as TM,
  RATIO_MULTIPLIERS as RM,
  ARRAY_SIZING as AS,
  MATH_BOUNDS as MB,
  INTEGER_MULTIPLIERS,
  THRESHOLD_VALUES,
  MULTIPLIER_VALUES,
} from './technical.constants';

// ============================================================================
// TIME UNITS (in milliseconds) - NEVER CHANGE
// ============================================================================

export const TIME_UNITS = {
  /** 1 millisecond */
  MILLISECOND: 1,
  /** 1 second = 1000 ms */
  SECOND: INTEGER_MULTIPLIERS.ONE_THOUSAND,
  /** 1 minute = 60000 ms */
  MINUTE: INTEGER_MULTIPLIERS.SIXTY * INTEGER_MULTIPLIERS.ONE_THOUSAND,
  /** 5 minutes = 300000 ms */
  FIVE_MINUTES: INTEGER_MULTIPLIERS.FIVE * INTEGER_MULTIPLIERS.SIXTY * INTEGER_MULTIPLIERS.ONE_THOUSAND,
  /** 15 minutes = 900000 ms */
  FIFTEEN_MINUTES: INTEGER_MULTIPLIERS.FIFTEEN * INTEGER_MULTIPLIERS.SIXTY * INTEGER_MULTIPLIERS.ONE_THOUSAND,
  /** 30 minutes = 1800000 ms */
  THIRTY_MINUTES: INTEGER_MULTIPLIERS.THIRTY * INTEGER_MULTIPLIERS.SIXTY * INTEGER_MULTIPLIERS.ONE_THOUSAND,
  /** 1 hour = 3600000 ms */
  HOUR: INTEGER_MULTIPLIERS.SIXTY * INTEGER_MULTIPLIERS.SIXTY * INTEGER_MULTIPLIERS.ONE_THOUSAND,
  /** 4 hours = 14400000 ms */
  FOUR_HOURS: INTEGER_MULTIPLIERS.FOUR * INTEGER_MULTIPLIERS.SIXTY * INTEGER_MULTIPLIERS.SIXTY * INTEGER_MULTIPLIERS.ONE_THOUSAND,
  /** 1 day = 86400000 ms */
  DAY: INTEGER_MULTIPLIERS.TWENTY_FOUR * INTEGER_MULTIPLIERS.SIXTY * INTEGER_MULTIPLIERS.SIXTY * INTEGER_MULTIPLIERS.ONE_THOUSAND,
  /** 1 week = 604800000 ms */
  WEEK: INTEGER_MULTIPLIERS.SEVEN * INTEGER_MULTIPLIERS.TWENTY_FOUR * INTEGER_MULTIPLIERS.SIXTY * INTEGER_MULTIPLIERS.SIXTY * INTEGER_MULTIPLIERS.ONE_THOUSAND,
} as const;

// ============================================================================
// TIMEZONE OFFSETS (UTC hours) - FIXED SESSIONS
// These are standard forex market session times in UTC
// ============================================================================

export const TIMEZONE_OFFSETS = {
  /** Tokyo session opens at 00:00 UTC */
  TOKYO_START: 0,
  /** Tokyo session closes at 08:00 UTC */
  TOKYO_END: 8,

  /** London session opens at 08:00 UTC */
  LONDON_START: 8,
  /** London session closes at 16:00 UTC */
  LONDON_END: 16,

  /** New York session opens at 13:00 UTC */
  NEW_YORK_START: 13,
  /** New York session closes at 21:00 UTC */
  NEW_YORK_END: 21,
} as const;

// ============================================================================
// BASIC MATH OPERATIONS
// ============================================================================

export const MATH_OPS = {
  ZERO: 0,
  ONE: 1,
  NEGATIVE_ONE: -1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  HALF: 0.5,
} as const;

// ============================================================================
// PERCENTAGE BOUNDARIES (for calculations)
// ============================================================================

export const PERCENTAGE_BOUNDS = {
  /** Minimum value: 0% */
  MINIMUM: 0,
  /** Maximum value: 100% */
  MAXIMUM: INTEGER_MULTIPLIERS.ONE_HUNDRED,
  /** Half: 50% */
  HALF: INTEGER_MULTIPLIERS.FIFTY,
  /** Quarter: 25% */
  QUARTER: 25,
  /** Tenth: 10% */
  TENTH: INTEGER_MULTIPLIERS.TEN,
} as const;

// ============================================================================
// FIXED EXIT PERCENTAGES
// ============================================================================

export const FIXED_EXIT_PERCENTAGES = {
  /** Full position exit: 100% */
  FULL: INTEGER_MULTIPLIERS.ONE_HUNDRED,
  /** Half position exit: 50% */
  HALF: INTEGER_MULTIPLIERS.FIFTY,
  /** Quarter position exit: 25% */
  QUARTER: 25,
  /** Tenth position exit: 10% */
  TENTH: INTEGER_MULTIPLIERS.TEN,
} as const;

// ============================================================================
// DEFAULT ARRAY/LIST SIZES
// ============================================================================

export const DEFAULT_SIZES = {
  /** Empty array */
  EMPTY: 0,
  /** Single item */
  SINGLE: 1,
  /** Two items (common for pairs) */
  PAIR: INTEGER_MULTIPLIERS.TWO,
  /** Four items (common for OHLC) */
  FOUR: INTEGER_MULTIPLIERS.FOUR,
} as const;

// ============================================================================
// SIGNAL CONSTANTS
// ============================================================================

export const SIGNAL_CONSTANTS = {
  /** Minimum consecutive signals required for confirmation */
  MIN_CONSECUTIVE_SIGNALS: INTEGER_MULTIPLIERS.TWO,
  /** Maximum consecutive signals to track before reset */
  MAX_CONSECUTIVE_SIGNALS: INTEGER_MULTIPLIERS.THREE,
} as const;

// ============================================================================
// ORDERBOOK CONSTANTS
// ============================================================================

export const ORDERBOOK_CONSTANTS = {
  /** Default orderbook depth (number of levels) */
  DEFAULT_DEPTH: INTEGER_MULTIPLIERS.TWENTY,
  /** Minimum bid/ask spread percentage for validation */
  MIN_SPREAD_PERCENT: THRESHOLD_VALUES.ONE_PERCENT,
} as const;

// ============================================================================
// CONFIDENCE SCORE BOUNDS (for calculations)
// ============================================================================

export const CONFIDENCE_BOUNDS = {
  /** Minimum confidence score */
  MINIMUM: 0,
  /** Maximum confidence score */
  MAXIMUM: INTEGER_MULTIPLIERS.ONE_HUNDRED,
} as const;

// ============================================================================
// WALLTRACKER CONSTANTS
// ============================================================================

export const WALLTRACKER_CONSTANTS = {
  /** Minimum wall confidence multiplier */
  MIN_CONFIDENCE_MULTIPLIER: 0.9,
  /** Maximum wall confidence multiplier */
  MAX_CONFIDENCE_MULTIPLIER: 1.1,
} as const;

// ============================================================================
// EXPORT ALL CONSTANTS AS DEFAULT
// ============================================================================


// ============================================================================
// SESSION-BASED SL MULTIPLIERS
// ============================================================================

export const SESSION_SL_MULTIPLIERS = {
  ASIAN: 1.0,
  LONDON: 1.5,
  NEW_YORK: 1.5,
  OVERLAP: 1.8,
} as const;

// ============================================================================
// RISK THRESHOLDS (TP/SL percentages)
// ============================================================================

export const RISK_THRESHOLDS = {
  TP_SCALP: 0.15,
  TP_AGGRESSIVE: 0.25,
  TP_STANDARD: 0.4,
  TP_CONSERVATIVE: 0.6,

  SL_TIGHT: 0.5,
  SL_STANDARD: 1.0,
  SL_MODERATE: 1.2,
  SL_CONSERVATIVE: 1.5,
} as const;

// ============================================================================
// CONFIDENCE WEIGHTS
// ============================================================================

export const CONFIDENCE_WEIGHTS = {
  LOW: 0.3,
  MODERATE: 0.5,
  HIGH: 0.8,
  VERY_HIGH: 0.9,
} as const;

// ============================================================================
// TECHNICAL CONSTANTS (pure math/time values - never change)
// ============================================================================

export {
  PERCENT_MULTIPLIER,
  PERCENT_DECIMAL_PLACES,
  DECIMAL_PLACES,
  TIME_MULTIPLIERS,
  RATIO_MULTIPLIERS,
  ARRAY_SIZING,
  FIRST_INDEX,
  SECOND_INDEX,
  THIRD_INDEX,
  INVALID_INDEX,
  INVALID_TIMEFRAME,
  MATH_BOUNDS,
  INDICATOR_DEFAULTS,
  BACKTEST_CONSTANTS,
  CALIBRATION_CONSTANTS,
  EXCHANGE_FEES,
  INTEGER_MULTIPLIERS,
  THRESHOLD_VALUES,
  MULTIPLIER_VALUES,
  NEGATIVE_MARKERS,
  PRECISION_THRESHOLDS,
  roundToDecimalPlaces,
  roundPrice,
  roundPercent,
  roundRSI,
} from './technical.constants';

// ============================================================================
// ANALYZER-SPECIFIC CONSTANTS (imported from analyzer-constants.ts)
// ============================================================================

export {
  BTC_ANALYZER_CONSTANTS,
  CHART_PATTERN_CONSTANTS,
  BREAKOUT_CONSTANTS,
  CONTEXT_ANALYZER_CONSTANTS,
  CORRELATION_CONSTANTS,
  SUPPORT_RESISTANCE_CONSTANTS,
  VOLUME_ANALYSIS_CONSTANTS,
} from './analyzer-constants';

export { MULTIPLIERS, PERCENTAGE_THRESHOLDS, CONFIDENCE_THRESHOLDS } from './strategy-constants';

export default {
  PERCENT_MULTIPLIER: PM,
  PERCENT_DECIMAL_PLACES: PDP,
  DECIMAL_PLACES: DP,
  TIME_MULTIPLIERS: TM,
  TIME_UNITS,
  TIMEZONE_OFFSETS,
  RATIO_MULTIPLIERS: RM,
  MATH_OPS,
  PERCENTAGE_BOUNDS,
  FIXED_EXIT_PERCENTAGES,
  DEFAULT_SIZES,
  SIGNAL_CONSTANTS,
  ORDERBOOK_CONSTANTS,
  CONFIDENCE_BOUNDS,
  WALLTRACKER_CONSTANTS,
  ARRAY_SIZING: AS,
  MATH_BOUNDS: MB,

  SESSION_SL_MULTIPLIERS,
  RISK_THRESHOLDS,
  CONFIDENCE_WEIGHTS,
};
