/**
 * Price Momentum Analyzer
 *
 * Real-time validation that price is moving in the signal direction.
 * Analyzes the last 5 candles to detect directional momentum.
 *
 * Prevents late entries that chase exhausted moves by requiring active momentum.
 * - For LONG: At least 3 of last 5 candles must close higher
 * - For SHORT: At least 3 of last 5 candles must close lower
 * - Confidence scales with momentum strength (50-100%)
 */

import { Candle, SignalDirection } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

const MOMENTUM_LOOKBACK_CANDLES = 5;
const MINIMUM_CANDLES_FOR_DIRECTION = 3; // At least 3 of 5 candles
const BASE_CONFIDENCE = 50; // Minimum confidence (no momentum)
const MAX_CONFIDENCE = 100; // Maximum confidence (all 5 candles in same direction)
const MOMENTUM_STRENGTH_MULTIPLIER = 10; // (5 - 3) * 10 = 20% confidence per extra candle

// ============================================================================
// PRICE MOMENTUM ANALYZER
// ============================================================================

export class PriceMomentumAnalyzer {
  /**
   * Analyze price momentum from recent candles
   * @param candles - Array of candles (most recent last)
   * @returns Momentum signal (LONG/SHORT/null) with confidence 50-100%
   */
  analyze(candles: Candle[]): { direction: SignalDirection; confidence: number } | null {
    if (!candles || candles.length < MOMENTUM_LOOKBACK_CANDLES) {
      return null; // Not enough data
    }

    // Get last 5 candles (most recent is last)
    const recentCandles = candles.slice(-MOMENTUM_LOOKBACK_CANDLES);

    // Count candles that closed higher (for LONG momentum)
    let closesHigher = 0;
    for (let i = 1; i < recentCandles.length; i++) {
      if (recentCandles[i].close > recentCandles[i - 1].close) {
        closesHigher++;
      }
    }

    // Count candles that closed lower (for SHORT momentum)
    const closesLower = MOMENTUM_LOOKBACK_CANDLES - 1 - closesHigher; // 4 transitions total

    // LONG signal if at least 3 candles closed higher
    if (closesHigher >= MINIMUM_CANDLES_FOR_DIRECTION) {
      const confidence = Math.min(
        BASE_CONFIDENCE + closesHigher * MOMENTUM_STRENGTH_MULTIPLIER,
        MAX_CONFIDENCE
      );
      return {
        direction: SignalDirection.LONG,
        confidence,
      };
    }

    // SHORT signal if at least 3 candles closed lower
    if (closesLower >= MINIMUM_CANDLES_FOR_DIRECTION) {
      const confidence = Math.min(
        BASE_CONFIDENCE + closesLower * MOMENTUM_STRENGTH_MULTIPLIER,
        MAX_CONFIDENCE
      );
      return {
        direction: SignalDirection.SHORT,
        confidence,
      };
    }

    // No clear momentum (roughly equal ups and downs)
    return null;
  }

  /**
   * Check if momentum supports a given direction
   * @param candles - Array of candles
   * @param direction - Direction to check (LONG or SHORT)
   * @returns true if momentum supports direction, false otherwise
   */
  supportsMomentum(candles: Candle[], direction: SignalDirection): boolean {
    const signal = this.analyze(candles);
    if (!signal) return false;
    return signal.direction === direction;
  }

  /**
   * Get momentum strength (0-1) for a direction
   * @param candles - Array of candles
   * @param direction - Direction to check
   * @returns Momentum strength from 0 (no momentum) to 1 (strong momentum)
   */
  getMomentumStrength(candles: Candle[], direction: SignalDirection): number {
    const signal = this.analyze(candles);
    if (!signal || signal.direction !== direction) return 0;
    return signal.confidence / 100; // Convert 50-100% to 0.5-1.0
  }
}
