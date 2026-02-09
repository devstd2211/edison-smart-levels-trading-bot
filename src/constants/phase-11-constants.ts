/**
 * Phase 11: Dynamic Position Sizing - Technical Constants
 *
 * These are technical/mathematical constants that should NOT be changed
 * without careful consideration. Strategic parameters (risk %, thresholds)
 * are configured in config.json for easy production tuning.
 *
 * Created: 2026-02-09 (Session 96)
 * Phase: 11.1 - Risk-Based Entry Sizing
 */

// ============================================================================
// KELLY CRITERION CONSTANTS
// ============================================================================

/**
 * Maximum Kelly fraction to use (full Kelly is too aggressive)
 * 0.25 = 25% of optimal Kelly (fractional Kelly)
 * Prevents over-betting and reduces volatility
 */
export const MAX_KELLY_FRACTION = 0.25;

/**
 * Minimum win probability to consider position
 * Below this, return zero size (no trade)
 */
export const MIN_WIN_PROBABILITY = 0.4; // 40%

/**
 * Default win/loss ratio if not provided
 * Conservative 1.5:1 RR ratio
 */
export const DEFAULT_RISK_REWARD_RATIO = 1.5;

/**
 * Minimum risk/reward ratio to consider trade
 * Below 1:1 is not worth the risk
 */
export const MIN_RISK_REWARD_RATIO = 1.0;

// ============================================================================
// VOLATILITY ADJUSTMENT CONSTANTS
// ============================================================================

/**
 * Number of periods to calculate average ATR
 * 14 periods is standard for ATR calculation
 */
export const ATR_AVERAGE_PERIODS = 14;

/**
 * Minimum ATR value to prevent division by zero
 * Very small number, acts as floor
 */
export const MIN_ATR_VALUE = 0.0001;

/**
 * Maximum volatility adjustment multiplier
 * Caps position size reduction in extreme volatility
 */
export const MAX_VOLATILITY_ADJUSTMENT = 2.0;

/**
 * Minimum volatility adjustment multiplier
 * Caps position size increase in low volatility
 */
export const MIN_VOLATILITY_ADJUSTMENT = 0.25;

// ============================================================================
// ACCOUNT RISK CONSTANTS
// ============================================================================

/**
 * Default risk per trade as % of account (if not in config)
 * 1% is conservative default
 */
export const DEFAULT_RISK_PERCENT = 1.0;

/**
 * Maximum risk per trade as % of account (hard limit)
 * Never exceed 5% regardless of config
 */
export const ABSOLUTE_MAX_RISK_PERCENT = 5.0;

/**
 * Minimum account balance to trade
 * Below this, refuse to calculate size
 */
export const MIN_ACCOUNT_BALANCE = 10; // $10

/**
 * Maximum account utilization (% of balance in positions)
 * 80% maximum, keep 20% as buffer
 */
export const MAX_ACCOUNT_UTILIZATION = 0.8; // 80%

// ============================================================================
// POSITION SIZE CONSTRAINTS
// ============================================================================

/**
 * Minimum position size (USD)
 * Below exchange minimum order
 */
export const MIN_POSITION_SIZE_USD = 5;

/**
 * Maximum position size as % of account
 * Single position should not exceed 30% of account
 */
export const MAX_POSITION_SIZE_PERCENT = 0.3; // 30%

/**
 * Dust threshold for position sizing
 * Positions below this are rounded to zero
 */
export const POSITION_SIZE_DUST_THRESHOLD = 0.01;

// ============================================================================
// CONFIDENCE ADJUSTMENT CONSTANTS
// ============================================================================

/**
 * Minimum confidence to take any position
 * Below 50%, no trade
 */
export const MIN_CONFIDENCE_THRESHOLD = 0.5; // 50%

/**
 * Confidence below which we reduce position size
 * 60% = reduce size, 70%+ = normal size
 */
export const REDUCED_SIZE_CONFIDENCE_THRESHOLD = 0.6; // 60%

/**
 * Confidence above which we increase position size
 * 80%+ = increase size (up to limits)
 */
export const INCREASED_SIZE_CONFIDENCE_THRESHOLD = 0.8; // 80%

/**
 * Maximum confidence multiplier
 * High confidence can increase size by max 1.5x
 */
export const MAX_CONFIDENCE_MULTIPLIER = 1.5;

/**
 * Minimum confidence multiplier
 * Low confidence reduces size to 0.5x
 */
export const MIN_CONFIDENCE_MULTIPLIER = 0.5;

// ============================================================================
// CALCULATION PRECISION
// ============================================================================

/**
 * Decimal places for position size rounding
 * 2 decimals = 0.01 precision
 */
export const POSITION_SIZE_DECIMALS = 2;

/**
 * Decimal places for percentage calculations
 * 4 decimals = 0.01% precision
 */
export const PERCENT_DECIMALS = 4;

/**
 * Minimum price difference to consider valid
 * Prevents division by zero in stop distance
 */
export const MIN_PRICE_DIFFERENCE = 0.000001;

// ============================================================================
// POSITION SCALING CONSTANTS (Phase 11.2)
// ============================================================================

/**
 * Maximum number of scale-in operations
 * Prevents excessive pyramiding
 */
export const MAX_SCALE_INS = 3;

/**
 * Size reduction factor per scale-in
 * Each scale is 50% of previous
 */
export const SCALE_SIZE_REDUCTION_FACTOR = 0.5;

/**
 * Minimum profit % to consider first scale-in
 * 50% of TP1 target
 */
export const MIN_PROFIT_FOR_SCALE = 0.5;

/**
 * Profit % threshold to move SL to breakeven
 * After 50% of TP1 reached
 */
export const BREAKEVEN_PROFIT_THRESHOLD = 0.5;

/**
 * Minimum position size for scaling (USD)
 * Don't scale if position too small
 */
export const MIN_POSITION_SIZE_FOR_SCALING = 20;

// ============================================================================
// ERROR HANDLING DEFAULTS
// ============================================================================

/**
 * Default position size when calculations fail
 * Return minimum safe size on error
 */
export const FALLBACK_POSITION_SIZE = MIN_POSITION_SIZE_USD;

/**
 * Default sizing decision when error occurs
 */
export const FALLBACK_SIZING_DECISION = {
  baseSize: FALLBACK_POSITION_SIZE,
  adjustedSize: FALLBACK_POSITION_SIZE,
  riskPercent: DEFAULT_RISK_PERCENT,
  maxRisk: FALLBACK_POSITION_SIZE,
  recommendation: 'reduce' as const,
  confidence: 0,
  volatilityAdjustment: 1.0,
};

/**
 * Default scale action when calculations fail
 */
export const FALLBACK_SCALE_ACTION = {
  action: 'hold' as const,
  size: 0,
  newStopLoss: 0,
  reasoning: 'Error in calculation - holding position',
  confidence: 0,
};
