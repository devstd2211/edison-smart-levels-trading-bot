/**
 * Unit Tests for DivergenceDetector
 */

import { DivergenceDetector, DivergenceType } from '../../analyzers/divergence.detector';
import { LoggerService, LogLevel, SwingPoint, SwingPointType } from '../../types';

// Mock logger
const logger = new LoggerService(LogLevel.ERROR, './logs', false);

describe('DivergenceDetector', () => {
  let detector: DivergenceDetector;

  beforeEach(() => {
    detector = new DivergenceDetector(logger, {
      minStrength: 0.3,
      priceDiffPercent: 0.2,
    });
  });

  // ============================================================================
  // BEARISH DIVERGENCE
  // ============================================================================

  describe('Bearish Divergence (Price HH, RSI LH)', () => {
    it('should detect bearish divergence', () => {
      const swingPoints: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 105, timestamp: 2000, type: SwingPointType.HIGH }, // Higher high
      ];

      const rsiValues = new Map<number, number>([
        [1000, 70], // Old RSI
        [2000, 65], // New RSI (lower)
      ]);

      const divergence = detector.detect(swingPoints, rsiValues);

      expect(divergence.type).toBe(DivergenceType.BEARISH);
      expect(divergence.strength).toBeGreaterThan(0);
      expect(divergence.pricePoints).toEqual([100, 105]);
      expect(divergence.rsiPoints).toEqual([70, 65]);
    });

    it('should not detect bearish divergence if RSI also higher', () => {
      const swingPoints: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 105, timestamp: 2000, type: SwingPointType.HIGH }, // Higher high
      ];

      const rsiValues = new Map<number, number>([
        [1000, 65],
        [2000, 70], // RSI also higher (no divergence)
      ]);

      const divergence = detector.detect(swingPoints, rsiValues);

      expect(divergence.type).toBe(DivergenceType.NONE);
    });

    it('should not detect if price difference too small', () => {
      const swingPoints: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 100.1, timestamp: 2000, type: SwingPointType.HIGH }, // Only 0.1% higher
      ];

      const rsiValues = new Map<number, number>([
        [1000, 70],
        [2000, 60], // RSI lower but price diff too small
      ]);

      const divergence = detector.detect(swingPoints, rsiValues);

      expect(divergence.type).toBe(DivergenceType.NONE);
    });

    it('should not detect if RSI difference too small', () => {
      const swingPoints: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 105, timestamp: 2000, type: SwingPointType.HIGH },
      ];

      const rsiValues = new Map<number, number>([
        [1000, 70],
        [2000, 69], // Only 1 point difference (threshold is 2)
      ]);

      const divergence = detector.detect(swingPoints, rsiValues);

      expect(divergence.type).toBe(DivergenceType.NONE);
    });

    it('should calculate higher strength for larger divergence', () => {
      // Larger divergence
      const swingPoints1: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 110, timestamp: 2000, type: SwingPointType.HIGH }, // 10% higher
      ];

      const rsiValues1 = new Map<number, number>([
        [1000, 80],
        [2000, 60], // 20 points lower
      ]);

      const div1 = detector.detect(swingPoints1, rsiValues1);

      // Smaller divergence
      const swingPoints2: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 102, timestamp: 2000, type: SwingPointType.HIGH }, // 2% higher
      ];

      const rsiValues2 = new Map<number, number>([
        [1000, 70],
        [2000, 65], // 5 points lower
      ]);

      const div2 = detector.detect(swingPoints2, rsiValues2);

      expect(div1.strength).toBeGreaterThan(div2.strength);
    });
  });

  // ============================================================================
  // BULLISH DIVERGENCE
  // ============================================================================

  describe('Bullish Divergence (Price LL, RSI HL)', () => {
    it('should detect bullish divergence', () => {
      const swingPoints: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.LOW },
        { price: 95, timestamp: 2000, type: SwingPointType.LOW }, // Lower low
      ];

      const rsiValues = new Map<number, number>([
        [1000, 30], // Old RSI
        [2000, 35], // New RSI (higher)
      ]);

      const divergence = detector.detect(swingPoints, rsiValues);

      expect(divergence.type).toBe(DivergenceType.BULLISH);
      expect(divergence.strength).toBeGreaterThan(0);
      expect(divergence.pricePoints).toEqual([100, 95]);
      expect(divergence.rsiPoints).toEqual([30, 35]);
    });

    it('should not detect bullish divergence if RSI also lower', () => {
      const swingPoints: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.LOW },
        { price: 95, timestamp: 2000, type: SwingPointType.LOW }, // Lower low
      ];

      const rsiValues = new Map<number, number>([
        [1000, 35],
        [2000, 30], // RSI also lower (no divergence)
      ]);

      const divergence = detector.detect(swingPoints, rsiValues);

      expect(divergence.type).toBe(DivergenceType.NONE);
    });

    it('should not detect if price difference too small', () => {
      const swingPoints: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.LOW },
        { price: 99.9, timestamp: 2000, type: SwingPointType.LOW }, // Only 0.1% lower
      ];

      const rsiValues = new Map<number, number>([
        [1000, 30],
        [2000, 40], // RSI higher but price diff too small
      ]);

      const divergence = detector.detect(swingPoints, rsiValues);

      expect(divergence.type).toBe(DivergenceType.NONE);
    });

    it('should calculate higher strength for larger divergence', () => {
      // Larger divergence
      const swingPoints1: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.LOW },
        { price: 90, timestamp: 2000, type: SwingPointType.LOW }, // 10% lower
      ];

      const rsiValues1 = new Map<number, number>([
        [1000, 20],
        [2000, 40], // 20 points higher
      ]);

      const div1 = detector.detect(swingPoints1, rsiValues1);

      // Smaller divergence
      const swingPoints2: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.LOW },
        { price: 98, timestamp: 2000, type: SwingPointType.LOW }, // 2% lower
      ];

      const rsiValues2 = new Map<number, number>([
        [1000, 30],
        [2000, 35], // 5 points higher
      ]);

      const div2 = detector.detect(swingPoints2, rsiValues2);

      expect(div1.strength).toBeGreaterThan(div2.strength);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should return NONE if not enough swing points', () => {
      const swingPoints: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
      ];

      const rsiValues = new Map<number, number>([[1000, 70]]);

      const divergence = detector.detect(swingPoints, rsiValues);

      expect(divergence.type).toBe(DivergenceType.NONE);
    });

    it('should return NONE if RSI values missing', () => {
      const swingPoints: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 105, timestamp: 2000, type: SwingPointType.HIGH },
      ];

      const rsiValues = new Map<number, number>(); // Empty map

      const divergence = detector.detect(swingPoints, rsiValues);

      expect(divergence.type).toBe(DivergenceType.NONE);
    });

    it('should return NONE if time between points too large', () => {
      const oneDay = 24 * 60 * 60 * 1000;
      const twoDays = 2 * oneDay;

      const swingPoints: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.HIGH },
        { price: 105, timestamp: 1000 + twoDays, type: SwingPointType.HIGH }, // 2 days later
      ];

      const rsiValues = new Map<number, number>([
        [1000, 70],
        [1000 + twoDays, 60],
      ]);

      const divergence = detector.detect(swingPoints, rsiValues);

      expect(divergence.type).toBe(DivergenceType.NONE);
    });

    it('should prioritize bearish over bullish if both present', () => {
      // This tests detector logic priority (checks bearish first)
      const swingPoints: SwingPoint[] = [
        { price: 100, timestamp: 1000, type: SwingPointType.LOW },
        { price: 95, timestamp: 2000, type: SwingPointType.LOW },
        { price: 110, timestamp: 3000, type: SwingPointType.HIGH },
        { price: 115, timestamp: 4000, type: SwingPointType.HIGH },
      ];

      const rsiValues = new Map<number, number>([
        [1000, 30],
        [2000, 35], // Bullish divergence
        [3000, 80],
        [4000, 70], // Bearish divergence
      ]);

      const divergence = detector.detect(swingPoints, rsiValues);

      // Should detect bearish (checked first in code)
      expect(divergence.type).toBe(DivergenceType.BEARISH);
    });
  });
});
