import type { Candle } from '../../types/core';

export type DivergenceResult = {
  type: 'NONE' | 'BULLISH' | 'BEARISH';
  strength: number;
  priceDiff: number;
  rsiDiff: number;
};

export type SwingHighPoint = { index: number; high: number; rsi: number };
export type SwingLowPoint = { index: number; low: number; rsi: number };

export function findSwingHighs(
  candles: Candle[],
  rsiValues: number[],
): SwingHighPoint[] {
  const highs: SwingHighPoint[] = [];

  for (let i = 1; i < candles.length - 1; i++) {
    const prevHigh = candles[i - 1].high;
    const currentHigh = candles[i].high;
    const nextHigh = candles[i + 1].high;

    if (currentHigh > prevHigh && currentHigh > nextHigh) {
      const rsi = rsiValues[i];
      if (!isNaN(rsi)) {
        highs.push({ index: i, high: currentHigh, rsi });
      }
    }
  }

  return highs;
}

export function findSwingLows(
  candles: Candle[],
  rsiValues: number[],
): SwingLowPoint[] {
  const lows: SwingLowPoint[] = [];

  for (let i = 1; i < candles.length - 1; i++) {
    const prevLow = candles[i - 1].low;
    const currentLow = candles[i].low;
    const nextLow = candles[i + 1].low;

    if (currentLow < prevLow && currentLow < nextLow) {
      const rsi = rsiValues[i];
      if (!isNaN(rsi)) {
        lows.push({ index: i, low: currentLow, rsi });
      }
    }
  }

  return lows;
}

export function calculateDivergenceStrength(
  priceDiffPercent: number,
  rsiDiff: number,
  minConfidence: number,
): number {
  const priceScore = Math.min(priceDiffPercent / 5, 1);
  const rsiScore = Math.min(rsiDiff / 20, 1);
  const strength = (priceScore + rsiScore) / 2;
  return Math.max(minConfidence, Math.min(strength, 1));
}

export function checkBearishDivergence(
  oldHigh: SwingHighPoint,
  recentHigh: SwingHighPoint,
  minPriceDiffPercent: number,
  minRsiDiffPoints: number,
  minConfidence: number,
): DivergenceResult {
  const priceIsHigher = recentHigh.high > oldHigh.high;
  const rsiIsLower = recentHigh.rsi < oldHigh.rsi;

  if (priceIsHigher && rsiIsLower) {
    const priceDiff = ((recentHigh.high - oldHigh.high) / oldHigh.high) * 100;
    const rsiDiff = Math.abs(oldHigh.rsi - recentHigh.rsi);

    if (priceDiff >= minPriceDiffPercent && rsiDiff >= minRsiDiffPoints) {
      const strength = calculateDivergenceStrength(
        priceDiff,
        rsiDiff,
        minConfidence,
      );
      return { type: 'BEARISH', strength, priceDiff, rsiDiff };
    }
  }

  return { type: 'NONE', strength: 0, priceDiff: 0, rsiDiff: 0 };
}

export function checkBullishDivergence(
  oldLow: SwingLowPoint,
  recentLow: SwingLowPoint,
  minPriceDiffPercent: number,
  minRsiDiffPoints: number,
  minConfidence: number,
): DivergenceResult {
  const priceIsLower = recentLow.low < oldLow.low;
  const rsiIsHigher = recentLow.rsi > oldLow.rsi;

  if (priceIsLower && rsiIsHigher) {
    const priceDiff = ((oldLow.low - recentLow.low) / oldLow.low) * 100;
    const rsiDiff = Math.abs(recentLow.rsi - oldLow.rsi);

    if (priceDiff >= minPriceDiffPercent && rsiDiff >= minRsiDiffPoints) {
      const strength = calculateDivergenceStrength(
        priceDiff,
        rsiDiff,
        minConfidence,
      );
      return { type: 'BULLISH', strength, priceDiff, rsiDiff };
    }
  }

  return { type: 'NONE', strength: 0, priceDiff: 0, rsiDiff: 0 };
}
