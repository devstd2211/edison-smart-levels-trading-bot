import { INTEGER_MULTIPLIERS, PERCENT_MULTIPLIER } from '../../constants';
import { ImbalanceAnalysis, OrderbookImbalanceConfig } from '../../types/legacy';

export type OrderbookSnapshot = {
  bids: [number, number][];
  asks: [number, number][];
};

export function createNeutralImbalanceAnalysis(timestamp: number = Date.now()): ImbalanceAnalysis {
  return {
    timestamp,
    bidVolume: 0,
    askVolume: 0,
    totalVolume: 0,
    imbalance: 0,
    direction: 'NEUTRAL',
    strength: 0,
  };
}

export function validateOrderbookImbalanceConfig(config: OrderbookImbalanceConfig): void {
  if (typeof config.levels !== 'number' || config.levels < 1) {
    throw new Error('OrderbookImbalanceService: config.levels must be >= 1');
  }
  if (typeof config.minImbalancePercent !== 'number' || config.minImbalancePercent < 0 || config.minImbalancePercent > 100) {
    throw new Error('OrderbookImbalanceService: config.minImbalancePercent must be between 0 and 100');
  }
  if (typeof config.enabled !== 'boolean') {
    throw new Error('OrderbookImbalanceService: config.enabled must be boolean');
  }
}

export function validateOrderbookSnapshot(orderbook: OrderbookSnapshot): void {
  if (!orderbook) {
    throw new Error('OrderbookImbalanceService.analyze: orderbook is required');
  }
  if (!Array.isArray(orderbook.bids) || !Array.isArray(orderbook.asks)) {
    throw new Error('OrderbookImbalanceService.analyze: bids and asks must be arrays');
  }
}

export function sliceOrderbookLevels(orderbook: OrderbookSnapshot, levels: number): OrderbookSnapshot {
  return {
    bids: orderbook.bids.slice(0, levels),
    asks: orderbook.asks.slice(0, levels),
  };
}

export function sumOrderbookSideVolume(levels: [number, number][]): number | null {
  let volume = 0;

  for (const [, qty] of levels) {
    if (!Number.isFinite(qty)) {
      return null;
    }
    volume += qty;
  }

  return Number.isFinite(volume) ? volume : null;
}

export function analyzeOrderbookImbalance(
  orderbook: OrderbookSnapshot,
  config: OrderbookImbalanceConfig,
  timestamp: number = Date.now(),
): ImbalanceAnalysis | null {
  const topLevels = sliceOrderbookLevels(orderbook, config.levels);
  const bidVolume = sumOrderbookSideVolume(topLevels.bids);
  const askVolume = sumOrderbookSideVolume(topLevels.asks);

  if (bidVolume === null || askVolume === null) {
    return null;
  }

  const totalVolume = bidVolume + askVolume;
  const imbalance = totalVolume > 0 ? ((bidVolume - askVolume) / totalVolume) * PERCENT_MULTIPLIER : 0;
  if (!Number.isFinite(imbalance)) {
    return null;
  }

  let direction: 'BID' | 'ASK' | 'NEUTRAL';
  if (Math.abs(imbalance) < config.minImbalancePercent) {
    direction = 'NEUTRAL';
  } else if (imbalance > 0) {
    direction = 'BID';
  } else {
    direction = 'ASK';
  }

  return {
    timestamp,
    bidVolume,
    askVolume,
    totalVolume,
    imbalance,
    direction,
    strength: Math.min(Math.abs(imbalance), INTEGER_MULTIPLIERS.ONE_HUNDRED),
  };
}
