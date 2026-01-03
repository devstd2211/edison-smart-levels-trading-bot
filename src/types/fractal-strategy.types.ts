/**
 * Fractal Breakout-Retest Strategy Types
 *
 * Comprehensive type definitions for the Fractal Breakout-Retest strategy.
 * All constants are in config files, NO hardcoded values here.
 */

import { SignalDirection } from '../types';

// ============================================================================
// ENUMS (FRACTAL-SPECIFIC)
// ============================================================================

/**
 * Fractal strategy state machine
 * Tracks progression through: IDLE → BREAKOUT → RETEST → REVERSAL → ENTRY
 */
export enum FractalState {
  IDLE = 'IDLE',                          // Waiting for setup
  BREAKOUT_DETECTED = 'BREAKOUT_DETECTED', // Breakout detected
  RETEST_ZONE = 'RETEST_ZONE',           // In retest phase
  REVERSAL_SIGNAL = 'REVERSAL_SIGNAL',   // Reversal confirmed
  POSITION_OPEN = 'POSITION_OPEN',       // Position opened
  TIMEOUT = 'TIMEOUT',                    // Setup timed out
  CANCELLED = 'CANCELLED',                // Setup cancelled
}

/**
 * Market health status
 */
export enum MarketHealthStatus {
  HEALTHY = 'HEALTHY',     // Win rate > 40%, PF > 1.2, healthy condition
  CAUTION = 'CAUTION',     // Degraded condition, reduce position size
  BROKEN = 'BROKEN',       // Win rate < 30%, PF < 0.9, stop trading
}

/**
 * Weighted signal confidence level
 */
export enum ConfidenceLevel {
  LOW = 'LOW',       // Score < 70 (not tradable)
  MEDIUM = 'MEDIUM', // Score 70-90 (75% position size)
  HIGH = 'HIGH',     // Score 90+ (100% position size)
}

// ============================================================================
// INTERFACES - CONFIGURATION
// ============================================================================

/**
 * Daily Level Tracker configuration
 * All thresholds and parameters should be in config.json
 */
export interface DailyLevelConfig {
  lookbackPeriod: number;        // Days to look back for Daily High/Low
  retestThreshold: number;       // Retest zone threshold (0.99 = 99% of level)
  minBreakoutStrength: number;   // Minimum breakout strength (0.002 = 0.2%)
  retestTimeoutBars: number;     // Retest timeout in 5m bars
  minVolumeRatio?: number;       // Minimum volume ratio (default: 1.0 = average volume)
}

/**
 * Entry Refinement configuration (1-minute confirmation parameters)
 */
export interface EntryRefinementConfig {
  minVolumeConfirmationRatio: number;     // Volume must be >= this % of average
  pinBarBodyRatioThreshold: number;       // Body ratio threshold for pin bar detection
  wickRatioThreshold: number;             // Wick ratio threshold for pin bar/hammer
  structureAlignmentMargin: number;       // Margin for structure alignment check (e.g., 0.95 = 5%)
  volatilityCheckRatio: number;           // Minimum volatility check ratio
  strongCandleBodyRatio: number;          // Minimum body ratio for strong candles (e.g., 0.6 = 60%)
  minConditionsToConfirm: number;         // Minimum conditions needed for entry confirmation
  localHighLowBars: number;               // Number of bars to check for local high/low
}

/**
 * Fractal Strategy configuration
 */
export interface FractalStrategyConfig {
  enabled: boolean;
  priority: number;
  dailyLevelConfig: DailyLevelConfig;
  entryRefinementConfig: EntryRefinementConfig;
  rrRatio: {
    tp1: number;                 // First take profit ratio (e.g., 2.0 = 2:1)
    tp2: number;                 // Second take profit ratio
    tp3: number;                 // Third take profit ratio
  };
  minCombinedScore: number;      // Minimum weighted score to enter (70)
  highConfidenceThreshold: number; // High confidence threshold (90)
  positionSizing: {
    low: number;                 // Low confidence position size (0.5)
    medium: number;              // Medium confidence position size (0.75)
    high: number;                // High confidence position size (1.0)
  };
}

/**
 * Market Health Monitor configuration
 */
export interface MarketHealthConfig {
  enabled: boolean;
  minWinRate: number;            // Minimum win rate to stay HEALTHY
  minProfitFactor: number;       // Minimum profit factor
  maxConsecutiveLosses: number;  // Max consecutive losses before CAUTION
  maxDrawdown: number;           // Max drawdown before CAUTION
}

/**
 * Weighted Signal configuration
 */
export interface WeightedSignalConfig {
  threshold: number;             // Minimum score to trade (70)
  highConfidenceThreshold: number; // Score for HIGH confidence (90)
  maxFractalScore: number;       // Max Fractal score (125)
  maxSmcScore: number;           // Max SMC score (110)
}

// ============================================================================
// INTERFACES - MARKET DATA
// ============================================================================

/**
 * Daily High/Low levels
 */
export interface DailyLevel {
  high: number;
  low: number;
  timestamp: number;
  source: 'daily' | '5m_aggregated' | '5m_local'; // Data source
}

/**
 * Breakout information
 */
export interface BreakoutInfo {
  direction: SignalDirection;
  price: number;
  timestamp: number;
  volume: number;
  volumeRatio: number;           // Ratio to average volume
  strength: number;              // Percentage beyond level
  confirmedByClose: boolean;
}

/**
 * Local high/low information for stop loss
 */
export interface LocalHighLow {
  high: number;
  low: number;
  bars: number;                  // Number of bars used
}

/**
 * Retest zone information
 */
export interface RetestInfo {
  entryPrice: number;            // Entry price in retest zone
  timestamp: number;
  touchCount: number;            // Number of zone touches
  isSecondTouch: boolean;        // True if 2+ touches
  localHighLow: LocalHighLow;    // For tight stop loss
}

/**
 * Reversal confirmation details
 */
export interface ReversalConfirmation {
  confirmationBars: number;
  priceActionPattern?: string; // 'engulfing', 'pin_bar', 'hammer'
  volumeConfirmed: boolean;
  structureAligned: boolean;   // 1m structure aligned with 5m
  volatilityOk: boolean;       // Not sideways
  strongCandleBody: boolean;   // Body >= 60%
}

/**
 * Complete fractal setup state
 */
export interface FractalSetup {
  id: string;
  direction: SignalDirection;
  state: FractalState;
  dailyLevel: DailyLevel;
  breakout?: BreakoutInfo;
  retest?: RetestInfo;
  reversal?: ReversalConfirmation;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;            // Timeout timestamp
}

// ============================================================================
// INTERFACES - WEIGHTED SCORING
// ============================================================================

/**
 * Fractal-specific score weight
 */
export interface ScoreWeight {
  base: number;                  // Base points
  weight: number;                // Weight multiplier
}

/**
 * Weighted signal result
 */
export interface WeightedSignal {
  fractalScore: number;          // Fractal component (0-125)
  smcScore: number;              // SMC component (0-110)
  combinedScore: number;         // Total (0-220)
  threshold: number;             // Minimum threshold (70)
  passesThreshold: boolean;
  confidence: ConfidenceLevel;
  positionSize: number;          // 0.5, 0.75, or 1.0
  reasoning: string[];           // Score breakdown explanation
}

// ============================================================================
// INTERFACES - MARKET HEALTH
// ============================================================================

/**
 * Trade record for health monitoring
 */
export interface Trade {
  pnl: number;                   // Profit/Loss in USDT
  riskAmount: number;
  rewardAmount: number;
  timestamp: number;
}

/**
 * Market health status result
 */
export interface MarketHealthResult {
  status: MarketHealthStatus;
  winRate: number;               // 0-1
  profitFactor: number;          // Gross profit / Gross loss
  consecutiveLosses: number;
  maxDrawdown?: number;
  message: string;
  positionSizeMultiplier: number; // 0 (stop), 0.5 (caution), 1.0 (healthy)
}

// ============================================================================
// INTERFACES - ANALYSIS RESULTS
// ============================================================================

/**
 * Daily level analysis result
 */
export interface DailyLevelAnalysis {
  dailyLevel: DailyLevel;
  isBreakoutPossible: boolean;   // Are candles present?
  lastBreakoutTime?: number;     // When last breakout detected
}

/**
 * Breakout detection result
 */
export interface BreakoutDetectionResult {
  detected: boolean;
  breakout?: BreakoutInfo;
  reason?: string;
}

/**
 * Retest phase analysis result
 */
export interface RetestPhaseResult {
  inRetestZone: boolean;
  retestInfo?: RetestInfo;
  timedOut: boolean;
  reason?: string;
}

/**
 * Entry refinement result
 */
export interface EntryRefinementResult {
  confirmed: boolean;
  reversal?: ReversalConfirmation;
  conditionsMet: number;         // How many conditions passed
  reason?: string;
}

// ============================================================================
// CONFIGURATION VALIDATION
// ============================================================================

/**
 * Validated configuration - ensures all required fields are present
 */
export interface ValidatedFractalConfig extends FractalStrategyConfig {
  // All fields required (no optionals)
  enabled: true;
  priority: number & { readonly __brand: 'priority' };
  dailyLevelConfig: Required<DailyLevelConfig>;
  rrRatio: Required<FractalStrategyConfig['rrRatio']>;
  minCombinedScore: number;
  highConfidenceThreshold: number;
  positionSizing: Required<FractalStrategyConfig['positionSizing']>;
}
