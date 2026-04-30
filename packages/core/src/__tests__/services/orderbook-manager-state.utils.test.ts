import {
  getOrderbookSide,
  getOrderbookSnapshotAge,
  mapOrderbookLevels,
  parseOrderbookLevel,
  sortOrderbookEntries,
  trimOrderbookEntries,
} from '../../services/orderbook-manager/orderbook-manager-state.utils';

describe('orderbook-manager state utils', () => {
  it('parses valid levels and rejects invalid numeric payloads', () => {
    expect(parseOrderbookLevel(['100.5', '2'])).toEqual({ price: 100.5, size: 2 });
    expect(parseOrderbookLevel(['bad', '2'])).toBeNull();
    expect(parseOrderbookLevel(['100', 'bad'])).toBeNull();
  });

  it('derives side labels and stale snapshot age', () => {
    expect(getOrderbookSide(true)).toBe('BID');
    expect(getOrderbookSide(false)).toBe('ASK');
    expect(getOrderbookSnapshotAge(1000, 61001, 60000)).toBe(60001);
    expect(getOrderbookSnapshotAge(1000, 60999, 60000)).toBeNull();
  });

  it('sorts, trims, and maps bids and asks consistently', () => {
    const entries: Array<[number, number]> = [
      [99, 1],
      [101, 3],
      [100, 2],
    ];

    expect(sortOrderbookEntries(entries, true)).toEqual([
      [101, 3],
      [100, 2],
      [99, 1],
    ]);
    expect(sortOrderbookEntries(entries, false)).toEqual([
      [99, 1],
      [100, 2],
      [101, 3],
    ]);
    expect(trimOrderbookEntries(entries, true, 2)).toEqual([
      [101, 3],
      [100, 2],
    ]);
    expect(mapOrderbookLevels(entries, false)).toEqual([
      { price: 99, size: 1 },
      { price: 100, size: 2 },
      { price: 101, size: 3 },
    ]);
  });
});
