/**
 * Tests for OrderbookManagerService
 *
 * Critical service - maintains orderbook snapshot from WebSocket:
 * - Snapshot initialization
 * - Delta application logic
 * - Memory leak protection
 * - Stale data detection
 */

import { OrderbookManagerService, OrderbookUpdate } from '../../services/orderbook-manager.service';
import { LoggerService, LogLevel } from '../../types';

// ============================================================================
// HELPERS
// ============================================================================

const createLogger = (): LoggerService => {
  return new LoggerService(LogLevel.ERROR, './logs', false);
};

const createSnapshotUpdate = (
  bids: Array<[string, string]>,
  asks: Array<[string, string]>,
  updateId: number = 1,
): OrderbookUpdate => ({
  type: 'snapshot',
  bids,
  asks,
  updateId,
  timestamp: Date.now(),
});

const createDeltaUpdate = (
  bids: Array<[string, string]>,
  asks: Array<[string, string]>,
  updateId: number,
): OrderbookUpdate => ({
  type: 'delta',
  bids,
  asks,
  updateId,
  timestamp: Date.now(),
});

// ============================================================================
// TESTS
// ============================================================================

describe('OrderbookManagerService', () => {
  let manager: OrderbookManagerService;
  let logger: LoggerService;

  beforeEach(() => {
    logger = createLogger();
    manager = new OrderbookManagerService('BTCUSDT', logger);
  });

  describe('Snapshot handling', () => {
    it('should initialize with snapshot', () => {
      const snapshot = createSnapshotUpdate(
        [['100', '10'], ['99', '5']],
        [['101', '8'], ['102', '12']],
      );

      manager.processUpdate(snapshot);

      expect(manager.isReady()).toBe(true);
      const result = manager.getSnapshot();

      expect(result).not.toBeNull();
      expect(result!.bids).toHaveLength(2);
      expect(result!.asks).toHaveLength(2);

      // Bids should be sorted descending
      expect(result!.bids[0].price).toBe(100);
      expect(result!.bids[1].price).toBe(99);

      // Asks should be sorted ascending
      expect(result!.asks[0].price).toBe(101);
      expect(result!.asks[1].price).toBe(102);
    });

    it('should reset orderbook on new snapshot', () => {
      // First snapshot
      const snapshot1 = createSnapshotUpdate(
        [['100', '10']],
        [['101', '8']],
        1,
      );
      manager.processUpdate(snapshot1);

      let result = manager.getSnapshot();
      expect(result!.bids).toHaveLength(1);
      expect(result!.asks).toHaveLength(1);

      // Second snapshot (should replace first)
      const snapshot2 = createSnapshotUpdate(
        [['200', '20'], ['199', '15']],
        [['201', '18']],
        2,
      );
      manager.processUpdate(snapshot2);

      result = manager.getSnapshot();
      expect(result!.bids).toHaveLength(2);
      expect(result!.bids[0].price).toBe(200);
      expect(result!.asks).toHaveLength(1);
      expect(result!.asks[0].price).toBe(201);
    });

    it('should not be ready before receiving snapshot', () => {
      expect(manager.isReady()).toBe(false);
      expect(manager.getSnapshot()).toBeNull();
    });
  });

  describe('Delta handling', () => {
    beforeEach(() => {
      // Initialize with snapshot
      const snapshot = createSnapshotUpdate(
        [['100', '10'], ['99', '5'], ['98', '3']],
        [['101', '8'], ['102', '12'], ['103', '6']],
        1,
      );
      manager.processUpdate(snapshot);
    });

    it('should update existing level', () => {
      const delta = createDeltaUpdate(
        [['100', '20']], // Update price 100 from size 10 to 20
        [],
        2,
      );

      manager.processUpdate(delta);

      const result = manager.getSnapshot();
      const bid100 = result!.bids.find(b => b.price === 100);
      expect(bid100!.size).toBe(20);
    });

    it('should insert new level', () => {
      const delta = createDeltaUpdate(
        [['97', '7']], // New bid level
        [['104', '9']], // New ask level
        2,
      );

      manager.processUpdate(delta);

      const result = manager.getSnapshot();
      expect(result!.bids).toHaveLength(4);
      expect(result!.asks).toHaveLength(4);

      const bid97 = result!.bids.find(b => b.price === 97);
      expect(bid97!.size).toBe(7);

      const ask104 = result!.asks.find(a => a.price === 104);
      expect(ask104!.size).toBe(9);
    });

    it('should delete level when size = 0', () => {
      const delta = createDeltaUpdate(
        [['99', '0']], // Delete price level 99
        [['102', '0']], // Delete price level 102
        2,
      );

      manager.processUpdate(delta);

      const result = manager.getSnapshot();
      expect(result!.bids).toHaveLength(2); // Was 3, deleted 1
      expect(result!.asks).toHaveLength(2); // Was 3, deleted 1

      const bid99 = result!.bids.find(b => b.price === 99);
      expect(bid99).toBeUndefined();

      const ask102 = result!.asks.find(a => a.price === 102);
      expect(ask102).toBeUndefined();
    });

    it('should handle multiple changes in one delta', () => {
      const delta = createDeltaUpdate(
        [
          ['100', '20'], // Update existing
          ['97', '7'],   // Insert new
          ['98', '0'],   // Delete existing
        ],
        [
          ['101', '15'], // Update existing
          ['104', '9'],  // Insert new
        ],
        2,
      );

      manager.processUpdate(delta);

      const result = manager.getSnapshot();
      expect(result!.bids).toHaveLength(3); // 100, 99, 97 (98 deleted)
      expect(result!.asks).toHaveLength(4); // 101, 102, 103, 104

      expect(result!.bids.find(b => b.price === 100)!.size).toBe(20);
      expect(result!.bids.find(b => b.price === 97)!.size).toBe(7);
      expect(result!.bids.find(b => b.price === 98)).toBeUndefined();

      expect(result!.asks.find(a => a.price === 101)!.size).toBe(15);
      expect(result!.asks.find(a => a.price === 104)!.size).toBe(9);
    });

    it('should ignore delta before snapshot', () => {
      const freshManager = new OrderbookManagerService('BTCUSDT', logger);

      const delta = createDeltaUpdate(
        [['100', '10']],
        [['101', '8']],
        2,
      );

      freshManager.processUpdate(delta);

      expect(freshManager.isReady()).toBe(false);
      expect(freshManager.getSnapshot()).toBeNull();
    });
  });

  describe('Sorting', () => {
    it('should sort bids descending (highest first)', () => {
      const snapshot = createSnapshotUpdate(
        [['95', '5'], ['100', '10'], ['97', '7']], // Unsorted
        [['101', '8']],
      );

      manager.processUpdate(snapshot);

      const result = manager.getSnapshot();
      expect(result!.bids[0].price).toBe(100);
      expect(result!.bids[1].price).toBe(97);
      expect(result!.bids[2].price).toBe(95);
    });

    it('should sort asks ascending (lowest first)', () => {
      const snapshot = createSnapshotUpdate(
        [['100', '10']],
        [['105', '12'], ['101', '8'], ['103', '6']], // Unsorted
      );

      manager.processUpdate(snapshot);

      const result = manager.getSnapshot();
      expect(result!.asks[0].price).toBe(101);
      expect(result!.asks[1].price).toBe(103);
      expect(result!.asks[2].price).toBe(105);
    });
  });

  describe('Memory leak protection', () => {
    it('should trim orderbook if too large', () => {
      // Create snapshot with 150 levels (exceeds MAX_ORDERBOOK_LEVELS = 100)
      const largeBids: Array<[string, string]> = [];
      const largeAsks: Array<[string, string]> = [];

      for (let i = 0; i < 150; i++) {
        largeBids.push([`${100 - i}`, '10']);
        largeAsks.push([`${101 + i}`, '10']);
      }

      const snapshot = createSnapshotUpdate(largeBids, largeAsks);
      manager.processUpdate(snapshot);

      const result = manager.getSnapshot();

      // Should trim to MAX_ORDERBOOK_LEVELS
      expect(result!.bids.length).toBeLessThanOrEqual(100);
      expect(result!.asks.length).toBeLessThanOrEqual(100);

      // Should keep best levels
      expect(result!.bids[0].price).toBe(100); // Highest bid
      expect(result!.asks[0].price).toBe(101); // Lowest ask
    });
  });

  describe('Stale data detection', () => {
    it('should return null if snapshot is stale', async () => {
      const snapshot = createSnapshotUpdate(
        [['100', '10']],
        [['101', '8']],
      );

      manager.processUpdate(snapshot);

      // Manually set lastSnapshotTime to 2 minutes ago
      (manager as any).lastSnapshotTime = Date.now() - 120000;

      const result = manager.getSnapshot();
      expect(result).toBeNull();
    });

    it('should return snapshot if fresh', () => {
      const snapshot = createSnapshotUpdate(
        [['100', '10']],
        [['101', '8']],
      );

      manager.processUpdate(snapshot);

      const result = manager.getSnapshot();
      expect(result).not.toBeNull();
    });
  });

  describe('Reset', () => {
    it('should reset orderbook state', () => {
      const snapshot = createSnapshotUpdate(
        [['100', '10']],
        [['101', '8']],
      );

      manager.processUpdate(snapshot);
      expect(manager.isReady()).toBe(true);

      manager.reset();

      expect(manager.isReady()).toBe(false);
      expect(manager.getSnapshot()).toBeNull();

      const stats = manager.getStats();
      expect(stats.bidsCount).toBe(0);
      expect(stats.asksCount).toBe(0);
      expect(stats.initialized).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should return correct statistics', () => {
      const snapshot = createSnapshotUpdate(
        [['100', '10'], ['99', '5']],
        [['101', '8'], ['102', '12'], ['103', '6']],
      );

      manager.processUpdate(snapshot);

      const stats = manager.getStats();
      expect(stats.bidsCount).toBe(2);
      expect(stats.asksCount).toBe(3);
      expect(stats.initialized).toBe(true);
      expect(stats.lastUpdate).toBeGreaterThan(0);
    });
  });
});
