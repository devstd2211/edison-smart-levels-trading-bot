import { DECIMAL_PLACES, INTEGER_MULTIPLIERS, PERCENT_MULTIPLIER } from '../../constants';
import { Candle, RetestConfig, RetestZone, Signal, SignalDirection } from '../../types/legacy';

export type RetestImpulseResult = {
  hasImpulse: boolean;
  impulseStart: number;
  impulseEnd: number;
};

export type RetestCheckResult = {
  inZone: boolean;
  shouldEnter: boolean;
  reason: string;
};

export function createNeutralRetestImpulse(): RetestImpulseResult {
  return { hasImpulse: false, impulseStart: 0, impulseEnd: 0 };
}

export function validateRetestConfig(config: RetestConfig): void {
  if (!config) {
    throw new Error('RetestEntryService: config is required');
  }

  if (typeof config.minImpulsePercent !== 'number' || config.minImpulsePercent <= 0 || config.minImpulsePercent > 100) {
    throw new Error('RetestEntryService: minImpulsePercent must be between 0 and 100');
  }

  if (typeof config.retestZoneFibStart !== 'number' || config.retestZoneFibStart <= 0 || config.retestZoneFibStart > 100) {
    throw new Error('RetestEntryService: retestZoneFibStart must be between 0 and 100');
  }

  if (typeof config.retestZoneFibEnd !== 'number' || config.retestZoneFibEnd <= 0 || config.retestZoneFibEnd > 100) {
    throw new Error('RetestEntryService: retestZoneFibEnd must be between 0 and 100');
  }

  if (config.retestZoneFibStart >= config.retestZoneFibEnd) {
    throw new Error('RetestEntryService: retestZoneFibStart must be < retestZoneFibEnd');
  }

  if (typeof config.maxRetestWaitMs !== 'number' || config.maxRetestWaitMs <= 0) {
    throw new Error('RetestEntryService: maxRetestWaitMs must be > 0');
  }

  if (typeof config.volumeMultiplier !== 'number' || config.volumeMultiplier <= 0) {
    throw new Error('RetestEntryService: volumeMultiplier must be > 0');
  }

  if (typeof config.enabled !== 'boolean') {
    throw new Error('RetestEntryService: enabled must be boolean');
  }

  if (typeof config.requireStructureIntact !== 'boolean') {
    throw new Error('RetestEntryService: requireStructureIntact must be boolean');
  }
}

export function validateRetestImpulseInput(candles: Candle[], currentPrice: number): void {
  if (!Array.isArray(candles)) {
    throw new Error('RetestEntryService.detectImpulse: candles must be an array');
  }

  if (typeof currentPrice !== 'number' || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    throw new Error('RetestEntryService.detectImpulse: currentPrice must be a positive number');
  }
}

export function calculateRetestImpulse(
  candles: Candle[],
  currentPrice: number,
  minImpulsePercent: number,
): RetestImpulseResult | null {
  const lookback = Math.min(5, candles.length);
  if (lookback === 0) {
    return createNeutralRetestImpulse();
  }

  const recentCandles = candles.slice(-lookback);
  const startPrice = recentCandles[0].open;
  const endPrice = currentPrice;

  if (!Number.isFinite(startPrice) || startPrice <= 0) {
    return null;
  }

  const priceChange = Math.abs((endPrice - startPrice) / startPrice) * PERCENT_MULTIPLIER;
  if (!Number.isFinite(priceChange)) {
    return null;
  }

  return {
    hasImpulse: priceChange >= minImpulsePercent,
    impulseStart: startPrice,
    impulseEnd: endPrice,
  };
}

export function validateRetestZoneInput(
  symbol: string,
  signal: Signal,
  impulseStart: number,
  impulseEnd: number,
): void {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('RetestEntryService.createRetestZone: symbol must be a non-empty string');
  }

  if (!signal) {
    throw new Error('RetestEntryService.createRetestZone: signal is required');
  }

  if (typeof impulseStart !== 'number' || !Number.isFinite(impulseStart) || impulseStart <= 0) {
    throw new Error('RetestEntryService.createRetestZone: impulseStart must be a positive number');
  }

  if (typeof impulseEnd !== 'number' || !Number.isFinite(impulseEnd) || impulseEnd <= 0) {
    throw new Error('RetestEntryService.createRetestZone: impulseEnd must be a positive number');
  }
}

export function buildRetestZone(
  symbol: string,
  signal: Signal,
  impulseStart: number,
  impulseEnd: number,
  config: RetestConfig,
  now: number = Date.now(),
): RetestZone {
  const impulseRange = Math.abs(impulseEnd - impulseStart);
  if (!Number.isFinite(impulseRange) || impulseRange <= 0) {
    throw new Error('impulseRange is not valid');
  }

  const fibStart = config.retestZoneFibStart / PERCENT_MULTIPLIER;
  const fibEnd = config.retestZoneFibEnd / PERCENT_MULTIPLIER;

  let zoneLow: number;
  let zoneHigh: number;

  if (signal.direction === SignalDirection.LONG) {
    zoneLow = impulseEnd - (impulseRange * fibEnd);
    zoneHigh = impulseEnd - (impulseRange * fibStart);
  } else {
    zoneLow = impulseEnd + (impulseRange * fibStart);
    zoneHigh = impulseEnd + (impulseRange * fibEnd);
  }

  if (!Number.isFinite(zoneLow) || !Number.isFinite(zoneHigh)) {
    throw new Error('zone calculations resulted in non-finite values');
  }

  return {
    symbol,
    direction: signal.direction,
    impulseStart,
    impulseEnd,
    zoneLow,
    zoneHigh,
    createdAt: now,
    expiresAt: now + config.maxRetestWaitMs,
    originalSignal: signal,
  };
}

export function buildFallbackRetestZone(
  symbol: string,
  signal: Signal,
  impulseStart: number,
  impulseEnd: number,
  maxRetestWaitMs: number,
  now: number = Date.now(),
): RetestZone {
  return {
    symbol,
    direction: signal.direction,
    impulseStart,
    impulseEnd,
    zoneLow: Math.min(impulseStart, impulseEnd),
    zoneHigh: Math.max(impulseStart, impulseEnd),
    createdAt: now,
    expiresAt: now + maxRetestWaitMs,
    originalSignal: signal,
  };
}

export function evaluateRetestZone(
  zone: RetestZone | undefined,
  currentPrice: number,
  currentVolume: number,
  avgVolume: number,
  ema20: number,
  seniorTFTrend: 'UP' | 'DOWN' | 'NEUTRAL',
  config: RetestConfig,
  now: number = Date.now(),
): RetestCheckResult {
  if (!zone) {
    return { inZone: false, shouldEnter: false, reason: 'No retest zone' };
  }

  if (now > zone.expiresAt) {
    return { inZone: false, shouldEnter: false, reason: 'Retest zone expired' };
  }

  const inZone = currentPrice >= zone.zoneLow && currentPrice <= zone.zoneHigh;
  if (!inZone) {
    return {
      inZone: false,
      shouldEnter: false,
      reason: `Price ${currentPrice.toFixed(DECIMAL_PLACES.PRICE)} outside zone [${zone.zoneLow.toFixed(DECIMAL_PLACES.PRICE)}, ${zone.zoneHigh.toFixed(DECIMAL_PLACES.PRICE)}]`,
    };
  }

  if (currentVolume > avgVolume) {
    return {
      inZone: true,
      shouldEnter: false,
      reason: `Volume too high: ${currentVolume.toFixed(0)} > ${avgVolume.toFixed(0)} (aggressive, not calm retest)`,
    };
  }

  if (config.requireStructureIntact) {
    const emaIntact = zone.direction === 'LONG'
      ? currentPrice > ema20
      : currentPrice < ema20;

    if (!emaIntact) {
      return {
        inZone: true,
        shouldEnter: false,
        reason: `EMA structure broken: price ${currentPrice.toFixed(DECIMAL_PLACES.PRICE)} ${zone.direction === 'LONG' ? '<' : '>'} EMA ${ema20.toFixed(DECIMAL_PLACES.PRICE)}`,
      };
    }

    const seniorAligned = zone.direction === 'LONG'
      ? seniorTFTrend === 'UP'
      : seniorTFTrend === 'DOWN';

    if (!seniorAligned) {
      return {
        inZone: true,
        shouldEnter: false,
        reason: `Senior TF not aligned: ${seniorTFTrend} (expected ${zone.direction === 'LONG' ? 'UP' : 'DOWN'})`,
      };
    }
  }

  return {
    inZone: true,
    shouldEnter: true,
    reason: 'Calm retest with structure intact',
  };
}

export function getRetestZoneAgeSeconds(zone: RetestZone, now: number = Date.now()): number {
  return (now - zone.createdAt) / INTEGER_MULTIPLIERS.ONE_THOUSAND;
}
