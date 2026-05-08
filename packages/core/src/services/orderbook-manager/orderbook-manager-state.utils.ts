import type {
  OrderbookLevel,
  OrderbookSnapshot,
} from '../orderbook-manager.service';

export type OrderbookSide = 'BID' | 'ASK';

export interface ParsedOrderbookLevel {
  price: number;
  size: number;
}

export function getOrderbookSide(isBids: boolean): OrderbookSide {
  return isBids ? 'BID' : 'ASK';
}

export function parseOrderbookLevel(level: [string, string]): ParsedOrderbookLevel | null {
  const [priceStr, sizeStr] = level;
  const price = parseFloat(priceStr);
  const size = parseFloat(sizeStr);

  if (Number.isNaN(price) || Number.isNaN(size)) {
    return null;
  }

  return { price, size };
}

export function sortOrderbookEntries(
  entries: Iterable<[number, number]>,
  isBids: boolean,
): Array<[number, number]> {
  return Array.from(entries).sort((left, right) => (isBids ? right[0] - left[0] : left[0] - right[0]));
}

export function trimOrderbookEntries(
  entries: Iterable<[number, number]>,
  isBids: boolean,
  maxLevels: number,
): Array<[number, number]> {
  return sortOrderbookEntries(entries, isBids).slice(0, maxLevels);
}

export function mapOrderbookLevels(
  entries: Iterable<[number, number]>,
  isBids: boolean,
): OrderbookLevel[] {
  return sortOrderbookEntries(entries, isBids).map(([price, size]) => ({ price, size }));
}

export function createOrderbookSnapshot(
  bids: Iterable<[number, number]>,
  asks: Iterable<[number, number]>,
  timestamp: number,
  updateId: number,
): OrderbookSnapshot {
  return {
    bids: mapOrderbookLevels(bids, true),
    asks: mapOrderbookLevels(asks, false),
    timestamp,
    updateId,
  };
}

export function getOrderbookSnapshotAge(
  lastSnapshotTime: number,
  now: number,
  thresholdMs: number,
): number | null {
  const ageMs = now - lastSnapshotTime;
  return ageMs > thresholdMs ? ageMs : null;
}
