/**
 * Micro Wall Detector Service Tests
 */

import { MicroWallDetectorService } from '../../services/micro-wall-detector.service';
import {
  LoggerService,
  LogLevel,
  SignalDirection,
  MicroWallDetectorConfig,
  OrderBook,
} from '../../types';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createOrderBook(
  bids: Array<[number, number]>,
  asks: Array<[number, number]>,
): OrderBook {
  return {
    symbol: 'APEXUSDT',
    timestamp: Date.now(),
    bids,
    asks,
    updateId: 1,
  };
}

function createConfig(overrides?: Partial<MicroWallDetectorConfig>): MicroWallDetectorConfig {
  return {
    minWallSizePercent: 5,
    breakConfirmationMs: 1000,
    maxConfidence: 75,
    wallExpiryMs: 60000,
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('MicroWallDetectorService', () => {
  let detector: MicroWallDetectorService;
  let logger: LoggerService;
  let config: MicroWallDetectorConfig;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    config = createConfig();
    detector = new MicroWallDetectorService(config, logger);
  });

  describe('detectMicroWalls', () => {
    it('should detect micro wall on BID side (5% size)', () => {
      // Orderbook: Large bid at 1.0000 (5% of total volume)
      const orderbook = createOrderBook(
        [
          [1.0, 500], // 500 USDT (5% if total is 10,000 USDT)
          [0.999, 100],
          [0.998, 100],
        ],
        [
          [1.001, 4650], // Remaining volume on ask side
          [1.002, 100],
          [1.003, 100],
        ],
      );

      const walls = detector.detectMicroWalls(orderbook);

      expect(walls.length).toBeGreaterThan(0);
      const bidWall = walls.find((w) => w.side === 'BID' && w.price === 1.0);
      expect(bidWall).toBeDefined();
      expect(bidWall!.size).toBeCloseTo(500, 1);
      expect(bidWall!.percentOfTotal).toBeGreaterThanOrEqual(5);
      expect(bidWall!.broken).toBe(false);
    });

    it('should detect micro wall on ASK side (10% size)', () => {
      // Orderbook: Large ask at 1.001 (10% of total volume)
      const orderbook = createOrderBook(
        [
          [1.0, 4500], // Remaining volume on bid side
          [0.999, 100],
          [0.998, 100],
        ],
        [
          [1.001, 1000], // 1001 USDT (10% if total is ~10,000 USDT)
          [1.002, 100],
          [1.003, 100],
        ],
      );

      const walls = detector.detectMicroWalls(orderbook);

      expect(walls.length).toBeGreaterThan(0);
      const askWall = walls.find((w) => w.side === 'ASK' && w.price === 1.001);
      expect(askWall).toBeDefined();
      expect(askWall!.size).toBeGreaterThan(1000);
      expect(askWall!.percentOfTotal).toBeGreaterThanOrEqual(10);
      expect(askWall!.broken).toBe(false);
    });

    it('should ignore walls below threshold (4% size)', () => {
      // Orderbook: Small bid at 1.0 (only 4% of total)
      // Total = 10000 USDT → 4% = 400 USDT
      const orderbook = createOrderBook(
        [
          [1.0, 400], // 400 USDT (target 4%)
          [0.999, 100],
          [0.998, 100],
        ],
        [
          [1.001, 9000], // Large ask to make total = 10000 USDT
          [1.002, 200],
          [1.003, 200],
        ],
      );

      const walls = detector.detectMicroWalls(orderbook);

      const bidWall = walls.find((w) => w.side === 'BID' && w.price === 1.0);
      expect(bidWall).toBeUndefined(); // Below 5% threshold
    });

    it('should handle empty orderbook', () => {
      const orderbook = createOrderBook([], []);

      const walls = detector.detectMicroWalls(orderbook);

      expect(walls).toEqual([]);
    });

    it('should handle orderbook with zero volume', () => {
      const orderbook = createOrderBook(
        [[1.0, 0]],
        [[1.001, 0]],
      );

      const walls = detector.detectMicroWalls(orderbook);

      expect(walls).toEqual([]);
    });

    it('should calculate correct distance from current price', () => {
      // Current price: (1.0 + 1.001) / 2 = 1.0005
      // BID at 1.0: distance = (1.0005 - 1.0) / 1.0005 * 100 = ~0.05%
      const orderbook = createOrderBook(
        [[1.0, 500]],
        [[1.001, 4500]],
      );

      const walls = detector.detectMicroWalls(orderbook);

      const bidWall = walls.find((w) => w.side === 'BID');
      expect(bidWall).toBeDefined();
      expect(bidWall!.distance).toBeCloseTo(0.05, 2); // ~0.05% distance
    });
  });

  describe('calculateWallConfidence', () => {
    it('should calculate confidence based on size and distance', () => {
      const wall = {
        side: 'BID' as const,
        price: 1.0,
        size: 500,
        percentOfTotal: 5,
        distance: 0.1,
        timestamp: Date.now(),
        broken: false,
      };

      const confidence = detector.calculateWallConfidence(wall);

      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(config.maxConfidence);
    });

    it('should give higher confidence for larger walls', () => {
      const smallWall = {
        side: 'BID' as const,
        price: 1.0,
        size: 500,
        percentOfTotal: 5, // 5% wall
        distance: 0.1,
        timestamp: Date.now(),
        broken: false,
      };

      const largeWall = {
        ...smallWall,
        percentOfTotal: 10, // 10% wall (2x larger)
      };

      const smallConfidence = detector.calculateWallConfidence(smallWall);
      const largeConfidence = detector.calculateWallConfidence(largeWall);

      expect(largeConfidence).toBeGreaterThan(smallConfidence);
    });

    it('should give higher confidence for closer walls', () => {
      const farWall = {
        side: 'BID' as const,
        price: 1.0,
        size: 500,
        percentOfTotal: 5,
        distance: 1.0, // 1% away
        timestamp: Date.now(),
        broken: false,
      };

      const closeWall = {
        ...farWall,
        distance: 0.1, // 0.1% away (10x closer)
      };

      const farConfidence = detector.calculateWallConfidence(farWall);
      const closeConfidence = detector.calculateWallConfidence(closeWall);

      expect(closeConfidence).toBeGreaterThan(farConfidence);
    });

    it('should not exceed maxConfidence', () => {
      const massiveWall = {
        side: 'BID' as const,
        price: 1.0,
        size: 10000,
        percentOfTotal: 50, // 50% of orderbook
        distance: 0.01, // Very close
        timestamp: Date.now(),
        broken: false,
      };

      const confidence = detector.calculateWallConfidence(massiveWall);

      expect(confidence).toBeLessThanOrEqual(config.maxConfidence);
    });
  });

  describe('isWallBroken', () => {
    it('should detect BID wall break (price moved DOWN)', () => {
      const wall = {
        side: 'BID' as const,
        price: 1.0,
        size: 500,
        percentOfTotal: 5,
        distance: 0.1,
        timestamp: Date.now() - 2000, // Wall detected 2 seconds ago
        broken: false,
      };

      const currentPrice = 0.999; // Price moved DOWN through BID wall

      const isBroken = detector.isWallBroken(wall, currentPrice);

      expect(isBroken).toBe(true);
      expect(wall.broken).toBe(true);
    });

    it('should detect ASK wall break (price moved UP)', () => {
      const wall = {
        side: 'ASK' as const,
        price: 1.001,
        size: 500,
        percentOfTotal: 5,
        distance: 0.1,
        timestamp: Date.now() - 2000, // Wall detected 2 seconds ago
        broken: false,
      };

      const currentPrice = 1.002; // Price moved UP through ASK wall

      const isBroken = detector.isWallBroken(wall, currentPrice);

      expect(isBroken).toBe(true);
      expect(wall.broken).toBe(true);
    });

    it('should wait for confirmation period before confirming break', () => {
      const wall = {
        side: 'BID' as const,
        price: 1.0,
        size: 500,
        percentOfTotal: 5,
        distance: 0.1,
        timestamp: Date.now() - 500, // Wall detected only 500ms ago (< 1000ms confirmation)
        broken: false,
      };

      const currentPrice = 0.999; // Price moved DOWN

      const isBroken = detector.isWallBroken(wall, currentPrice);

      expect(isBroken).toBe(false); // Not confirmed yet
      expect(wall.broken).toBe(false);
    });

    it('should return true if wall already broken', () => {
      const wall = {
        side: 'BID' as const,
        price: 1.0,
        size: 500,
        percentOfTotal: 5,
        distance: 0.1,
        timestamp: Date.now() - 5000,
        broken: true, // Already broken
        brokenAt: Date.now() - 1000,
      };

      const currentPrice = 0.999;

      const isBroken = detector.isWallBroken(wall, currentPrice);

      expect(isBroken).toBe(true);
    });

    it('should NOT detect break if price did not cross wall (BID)', () => {
      const wall = {
        side: 'BID' as const,
        price: 1.0,
        size: 500,
        percentOfTotal: 5,
        distance: 0.1,
        timestamp: Date.now() - 2000,
        broken: false,
      };

      const currentPrice = 1.001; // Price ABOVE BID wall (not broken)

      const isBroken = detector.isWallBroken(wall, currentPrice);

      expect(isBroken).toBe(false);
      expect(wall.broken).toBe(false);
    });

    it('should NOT detect break if price did not cross wall (ASK)', () => {
      const wall = {
        side: 'ASK' as const,
        price: 1.001,
        size: 500,
        percentOfTotal: 5,
        distance: 0.1,
        timestamp: Date.now() - 2000,
        broken: false,
      };

      const currentPrice = 1.0; // Price BELOW ASK wall (not broken)

      const isBroken = detector.isWallBroken(wall, currentPrice);

      expect(isBroken).toBe(false);
      expect(wall.broken).toBe(false);
    });
  });

  describe('cleanupExpiredWalls', () => {
    it('should remove expired walls from tracking', () => {
      // Detect walls
      const orderbook = createOrderBook(
        [[1.0, 500]],
        [[1.001, 4500]],
      );

      detector.detectMicroWalls(orderbook);
      expect(detector.getTrackedWalls().length).toBeGreaterThan(0);

      // Fast-forward time by moving timestamp back for ALL walls
      const trackedWalls = detector.getTrackedWalls();
      const expiredTimestamp = Date.now() - config.wallExpiryMs - 1000;
      trackedWalls.forEach((wall) => {
        wall.timestamp = expiredTimestamp; // Mark all as expired
      });

      // Cleanup
      detector.cleanupExpiredWalls();

      // All walls should be removed
      expect(detector.getTrackedWalls().length).toBe(0);
    });

    it('should keep recent walls', () => {
      // Detect walls
      const orderbook = createOrderBook(
        [[1.0, 500]],
        [[1.001, 4500]],
      );

      detector.detectMicroWalls(orderbook);
      const initialCount = detector.getTrackedWalls().length;

      // Cleanup (walls are recent)
      detector.cleanupExpiredWalls();

      // Walls should still be there
      expect(detector.getTrackedWalls().length).toBe(initialCount);
    });
  });

  describe('getSignalDirection', () => {
    it('should return LONG for broken ASK wall', () => {
      const wall = {
        side: 'ASK' as const,
        price: 1.001,
        size: 500,
        percentOfTotal: 5,
        distance: 0.1,
        timestamp: Date.now(),
        broken: true,
        brokenAt: Date.now(),
      };

      const direction = detector.getSignalDirection(wall);

      expect(direction).toBe(SignalDirection.LONG);
    });

    it('should return SHORT for broken BID wall', () => {
      const wall = {
        side: 'BID' as const,
        price: 1.0,
        size: 500,
        percentOfTotal: 5,
        distance: 0.1,
        timestamp: Date.now(),
        broken: true,
        brokenAt: Date.now(),
      };

      const direction = detector.getSignalDirection(wall);

      expect(direction).toBe(SignalDirection.SHORT);
    });
  });

  describe('wasRecentlyBroken', () => {
    it('should return true for recently broken wall', () => {
      const wall = {
        side: 'BID' as const,
        price: 1.0,
        size: 500,
        percentOfTotal: 5,
        distance: 0.1,
        timestamp: Date.now() - 2000,
        broken: false,
      };

      // Break the wall
      detector.isWallBroken(wall, 0.999);

      // Check if recently broken
      const recentlyBroken = detector.wasRecentlyBroken('BID', 1.0);

      expect(recentlyBroken).toBe(true);
    });

    it('should return false for never broken wall', () => {
      const recentlyBroken = detector.wasRecentlyBroken('BID', 1.0);

      expect(recentlyBroken).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear all tracked and broken walls', () => {
      // Detect walls
      const orderbook = createOrderBook(
        [[1.0, 500]],
        [[1.001, 4500]],
      );

      detector.detectMicroWalls(orderbook);
      expect(detector.getTrackedWalls().length).toBeGreaterThan(0);

      // Reset
      detector.reset();

      // Everything should be cleared
      expect(detector.getTrackedWalls().length).toBe(0);
      expect(detector.wasRecentlyBroken('BID', 1.0)).toBe(false);
    });
  });

  describe('integration: full detection flow', () => {
    it('should detect → track → break → signal flow', () => {
      // 1. Detect micro wall
      const orderbook = createOrderBook(
        [[1.0, 500]], // BID wall
        [[1.001, 4500]],
      );

      const walls = detector.detectMicroWalls(orderbook);
      expect(walls.length).toBeGreaterThan(0);

      const bidWall = walls.find((w) => w.side === 'BID');
      expect(bidWall).toBeDefined();

      // 2. Calculate confidence
      const confidence = detector.calculateWallConfidence(bidWall!);
      expect(confidence).toBeGreaterThan(0);

      // 3. Simulate time passing (for confirmation)
      bidWall!.timestamp = Date.now() - 2000;

      // 4. Break wall (price moves down)
      const isBroken = detector.isWallBroken(bidWall!, 0.999);
      expect(isBroken).toBe(true);

      // 5. Get signal direction
      const direction = detector.getSignalDirection(bidWall!);
      expect(direction).toBe(SignalDirection.SHORT);

      // 6. Check if recently broken (prevents re-entry)
      const recentlyBroken = detector.wasRecentlyBroken('BID', 1.0);
      expect(recentlyBroken).toBe(true);
    });
  });
});
