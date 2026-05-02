/**
 * Signal types
 */

import type { SignalDirection, SignalType } from '../enums';
import type { TakeProfit } from '../position';
import type { BTCAnalysis } from '../core';

/**
 * Trading signal
 */
export interface Signal {
  direction: SignalDirection;
  type: SignalType;
  confidence: number;
  price: number;
  stopLoss: number;
  takeProfits: TakeProfit[];
  reason: string;
  timestamp: number;
  // Market data for journal entry condition
  marketData?: {
    rsi: number;
    rsiEntry?: number;
    rsiTrend1?: number;
    ema?: number; // Legacy: EMA50 (for backward compatibility)
    ema20?: number; // NEW: Fast EMA
    ema50?: number; // NEW: Slow EMA
    emaEntry?: number;
    emaTrend1?: number;
    atr: number;
    volumeRatio?: number; // Optional for Whale Hunter
    swingHighsCount?: number; // Optional for Whale Hunter
    swingLowsCount?: number; // Optional for Whale Hunter
    trend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    nearestLevel?: number;
    distanceToLevel?: number;
    distanceToEma?: number;
    // Whale Hunter specific fields
    whaleMode?: string;
    wallSize?: number;
    imbalance?: number;
    // Stochastic indicator data
    stochastic?: {
      k: number; // %K value (0-100)
      d: number; // %D value (0-100)
      isOversold: boolean; // K < 20
      isOverbought: boolean; // K > 80
    };
    // Bollinger Bands data
    bollingerBands?: {
      upper: number; // Upper band price
      middle: number; // Middle band (SMA)
      lower: number; // Lower band price
      width: number; // Band width %
      percentB: number; // Price position (0-1)
      isSqueeze: boolean; // Squeeze detected
    };
    // Breakout Direction Prediction (BB.MD Section 4.4)
    breakoutPrediction?: {
      direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      confidence: number; // 0-100
      emaTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      rsiMomentum: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
      volumeStrength: 'HIGH' | 'MEDIUM' | 'LOW';
    };
  };
  // BTC confirmation data (if BTC filter enabled)
  // Full BTCAnalysis object from btc.analyzer.ts
  btcData?: BTCAnalysis;
  aggregationContext?: {
    signalCount: number;
    longSignalCount: number;
    shortSignalCount: number;
    originalSignals: Signal[];
  };
}
