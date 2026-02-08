/**
 * Phase 10 Constants
 *
 * Centralized constants for all Phase 10 services to eliminate magic numbers
 * and improve maintainability. All threshold values, weights, and limits
 * are defined here with clear documentation.
 *
 * Organization:
 * - Each service has its own namespace
 * - Constants are grouped by functionality
 * - All values include JSDoc comments explaining their purpose
 */

// =============================================================================
// ADVANCED ORDER FLOW SERVICE CONSTANTS
// =============================================================================

export const ADVANCED_ORDER_FLOW = {
  /**
   * Momentum thresholds for directional signals
   */
  MOMENTUM: {
    /** Momentum above this value triggers LONG signal */
    LONG_THRESHOLD: 20,
    /** Momentum below this value triggers SHORT signal */
    SHORT_THRESHOLD: -20,
  },

  /**
   * Pattern detection thresholds
   */
  PATTERN: {
    /** Buy pressure threshold for accumulation pattern (%) */
    ACCUMULATION_THRESHOLD: 65,
    /** Sell pressure threshold for distribution pattern (%) */
    DISTRIBUTION_THRESHOLD: 30,
  },

  /**
   * Spoofing detection confidence
   */
  SPOOFING: {
    /** Confidence score when spoofing is detected */
    DETECTION_CONFIDENCE: 75,
  },

  /**
   * Memory management limits
   */
  LIMITS: {
    /** Maximum number of ticks to keep in buffer */
    MAX_TICK_BUFFER_SIZE: 10000,
    /** Maximum number of orderbook snapshots to store */
    MAX_ORDERBOOK_HISTORY: 100,
  },
} as const;

// =============================================================================
// LIQUIDITY HEATMAP SERVICE CONSTANTS
// =============================================================================

export const LIQUIDITY_HEATMAP = {
  /**
   * Zone strength calculation
   */
  STRENGTH: {
    /** Multiplier for order cluster bonus (per order) */
    CLUSTER_BONUS_MULTIPLIER: 0.5,
    /** Maximum bonus from order clustering */
    MAX_CLUSTER_BONUS: 30,
    /** Penalty per level of distance from best price */
    DISTANCE_PENALTY_PER_LEVEL: 0.3,
    /** Threshold below which zone is considered neutral */
    NEUTRAL_ZONE_THRESHOLD: 35,
  },

  /**
   * Spread and cost estimation
   */
  SPREAD: {
    /** Spread value (in BPS) indicating very wide/illiquid market */
    VERY_WIDE_SPREAD_BPS: 10000,
  },

  /**
   * Data quality validation
   */
  QUALITY: {
    /** Maximum allowed corrupt data ratio before throwing error */
    CORRUPT_DATA_THRESHOLD: 0.5, // 50%
  },
} as const;

// =============================================================================
// SMART ORDER PLACEMENT SERVICE CONSTANTS
// =============================================================================

export const SMART_ORDER_PLACEMENT = {
  /**
   * Order splitting configuration
   */
  SPLITTING: {
    /** Maximum number of splits to avoid over-fragmentation */
    MAX_SPLITS: 5,
  },

  /**
   * Improvement estimation (when splitting large orders)
   */
  IMPROVEMENT: {
    /** Maximum slippage reduction from splitting (BPS) */
    MAX_SLIPPAGE_REDUCTION_BPS: 50,
    /** Maximum fill probability increase from splitting (%) */
    MAX_FILL_PROBABILITY_INCREASE: 20,
    /** Maximum market impact reduction from splitting (%) */
    MAX_IMPACT_REDUCTION: 30,
  },

  /**
   * Liquidity scoring
   */
  LIQUIDITY: {
    /** Penalty points per level of depth from best price */
    DEPTH_PENALTY_PER_LEVEL: 2,
  },

  /**
   * Priority determination thresholds
   */
  PRIORITY: {
    /** Fill probability threshold for patient execution */
    PATIENT_THRESHOLD: 80,
    /** Fill probability threshold for immediate execution */
    IMMEDIATE_THRESHOLD: 50,
  },

  /**
   * Risk assessment multipliers
   */
  RISK: {
    /** Slippage multiplier for high risk classification */
    HIGH_RISK_SLIPPAGE_MULTIPLIER: 1.5,
    /** Fill probability multiplier for high risk classification */
    HIGH_RISK_FILL_MULTIPLIER: 0.7,
  },

  /**
   * Fill probability weights (must sum to 1.0)
   */
  FILL_PROBABILITY_WEIGHTS: {
    /** Weight for liquidity factor */
    LIQUIDITY: 0.4,
    /** Weight for price aggressiveness factor */
    AGGRESSIVENESS: 0.2,
    /** Weight for volatility factor */
    VOLATILITY: 0.2,
    /** Weight for size impact factor */
    SIZE_IMPACT: 0.2,
  },
} as const;

// =============================================================================
// ML SIGNAL VALIDATOR SERVICE CONSTANTS
// =============================================================================

export const ML_SIGNAL_VALIDATOR = {
  /**
   * Confidence thresholds for recommended actions
   */
  ACTION: {
    /** Confidence threshold for strong buy/sell signals */
    STRONG_ACTION_THRESHOLD: 80,
    /** Confidence threshold for buy/sell signals */
    ACTION_THRESHOLD: 60,
  },

  /**
   * Risk level thresholds
   */
  RISK: {
    /** Confidence threshold for low risk classification */
    LOW_RISK_CONFIDENCE: 70,
    /** Confidence threshold for medium risk classification */
    MEDIUM_RISK_CONFIDENCE: 50,
    /** Volatility multiplier for risk assessment */
    VOLATILITY_MULTIPLIER: 1.5,
  },

  /**
   * Regime alignment multipliers
   */
  REGIME: {
    /** Confidence boost when signal matches regime */
    MATCH_BOOST: 1.2,
    /** Confidence boost during regime transitions */
    TRANSITION_BOOST: 1.1,
  },

  /**
   * Quality scoring weights
   */
  QUALITY_WEIGHTS: {
    /** Weight for historical performance */
    PERFORMANCE: 30,
    /** Center offset for performance score */
    PERFORMANCE_CENTER: 15,
    /** Weight for signal confidence */
    CONFIDENCE: 25,
    /** Center offset for confidence score */
    CONFIDENCE_CENTER: 12.5,
    /** Weight for regime alignment */
    REGIME: 25,
    /** Weight for risk/reward ratio */
    RISK_REWARD: 20,
  },
} as const;

// =============================================================================
// PATTERN RECOGNITION SERVICE CONSTANTS
// =============================================================================

export const PATTERN_RECOGNITION = {
  /**
   * Candlestick pattern thresholds
   */
  PATTERN: {
    /** Minimum lower shadow ratio for hammer pattern */
    HAMMER_LOWER_SHADOW_RATIO: 0.6,
    /** Maximum upper shadow ratio for hammer pattern */
    HAMMER_UPPER_SHADOW_MAX_RATIO: 0.3,
  },

  /**
   * Support/Resistance detection
   */
  SUPPORT_RESISTANCE: {
    /** Maximum distance from S/R level for detection (ratio) */
    DISTANCE_THRESHOLD: 0.2,
    /** Strength bonus when near support/resistance */
    LEVEL_BONUS: 10,
  },

  /**
   * Fibonacci level configuration
   */
  FIBONACCI: {
    /** Maximum distance from price for level testing (ratio) */
    TEST_THRESHOLD: 0.005, // 0.5%
    /** Strength scores for key fibonacci levels */
    LEVEL_STRENGTHS: {
      50: 90,
      61.8: 85,
      38.2: 80,
      23.6: 70,
      78.6: 70,
      100: 75,
      0: 65,
      161.8: 80,
      261.8: 75,
    } as Record<number, number>,
  },

  /**
   * Swing point detection
   */
  SWING: {
    /** Lookback period for swing confirmation (candles) */
    LOOKBACK_PERIOD: 5,
  },

  /**
   * Zone touch analysis
   */
  ZONE_TOUCHES: {
    /** Touch count threshold for maximum strength bonus */
    HIGH_TOUCH_THRESHOLD: 5,
    /** Strength bonus for high touch count */
    HIGH_TOUCH_BONUS: 30,
    /** Touch count threshold for medium strength bonus */
    MEDIUM_TOUCH_THRESHOLD: 3,
    /** Strength bonus for medium touch count */
    MEDIUM_TOUCH_BONUS: 20,
  },

  /**
   * Pattern confirmation
   */
  CONFIRMATION: {
    /** Reliability bonus when pattern is confirmed */
    BONUS: 15,
  },
} as const;

// =============================================================================
// ANOMALY DETECTION SERVICE CONSTANTS
// =============================================================================

export const ANOMALY_DETECTION = {
  /**
   * Z-score thresholds for severity classification
   */
  Z_SCORE: {
    /** Z-score threshold for critical severity */
    CRITICAL: 4.0,
    /** Z-score threshold for high severity */
    HIGH: 3.5,
    /** Z-score threshold for medium severity */
    MEDIUM: 3.0,
  },

  /**
   * Whale activity detection
   */
  WHALE: {
    /** Trade size ratio threshold for accumulation/distribution */
    ACCUMULATION_RATIO_THRESHOLD: 2.0,
  },

  /**
   * Market manipulation detection
   */
  MANIPULATION: {
    /** Similarity threshold for wash trading detection (ratio) */
    WASH_TRADING_SIMILARITY: 0.7,
    /** Price decrease threshold for pump & dump detection (ratio) */
    PUMP_DUMP_DECREASE: 0.08,
    /** Minimum number of trades for manipulation detection */
    MIN_TRADES: 5,
    /** Minimum volume history samples for detection */
    MIN_VOLUME_HISTORY: 10,
  },

  /**
   * Severity ratio thresholds
   */
  SEVERITY_RATIOS: {
    /** Ratio threshold for critical severity */
    CRITICAL: 20,
    /** Ratio threshold for high severity */
    HIGH: 10,
    /** Ratio threshold for medium severity */
    MEDIUM: 5,
  },

  /**
   * Manipulation likelihood weights
   */
  LIKELIHOOD_WEIGHTS: {
    /** Likelihood increase for wash trading evidence */
    WASH_TRADING: 30,
    /** Likelihood increase for pump & dump evidence */
    PUMP_DUMP: 40,
  },
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

/**
 * Type-safe access to all Phase 10 constants
 */
export type Phase10Constants = {
  ADVANCED_ORDER_FLOW: typeof ADVANCED_ORDER_FLOW;
  LIQUIDITY_HEATMAP: typeof LIQUIDITY_HEATMAP;
  SMART_ORDER_PLACEMENT: typeof SMART_ORDER_PLACEMENT;
  ML_SIGNAL_VALIDATOR: typeof ML_SIGNAL_VALIDATOR;
  PATTERN_RECOGNITION: typeof PATTERN_RECOGNITION;
  ANOMALY_DETECTION: typeof ANOMALY_DETECTION;
};
