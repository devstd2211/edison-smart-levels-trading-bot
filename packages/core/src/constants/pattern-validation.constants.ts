/**
 * Pattern Validation System - Constants
 *
 * All default thresholds and configuration values for pattern validation.
 * These can be overridden in config.json per pattern or globally.
 */

// ============================================================================
// Walk-Forward Validation Split
// ============================================================================

export const WALK_FORWARD_CONFIG = {
  TOTAL_PERIOD_DAYS: 90,
  TRAIN_PERCENT: 70, // 63 days
  TEST_PERCENT: 30, // 27 days
};

// ============================================================================
// Statistical Thresholds
// ============================================================================

export const STATISTICAL_THRESHOLDS = {
  // Win rate thresholds
  MIN_TRAIN_WIN_RATE: 50, // %
  MIN_TEST_WIN_RATE: 45, // % (more conservative for out-of-sample)
  CRITICAL_WIN_RATE: 40, // % - triggers auto-disable

  // Expectancy threshold
  MIN_EXPECTANCY: 0.0,

  // Statistical significance
  MIN_P_VALUE: 0.05, // Chi-square test

  // Overfitting detection
  MAX_OVERFITTING_GAP: 10, // % - warn if |trainWR - testWR| > this
};

// ============================================================================
// Sample Size Requirements
// ============================================================================

export const SAMPLE_SIZE_CONFIG = {
  MIN_OCCURRENCES_PER_SPLIT: 30, // Minimum trades per TRAIN/TEST split
};

// ============================================================================
// Pattern Types (14 supported patterns)
// ============================================================================

export const PATTERN_TYPES = {
  // 1. Fractal patterns
  BULLISH_FRACTAL: 'BULLISH_FRACTAL',
  BEARISH_FRACTAL: 'BEARISH_FRACTAL',

  // 2. Engulfing patterns
  BULLISH_ENGULFING: 'BULLISH_ENGULFING',
  BEARISH_ENGULFING: 'BEARISH_ENGULFING',

  // 3. Head & Shoulders
  HEAD_AND_SHOULDERS: 'HEAD_AND_SHOULDERS',
  INVERSE_HEAD_AND_SHOULDERS: 'INVERSE_HEAD_AND_SHOULDERS',

  // 4. Double patterns
  DOUBLE_TOP: 'DOUBLE_TOP',
  DOUBLE_BOTTOM: 'DOUBLE_BOTTOM',

  // 5. Triangle patterns
  ASCENDING_TRIANGLE: 'ASCENDING_TRIANGLE',
  DESCENDING_TRIANGLE: 'DESCENDING_TRIANGLE',
  SYMMETRICAL_TRIANGLE: 'SYMMETRICAL_TRIANGLE',

  // 6. Wedge patterns
  RISING_WEDGE: 'RISING_WEDGE',
  FALLING_WEDGE: 'FALLING_WEDGE',

  // 7. Flag/Pennant
  FLAG: 'FLAG',
} as const;

// ============================================================================
// Timeframes for Multi-TF Analysis
// ============================================================================

export const ANALYSIS_TIMEFRAMES = ['1m', '5m', '15m'] as const;

// ============================================================================
// Default Pattern Weights (after validation)
// ============================================================================

export const DEFAULT_PATTERN_WEIGHTS = {
  // High-confidence patterns (70%+ WR)
  HIGH_CONFIDENCE: 0.4,

  // Medium-confidence patterns (50-70% WR)
  MEDIUM_CONFIDENCE: 0.2,

  // Low-confidence patterns (45-50% WR)
  LOW_CONFIDENCE: 0.1,

  // Disabled patterns (< 45% WR)
  DISABLED: 0.0,
};

// ============================================================================
// Bootstrap Statistics Configuration
// ============================================================================

export const BOOTSTRAP_CONFIG = {
  ITERATIONS: 10000, // Number of bootstrap samples
  CONFIDENCE_LEVEL: 95, // % confidence interval
};

// ============================================================================
// Degradation Thresholds
// ============================================================================

export const DEGRADATION_THRESHOLDS = {
  // Critical: Test WR drops below this
  CRITICAL: {
    WIN_RATE_THRESHOLD: 40, // %
    EXPECTANCY_THRESHOLD: -0.2,
  },

  // Warning: Test WR drops or overfitting detected
  WARNING: {
    WIN_RATE_THRESHOLD: 45, // %
    OVERFITTING_GAP_THRESHOLD: 10, // %
  },
};

// ============================================================================
// Market Regime Detection
// ============================================================================

export const MARKET_REGIMES = {
  TREND: 'TREND',
  FLAT: 'FLAT',
  VOLATILE: 'VOLATILE',
} as const;

// ============================================================================
// BTC Context Categories
// ============================================================================

export const BTC_CONTEXT = {
  ALIGNED: 'aligned',
  OPPOSED: 'opposed',
} as const;

// ============================================================================
// Default Validation Config
// ============================================================================

export const DEFAULT_PATTERN_VALIDATION_CONFIG = {
  enabled: true,
  dataSource: 'BACKTEST' as const,
  minSampleSize: 30,
  backtestPeriodDays: 90,

  trainTestSplit: {
    trainPercent: 70,
    testPercent: 30,
  },

  thresholds: {
    minWinRate: STATISTICAL_THRESHOLDS.MIN_TRAIN_WIN_RATE,
    minTestWinRate: STATISTICAL_THRESHOLDS.MIN_TEST_WIN_RATE,
    minExpectancy: STATISTICAL_THRESHOLDS.MIN_EXPECTANCY,
    criticalWinRate: STATISTICAL_THRESHOLDS.CRITICAL_WIN_RATE,
    minPValue: STATISTICAL_THRESHOLDS.MIN_P_VALUE,
    maxOverfittingGap: STATISTICAL_THRESHOLDS.MAX_OVERFITTING_GAP,
  },

  autoValidationInterval: 'WEEKLY' as const,
  autoDisableDegraded: true,
  autoAdjustWeights: true,
  timeframes: ANALYSIS_TIMEFRAMES,
  includeBtcContext: true,
};

// ============================================================================
// Report Configuration
// ============================================================================

export const REPORT_CONFIG = {
  OUTPUT_DIR: 'data/pattern-validation',
  OCCURRENCES_SUBDIR: 'occurrences',
  VALIDATION_RESULTS_SUBDIR: 'validation-results',
  REPORTS_SUBDIR: 'reports',
};
