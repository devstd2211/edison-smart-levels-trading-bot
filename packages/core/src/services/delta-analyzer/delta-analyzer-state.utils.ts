import { INTEGER_MULTIPLIERS, PERCENT_MULTIPLIER } from '../../constants';
import { DeltaAnalysis, DeltaConfig, DeltaTick } from '../../types/legacy';

export function createNeutralDeltaAnalysis(timestamp: number = Date.now()): DeltaAnalysis {
  return {
    timestamp,
    buyVolume: 0,
    sellVolume: 0,
    delta: 0,
    deltaPercent: 0,
    trend: 'NEUTRAL',
    strength: 0,
  };
}

export function validateDeltaConfig(config: DeltaConfig): void {
  if (!config) {
    throw new Error('DeltaConfig cannot be null or undefined');
  }

  if (typeof config.windowSizeMs !== 'number' || config.windowSizeMs <= 0) {
    throw new Error(`windowSizeMs must be > 0 (got ${config.windowSizeMs})`);
  }

  if (typeof config.minDeltaThreshold !== 'number' || config.minDeltaThreshold < 0) {
    throw new Error(`minDeltaThreshold must be >= 0 (got ${config.minDeltaThreshold})`);
  }
}

export function validateDeltaTick(tick: DeltaTick): void {
  if (!tick) {
    throw new Error('DeltaTick cannot be null or undefined');
  }

  if (!tick.side || (tick.side !== 'BUY' && tick.side !== 'SELL')) {
    throw new Error(`Tick side must be BUY or SELL (got ${tick.side})`);
  }

  if (!Number.isFinite(tick.quantity) || tick.quantity < 0) {
    throw new Error(`Tick quantity must be >= 0 and finite (got ${tick.quantity})`);
  }

  if (!Number.isFinite(tick.price) || tick.price < 0) {
    throw new Error(`Tick price must be >= 0 and finite (got ${tick.price})`);
  }
}

export function filterDeltaTicksByWindow(
  ticks: DeltaTick[],
  windowSizeMs: number,
  now: number = Date.now(),
): DeltaTick[] {
  const cutoff = now - windowSizeMs;
  return ticks.filter((tick) => tick.timestamp >= cutoff);
}

export function analyzeDeltaTicks(
  ticks: DeltaTick[],
  minDeltaThreshold: number,
  timestamp: number = Date.now(),
): DeltaAnalysis {
  if (ticks.length === 0) {
    return createNeutralDeltaAnalysis(timestamp);
  }

  let buyVolume = 0;
  let sellVolume = 0;

  for (const tick of ticks) {
    if (tick.side === 'BUY') {
      buyVolume += tick.quantity;
    } else {
      sellVolume += tick.quantity;
    }
  }

  if (!Number.isFinite(buyVolume) || !Number.isFinite(sellVolume)) {
    return createNeutralDeltaAnalysis(timestamp);
  }

  const totalVolume = buyVolume + sellVolume;
  const delta = buyVolume - sellVolume;
  const deltaPercent = totalVolume > 0 ? (delta / totalVolume) * PERCENT_MULTIPLIER : 0;

  if (!Number.isFinite(deltaPercent)) {
    return {
      timestamp,
      buyVolume,
      sellVolume,
      delta,
      deltaPercent: 0,
      trend: 'NEUTRAL',
      strength: 0,
    };
  }

  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  if (Math.abs(delta) < minDeltaThreshold) {
    trend = 'NEUTRAL';
  } else if (delta > 0) {
    trend = 'BULLISH';
  } else {
    trend = 'BEARISH';
  }

  return {
    timestamp,
    buyVolume,
    sellVolume,
    delta,
    deltaPercent,
    trend,
    strength: Math.min(Math.abs(deltaPercent), INTEGER_MULTIPLIERS.ONE_HUNDRED),
  };
}

export function validateDeltaSignalDirection(direction: string | undefined): void {
  if (!direction || (direction !== 'LONG' && direction !== 'SHORT')) {
    throw new Error(`Signal direction must be LONG or SHORT (got ${direction})`);
  }
}
