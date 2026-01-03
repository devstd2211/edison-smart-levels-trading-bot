/**
 * Technical Constants (НЕ СТРАТЕГИЧЕСКИЕ!)
 *
 * These constants are technical values that don't affect strategy logic.
 * Strategic constants should be in config.json instead.
 *
 * Examples of technical constants:
 * - Time units (milliseconds, seconds, minutes)
 * - API limits and pagination
 * - Precision decimals
 * - Default timeout values
 *
 * Examples of strategic constants (SHOULD BE IN CONFIG):
 * - Confidence thresholds (in strategyConfidence)
 * - Analyzer parameters (in analyzerThresholds)
 * - Risk multipliers (in services)
 */

// NOTE: TIME_UNITS and other technical constants are now defined in constants/index.ts
// They are re-exported below for convenience.

// ============================================================================
// BYBIT API LIMITS (не конфигурируются)
// ============================================================================

/**
 * Bybit API constraints and limits
 */
export const BYBIT_LIMITS = {
  MAX_CANDLES_PER_REQUEST: 1000,
  RATE_LIMIT_MS: 200,
  MAX_ORDERS_PER_MINUTE: 100,
} as const;

// ============================================================================
// PRECISION CONSTANTS (не конфигурируются)
// ============================================================================

/**
 * Decimal precision for various data types
 */
export const PRECISION = {
  PRICE_DECIMALS: 4,
  QUANTITY_DECIMALS: 2,
  PERCENT_DECIMALS: 2,
  PNL_DECIMALS: 2,
} as const;

// ============================================================================
// ARRAY BOUNDS (не конфигурируются)
// ============================================================================

/**
 * Standard limits for arrays and collections
 */
export const ARRAY_BOUNDS = {
  MIN_CANDLES_FOR_ANALYSIS: 3,
  MIN_SWING_POINTS: 2,
  MAX_SIGNALS_CACHE: 100,
  MAX_TRADE_HISTORY_CACHE: 500,
} as const;

// ============================================================================
// REGEX PATTERNS (не конфигурируются)
// ============================================================================

/**
 * Common regex patterns used across the application
 */
export const REGEX_PATTERNS = {
  SYMBOL_PATTERN: /^[A-Z]{1,10}USDT$/,
  TIMEFRAME_PATTERN: /^\d+$/,
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

// ============================================================================
// EXIT CODES (не конфигурируются)
// ============================================================================

/**
 * Process exit codes for different scenarios
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  INITIALIZATION_ERROR: 2,
  CONNECTION_ERROR: 3,
  DATA_ERROR: 4,
  CONFIG_ERROR: 5,
} as const;

// ============================================================================
// LOG LEVELS (не конфигурируются)
// ============================================================================

/**
 * Log level ordering (higher number = more verbose)
 */
export const LOG_LEVEL_ORDER = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
} as const;

// ============================================================================
// PRICE TOLERANCE CONSTANTS (не конфигурируются)
// ============================================================================

/**
 * Price tolerance constants for different use cases
 * Each service has different tolerance requirements
 */
export const PRICE_TOLERANCE = {
  // Liquidity detector: swing points within 0.3% are considered same level
  LIQUIDITY_ZONE_PERCENT: 0.3,

  // TP hit detection: order filled within 0.01% of target
  TP_HIT_DETECTION_PERCENT: 0.01,

  // Price matching in bot: accept fill within 0.1% of expected price
  BOT_PRICE_MATCHING: 0.001,
} as const;

// ============================================================================
// BYBIT FEE CONSTANTS (не конфигурируются)
// ============================================================================

/**
 * Bybit trading fees (for non-VIP users)
 * Used in PnL calculations and position management
 */
export const BYBIT_FEES = {
  TAKER: 0.00055,  // 0.055% for market orders (non-VIP)
  MAKER: 0.0002,   // 0.02% for limit orders (non-VIP)
} as const;

// ============================================================================
// TECHNICAL THRESHOLDS (не конфигурируются)
// ============================================================================

/**
 * Technical thresholds for pattern detection and analysis
 */
export const TECHNICAL_THRESHOLDS = {
  // Price equality threshold (0.1%)
  EQUAL_PRICE: 0.001,

  // Pattern detection thresholds
  FLAT_SLOPE: 0.00005,          // Slope considered "flat"
  CONVERGENCE: 0.0001,           // Minimum convergence in patterns

  // Volatility thresholds
  HIGH_VOLATILITY: 0.05,         // 5% ATR/price ratio
  MEDIUM_VOLATILITY: 0.03,       // 3% ATR/price ratio

  // Price movement detection
  PRICE_MOVE: 0.01,              // 0.01% price change to detect direction

  // Breakeven tolerance
  BREAKEVEN_TOLERANCE: 0.01,     // $0.01 tolerance for breakeven

  // Buffer for adaptive stop loss
  BUFFER_MIN: 0.0001,            // Minimum buffer (0.01%)
  BUFFER_MAX: 0.005,             // Maximum buffer (0.5%)

  // VWAP threshold
  VWAP_THRESHOLD: 0.0001,        // 0.01% threshold for "AT"
} as const;

// ============================================================================
// SLEEP UTILITY (используй вместо Math.random())
// ============================================================================

/**
 * Sleep function for delays
 * Usage: await sleep(5 * TIME_UNITS.SECOND)
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// RE-EXPORTS FROM CONSTANTS DIRECTORY
// ============================================================================

// Re-export all constants from the constants directory index
export * from './constants/index';
export * from './constants/strategy-constants';
export * from './constants/analyzer.constants';
export * from './constants/analyzer-constants';
export * from './constants/pattern-validation.constants';
export * from './constants/technical.constants';
