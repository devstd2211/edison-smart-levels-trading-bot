/**
 * Phase 13: Advanced Order Management - Technical Constants
 *
 * These are technical/mathematical constants that should NOT be changed
 * without careful consideration. Strategic parameters (slippage %, execution strategy)
 * are configured in config.json for easy production tuning.
 *
 * Created: 2026-02-09 (Session 97)
 * Phase: 13.1 - Smart Order Execution (Session 97)
 * Phase: 13.2 - Order State Machine (Session 98)
 */

// ============================================================================
// SMART ORDER EXECUTION CONSTANTS
// ============================================================================

/**
 * Default max slippage tolerance (basis points)
 * 10 bps = 0.1%
 */
export const DEFAULT_MAX_SLIPPAGE_BPS = 10;

/**
 * Maximum number of order splits
 * Too many splits = too much overhead
 */
export const MAX_ORDER_SPLITS = 10;

/**
 * Minimum sub-order size (USD)
 * Below this, not worth splitting
 */
export const MIN_SUB_ORDER_SIZE_USD = 100;

/**
 * Default fill probability threshold
 * Below this, consider adjusting price
 */
export const DEFAULT_FILL_PROBABILITY = 0.7; // 70%

/**
 * Minimum fill probability to attempt order
 * Below this, cancel or adjust
 */
export const MIN_FILL_PROBABILITY = 0.3; // 30%

/**
 * Default execution timeout (milliseconds)
 * 5 minutes for normal orders
 */
export const DEFAULT_EXECUTION_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * TWAP default interval (milliseconds)
 * 30 seconds between sub-orders
 */
export const DEFAULT_TWAP_INTERVAL_MS = 30 * 1000;

/**
 * TWAP minimum interval (milliseconds)
 * Faster than 5 seconds is too aggressive
 */
export const MIN_TWAP_INTERVAL_MS = 5 * 1000;

/**
 * VWAP default lookback period (candles)
 * Last 20 candles for volume profiling
 */
export const DEFAULT_VWAP_LOOKBACK = 20;

/**
 * VWAP minimum lookback period (candles)
 * Need at least 5 candles for meaningful data
 */
export const MIN_VWAP_LOOKBACK = 5;

/**
 * VWAP maximum lookback period (candles)
 * Beyond 100 candles, data is too old
 */
export const MAX_VWAP_LOOKBACK = 100;

// ============================================================================
// MARKET IMPACT ESTIMATION CONSTANTS
// ============================================================================

/**
 * Market impact coefficient
 * impact = sqrt(orderSize / avgVolume) * coefficient
 */
export const MARKET_IMPACT_COEFFICIENT = 0.1;

/**
 * Minimum daily volume to consider (USD)
 * Below this, market is too illiquid
 */
export const MIN_DAILY_VOLUME_USD = 1_000_000;

/**
 * Order size threshold for impact calculation (% of daily volume)
 * Above 1% of daily volume = significant impact
 */
export const SIGNIFICANT_ORDER_THRESHOLD_PERCENT = 1.0;

/**
 * Large order threshold (% of daily volume)
 * Above 5% = very large order, needs splitting
 */
export const LARGE_ORDER_THRESHOLD_PERCENT = 5.0;

/**
 * Maximum acceptable market impact (bps)
 * Above 50 bps = too much impact, split order
 */
export const MAX_ACCEPTABLE_IMPACT_BPS = 50;

// ============================================================================
// PRICE ADJUSTMENT CONSTANTS
// ============================================================================

/**
 * Minimum price movement to trigger adjustment (bps)
 * 5 bps = 0.05%
 */
export const MIN_PRICE_MOVEMENT_BPS = 5;

/**
 * Aggressive price adjustment multiplier
 * Adjust price by 1.5x the slippage tolerance
 */
export const AGGRESSIVE_ADJUSTMENT_MULTIPLIER = 1.5;

/**
 * Passive price adjustment multiplier
 * Adjust price by 0.5x the slippage tolerance
 */
export const PASSIVE_ADJUSTMENT_MULTIPLIER = 0.5;

/**
 * Maximum price adjustments per order
 * Prevent infinite adjustment loop
 */
export const MAX_PRICE_ADJUSTMENTS = 5;

/**
 * Timeout before first price adjustment (milliseconds)
 * Wait 30 seconds before adjusting
 */
export const ADJUSTMENT_DELAY_MS = 30 * 1000;

// ============================================================================
// PARTIAL FILL HANDLING CONSTANTS
// ============================================================================

/**
 * Minimum partial fill percentage to continue
 * If filled < 10%, cancel (liquidity too low)
 */
export const MIN_PARTIAL_FILL_PERCENT = 10;

/**
 * Partial fill continuation threshold
 * If filled >= 50%, continue with remainder
 */
export const PARTIAL_FILL_CONTINUE_THRESHOLD = 50;

/**
 * Partial fill timeout multiplier
 * Give partial fills 2x normal timeout
 */
export const PARTIAL_FILL_TIMEOUT_MULTIPLIER = 2.0;

/**
 * Maximum partial fill retries
 * After 3 retries, cancel remaining
 */
export const MAX_PARTIAL_FILL_RETRIES = 3;

// ============================================================================
// ORDER STATE MACHINE CONSTANTS
// ============================================================================

/**
 * Default order timeout (milliseconds)
 * Orders expire after 10 minutes if not filled
 */
export const DEFAULT_ORDER_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Minimum order timeout (milliseconds)
 * At least 30 seconds
 */
export const MIN_ORDER_TIMEOUT_MS = 30 * 1000;

/**
 * Maximum order timeout (milliseconds)
 * Maximum 1 hour
 */
export const MAX_ORDER_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * State transition lock timeout (milliseconds)
 * Max time to hold state lock
 */
export const STATE_LOCK_TIMEOUT_MS = 5 * 1000;

/**
 * State history max entries
 * Keep last 100 state transitions
 */
export const MAX_STATE_HISTORY = 100;

/**
 * Validation retry delay (milliseconds)
 * Wait 1 second before retrying validation
 */
export const VALIDATION_RETRY_DELAY_MS = 1000;

/**
 * Maximum validation retries
 * Retry validation up to 3 times
 */
export const MAX_VALIDATION_RETRIES = 3;

// ============================================================================
// EXECUTION STRATEGY CONSTANTS
// ============================================================================

/**
 * Aggressive strategy: Max slippage multiplier
 * Accept 2x normal slippage for immediate fill
 */
export const AGGRESSIVE_SLIPPAGE_MULTIPLIER = 2.0;

/**
 * Aggressive strategy: Fill probability threshold
 * Lower threshold = more aggressive
 */
export const AGGRESSIVE_FILL_PROBABILITY = 0.5;

/**
 * Passive strategy: Fill probability threshold
 * Higher threshold = more patient
 */
export const PASSIVE_FILL_PROBABILITY = 0.9;

/**
 * Passive strategy: Timeout multiplier
 * Give passive orders 3x normal timeout
 */
export const PASSIVE_TIMEOUT_MULTIPLIER = 3.0;

/**
 * Adaptive strategy: Market condition check interval (ms)
 * Check market every 10 seconds
 */
export const ADAPTIVE_CHECK_INTERVAL_MS = 10 * 1000;

/**
 * Adaptive strategy: Volatility threshold for strategy switch
 * If volatility > 2x normal, switch to aggressive
 */
export const ADAPTIVE_VOLATILITY_THRESHOLD = 2.0;

// ============================================================================
// FALLBACK VALUES
// ============================================================================

/**
 * Fallback execution report for complete failures
 */
export const FALLBACK_EXECUTION_REPORT = {
  orderId: 'fallback',
  status: 'failed' as const,
  symbol: '',
  side: 'Buy' as const,
  requestedSize: 0,
  filledSize: 0,
  remainingSize: 0,
  requestedPrice: 0,
  averageFillPrice: 0,
  slippage: 0,
  executionTime: 0,
  numberOfSplits: 0,
  marketImpact: 0,
  subOrders: [],
  adjustments: [],
  reasoning: 'Execution failed - using fallback report',
};

/**
 * Fallback sub-order for calculation failures
 */
export const FALLBACK_SUB_ORDER = {
  id: 'fallback_sub',
  size: 0,
  price: 0,
  status: 'cancelled' as const,
  timestamp: Date.now(),
};

/**
 * Default sub-order ID prefix
 */
export const SUB_ORDER_ID_PREFIX = 'sub_';

/**
 * Default price adjustment ID prefix
 */
export const ADJUSTMENT_ID_PREFIX = 'adj_';

// ============================================================================
// NUMERICAL PRECISION CONSTANTS
// ============================================================================

/**
 * Price decimal places
 * Round prices to 2 decimals
 */
export const PRICE_DECIMALS = 2;

/**
 * Size decimal places
 * Round sizes to 3 decimals
 */
export const SIZE_DECIMALS = 3;

/**
 * Slippage decimal places (bps)
 * Round slippage to 1 decimal
 */
export const SLIPPAGE_DECIMALS = 1;

/**
 * Market impact decimal places (bps)
 * Round impact to 1 decimal
 */
export const IMPACT_DECIMALS = 1;

/**
 * Fill probability decimal places
 * Round to 2 decimals (0.75 = 75%)
 */
export const PROBABILITY_DECIMALS = 2;

/**
 * Minimum size difference for split
 * If difference < 0.001, consider equal
 */
export const MIN_SIZE_DIFFERENCE = 0.001;

/**
 * Minimum price difference for adjustment
 * If difference < 0.01, skip adjustment
 */
export const MIN_PRICE_DIFFERENCE = 0.01;

// ============================================================================
// PERFORMANCE THRESHOLDS
// ============================================================================

/**
 * Maximum execution time for single order (ms)
 * Alert if execution takes > 1 minute
 */
export const MAX_SINGLE_ORDER_EXECUTION_MS = 60 * 1000;

/**
 * Maximum sub-orders per second
 * Rate limit to prevent exchange throttling
 */
export const MAX_SUB_ORDERS_PER_SECOND = 5;

/**
 * Minimum time between sub-orders (ms)
 * At least 200ms between orders
 */
export const MIN_SUB_ORDER_INTERVAL_MS = 200;

/**
 * Maximum concurrent orders
 * Don't execute more than 10 orders at once
 */
export const MAX_CONCURRENT_ORDERS = 10;

// ============================================================================
// ORDER STATE MACHINE ENUMS & TYPES (Phase 13.2)
// ============================================================================

/**
 * Order states
 */
export enum OrderState {
  // Initial states
  PENDING = 'pending',           // Created, not yet submitted
  VALIDATING = 'validating',     // Validating with exchange

  // Active states
  SUBMITTED = 'submitted',       // On exchange, waiting for fill
  PARTIAL_FILL = 'partial_fill', // Partially filled

  // Terminal states
  FILLED = 'filled',             // Fully filled
  CANCELLED = 'cancelled',       // User cancelled
  REJECTED = 'rejected',         // Exchange rejected
  FAILED = 'failed',             // System error
  EXPIRED = 'expired',           // Timeout
}

/**
 * Transition trigger types
 */
export enum TransitionTrigger {
  USER = 'user',       // User-initiated action
  SYSTEM = 'system',   // System-initiated action
  EXCHANGE = 'exchange', // Exchange update
  TIMEOUT = 'timeout', // Timeout expiry
  ERROR = 'error',     // Error condition
}

/**
 * Pending state timeout (milliseconds)
 * If order stays in PENDING > 30 seconds, something is wrong
 */
export const PENDING_STATE_TIMEOUT_MS = 30 * 1000;

/**
 * Validating state timeout (milliseconds)
 * Exchange should respond within 5 seconds
 */
export const VALIDATING_STATE_TIMEOUT_MS = 5 * 1000;

/**
 * Submitted state timeout (milliseconds)
 * If no fill after 5 minutes, likely won't fill
 */
export const SUBMITTED_STATE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Partial fill state timeout (milliseconds)
 * If partially filled order sits > 2 minutes, consider cancelling rest
 */
export const PARTIAL_FILL_STATE_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Maximum state transition history length
 * Keep last 100 transitions per order
 */
export const MAX_TRANSITION_HISTORY = 100;

/**
 * Maximum concurrent state transitions
 * Prevent race conditions
 */
export const MAX_CONCURRENT_TRANSITIONS = 1;

/**
 * State check interval (milliseconds)
 * Check for timeouts every 1 second
 */
export const STATE_CHECK_INTERVAL_MS = 1000;

/**
 * Rollback retry limit
 * Maximum attempts to rollback state
 */
export const MAX_ROLLBACK_RETRIES = 3;

/**
 * Terminal states (cannot transition from these)
 */
export const TERMINAL_STATES = new Set<OrderState>([
  OrderState.FILLED,
  OrderState.CANCELLED,
  OrderState.REJECTED,
  OrderState.FAILED,
  OrderState.EXPIRED,
]);

/**
 * Valid state transitions map
 * Defines which state can transition to which other states
 */
export const STATE_TRANSITIONS: Record<OrderState, OrderState[]> = {
  [OrderState.PENDING]: [
    OrderState.VALIDATING,
    OrderState.CANCELLED,
    OrderState.FAILED,
    OrderState.EXPIRED, // Timeout can happen in any state
  ],
  [OrderState.VALIDATING]: [
    OrderState.SUBMITTED,
    OrderState.REJECTED,
    OrderState.CANCELLED, // User can cancel during validation
    OrderState.FAILED,
    OrderState.EXPIRED, // Timeout can happen during validation
  ],
  [OrderState.SUBMITTED]: [
    OrderState.PARTIAL_FILL,
    OrderState.FILLED,
    OrderState.CANCELLED,
    OrderState.EXPIRED,
    OrderState.FAILED,
  ],
  [OrderState.PARTIAL_FILL]: [
    OrderState.FILLED,
    OrderState.CANCELLED,
    OrderState.EXPIRED,
    OrderState.FAILED,
  ],
  // Terminal states cannot transition
  [OrderState.FILLED]: [],
  [OrderState.CANCELLED]: [],
  [OrderState.REJECTED]: [],
  [OrderState.FAILED]: [],
  [OrderState.EXPIRED]: [],
};

/**
 * State timeouts map
 * Maximum time an order can stay in each state
 */
export const STATE_TIMEOUTS: Record<OrderState, number> = {
  [OrderState.PENDING]: PENDING_STATE_TIMEOUT_MS,
  [OrderState.VALIDATING]: VALIDATING_STATE_TIMEOUT_MS,
  [OrderState.SUBMITTED]: SUBMITTED_STATE_TIMEOUT_MS,
  [OrderState.PARTIAL_FILL]: PARTIAL_FILL_STATE_TIMEOUT_MS,
  // Terminal states have no timeout
  [OrderState.FILLED]: 0,
  [OrderState.CANCELLED]: 0,
  [OrderState.REJECTED]: 0,
  [OrderState.FAILED]: 0,
  [OrderState.EXPIRED]: 0,
};

/**
 * State transition ID prefix
 */
export const TRANSITION_ID_PREFIX = 'trans_';

/**
 * Default order ID prefix for state machine
 */
export const STATE_MACHINE_ORDER_ID_PREFIX = 'order_';
