/**
 * Advanced Order Flow Service Type Definitions (Phase 10.1)
 *
 * Types for tick-level order flow analysis with:
 * - Real-time imbalance calculation
 * - Execution pattern detection (accumulation/distribution/neutral)
 * - Spoofing detection
 * - Order flow momentum
 */

/**
 * Tick data structure
 */
export interface Tick {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Trade price in USDT */
  price: number;
  /** Trade size in base asset */
  size: number;
  /** Trade side: BUY or SELL */
  side: 'BUY' | 'SELL';
}

/**
 * Orderbook snapshot
 */
export interface OrderBook {
  /** Bids: [price, quantity] pairs, sorted descending by price */
  bids: [number, number][];
  /** Asks: [price, quantity] pairs, sorted ascending by price */
  asks: [number, number][];
}

/**
 * Configuration for AdvancedOrderFlowService
 */
export interface AdvancedOrderFlowConfig {
  /** Time window for tick analysis in milliseconds (default: 5000) */
  tickWindowMs: number;

  /** Number of orderbook levels to analyze (default: 10) */
  orderbookLevels: number;

  /** Imbalance threshold (0-1) for directional signal (default: 0.65) */
  imbalanceThreshold: number;

  /** Spoofing detection threshold - sudden volume change ratio (default: 3.0) */
  spoofingThreshold: number;

  /** Minimum volume in USDT to consider in analysis (default: 1000) */
  minVolumeUSDT: number;

  /** Maximum confidence score (default: 100) */
  maxConfidence: number;

  /** Enable spoofing detection (default: true) */
  enableSpoofingDetection: boolean;

  /** Enable momentum calculation (default: true) */
  enableMomentum: boolean;
}

/**
 * Imbalance metric
 */
export interface ImbalanceMetric {
  /** Total buy volume in analysis window */
  buyVolume: number;
  /** Total sell volume in analysis window */
  sellVolume: number;
  /** Imbalance ratio: (buy - sell) / total, range [-1, 1] */
  value: number;
  /** Confidence in imbalance (0-100) */
  confidence: number;
}

/**
 * Pattern detection result
 */
export interface PatternMetric {
  /** Pattern type */
  pattern: 'accumulation' | 'distribution' | 'neutral';
  /** Confidence in pattern detection (0-100) */
  confidence: number;
  /** Buy pressure component (0-100) */
  buyPressure: number;
  /** Sell pressure component (0-100) */
  sellPressure: number;
  /** Duration of pattern in milliseconds */
  duration: number;
}

/**
 * Spoofing detection signal
 */
export interface SpoofingMetric {
  /** Whether spoofing was detected */
  detected: boolean;
  /** Side of suspicious activity: BUY or SELL */
  side?: 'BUY' | 'SELL';
  /** Price level where spoofing detected */
  suspiciousLevel?: number;
  /** Ratio of volume change (e.g., 3.5x = 350% increase) */
  volumeChange?: number;
  /** Confidence in spoofing detection (0-100) */
  confidence: number;
}

/**
 * Momentum metric
 */
export interface MomentumMetric {
  /** Momentum value in range [-100, 100] */
  value: number;
  /** Direction: LONG (positive momentum) or SHORT (negative) */
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  /** Confidence in momentum (0-100) */
  confidence: number;
  /** Rate of momentum change */
  rate: number;
}

/**
 * Complete advanced order flow analysis
 */
export interface AdvancedOrderFlow {
  /** Analysis timestamp */
  timestamp: number;

  // Volume metrics
  /** Total buy volume in analysis window */
  buyVolume: number;
  /** Total sell volume in analysis window */
  sellVolume: number;
  /** Buy/sell imbalance ratio */
  imbalance: number;

  // Pattern metrics
  /** Detected flow pattern */
  pattern: 'accumulation' | 'distribution' | 'neutral';
  /** Pattern confidence (0-100) */
  patternConfidence: number;

  // Direction inference
  /** Inferred direction based on all metrics */
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  /** Overall confidence in direction (0-100) */
  confidence: number;

  // Advanced metrics
  /** Order flow momentum (-100 to +100) */
  momentum: number;
  /** Whether spoofing was detected */
  spoofingDetected: boolean;
  /** Total volume analyzed in USDT */
  volumeUSDT: number;

  // Metadata
  /** Number of ticks in analysis window */
  tickCount: number;
  /** Number of orderbook snapshots analyzed */
  orderbookCount: number;
}

/**
 * Flow pattern detailed info
 */
export interface FlowPattern {
  /** Pattern classification */
  pattern: 'accumulation' | 'distribution' | 'neutral';
  /** Pattern confidence (0-100) */
  confidence: number;
  /** Buy pressure score (0-100) */
  buyPressure: number;
  /** Sell pressure score (0-100) */
  sellPressure: number;
  /** Duration of current pattern in ms */
  duration: number;
}

/**
 * Spoofing signal detailed info
 */
export interface SpoofingSignal {
  /** Whether spoofing detected */
  detected: boolean;
  /** Side of suspicious activity */
  side?: 'BUY' | 'SELL';
  /** Price level with suspicious activity */
  suspiciousLevel?: number;
  /** Sudden volume change ratio */
  volumeChange?: number;
  /** Confidence in detection (0-100) */
  confidence: number;
}
