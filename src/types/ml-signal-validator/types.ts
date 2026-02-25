/**
 * ML-Based Signal Validation Interface
 * Phase 10.2.1
 *
 * Provides ML-based signal validation using historical accuracy,
 * market regime detection, and confidence scoring.
 */

import type { Signal } from '../core';
import { SignalType } from '../enums';

/**
 * Market regime types
 */
export type MarketRegime = 'trending_up' | 'trending_down' | 'range_bound' | 'volatile' | 'unknown';

/**
 * Recommended trading action
 */
export type RecommendedAction = 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';

/**
 * Risk level assessment
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Market context for signal validation
 */
export interface MarketContext {
  /** Current market regime */
  regime: MarketRegime;

  /** Current volatility (ATR ratio or similar) */
  volatility: number;

  /** Trend strength (-1 to 1, negative = downtrend, positive = uptrend) */
  trendStrength: number;

  /** Current price */
  currentPrice: number;

  /** Recent volume compared to average (1.0 = average) */
  volumeRatio: number;

  /** Timestamp of context */
  timestamp: number;
}

/**
 * Signal validation result
 */
export interface ValidationResult {
  /** Original signal confidence (0-100) */
  originalConfidence: number;

  /** ML-adjusted confidence (0-100) */
  adjustedConfidence: number;

  /** Recommended trading action */
  recommendedAction: RecommendedAction;

  /** Assessed risk level */
  riskLevel: RiskLevel;

  /** Expected win rate (0-100) based on historical data */
  expectedWinRate: number;

  /** Expected risk-reward ratio */
  expectedRR: number;

  /** Adjustment factors applied */
  adjustmentFactors?: {
    regimeAdjustment: number;
    timeDecay: number;
    winRateAdjustment: number;
    volatilityAdjustment: number;
  };
}

/**
 * Historical signal record for ML training
 */
export interface SignalRecord {
  /** Signal that was generated */
  signal: Signal;

  /** Market context at time of signal */
  context: MarketContext;

  /** Whether the signal was profitable */
  wasWinner: boolean;

  /** Actual profit/loss percentage */
  profitLoss: number;

  /** Actual risk-reward achieved */
  actualRR: number;

  /** How long the trade lasted (ms) */
  duration: number;

  /** Timestamp */
  timestamp: number;
}

/**
 * Signal type statistics
 */
export interface SignalTypeStats {
  /** Signal type */
  type: SignalType;

  /** Total signals of this type */
  totalSignals: number;

  /** Winning signals */
  winningSignals: number;

  /** Win rate (0-100) */
  winRate: number;

  /** Average RR */
  avgRR: number;

  /** Average profit per winner */
  avgProfit: number;

  /** Average loss per loser */
  avgLoss: number;

  /** Last updated timestamp */
  lastUpdated: number;
}

/**
 * Configuration for MLSignalValidatorService
 */
export interface MLSignalValidatorConfig {
  /** Minimum historical samples needed for ML validation (default: 30) */
  minHistoricalSamples: number;

  /** Time decay factor per hour (0-1, default: 0.95) */
  timeDecayFactor: number;

  /** Maximum age of signal to consider (ms, default: 24h) */
  maxSignalAge: number;

  /** Confidence boost for high win rate signals (default: 1.2) */
  highWinRateBoost: number;

  /** Confidence penalty for low win rate signals (default: 0.7) */
  lowWinRatePenalty: number;

  /** Win rate threshold for "high" (default: 60%) */
  highWinRateThreshold: number;

  /** Win rate threshold for "low" (default: 40%) */
  lowWinRateThreshold: number;

  /** Regime mismatch penalty (default: 0.8) */
  regimeMismatchPenalty: number;

  /** High volatility threshold (default: 1.5x average) */
  highVolatilityThreshold: number;

  /** Volatility penalty factor (default: 0.85) */
  volatilityPenalty: number;
}

/**
 * Default configuration
 */
export const DEFAULT_ML_SIGNAL_VALIDATOR_CONFIG: MLSignalValidatorConfig = {
  minHistoricalSamples: 30,
  timeDecayFactor: 0.95,
  maxSignalAge: 24 * 60 * 60 * 1000, // 24 hours
  highWinRateBoost: 1.2,
  lowWinRatePenalty: 0.7,
  highWinRateThreshold: 60,
  lowWinRateThreshold: 40,
  regimeMismatchPenalty: 0.8,
  highVolatilityThreshold: 1.5,
  volatilityPenalty: 0.85,
};
