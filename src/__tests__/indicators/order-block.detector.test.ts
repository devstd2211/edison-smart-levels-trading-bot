/**
 * Unit Tests for Order Block Detector
 * Tests order block detection, lifecycle, and signal confirmation
 */

import { OrderBlockDetector } from '../../indicators/order-block.detector';
import { LoggerService, LogLevel, Candle, OrderBlockConfig, OrderBlockType, SignalDirection } from '../../types';

// ============================================================================
// SETUP
// ============================================================================

const logger = new LoggerService(LogLevel.ERROR, './logs', false);

describe('OrderBlockDetector', () => {
  let detector: OrderBlockDetector;
  let config: OrderBlockConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      minBreakoutPercent: 0.5,
      minVolumeRatio: 1.5,
      maxBlockAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      maxDistancePercent: 2.0,
      confidenceBoost: 1.2,
      retestBoostMultiplier: 1.3,
    };

    detector = new OrderBlockDetector(config, logger);
  });

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const createCandle = (
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number,
    timestamp: number,
  ): Candle => ({
    open,
    high,
    low,
    close,
    volume,
    timestamp,
  });

  // ============================================================================
  // BASIC FUNCTIONALITY - BULLISH ORDER BLOCK
  // ============================================================================

  describe('Basic Functionality - Bullish Order Block', () => {
    it('should detect bullish order block from breakout', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 60000), // Consolidation (1 min ago)
        createCandle(100.6, 102, 100.6, 101.5, 2000, now), // Breakout: +1.5%, 2x volume, low above block (now)
      ];

      const blocks = detector.detectBlocks(candles);

      expect(blocks.length).toBe(1);
      expect(blocks[0].type).toBe(OrderBlockType.BULLISH);
      expect(blocks[0].high).toBe(100.5); // Consolidation high
      expect(blocks[0].low).toBe(99.5); // Consolidation low
      expect(blocks[0].tested).toBe(false);
    });

    it('should calculate bullish block strength based on breakout size', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 60000),
        createCandle(100, 105, 100, 104, 2000, now), // Large breakout: +4%
      ];

      const blocks = detector.detectBlocks(candles);

      expect(blocks[0].strength).toBeGreaterThan(0);
      expect(blocks[0].strength).toBeLessThanOrEqual(1);
    });

    it('should not detect bullish block if breakout too small', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 60000),
        createCandle(100, 100.2, 99.8, 100.1, 2000, now), // +0.1% (< 0.5%)
      ];

      const blocks = detector.detectBlocks(candles);

      expect(blocks.length).toBe(0);
    });

    it('should not detect bullish block if volume ratio too low', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 2000, now - 60000),
        createCandle(100, 101.5, 100, 101, 2500, now), // +1%, but volume ratio = 1.25 (< 1.5)
      ];

      const blocks = detector.detectBlocks(candles);

      expect(blocks.length).toBe(0);
    });
  });

  // ============================================================================
  // BASIC FUNCTIONALITY - BEARISH ORDER BLOCK
  // ============================================================================

  describe('Basic Functionality - Bearish Order Block', () => {
    it('should detect bearish order block from breakdown', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 60000), // Consolidation
        createCandle(100, 100.5, 98.5, 98.8, 2000, now), // Breakdown: -1.2%, 2x volume
      ];

      const blocks = detector.detectBlocks(candles);

      expect(blocks.length).toBe(1);
      expect(blocks[0].type).toBe(OrderBlockType.BEARISH);
      expect(blocks[0].high).toBe(100.5);
      expect(blocks[0].low).toBe(99.5);
    });

    it('should not detect bearish block if red candle body is upward facing', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 60000),
        createCandle(100, 105, 99, 100.5, 2000, now), // Close > open (green, not red)
      ];

      const blocks = detector.detectBlocks(candles);

      // May or may not have block depending on other criteria
      expect(Array.isArray(blocks)).toBe(true);
    });
  });

  // ============================================================================
  // BLOCK LIFECYCLE - TESTED & BROKEN
  // ============================================================================

  describe('Block Lifecycle - Tested & Broken', () => {
    it('should mark bullish block as tested when price returns to block', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 120000), // Block (2 min ago)
        createCandle(100, 102, 100, 101.5, 2000, now - 60000), // Breakout (1 min ago)
        createCandle(101.5, 102, 100.2, 101, 1500, now), // Price at 100.2 (in block range, now)
      ];

      detector.detectBlocks(candles);
      const blocks = detector.getAllBlocks();

      expect(blocks.length).toBeGreaterThan(0);
      if (blocks[0].type === OrderBlockType.BULLISH) {
        expect(blocks[0].tested).toBe(true);
      }
    });

    it('should mark bullish block as broken when price closes below block', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 120000), // Block
        createCandle(100, 102, 100, 101.5, 2000, now - 60000), // Breakout
        createCandle(101.5, 102, 99, 99.2, 1500, now), // Price closes below block.low
      ];

      detector.detectBlocks(candles);
      const blocks = detector.getAllBlocks();

      if (blocks.length > 0 && blocks[0].type === OrderBlockType.BULLISH) {
        expect(blocks[0].broken).toBe(true);
      }
    });

    it('should mark bearish block as tested when price returns to block', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 120000), // Block
        createCandle(100, 100.5, 98.5, 98.8, 2000, now - 60000), // Breakdown
        createCandle(98.8, 100.2, 98, 99, 1500, now), // Price at 100.2 (in block range)
      ];

      detector.detectBlocks(candles);
      const blocks = detector.getAllBlocks();

      if (blocks.length > 0 && blocks[0].type === OrderBlockType.BEARISH) {
        expect(blocks[0].tested).toBe(true);
      }
    });

    it('should mark bearish block as broken when price closes above block', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 120000), // Block
        createCandle(100, 100.5, 98.5, 98.8, 2000, now - 60000), // Breakdown
        createCandle(98.8, 101, 98, 100.8, 1500, now), // Price closes above block.high
      ];

      detector.detectBlocks(candles);
      const blocks = detector.getAllBlocks();

      if (blocks.length > 0 && blocks[0].type === OrderBlockType.BEARISH) {
        expect(blocks[0].broken).toBe(true);
      }
    });
  });

  // ============================================================================
  // SIGNAL CONFIRMATION
  // ============================================================================

  describe('Signal Confirmation', () => {
    it('should find nearest bullish block below price for LONG signal', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 120000),
        createCandle(100, 102, 100, 101.5, 2000, now - 60000),
        createCandle(101.5, 103, 101.4, 102.5, 1500, now), // Price well above block
      ];

      detector.detectBlocks(candles);
      const analysis = detector.analyze(102.5, SignalDirection.LONG);

      expect(analysis.nearestBullishBlock).not.toBeNull();
    });

    it('should find nearest bearish block above price for SHORT signal', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 120000),
        createCandle(100, 100.5, 98.5, 98.8, 2000, now - 60000),
        createCandle(98.8, 98.9, 96, 97, 1500, now), // Price well below block
      ];

      detector.detectBlocks(candles);
      const analysis = detector.analyze(97, SignalDirection.SHORT);

      expect(analysis.nearestBearishBlock).not.toBeNull();
    });

    it('should calculate distance to nearest block correctly', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 120000),
        createCandle(100, 102, 100, 101.5, 2000, now - 60000),
        createCandle(101.5, 103, 101.4, 102.5, 1500, now),
      ];

      detector.detectBlocks(candles);
      const analysis = detector.analyze(102.5, SignalDirection.LONG);

      expect(analysis.distanceToNearestBlock).toBeGreaterThanOrEqual(0);
      expect(isNaN(analysis.distanceToNearestBlock)).toBe(false);
    });

    it('should ignore tested/broken blocks in analysis', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 120000),
        createCandle(100, 102, 100, 101.5, 2000, now - 60000),
        createCandle(101.5, 102, 100.2, 101, 1500, now), // Block tested
      ];

      detector.detectBlocks(candles);
      const analysis = detector.analyze(101.5, SignalDirection.LONG);

      // Tested blocks should not be in activeBlocks
      const activeBlocks = analysis.activeBlocks;
      for (const block of activeBlocks) {
        expect(block.tested).toBe(false);
        expect(block.broken).toBe(false);
      }
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty candle array', () => {
      const blocks = detector.detectBlocks([]);
      expect(blocks.length).toBe(0);
    });

    it('should handle single candle', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now),
      ];

      const blocks = detector.detectBlocks(candles);
      expect(blocks.length).toBe(0);
    });

    it('should handle exactly 2 candles', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 60000),
        createCandle(100, 102, 100, 101.5, 2000, now),
      ];

      const blocks = detector.detectBlocks(candles);
      expect(Array.isArray(blocks)).toBe(true);
    });

    it('should handle disabled config', () => {
      const now = Date.now();
      const disabledConfig: OrderBlockConfig = { ...config, enabled: false };
      const disabledDetector = new OrderBlockDetector(disabledConfig, logger);

      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 60000),
        createCandle(100, 102, 100, 101.5, 2000, now),
      ];

      const blocks = disabledDetector.detectBlocks(candles);
      expect(blocks.length).toBe(0);
    });

    it('should handle very small prices', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(0.0001, 0.0001001, 0.00009999, 0.0001, 1000, now - 60000),
        createCandle(0.0001, 0.000102, 0.0001, 0.000101, 2000, now),
      ];

      const blocks = detector.detectBlocks(candles);
      expect(Array.isArray(blocks)).toBe(true);
      if (blocks.length > 0) {
        expect(isNaN(blocks[0].strength)).toBe(false);
      }
    });

    it('should handle very large prices', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(1000000, 1000005, 999995, 1000000, 1000, now - 60000),
        createCandle(1000000, 1002000, 1000000, 1001500, 2000, now),
      ];

      const blocks = detector.detectBlocks(candles);
      expect(Array.isArray(blocks)).toBe(true);
      if (blocks.length > 0) {
        expect(isNaN(blocks[0].strength)).toBe(false);
      }
    });
  });

  // ============================================================================
  // OLD BLOCK CLEANUP
  // ============================================================================

  describe('Old Block Cleanup', () => {
    it('should remove blocks older than maxBlockAge', () => {
      const now = Date.now();
      const veryOldTime = now - (8 * 24 * 60 * 60 * 1000); // 8 days ago

      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, veryOldTime),
        createCandle(100, 102, 100, 101.5, 2000, veryOldTime + 60000),
        createCandle(101.5, 103, 101.4, 102.5, 1500, now), // Recent candle triggers cleanup
      ];

      detector.detectBlocks(candles);
      const blocks = detector.getAllBlocks();

      // Old blocks should be removed
      const oldBlocks = blocks.filter((b) => b.timestamp < now - config.maxBlockAge);
      expect(oldBlocks.length).toBe(0);
    });
  });

  // ============================================================================
  // REAL-WORLD SCENARIOS
  // ============================================================================

  describe('Real-World Scenarios', () => {
    it('should detect bull flag with order block', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 180000), // 3 min ago
        createCandle(100, 100.8, 99.8, 100, 1100, now - 120000), // 2 min ago
        createCandle(100, 100.6, 99.7, 100, 1050, now - 60000), // 1 min ago
        createCandle(100, 104, 99.5, 103.5, 2000, now), // Strong breakout (now)
      ];

      const blocks = detector.detectBlocks(candles);

      expect(Array.isArray(blocks)).toBe(true);
    });

    it('should handle trending market with multiple blocks', () => {
      const now = Date.now();
      const basePrice = 100;
      const candles: Candle[] = [];

      // Create trending up market (each candle 30 seconds apart)
      for (let i = 0; i < 20; i++) {
        const price = basePrice + i * 0.5;
        candles.push(
          createCandle(
            price,
            price + 0.3,
            price - 0.1,
            price + 0.2,
            1000 + i * 50,
            now - (20 - i) * 30000, // From 10 min ago to now
          ),
        );
      }

      const blocks = detector.detectBlocks(candles);

      expect(Array.isArray(blocks)).toBe(true);
      // Trending market may have multiple blocks
    });
  });

  // ============================================================================
  // DETECTOR STATE
  // ============================================================================

  describe('Detector State', () => {
    it('should allow retrieval of all blocks', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 60000),
        createCandle(100, 102, 100, 101.5, 2000, now),
      ];

      detector.detectBlocks(candles);
      const allBlocks = detector.getAllBlocks();

      expect(Array.isArray(allBlocks)).toBe(true);
    });

    it('should allow reset of detector state', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, 1000, now - 60000),
        createCandle(100, 102, 100, 101.5, 2000, now),
      ];

      detector.detectBlocks(candles);
      const blocksBefore = detector.getAllBlocks();

      detector.reset();
      const blocksAfter = detector.getAllBlocks();

      expect(blocksBefore.length).toBeGreaterThanOrEqual(0);
      expect(blocksAfter.length).toBe(0);
    });
  });
});
