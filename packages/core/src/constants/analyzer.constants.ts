/**
 * Analyzer Constants
 *
 * Technical constants for analyzer calculations.
 * These are LOW-LEVEL calculation parameters that should not change frequently.
 * Strategic/configurable parameters are in config.json.
 *
 * Distinction:
 * - Technical: Multipliers, thresholds for calculations (keep here)
 * - Strategic: Confidence caps, enabled flags, min thresholds (keep in config.json)
 */

// ============================================================================
// RSI ANALYZER CONSTANTS
// ============================================================================

/** RSI oversold threshold for LONG signal */
export const RSI_OVERSOLD_LEVEL = 30;

/** RSI overbought threshold for SHORT signal */
export const RSI_OVERBOUGHT_LEVEL = 70;

/** Maximum confidence cap for RSI signals */
export const RSI_MAX_CONFIDENCE = 70;

// ============================================================================
// EMA ANALYZER CONSTANTS
// ============================================================================

/** EMA difference strength multiplier (dividing emaDiffPercent by this) */
export const EMA_STRENGTH_MULTIPLIER = 1.0;

/** Base confidence for EMA signals */
export const EMA_BASE_CONFIDENCE = 50;

/** EMA strength to confidence multiplier */
export const EMA_STRENGTH_CONFIDENCE_MULTIPLIER = 0.3;

// ============================================================================
// ATR ANALYZER CONSTANTS
// ============================================================================

/** ATR percent to confidence multiplier (volatility indicator strength) */
export const ATR_CONFIDENCE_MULTIPLIER = 20;

/** Maximum confidence cap for ATR signals */
export const ATR_MAX_CONFIDENCE = 80;

// ============================================================================
// WICK ANALYZER CONSTANTS
// ============================================================================

/** Wick rejection threshold percentage (> this means strong rejection) */
export const WICK_REJECTION_THRESHOLD_PERCENT = 40;

/** Base confidence for wick rejection signals */
export const WICK_SIGNAL_BASE_CONFIDENCE = 50;

/** Maximum confidence cap for wick signals */
export const WICK_MAX_CONFIDENCE = 80;

// ============================================================================
// FOOTPRINT ANALYZER CONSTANTS
// ============================================================================

/** Base confidence for footprint signals */
export const FOOTPRINT_BASE_CONFIDENCE = 45;

/** Footprint confidence multiplier based on close position (0-1) */
export const FOOTPRINT_CLOSE_POSITION_MULTIPLIER = 30;

// ============================================================================
// ORDER BLOCK ANALYZER CONSTANTS
// ============================================================================

/** Base confidence for order block signals */
export const ORDER_BLOCK_BASE_CONFIDENCE = 50;

/** Order block confidence multiplier based on body/wick ratio */
export const ORDER_BLOCK_BODY_WICK_MULTIPLIER = 5;

// ============================================================================
// FAIR VALUE GAP ANALYZER CONSTANTS
// ============================================================================

/** Base confidence for FVG signals */
export const FAIR_VALUE_GAP_BASE_CONFIDENCE = 40;

/** FVG confidence multiplier based on gap percent */
export const FAIR_VALUE_GAP_PERCENT_MULTIPLIER = 10;

// ============================================================================
// ATH PROTECTION CONSTANTS
// ============================================================================

/** ATH distance threshold (%) - distance from ATH to current price */
export const ATH_DISTANCE_THRESHOLD_PERCENT = 2;

/** Confidence for ATH protection when triggered */
export const ATH_PROTECTION_CONFIDENCE = 80;

// ============================================================================
// VOLUME ANALYZER CONSTANTS
// ============================================================================

/** Default neutral confidence for volume analyzer */
export const VOLUME_NEUTRAL_CONFIDENCE = 50;

// ============================================================================
// TREND DETECTOR CONSTANTS
// ============================================================================

/** Default confidence for trend-based signals */
export const TREND_DETECTOR_DEFAULT_CONFIDENCE = 60;

// ============================================================================
// EXPORT ALL AS OBJECT FOR CONVENIENCE
// ============================================================================

export const ANALYZER_CONSTANTS = {
  rsi: {
    oversoldLevel: RSI_OVERSOLD_LEVEL,
    overboughtLevel: RSI_OVERBOUGHT_LEVEL,
    maxConfidence: RSI_MAX_CONFIDENCE,
  },
  ema: {
    strengthMultiplier: EMA_STRENGTH_MULTIPLIER,
    baseConfidence: EMA_BASE_CONFIDENCE,
    strengthConfidenceMultiplier: EMA_STRENGTH_CONFIDENCE_MULTIPLIER,
  },
  atr: {
    confidenceMultiplier: ATR_CONFIDENCE_MULTIPLIER,
    maxConfidence: ATR_MAX_CONFIDENCE,
  },
  wick: {
    rejectionThreshold: WICK_REJECTION_THRESHOLD_PERCENT,
    baseConfidence: WICK_SIGNAL_BASE_CONFIDENCE,
    maxConfidence: WICK_MAX_CONFIDENCE,
  },
  footprint: {
    baseConfidence: FOOTPRINT_BASE_CONFIDENCE,
    closePositionMultiplier: FOOTPRINT_CLOSE_POSITION_MULTIPLIER,
  },
  orderBlock: {
    baseConfidence: ORDER_BLOCK_BASE_CONFIDENCE,
    bodyWickMultiplier: ORDER_BLOCK_BODY_WICK_MULTIPLIER,
  },
  fairValueGap: {
    baseConfidence: FAIR_VALUE_GAP_BASE_CONFIDENCE,
    percentMultiplier: FAIR_VALUE_GAP_PERCENT_MULTIPLIER,
  },
  ath: {
    distanceThreshold: ATH_DISTANCE_THRESHOLD_PERCENT,
    protectionConfidence: ATH_PROTECTION_CONFIDENCE,
  },
  volume: {
    neutralConfidence: VOLUME_NEUTRAL_CONFIDENCE,
  },
  trend: {
    defaultConfidence: TREND_DETECTOR_DEFAULT_CONFIDENCE,
  },
};
