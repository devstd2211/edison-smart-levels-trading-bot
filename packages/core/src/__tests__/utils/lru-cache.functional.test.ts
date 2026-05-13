import { ArrayLRUCache } from '../../utils/lru-cache';

describe('ArrayLRUCache functional behavior', () => {
  it('drops older entries and keeps the newest half once cleanup is triggered', () => {
    const cache = new ArrayLRUCache<number>(4);

    [1, 2, 3, 4, 5, 6, 7].forEach((value) => cache.push(value));

    expect(cache.getAll()).toEqual([6, 7]);
    expect(cache.size()).toBe(2);
  });

  it('returns defensive copies while preserving recent-entry access', () => {
    const cache = new ArrayLRUCache<number>(4);

    [10, 11, 12].forEach((value) => cache.push(value));
    const snapshot = cache.getAll();
    snapshot.push(99);

    expect(cache.getAll()).toEqual([10, 11, 12]);
    expect(cache.getLast(2)).toEqual([11, 12]);
    expect(cache.get(1)).toBe(11);
  });
});
