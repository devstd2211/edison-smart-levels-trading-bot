/**
 * Phase 14.2 Constants - Resilience Patterns
 *
 * Technical constants for circuit breakers, rate limiters, retry policies,
 * bulkheads, and resilience coordination.
 *
 * Strategic parameters (thresholds, timeouts) are in config.json
 */

// ============================================================================
// CIRCUIT BREAKER CONSTANTS
// ============================================================================

/**
 * Default failure threshold to open circuit
 * Circuit opens after this many consecutive failures
 */
export const DEFAULT_CIRCUIT_FAILURE_THRESHOLD = 5;

/**
 * Default failure rate threshold (0-1) to open circuit
 * Circuit opens if failure rate exceeds this percentage
 */
export const DEFAULT_CIRCUIT_FAILURE_RATE = 0.5; // 50%

/**
 * Default success threshold to close circuit from HALF_OPEN
 * Circuit closes after this many consecutive successes in HALF_OPEN state
 */
export const DEFAULT_CIRCUIT_SUCCESS_THRESHOLD = 2;

/**
 * Default timeout (ms) before attempting HALF_OPEN from OPEN
 * Circuit waits this long before testing if service recovered
 */
export const DEFAULT_CIRCUIT_TIMEOUT_MS = 60000; // 60 seconds

/**
 * Default volume threshold for circuit evaluation
 * Need at least this many requests before evaluating failure rate
 */
export const DEFAULT_CIRCUIT_VOLUME_THRESHOLD = 10;

/**
 * Maximum circuit breaker instances
 * Prevent memory leaks from unlimited circuit creation
 */
export const MAX_CIRCUIT_BREAKERS = 100;

/**
 * Circuit state transition timeout (ms)
 * Maximum time to wait for state transition to complete
 */
export const CIRCUIT_STATE_TRANSITION_TIMEOUT_MS = 1000;

// ============================================================================
// RATE LIMITER CONSTANTS
// ============================================================================

/**
 * Default token bucket refill rate (requests per second)
 * Tokens are added to bucket at this rate
 */
export const DEFAULT_RATE_LIMIT_RPS = 10;

/**
 * Default rate limit window (ms)
 * Time window for counting requests
 */
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 1000;

/**
 * Default burst size (requests)
 * Maximum tokens in bucket, allows short bursts
 */
export const DEFAULT_RATE_LIMIT_BURST_SIZE = 15;

/**
 * Default queue size for excess requests
 * Requests beyond rate limit are queued up to this size
 */
export const DEFAULT_RATE_LIMIT_QUEUE_SIZE = 50;

/**
 * Default adaptive rate reduction factor on 429
 * Reduce rate by this factor when receiving 429 Too Many Requests
 */
export const RATE_LIMIT_429_REDUCTION_FACTOR = 0.7; // Reduce to 70%

/**
 * Default adaptive rate recovery factor
 * Gradually increase rate by this factor when no 429 errors
 */
export const RATE_LIMIT_RECOVERY_FACTOR = 1.1; // Increase by 10%

/**
 * Minimum tokens to prevent rate limit shutdown
 * Never reduce rate below this threshold
 */
export const MIN_RATE_LIMIT_TOKENS = 1;

/**
 * Maximum rate limiter instances
 * Prevent memory leaks from unlimited limiter creation
 */
export const MAX_RATE_LIMITERS = 100;

/**
 * Token refill interval (ms)
 * How often to add tokens to bucket
 */
export const TOKEN_REFILL_INTERVAL_MS = 100;

// ============================================================================
// RETRY POLICY CONSTANTS
// ============================================================================

/**
 * Default maximum retry attempts
 * Operation fails after this many attempts
 */
export const DEFAULT_MAX_RETRY_ATTEMPTS = 3;

/**
 * Default base delay (ms) for exponential backoff
 * First retry waits this long
 */
export const DEFAULT_RETRY_BASE_DELAY_MS = 100;

/**
 * Default maximum delay (ms) for exponential backoff
 * Delay never exceeds this value
 */
export const DEFAULT_RETRY_MAX_DELAY_MS = 5000;

/**
 * Default exponential backoff multiplier
 * Delay = baseDelay * (multiplier ^ attempt)
 */
export const DEFAULT_RETRY_EXPONENTIAL_BASE = 2;

/**
 * Default jitter factor (0-1)
 * Add random delay: delay * (1 ± jitter)
 */
export const DEFAULT_RETRY_JITTER_FACTOR = 0.1; // ±10%

/**
 * Default retry budget percentage (0-1)
 * Maximum percentage of total requests that can be retried
 */
export const DEFAULT_RETRY_BUDGET_PERCENT = 0.1; // 10%

/**
 * Retry budget reset interval (ms)
 * Reset retry budget counters this often
 */
export const RETRY_BUDGET_RESET_INTERVAL_MS = 60000; // 60 seconds

/**
 * Minimum retry delay (ms)
 * Never wait less than this between retries
 */
export const MIN_RETRY_DELAY_MS = 10;

/**
 * Maximum retry delay (ms) - absolute cap
 * Safety limit to prevent infinite waits
 */
export const MAX_RETRY_DELAY_MS = 30000; // 30 seconds

// ============================================================================
// BULKHEAD CONSTANTS
// ============================================================================

/**
 * Default maximum concurrent operations per bulkhead
 * Maximum parallel operations allowed
 */
export const DEFAULT_BULKHEAD_MAX_CONCURRENT = 10;

/**
 * Default bulkhead queue size
 * Operations beyond max concurrent are queued
 */
export const DEFAULT_BULKHEAD_QUEUE_SIZE = 20;

/**
 * Default bulkhead timeout (ms)
 * Operations in queue timeout after this duration
 */
export const DEFAULT_BULKHEAD_TIMEOUT_MS = 5000;

/**
 * Maximum bulkhead instances
 * Prevent memory leaks from unlimited bulkhead creation
 */
export const MAX_BULKHEADS = 50;

/**
 * Bulkhead queue check interval (ms)
 * How often to check for timed-out operations in queue
 */
export const BULKHEAD_QUEUE_CHECK_INTERVAL_MS = 100;

// ============================================================================
// RESILIENCE COORDINATOR CONSTANTS
// ============================================================================

/**
 * Default timeout (ms) for resilient operations
 * Operations timeout if they exceed this duration
 */
export const DEFAULT_RESILIENCE_TIMEOUT_MS = 10000;

/**
 * Maximum combined overhead (ms) from all resilience patterns
 * Total overhead from circuit breaker + rate limiter + retry should not exceed this
 */
export const MAX_RESILIENCE_OVERHEAD_MS = 100;

/**
 * Resilience health check interval (ms)
 * How often to check health of all resilience components
 */
export const RESILIENCE_HEALTH_CHECK_INTERVAL_MS = 30000;

// ============================================================================
// ERROR CLASSIFICATION FOR RETRY
// ============================================================================

/**
 * Transient error codes that should be retried
 * Network errors, timeouts, 5xx HTTP errors
 */
export const TRANSIENT_ERROR_CODES = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ENETUNREACH',
  'EAI_AGAIN',
];

/**
 * HTTP status codes that should be retried
 * 429 (Rate Limited), 500 (Server Error), 502 (Bad Gateway), 503 (Service Unavailable), 504 (Gateway Timeout)
 */
export const RETRYABLE_HTTP_STATUS_CODES = [429, 500, 502, 503, 504];

/**
 * HTTP status codes that should NOT be retried
 * Client errors (4xx) except 429
 */
export const NON_RETRYABLE_HTTP_STATUS_CODES = [400, 401, 403, 404, 405, 406, 409, 410, 422];

// ============================================================================
// METRICS CONSTANTS
// ============================================================================

/**
 * Metrics collection interval (ms)
 * How often to collect resilience metrics
 */
export const RESILIENCE_METRICS_INTERVAL_MS = 5000;

/**
 * Maximum metrics history size
 * Keep this many historical data points
 */
export const MAX_METRICS_HISTORY_SIZE = 1000;

/**
 * Metrics percentiles to calculate
 * Calculate these percentiles for latency metrics
 */
export const METRICS_PERCENTILES = [0.5, 0.75, 0.9, 0.95, 0.99];

// ============================================================================
// CIRCUIT BREAKER STATE NAMES
// ============================================================================

export const CIRCUIT_STATE_CLOSED = 'CLOSED';
export const CIRCUIT_STATE_OPEN = 'OPEN';
export const CIRCUIT_STATE_HALF_OPEN = 'HALF_OPEN';

// ============================================================================
// BULKHEAD REJECTION POLICIES
// ============================================================================

export const BULKHEAD_REJECT_FAIL_FAST = 'FAIL_FAST';
export const BULKHEAD_REJECT_QUEUE = 'QUEUE';
export const BULKHEAD_REJECT_TIMEOUT = 'TIMEOUT';
