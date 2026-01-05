/**
 * Order Book Analyzer Tests
 *
 * Tests for order book analysis: imbalance, walls, spread detection.
 */

import {
  OrderBookAnalyzer,
  OrderBookData,
  OrderBookConfig,
} from '../../analyzers/orderbook.analyzer';
import { LoggerService, LogLevel } from '../../types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const createMockLogger = (): LoggerService => {
  return new LoggerService(LogLevel.ERROR, './logs', false);
};

const createOrderBookData = (
  bids: [number, number][],
  asks: [number, number][],
): OrderBookData => ({
  bids: bids.map(([price, size]) => ({ price, size })),
  asks: asks.map(([price, size]) => ({ price, size })),
  timestamp: Date.now(),
});

const defaultConfig: OrderBookConfig = {
  enabled: true,
  depth: 50,
  wallThreshold: 0.1, // 10% of total volume
  imbalanceThreshold: 1.5, // 1.5x ratio
  updateIntervalMs: 5000,
};

// ============================================================================
// TESTS
// ============================================================================

describe('OrderBookAnalyzer', () => {
  let analyzer: OrderBookAnalyzer;
  let logger: LoggerService;

  beforeEach(() => {
    logger = createMockLogger();
    analyzer = new OrderBookAnalyzer(defaultConfig, logger);
  });

  // ==========================================================================
  // TEST GROUP 1: Imbalance Detection
  // ==========================================================================

  describe('imbalance detection', () => {
    it('should detect BULLISH imbalance when bid volume > ask volume', () => {
      const orderBook = createOrderBookData(
        [
          [1.50, 100],
          [1.49, 100],
          [1.48, 100],
        ], // Total: 300
        [
          [1.51, 50],
          [1.52, 50],
          [1.53, 50],
        ], // Total: 150
      );

      const analysis = analyzer.analyze(orderBook, 1.50);

      expect(analysis.imbalance.direction).toBe('BULLISH');
      expect(analysis.imbalance.ratio).toBeCloseTo(2.0, 2); // 300 / 150
      expect(analysis.imbalance.bidVolume).toBe(300);
      expect(analysis.imbalance.askVolume).toBe(150);
    });

    it('should detect BEARISH imbalance when ask volume > bid volume', () => {
      const orderBook = createOrderBookData(
        [
          [1.50, 50],
          [1.49, 50],
          [1.48, 50],
        ], // Total: 150
        [
          [1.51, 100],
          [1.52, 100],
          [1.53, 100],
        ], // Total: 300
      );

      const analysis = analyzer.analyze(orderBook, 1.50);

      expect(analysis.imbalance.direction).toBe('BEARISH');
      expect(analysis.imbalance.ratio).toBeCloseTo(0.5, 2); // 150 / 300
      expect(analysis.imbalance.bidVolume).toBe(150);
      expect(analysis.imbalance.askVolume).toBe(300);
    });

    it('should detect NEUTRAL imbalance when volumes are balanced', () => {
      const orderBook = createOrderBookData(
        [
          [1.50, 100],
          [1.49, 100],
        ], // Total: 200
        [
          [1.51, 100],
          [1.52, 100],
        ], // Total: 200
      );

      const analysis = analyzer.analyze(orderBook, 1.50);

      expect(analysis.imbalance.direction).toBe('NEUTRAL');
      expect(analysis.imbalance.ratio).toBeCloseTo(1.0, 2); // 200 / 200
    });

    it('should calculate imbalance strength correctly', () => {
      const orderBook = createOrderBookData(
        [
          [1.50, 300],
          [1.49, 300],
        ], // Total: 600
        [
          [1.51, 100],
          [1.52, 100],
        ], // Total: 200
      );

      const analysis = analyzer.analyze(orderBook, 1.50);

      expect(analysis.imbalance.ratio).toBeCloseTo(3.0, 2); // 600 / 200
      expect(analysis.imbalance.strength).toBeGreaterThan(0);
      expect(analysis.imbalance.strength).toBeLessThanOrEqual(1.0);
    });

    it('should handle empty asks gracefully', () => {
      const orderBook = createOrderBookData(
        [[1.50, 100]],
        [], // No asks
      );

      const analysis = analyzer.analyze(orderBook, 1.50);

      expect(analysis.imbalance.ratio).toBe(0);
      // With 0 asks, ratio is 0, which is < 1/1.5 = 0.67, so BEARISH is correct
      expect(analysis.imbalance.direction).toBe('BEARISH');
    });
  });

  // ==========================================================================
  // TEST GROUP 2: Wall Detection
  // ==========================================================================

  describe('wall detection', () => {
    it('should detect BID wall (large buy order)', () => {
      const orderBook = createOrderBookData(
        [
          [1.50, 10],
          [1.49, 10],
          [1.48, 500], // WALL: 500 / 520 = 96% of total
        ],
        [
          [1.51, 10],
          [1.52, 10],
        ],
      );

      const analysis = analyzer.analyze(orderBook, 1.50);

      const bidWalls = analysis.walls.filter((w) => w.side === 'BID');
      expect(bidWalls.length).toBeGreaterThan(0);
      expect(bidWalls[0].price).toBe(1.48);
      expect(bidWalls[0].quantity).toBe(500);
      expect(bidWalls[0].percentOfTotal).toBeGreaterThan(90);
    });

    it('should detect ASK wall (large sell order)', () => {
      const orderBook = createOrderBookData(
        [
          [1.50, 10],
          [1.49, 10],
        ],
        [
          [1.51, 10],
          [1.52, 10],
          [1.53, 500], // WALL: 500 / 520 = 96% of total
        ],
      );

      const analysis = analyzer.analyze(orderBook, 1.50);

      const askWalls = analysis.walls.filter((w) => w.side === 'ASK');
      expect(askWalls.length).toBeGreaterThan(0);
      expect(askWalls[0].price).toBe(1.53);
      expect(askWalls[0].quantity).toBe(500);
      expect(askWalls[0].percentOfTotal).toBeGreaterThan(90);
    });

    it('should NOT detect walls if no large orders exist', () => {
      const orderBook = createOrderBookData(
        [
          [1.50, 9.5],
          [1.49, 9.5],
          [1.48, 9.5],
          [1.47, 9.5],
          [1.46, 9.5],
          [1.45, 9.5],
          [1.44, 9.5],
          [1.43, 9.5],
          [1.42, 9.5],
          [1.41, 9.5],
          [1.40, 5],
        ], // Total 100, each < 10%
        [
          [1.51, 9.5],
          [1.52, 9.5],
          [1.53, 9.5],
          [1.54, 9.5],
          [1.55, 9.5],
          [1.56, 9.5],
          [1.57, 9.5],
          [1.58, 9.5],
          [1.59, 9.5],
          [1.60, 9.5],
          [1.61, 5],
        ], // Total 100, each < 10%
      );

      const analysis = analyzer.analyze(orderBook, 1.50);

      expect(analysis.walls.length).toBe(0);
    });

    it('should calculate wall distance from current price correctly', () => {
      const currentPrice = 1.50;
      const orderBook = createOrderBookData(
        [[1.48, 500]], // 1.33% below current price
        [[1.53, 500]], // 2% above current price
      );

      const analysis = analyzer.analyze(orderBook, currentPrice);

      const bidWall = analysis.walls.find((w) => w.side === 'BID');
      const askWall = analysis.walls.find((w) => w.side === 'ASK');

      expect(bidWall).toBeDefined();
      expect(askWall).toBeDefined();
      expect(bidWall!.distance).toBeCloseTo(1.33, 1);
      expect(askWall!.distance).toBeCloseTo(2.0, 1);
    });

    it('should sort walls by distance from current price', () => {
      const orderBook = createOrderBookData(
        [
          [1.45, 500], // Far
          [1.49, 500], // Near
        ],
        [
          [1.55, 500], // Far
          [1.52, 500], // Near
        ],
      );

      const analysis = analyzer.analyze(orderBook, 1.50);

      expect(analysis.walls.length).toBe(4);
      // First wall should be nearest
      expect(analysis.walls[0].distance).toBeLessThan(analysis.walls[3].distance);
    });
  });

  // ==========================================================================
  // TEST GROUP 3: Spread Calculation
  // ==========================================================================

  describe('spread calculation', () => {
    it('should calculate spread correctly', () => {
      const orderBook = createOrderBookData(
        [[1.50, 100]], // Best bid: 1.50
        [[1.51, 100]], // Best ask: 1.51
      );

      const analysis = analyzer.analyze(orderBook, 1.505); // Mid-price

      // Spread = (1.51 - 1.50) / 1.505 * 100 ≈ 0.66%
      expect(analysis.spread).toBeCloseTo(0.66, 1);
    });

    it('should handle tight spread correctly', () => {
      const orderBook = createOrderBookData(
        [[1.5000, 100]],
        [[1.5001, 100]], // 0.01% spread
      );

      const analysis = analyzer.analyze(orderBook, 1.50005);

      expect(analysis.spread).toBeLessThan(0.01);
    });

    it('should return 0 spread when order book is empty', () => {
      const orderBook = createOrderBookData([], []);

      const analysis = analyzer.analyze(orderBook, 1.50);

      expect(analysis.spread).toBe(0);
    });
  });

  // ==========================================================================
  // TEST GROUP 4: Strongest Levels
  // ==========================================================================

  describe('strongest levels', () => {
    it('should find strongest bid level', () => {
      const orderBook = createOrderBookData(
        [
          [1.50, 50],
          [1.49, 200], // STRONGEST
          [1.48, 100],
        ],
        [[1.51, 50]],
      );

      const analysis = analyzer.analyze(orderBook, 1.50);

      expect(analysis.strongestBid).toBeDefined();
      if (!analysis.strongestBid) throw new Error('strongestBid should not be null');

      const bidPrice = typeof analysis.strongestBid === 'object' && 'price' in analysis.strongestBid
        ? analysis.strongestBid.price
        : analysis.strongestBid[0];
      const bidSize = typeof analysis.strongestBid === 'object' && 'size' in analysis.strongestBid
        ? analysis.strongestBid.size
        : analysis.strongestBid[1];
      expect(bidPrice).toBe(1.49);
      expect(bidSize).toBe(200);
    });

    it('should find strongest ask level', () => {
      const orderBook = createOrderBookData(
        [[1.50, 50]],
        [
          [1.51, 50],
          [1.52, 300], // STRONGEST
          [1.53, 100],
        ],
      );

      const analysis = analyzer.analyze(orderBook, 1.50);

      expect(analysis.strongestAsk).toBeDefined();
      if (!analysis.strongestAsk) throw new Error('strongestAsk should not be null');

      const askPrice = typeof analysis.strongestAsk === 'object' && 'price' in analysis.strongestAsk
        ? analysis.strongestAsk.price
        : analysis.strongestAsk[0];
      const askSize = typeof analysis.strongestAsk === 'object' && 'size' in analysis.strongestAsk
        ? analysis.strongestAsk.size
        : analysis.strongestAsk[1];
      expect(askPrice).toBe(1.52);
      expect(askSize).toBe(300);
    });

    it('should return null when no bids exist', () => {
      const orderBook = createOrderBookData([], [[1.51, 100]]);

      const analysis = analyzer.analyze(orderBook, 1.50);

      expect(analysis.strongestBid).toBeNull();
    });

    it('should return null when no asks exist', () => {
      const orderBook = createOrderBookData([[1.50, 100]], []);

      const analysis = analyzer.analyze(orderBook, 1.50);

      expect(analysis.strongestAsk).toBeNull();
    });
  });

  // ==========================================================================
  // TEST GROUP 5: Depth Info
  // ==========================================================================

  describe('depth information', () => {
    it('should return correct depth counts', () => {
      const orderBook = createOrderBookData(
        [
          [1.50, 10],
          [1.49, 10],
          [1.48, 10],
        ], // 3 bids
        [
          [1.51, 10],
          [1.52, 10],
        ], // 2 asks
      );

      const analysis = analyzer.analyze(orderBook, 1.50);

      expect(analysis.depth.bid).toBe(3);
      expect(analysis.depth.ask).toBe(2);
    });

    it('should handle empty order book', () => {
      const orderBook = createOrderBookData([], []);

      const analysis = analyzer.analyze(orderBook, 1.50);

      expect(analysis.depth.bid).toBe(0);
      expect(analysis.depth.ask).toBe(0);
    });
  });

  // ==========================================================================
  // TEST GROUP 6: Utility Methods
  // ==========================================================================

  describe('getSummary', () => {
    it('should return human-readable summary', () => {
      const orderBook = createOrderBookData(
        [[1.50, 200]],
        [[1.51, 100]],
      );

      const analysis = analyzer.analyze(orderBook, 1.505);
      const summary = analyzer.getSummary(analysis);

      expect(summary).toContain('Imbalance:');
      expect(summary).toContain('Spread:');
      expect(typeof summary).toBe('string');
    });

    it('should mention walls if present', () => {
      const orderBook = createOrderBookData(
        [
          [1.48, 500], // Wall (98% of bid volume)
          [1.47, 10],
        ],
        [[1.51, 10]],
      );

      const analysis = analyzer.analyze(orderBook, 1.50);
      const summary = analyzer.getSummary(analysis);

      expect(summary).toContain('Nearest wall');
      // Wall is BID, but nearest could be either side
      expect(summary.length).toBeGreaterThan(0);
    });

    it('should mention no walls if none detected', () => {
      // Create order book with many small orders (no single order > 10%)
      const bidOrders: [number, number][] = [];
      const askOrders: [number, number][] = [];
      for (let i = 0; i < 20; i++) {
        bidOrders.push([1.50 - i * 0.001, 5]); // 20 orders of 5 each = 5% each
        askOrders.push([1.51 + i * 0.001, 5]);
      }

      const orderBook = createOrderBookData(bidOrders, askOrders);
      const analysis = analyzer.analyze(orderBook, 1.505);
      const summary = analyzer.getSummary(analysis);

      expect(summary).toContain('No walls detected');
    });
  });

  describe('hasBlockingWall', () => {
    it('should detect blocking ASK wall for LONG', () => {
      const orderBook = createOrderBookData(
        [[1.50, 10]],
        [
          [1.51, 500], // Wall at 0.67% above
          [1.52, 10],
        ],
      );

      const analysis = analyzer.analyze(orderBook, 1.50);
      const hasWall = analyzer.hasBlockingWall(analysis, 'LONG', 2.0);

      expect(hasWall).toBe(true);
    });

    it('should detect blocking BID wall for SHORT', () => {
      const orderBook = createOrderBookData(
        [
          [1.49, 500], // Wall at 0.67% below
          [1.48, 10],
        ],
        [[1.51, 10]],
      );

      const analysis = analyzer.analyze(orderBook, 1.50);
      const hasWall = analyzer.hasBlockingWall(analysis, 'SHORT', 2.0);

      expect(hasWall).toBe(true);
    });

    it('should NOT detect wall if beyond maxDistance', () => {
      const orderBook = createOrderBookData(
        [[1.50, 10]],
        [[1.55, 500]], // Wall at 3.33% (> 2% maxDistance)
      );

      const analysis = analyzer.analyze(orderBook, 1.50);
      const hasWall = analyzer.hasBlockingWall(analysis, 'LONG', 2.0);

      expect(hasWall).toBe(false);
    });

    it('should NOT detect wall on opposite side', () => {
      const orderBook = createOrderBookData(
        [
          [1.49, 500], // BID wall (98% of total)
          [1.48, 10],
        ],
        [
          [1.51, 8],
          [1.52, 8],
          [1.53, 8],
          [1.54, 8],
          [1.55, 8],
          [1.56, 8],
          [1.57, 8],
          [1.58, 8],
          [1.59, 8],
          [1.60, 8],
          [1.61, 8],
          [1.62, 8],
          [1.63, 12],
        ], // Total 100, each < 10%
      );

      const analysis = analyzer.analyze(orderBook, 1.50);
      const hasWall = analyzer.hasBlockingWall(analysis, 'LONG', 2.0);

      expect(hasWall).toBe(false); // LONG looks at ASK walls, not BID
    });
  });

  // ==========================================================================
  // TEST GROUP 7: Real-World Scenarios
  // ==========================================================================

  describe('real-world scenarios', () => {
    it('should handle typical spot market order book', () => {
      const orderBook = createOrderBookData(
        [
          [1.5005, 50],
          [1.5000, 120],
          [1.4995, 80],
          [1.4990, 150],
          [1.4985, 90],
        ],
        [
          [1.5010, 60],
          [1.5015, 100],
          [1.5020, 85],
          [1.5025, 130],
          [1.5030, 70],
        ],
      );

      const analysis = analyzer.analyze(orderBook, 1.5008);

      expect(analysis).toBeDefined();
      expect(analysis.imbalance.direction).toBeDefined();
      expect(analysis.spread).toBeGreaterThan(0);
      expect(analysis.depth.bid).toBe(5);
      expect(analysis.depth.ask).toBe(5);
    });

    it('should handle whale manipulation scenario (large ask wall)', () => {
      const orderBook = createOrderBookData(
        [
          [1.50, 100],
          [1.49, 100],
        ],
        [
          [1.51, 100],
          [1.52, 10000], // WHALE WALL at 98.5% of total ask volume
          [1.53, 100],
        ],
      );

      const analysis = analyzer.analyze(orderBook, 1.50);

      const whaleWalls = analysis.walls.filter(
        (w) => w.side === 'ASK' && w.percentOfTotal > 90,
      );
      expect(whaleWalls.length).toBeGreaterThan(0);
      expect(whaleWalls[0].price).toBe(1.52);
    });

    it('should handle pump scenario (strong bullish imbalance)', () => {
      const orderBook = createOrderBookData(
        [
          [1.50, 500],
          [1.49, 500],
          [1.48, 500],
        ], // Strong buying: 1500
        [
          [1.51, 50],
          [1.52, 50],
        ], // Weak selling: 100
      );

      const analysis = analyzer.analyze(orderBook, 1.50);

      expect(analysis.imbalance.direction).toBe('BULLISH');
      expect(analysis.imbalance.ratio).toBeGreaterThan(10);
      expect(analysis.imbalance.strength).toBeGreaterThan(0.5);
    });
  });
});
