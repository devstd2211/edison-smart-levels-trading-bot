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
// RE-EXPORTS FROM CONSTANTS DIRECTORY
// ============================================================================

// Re-export all constants from the constants directory index
export * from './constants/index';
export * from './constants/strategy-constants';
export * from './constants/analyzer.constants';
export * from './constants/analyzer-constants';
export * from './constants/pattern-validation.constants';
export * from './constants/technical.constants';
