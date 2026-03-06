import { PERCENT_MULTIPLIER } from '../../constants';
import { PositionSide } from '../../types/legacy';

export interface BollingerBands {
  upper: number;
  lower: number;
}

export function calculateBreakevenPrice(
  entryPrice: number,
  side: PositionSide,
  offsetPercent: number,
): number {
  const offset = (entryPrice * offsetPercent) / PERCENT_MULTIPLIER;
  return side === PositionSide.LONG ? entryPrice + offset : entryPrice - offset;
}

export function calculateFallbackBreakevenPrice(
  stopLossPrice: number,
  side: PositionSide,
  safeOffsetPercent: number = 0.1,
): number {
  if (side === PositionSide.LONG) {
    return stopLossPrice * (1 + safeOffsetPercent / PERCENT_MULTIPLIER);
  }
  return stopLossPrice * (1 - safeOffsetPercent / PERCENT_MULTIPLIER);
}

export function calculateTrailingStopPrice(
  side: PositionSide,
  currentPrice: number,
  trailingPercent: number,
): number {
  const trailingDistance = (currentPrice * trailingPercent) / PERCENT_MULTIPLIER;
  return side === PositionSide.LONG ? currentPrice - trailingDistance : currentPrice + trailingDistance;
}

export function calculateBollingerBands(closes: number[]): BollingerBands {
  const avg = closes.reduce((a, b) => a + b, 0) / closes.length;
  const variance = closes.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / closes.length;
  const stdDev = Math.sqrt(variance);
  return {
    upper: avg + 2 * stdDev,
    lower: avg - 2 * stdDev,
  };
}
