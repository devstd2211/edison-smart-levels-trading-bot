/**
 * Phase 10 Constants - TECHNICAL ONLY
 *
 * Strategic parameters have been moved to config.json (see config sections):
 * - orderFlowAnalysis: Momentum and pattern detection thresholds
 * - liquidityAnalysis: Zone classification
 * - smartOrderPlacement: Execution strategy selection
 * - signalValidation: ML-based confidence thresholds
 * - patternRecognition: Candlestick pattern and zone detection
 * - anomalyDetection: Statistical anomaly and manipulation detection
 *
 * This file contains ONLY technical constants (internal limits, formulas, weights)
 * that are not intended to be configurable by end users.
 */

import type {
  OrderFlowAnalysisConfig,
  LiquidityAnalysisConfig,
  SmartOrderPlacementConfig,
  SignalValidationConfig,
  PatternRecognitionStrategicConfig,
  AnomalyDetectionStrategicConfig,
} from '../types';

// =============================================================================
// DEFAULT VALUES (used when config not provided)
// =============================================================================

export const DEFAULT_ORDER_FLOW_ANALYSIS: OrderFlowAnalysisConfig = {
  momentumLongThreshold: 20,
  momentumShortThreshold: -20,
  accumulationThreshold: 65,
  distributionThreshold: 30,
  spoofingConfidence: 75,
};

export const DEFAULT_LIQUIDITY_ANALYSIS: LiquidityAnalysisConfig = {
  neutralZoneThreshold: 35,
};

export const DEFAULT_SMART_ORDER_PLACEMENT: SmartOrderPlacementConfig = {
  patientThreshold: 80,
  immediateThreshold: 50,
  highRiskSlippageMultiplier: 1.5,
  highRiskFillMultiplier: 0.7,
};

export const DEFAULT_SIGNAL_VALIDATION: SignalValidationConfig = {
  strongActionThreshold: 80,
  actionThreshold: 60,
  lowRiskConfidence: 70,
  mediumRiskConfidence: 50,
  volatilityMultiplier: 1.5,
};

export const DEFAULT_PATTERN_RECOGNITION: PatternRecognitionStrategicConfig = {
  supportResistanceDistance: 0.2,
  fibonacciTestThreshold: 0.005,
  highTouchThreshold: 5,
  mediumTouchThreshold: 3,
};

export const DEFAULT_ANOMALY_DETECTION: AnomalyDetectionStrategicConfig = {
  zScoreCritical: 4.0,
  zScoreHigh: 3.5,
  zScoreMedium: 3.0,
  whaleAccumulationRatio: 2.0,
  washTradingSimilarity: 0.7,
  pumpDumpDecrease: 0.08,
};

// =============================================================================
// TECHNICAL CONSTANTS (internal limits and formulas)
// =============================================================================

/**
 * Advanced Order Flow Service - Technical Constants
 * Internal memory limits and buffer management
 */
export const ADVANCED_ORDER_FLOW_TECHNICAL = {
  /**
   * Memory management limits
   */
  LIMITS: {
    /** Maximum number of ticks to keep in buffer (prevents memory leak) */
    MAX_TICK_BUFFER_SIZE: 10000,
    /** Maximum number of orderbook snapshots to store */
    MAX_ORDERBOOK_HISTORY: 100,
  },
} as const;

/**
 * Liquidity Heatmap Service - Technical Constants
 * Internal formulas for strength calculation and data validation
 */
export const LIQUIDITY_HEATMAP_TECHNICAL = {
  /**
   * Zone strength calculation formulas
   */
  STRENGTH: {
    /** Multiplier for order cluster bonus (per order) - internal formula */
    CLUSTER_BONUS_MULTIPLIER: 0.5,
    /** Maximum bonus from order clustering - prevents overflow */
    MAX_CLUSTER_BONUS: 30,
    /** Penalty per level of distance from best price - decay formula */
    DISTANCE_PENALTY_PER_LEVEL: 0.3,
  },

  /**
   * Spread and cost estimation
   */
  SPREAD: {
    /** Spread value (in BPS) indicating very wide/illiquid market - error fallback */
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

/**
 * Smart Order Placement Service - Technical Constants
 * Internal limits and formula weights
 */
export const SMART_ORDER_PLACEMENT_TECHNICAL = {
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
    /** Maximum slippage reduction from splitting (BPS) - calculation cap */
    MAX_SLIPPAGE_REDUCTION_BPS: 50,
    /** Maximum fill probability increase from splitting (%) - calculation cap */
    MAX_FILL_PROBABILITY_INCREASE: 20,
    /** Maximum market impact reduction from splitting (%) - calculation cap */
    MAX_IMPACT_REDUCTION: 30,
  },

  /**
   * Liquidity scoring
   */
  LIQUIDITY: {
    /** Penalty points per level of depth from best price - scoring formula */
    DEPTH_PENALTY_PER_LEVEL: 2,
  },

  /**
   * Fill probability weights (must sum to 1.0)
   * Internal ML model weights - not user-configurable
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

/**
 * ML Signal Validator Service - Technical Constants
 * Internal formula weights and boost multipliers
 */
export const ML_SIGNAL_VALIDATOR_TECHNICAL = {
  /**
   * Regime alignment multipliers - internal confidence boost formulas
   */
  REGIME: {
    /** Confidence boost when signal matches regime - multiplicative formula */
    MATCH_BOOST: 1.2,
    /** Confidence boost during regime transitions - multiplicative formula */
    TRANSITION_BOOST: 1.1,
  },

  /**
   * Quality scoring weights (must sum to 100)
   * Internal ML model weights - not user-configurable
   */
  QUALITY_WEIGHTS: {
    /** Weight for historical performance */
    PERFORMANCE: 30,
    /** Center offset for performance score - normalization constant */
    PERFORMANCE_CENTER: 15,
    /** Weight for signal confidence */
    CONFIDENCE: 25,
    /** Center offset for confidence score - normalization constant */
    CONFIDENCE_CENTER: 12.5,
    /** Weight for regime alignment */
    REGIME: 25,
    /** Weight for risk/reward ratio */
    RISK_REWARD: 20,
  },
} as const;

/**
 * Pattern Recognition Service - Technical Constants
 * Internal pattern definitions and formula weights
 */
export const PATTERN_RECOGNITION_TECHNICAL = {
  /**
   * Candlestick pattern mathematical definitions
   */
  PATTERN: {
    /** Minimum lower shadow ratio for hammer pattern - mathematical definition */
    HAMMER_LOWER_SHADOW_RATIO: 0.6,
    /** Maximum upper shadow ratio for hammer pattern - mathematical definition */
    HAMMER_UPPER_SHADOW_MAX_RATIO: 0.3,
  },

  /**
   * Support/Resistance calculation
   */
  SUPPORT_RESISTANCE: {
    /** Strength bonus when near support/resistance - internal formula */
    LEVEL_BONUS: 10,
  },

  /**
   * Fibonacci level configuration
   */
  FIBONACCI: {
    /** Strength scores for key fibonacci levels - mathematical constants */
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
    /** Lookback period for swing confirmation (candles) - algorithm parameter */
    LOOKBACK_PERIOD: 5,
  },

  /**
   * Zone touch analysis - internal strength bonuses
   */
  ZONE_TOUCHES: {
    /** Strength bonus for high touch count - internal formula */
    HIGH_TOUCH_BONUS: 30,
    /** Strength bonus for medium touch count - internal formula */
    MEDIUM_TOUCH_BONUS: 20,
  },

  /**
   * Pattern confirmation
   */
  CONFIRMATION: {
    /** Reliability bonus when pattern is confirmed - internal formula */
    BONUS: 15,
  },
} as const;

/**
 * Anomaly Detection Service - Technical Constants
 * Internal statistical analysis limits and formula weights
 */
export const ANOMALY_DETECTION_TECHNICAL = {
  /**
   * Market manipulation detection - minimum sample sizes
   */
  MANIPULATION: {
    /** Minimum number of trades for statistical analysis */
    MIN_TRADES: 5,
    /** Minimum volume history samples for detection */
    MIN_VOLUME_HISTORY: 10,
  },

  /**
   * Severity ratio thresholds - internal severity mapping formulas
   */
  SEVERITY_RATIOS: {
    /** Ratio threshold for critical severity - calculation formula */
    CRITICAL: 20,
    /** Ratio threshold for high severity - calculation formula */
    HIGH: 10,
    /** Ratio threshold for medium severity - calculation formula */
    MEDIUM: 5,
  },

  /**
   * Manipulation likelihood weights - internal scoring formula
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
 * Type-safe access to all Phase 10 technical constants
 */
export type Phase10TechnicalConstants = {
  ADVANCED_ORDER_FLOW_TECHNICAL: typeof ADVANCED_ORDER_FLOW_TECHNICAL;
  LIQUIDITY_HEATMAP_TECHNICAL: typeof LIQUIDITY_HEATMAP_TECHNICAL;
  SMART_ORDER_PLACEMENT_TECHNICAL: typeof SMART_ORDER_PLACEMENT_TECHNICAL;
  ML_SIGNAL_VALIDATOR_TECHNICAL: typeof ML_SIGNAL_VALIDATOR_TECHNICAL;
  PATTERN_RECOGNITION_TECHNICAL: typeof PATTERN_RECOGNITION_TECHNICAL;
  ANOMALY_DETECTION_TECHNICAL: typeof ANOMALY_DETECTION_TECHNICAL;
};
