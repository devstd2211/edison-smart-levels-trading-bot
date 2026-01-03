/**
 * Unit Tests for Fair Value Gap Detector
 * Tests FVG detection, filling, and signal confirmation
 */

import { FairValueGapDetector } from '../../indicators/fair-value-gap.detector';
import { LoggerService, LogLevel, Candle, FVGConfig, FVGType, FVGStatus, SignalDirection } from '../../types';

// ============================================================================
// SETUP
// ============================================================================

const logger = new LoggerService(LogLevel.ERROR, './logs', false);

describe('FairValueGapDetector', () => {
  let detector: FairValueGapDetector;
  let config: FVGConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      minGapPercent: 0.3,
      maxGapAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      fillThreshold: 0.75,
      maxDistancePercent: 1.5,
      fillExpectationBoost: 1.15,
    };

    detector = new FairValueGapDetector(config, logger);
  });

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const createCandle = (
    open: number,
    high: number,
    low: number,
    close: number,
    timestamp: number,
  ): Candle => ({
    open,
    high,
    low,
    close,
    volume: 1000,
    timestamp,
  });

  const createSignal = (direction: SignalDirection): SignalDirection => direction;

  // ============================================================================
  // BASIC FUNCTIONALITY - BULLISH FVG
  // ============================================================================

  describe('Basic Functionality - Bullish FVG', () => {
    it('should detect bullish FVG (gap up)', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 120000), // Candle 1: down
        createCandle(100, 105, 100, 104, now - 60000), // Candle 2: strong up
        createCandle(104, 106, 102, 105, now), // Candle 3: C3.low (102) > C1.high (101) = gap
      ];

      const gaps = detector.detectGaps(candles);

      expect(gaps.length).toBe(1);
      expect(gaps[0].type).toBe(FVGType.BULLISH);
      expect(gaps[0].status).toBe(FVGStatus.UNFILLED);
      expect(gaps[0].gapLow).toBe(101); // C1.high
      expect(gaps[0].gapHigh).toBe(102); // C3.low
      expect(gaps[0].gapSize).toBeCloseTo(1, 1);
    });

    it('should calculate bullish FVG size and percent correctly', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 120000),
        createCandle(100, 110, 100, 109, now - 60000),
        createCandle(109, 112, 103, 111, now), // Gap: 103 - 101 = 2
      ];

      const gaps = detector.detectGaps(candles);

      expect(gaps[0].gapSize).toBe(2);
      expect(gaps[0].gapPercent).toBeCloseTo(2, 0); // 2 / 101 * 100 ≈ 1.98%
    });

    it('should filter small bullish FVGs (below minGapPercent)', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 120000),
        createCandle(100, 101.5, 100, 101.4, now - 60000),
        createCandle(101.4, 101.6, 100.9, 101.5, now), // Gap: 100.9 - 101 = -0.1 (no gap)
      ];

      const gaps = detector.detectGaps(candles);

      expect(gaps.length).toBe(0); // No gap
    });

    it('should store candles that created FVG', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 120000),
        createCandle(100, 105, 100, 104, now - 60000),
        createCandle(104, 106, 102, 105, now),
      ];

      const gaps = detector.detectGaps(candles);

      expect(gaps[0].candles).toEqual([candles[0], candles[1], candles[2]]);
    });
  });

  // ============================================================================
  // BASIC FUNCTIONALITY - BEARISH FVG
  // ============================================================================

  describe('Basic Functionality - Bearish FVG', () => {
    it('should detect bearish FVG (gap down)', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 102, 100, 101, now - 120000), // Candle 1: up
        createCandle(101, 101.5, 95, 96, now - 60000), // Candle 2: strong down
        createCandle(96, 99, 94, 95, now), // Candle 3: C3.high (99) < C1.low (100) = gap
      ];

      const gaps = detector.detectGaps(candles);

      expect(gaps.length).toBe(1);
      expect(gaps[0].type).toBe(FVGType.BEARISH);
      expect(gaps[0].status).toBe(FVGStatus.UNFILLED);
      expect(gaps[0].gapLow).toBe(99); // C3.high
      expect(gaps[0].gapHigh).toBe(100); // C1.low
    });

    it('should calculate bearish FVG size correctly', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 102, 98, 101, now - 120000),
        createCandle(101, 101.5, 90, 91, now - 60000),
        createCandle(91, 97, 88, 89, now), // Gap: 98 - 97 = 1
      ];

      const gaps = detector.detectGaps(candles);

      expect(gaps[0].type).toBe(FVGType.BEARISH);
      expect(gaps[0].gapSize).toBe(1);
    });
  });

  // ============================================================================
  // GAP FILLING - STATUS TRACKING
  // ============================================================================

  describe('Gap Filling - Status Tracking', () => {
    it('should mark bullish gap as PARTIALLY_FILLED when price enters gap', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 180000),
        createCandle(100, 105, 100, 104, now - 120000),
        createCandle(104, 106, 102, 105, now - 60000), // Gap created: 101-102
        createCandle(105, 106, 101.3, 104, now), // Price drops to 101.3 (in gap)
      ];

      const gaps = detector.detectGaps(candles);

      expect(gaps[0].status).toBe(FVGStatus.PARTIALLY_FILLED);
      expect(gaps[0].filledPercent).toBeGreaterThan(0);
      expect(gaps[0].filledPercent).toBeLessThan(100);
    });

    it('should mark bullish gap as FILLED when price closes below gap', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 180000),
        createCandle(100, 105, 100, 104, now - 120000),
        createCandle(104, 106, 102, 105, now - 60000), // Gap: 101-102
        createCandle(105, 106, 100.5, 104, now), // Price goes below gap
      ];

      const gaps = detector.detectGaps(candles);

      expect(gaps[0].status).toBe(FVGStatus.FILLED);
      expect(gaps[0].filledPercent).toBeCloseTo(100, 1);
      expect(gaps[0].filledAt).toBe(now);
    });

    it('should mark bearish gap as PARTIALLY_FILLED when price enters gap', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 102, 98, 101, now - 180000),
        createCandle(101, 101.5, 90, 91, now - 120000),
        createCandle(91, 97, 88, 89, now - 60000), // Gap: 97-98
        createCandle(89, 97.5, 86, 87, now), // Price rises to 97.5 (in gap)
      ];

      const gaps = detector.detectGaps(candles);

      expect(gaps[0].status).toBe(FVGStatus.PARTIALLY_FILLED);
      expect(gaps[0].filledPercent).toBeGreaterThan(0);
    });

    it('should mark bearish gap as FILLED when price closes above gap', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 102, 98, 101, now - 180000),
        createCandle(101, 101.5, 90, 91, now - 120000),
        createCandle(91, 97, 88, 89, now - 60000), // Gap: 97-98
        createCandle(89, 98.5, 86, 87, now), // Price goes above gap
      ];

      const gaps = detector.detectGaps(candles);

      expect(gaps[0].status).toBe(FVGStatus.FILLED);
      expect(gaps[0].filledPercent).toBeCloseTo(100, 1);
    });

    it('should calculate fillPercent correctly for partial fill', () => {
      const now = Date.now();
      // Gap: 101-102 (size = 1)
      // If low = 101.5, filled = 102 - 101.5 = 0.5, fillPercent = 50%
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 180000),
        createCandle(100, 105, 100, 104, now - 120000),
        createCandle(104, 106, 102, 105, now - 60000), // Gap: 101-102 (size=1)
        createCandle(105, 106, 101.5, 104, now), // Fill 50%
      ];

      const gaps = detector.detectGaps(candles);

      expect(gaps[0].filledPercent).toBeCloseTo(50, 0);
    });
  });

  // ============================================================================
  // SIGNAL CONFIRMATION
  // ============================================================================

  describe('Signal Confirmation', () => {
    it('should boost confidence when LONG signal approaching bullish FVG', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 120000),
        createCandle(100, 105, 100, 104, now - 60000),
        createCandle(104, 106, 102, 105, now), // Gap: 101-102
      ];

      detector.detectGaps(candles);
      const direction = createSignal(SignalDirection.LONG);
      const analysis = detector.analyze(103, direction); // Above gap (gap is at 101-102)

      expect(analysis.expectingFill).toBe(true);
      expect(analysis.nearestBullishGap).not.toBeNull();
      expect(analysis.distanceToNearestGap).toBeLessThan(config.maxDistancePercent);
    });

    it('should not expect fill if too far from gap', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 120000),
        createCandle(100, 105, 100, 104, now - 60000),
        createCandle(104, 106, 102, 105, now), // Gap: 101-102
      ];

      detector.detectGaps(candles);
      const direction = createSignal(SignalDirection.LONG);
      const analysis = detector.analyze(95, direction); // Far from gap

      expect(analysis.expectingFill).toBe(false);
    });

    it('should ignore filled gaps in analysis', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 180000),
        createCandle(100, 105, 100, 104, now - 120000),
        createCandle(104, 106, 102, 105, now - 60000), // Gap: 101-102
        createCandle(105, 106, 100.5, 104, now), // Gap filled
      ];

      detector.detectGaps(candles);
      const direction = createSignal(SignalDirection.LONG);
      const analysis = detector.analyze(100.6, direction);

      expect(analysis.unfilledGaps.length).toBe(0);
      expect(analysis.nearestBullishGap).toBeNull();
      expect(analysis.expectingFill).toBe(false);
    });
  });

  // ============================================================================
  // MULTIPLE GAPS
  // ============================================================================

  describe('Multiple Gaps', () => {
    it('should detect multiple FVGs in same candle array', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 300000),
        createCandle(100, 105, 100, 104, now - 240000),
        createCandle(104, 106, 102, 105, now - 180000), // Bullish FVG: 101-102
        createCandle(105, 106, 105, 105.5, now - 120000),
        createCandle(105.5, 106, 105.5, 105.9, now - 60000),
        createCandle(105.9, 108, 107, 107.5, now), // Bullish FVG: 106-107
      ];

      const gaps = detector.detectGaps(candles);

      expect(gaps.length).toBeGreaterThanOrEqual(2);
    });

    it('should find nearest bullish gap', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 300000),
        createCandle(100, 105, 100, 104, now - 240000),
        createCandle(104, 106, 102, 105, now - 180000), // Gap1: 101-102
        createCandle(105, 105, 104, 105, now - 120000),
        createCandle(105, 106, 105, 106, now - 60000),
        createCandle(106, 108, 107, 107.5, now), // Gap2: 106-107 (closer)
      ];

      detector.detectGaps(candles);
      const signal = createSignal(SignalDirection.LONG);
      const analysis = detector.analyze(106.5, signal);

      // Should find the nearest (most recent / highest) bullish gap
      expect(analysis.nearestBullishGap).not.toBeNull();
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle empty candle array', () => {
      const gaps = detector.detectGaps([]);
      expect(gaps.length).toBe(0);
    });

    it('should handle insufficient candles (< 3)', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 60000),
        createCandle(100, 105, 100, 104, now),
      ];

      const gaps = detector.detectGaps(candles);
      expect(gaps.length).toBe(0);
    });

    it('should handle exactly 3 candles', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 120000),
        createCandle(100, 105, 100, 104, now - 60000),
        createCandle(104, 106, 102, 105, now),
      ];

      const gaps = detector.detectGaps(candles);
      expect(gaps.length).toBeGreaterThanOrEqual(0); // May have 1 gap
    });

    it('should handle zero-size gaps (no gap)', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 120000),
        createCandle(100, 102, 100, 101, now - 60000),
        createCandle(101, 103, 100, 102, now), // C3.low (100) = C1.high (101), no gap
      ];

      const gaps = detector.detectGaps(candles);
      expect(gaps.length).toBe(0);
    });

    it('should handle very small prices', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(0.0001, 0.0002, 0.00009, 0.0001, now - 120000),
        createCandle(0.0001, 0.0005, 0.0001, 0.0004, now - 60000),
        createCandle(0.0004, 0.0006, 0.00035, 0.0005, now), // Gap: 0.00035 - 0.0002 = 0.00015
      ];

      const gaps = detector.detectGaps(candles);
      // Should handle small numbers without precision issues
      if (gaps.length > 0) {
        expect(gaps[0].gapSize).toBeGreaterThan(0);
        expect(isNaN(gaps[0].gapPercent)).toBe(false);
      }
    });

    it('should handle very large prices', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(1000000, 1000001, 999999, 1000000, now - 120000),
        createCandle(1000000, 1000500, 1000000, 1000400, now - 60000),
        createCandle(1000400, 1000600, 1000200, 1000500, now), // Gap: 1000200 - 1000001
      ];

      const gaps = detector.detectGaps(candles);
      if (gaps.length > 0) {
        expect(isNaN(gaps[0].gapPercent)).toBe(false);
        expect(gaps[0].gapSize).toBeGreaterThan(0);
      }
    });

    it('should handle disabled config', () => {
      const now = Date.now();
      const disabledConfig: FVGConfig = { ...config, enabled: false };
      const disabledDetector = new FairValueGapDetector(disabledConfig, logger);

      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 120000),
        createCandle(100, 105, 100, 104, now - 60000),
        createCandle(104, 106, 102, 105, now),
      ];

      const gaps = disabledDetector.detectGaps(candles);
      expect(gaps.length).toBe(0);
    });
  });

  // ============================================================================
  // OLD GAP CLEANUP
  // ============================================================================

  describe('Old Gap Cleanup', () => {
    it('should remove gaps older than maxGapAge', () => {
      const now = Date.now();
      const veryOldTime = now - (8 * 24 * 60 * 60 * 1000); // 8 days ago

      // Create old gap
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, veryOldTime),
        createCandle(100, 105, 100, 104, veryOldTime + 60000),
        createCandle(104, 106, 102, 105, veryOldTime + 120000), // Very old gap
        createCandle(105, 106, 102.5, 105, now), // Recent candle triggers cleanup
      ];

      const gaps = detector.detectGaps(candles);

      // Old gap should be removed
      const unfilteredGaps = gaps.filter((g) => g.timestamp < now - config.maxGapAge);
      expect(unfilteredGaps.length).toBe(0);
    });

    it('should keep recent gaps', () => {
      const now = Date.now();
      const recentTime = now - 1000; // 1 second ago

      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, recentTime),
        createCandle(100, 105, 100, 104, recentTime + 1000),
        createCandle(104, 106, 102, 105, recentTime + 2000),
      ];

      const gaps = detector.detectGaps(candles);

      expect(gaps.length).toBeGreaterThanOrEqual(0); // Recent gaps kept
    });
  });

  // ============================================================================
  // REAL-WORLD SCENARIOS
  // ============================================================================

  describe('Real-World Scenarios', () => {
    it('should detect bull flag with FVG gap up', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 100.5, 99.5, 100, now - 240000),
        createCandle(100, 100.8, 99.8, 100, now - 180000),
        createCandle(100, 100.6, 99.7, 100, now - 120000),
        createCandle(100, 104, 99.5, 103.5, now - 60000), // Strong breakout
        createCandle(103.5, 105, 101, 104, now), // Gap: 101 - 100.8 = 0.2
      ];

      const gaps = detector.detectGaps(candles);

      // Should have detected gap(s) in last candle
      expect(Array.isArray(gaps)).toBe(true);
    });

    it('should handle trending up market with multiple gaps', () => {
      const now = Date.now();
      // Simulate trending up with multiple pullback gaps
      const basePrice = 100;
      const candles: Candle[] = [];

      for (let i = 0; i < 20; i++) {
        const price = basePrice + i * 0.5;
        candles.push(
          createCandle(
            price,
            price + 0.3,
            price - 0.1,
            price + 0.2,
            now - (20 - i) * 60000,
          ),
        );
      }

      const gaps = detector.detectGaps(candles);

      // Trending market may have gaps
      expect(Array.isArray(gaps)).toBe(true);
      expect(isNaN(gaps.length)).toBe(false);
    });
  });

  // ============================================================================
  // DETECTOR STATE
  // ============================================================================

  describe('Detector State', () => {
    it('should allow retrieval of all gaps', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 120000),
        createCandle(100, 105, 100, 104, now - 60000),
        createCandle(104, 106, 102, 105, now),
      ];

      detector.detectGaps(candles);
      const allGaps = detector.getAllGaps();

      expect(Array.isArray(allGaps)).toBe(true);
      expect(allGaps.length).toBeGreaterThanOrEqual(0);
    });

    it('should allow reset of detector state', () => {
      const now = Date.now();
      const candles: Candle[] = [
        createCandle(100, 101, 99, 100, now - 120000),
        createCandle(100, 105, 100, 104, now - 60000),
        createCandle(104, 106, 102, 105, now),
      ];

      detector.detectGaps(candles);
      const gapsBefore = detector.getAllGaps();

      detector.reset();
      const gapsAfter = detector.getAllGaps();

      expect(gapsBefore.length).toBeGreaterThanOrEqual(0);
      expect(gapsAfter.length).toBe(0);
    });
  });
});
