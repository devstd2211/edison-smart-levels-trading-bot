/**
 * Edison Trading Bot - Core Types
 * Fundamental types used throughout the codebase
 */

import {
  SignalDirection,
  PositionSide,
  BTCDirection,
} from './enums';
import type { TakeProfit, StopLossConfig, Position } from './position';

// ============================================================================
// CANDLE DATA
// ============================================================================

/**
 * Single candle (OHLCV)
 */
export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}


// ============================================================================
// BTC CORRELATION & ANALYSIS
// ============================================================================

/**
 * Correlation result for BTC-altcoin analysis
 */
export interface CorrelationResult {
  coefficient: number; // Pearson correlation coefficient (-1 to 1)
  strength: 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE'; // Correlation strength
  filterStrength: 'STRICT' | 'MODERATE' | 'WEAK' | 'SKIP'; // Recommended filter strength
  sampleSize: number; // Number of data points used
  btcVolatility: number; // BTC price volatility (%)
  altVolatility: number; // Altcoin price volatility (%)
}

/**
 * BTC analysis result
 * Analyzes Bitcoin price movement to confirm altcoin signals
 */
export interface BTCAnalysis {
  direction: BTCDirection; // BTC direction (UP/DOWN/NEUTRAL)
  momentum: number; // 0-1 (strength of movement)
  priceChange: number; // % change over lookback period
  consecutiveMoves: number; // Number of consecutive candles in same direction
  volumeRatio: number; // Current volume vs average
  isAligned: boolean; // Whether BTC supports the signal direction
  reason: string; // Human-readable explanation
  correlation?: CorrelationResult; // Correlation with altcoin (if enabled)
}


// Signal moved to ./types/signal
// ============================================================================
// AGGREGATED SIGNAL (from StrategyCoordinator)
// ============================================================================

/**
 * Aggregated signal from StrategyCoordinator
 * Result of combining all analyzer signals with strategy weights
 */
export interface AggregatedSignal {
  direction: SignalDirection | null; // LONG, SHORT, or null if no signal
  confidence: number; // 0-1, confidence in signal
  totalScore: number; // 0-1, weighted score
  signalCount: number; // number of contributing analyzers
  analyzers: {
    name: string;
    direction: SignalDirection;
    confidence: number;
  }[];
  appliedPenalty: number; // blind zone penalty applied (0.0-1.0)
  reason: string; // human-readable explanation
  timestamp: number; // when signal was generated
}
