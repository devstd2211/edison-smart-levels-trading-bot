/**
 * FractalDetector Unit Tests
 */

import { FractalDetector } from '../../analyzers/fractal.detector';
import { FractalType, Candle, LogLevel, LoggerService } from '../../types';

describe('FractalDetector', () => {
  let detector: FractalDetector;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    detector = new FractalDetector(logger);
  });

  // Helper to create test candles
  const createCandle = (low: number, high: number, close: number, timestamp: number = Date.now()): Candle => ({
    timestamp,
    open: (low + high) / 2,
    high,
    low,
    close,
    volume: 1000,
  });

  describe('detectFractal', () => {
    it('should detect bullish fractal (lowest low in middle)', () => {
      // Pattern: [L1=100, L2=100, L3=80(LOWEST), L4=100, L5=100]
      // Need significant difference > 20% (MIN_RELATIVE_HEIGHT_PERCENT)
      const candles = [
        createCandle(100, 105, 102, 1000), // 0
        createCandle(100, 105, 102, 2000), // 1
        createCandle(70, 105, 85, 3000),   // 2 - LOWEST (fractal middle) - 30% lower
        createCandle(100, 105, 102, 4000), // 3
        createCandle(100, 105, 102, 5000), // 4
      ];

      const fractal = detector.detectFractal(candles);

      expect(fractal).not.toBeNull();
      expect(fractal?.type).toBe(FractalType.SUPPORT);
      expect(fractal?.price).toBe(70);
      expect(fractal?.strength).toBeGreaterThan(50);
      expect(fractal?.candleIndex).toBe(2);
    });

    it('should detect bearish fractal (highest high in middle)', () => {
      // Pattern: High values [H1=100, H2=100, H3=130(HIGHEST), H4=100, H5=100]
      // Need significant difference > 20% (MIN_RELATIVE_HEIGHT_PERCENT)
      const candles = [
        createCandle(100, 100, 101, 1000), // 0
        createCandle(100, 100, 100, 2000), // 1
        createCandle(101, 130, 115, 3000), // 2 - HIGHEST (30% higher)
        createCandle(100, 100, 99, 4000),  // 3
        createCandle(100, 100, 100, 5000), // 4
      ];

      const fractal = detector.detectFractal(candles);

      expect(fractal).not.toBeNull();
      expect(fractal?.type).toBe(FractalType.RESISTANCE);
      expect(fractal?.price).toBe(130);
      expect(fractal?.strength).toBeGreaterThan(50);
      expect(fractal?.candleIndex).toBe(2);
    });

    it('should return null if no fractal (monotonic increase)', () => {
      // All lows increasing: no lowest point in middle
      const candles = [
        createCandle(100, 102, 101, 1000),
        createCandle(102, 104, 103, 2000),
        createCandle(104, 106, 105, 3000), // Middle but not lowest
        createCandle(106, 108, 107, 4000),
        createCandle(108, 110, 109, 5000),
      ];

      const fractal = detector.detectFractal(candles);
      expect(fractal).toBeNull();
    });

    it('should return null if fewer than 5 candles', () => {
      const candles = [
        createCandle(100, 102, 101, 1000),
        createCandle(99, 103, 102, 2000),
        createCandle(98, 101, 100, 3000),
        createCandle(99, 102, 101, 4000),
      ];

      const fractal = detector.detectFractal(candles);
      expect(fractal).toBeNull();
    });

    it('should calculate strength based on relative height', () => {
      // Large drop: high relative height = high strength
      const candles = [
        createCandle(1000, 1020, 1010, 1000),
        createCandle(1000, 1020, 1010, 2000),
        createCandle(750, 1020, 850, 3000), // Much lower (25% - bullish fractal)
        createCandle(1000, 1020, 1010, 4000),
        createCandle(1000, 1020, 1010, 5000),
      ];

      const fractal = detector.detectFractal(candles);

      expect(fractal?.type).toBe(FractalType.SUPPORT);
      expect(fractal?.strength).toBeGreaterThan(70); // Large distance = high strength
    });

    it('should reject fractal with insufficient relative height', () => {
      // Tiny drop: low relative height = rejected
      const candles = [
        createCandle(1000, 1020, 1010, 1000),
        createCandle(1000, 1020, 1010, 2000),
        createCandle(999, 1020, 1010, 3000), // Only 1 point lower
        createCandle(1000, 1020, 1010, 4000),
        createCandle(1000, 1020, 1010, 5000),
      ];

      const fractal = detector.detectFractal(candles);
      expect(fractal).toBeNull(); // Too small difference
    });

    it('should set correct timestamp and candleIndex', () => {
      const timestamp = 1704067200000; // Specific timestamp
      const candles = [
        createCandle(100, 102, 101, 1000),
        createCandle(100, 102, 101, 2000),
        createCandle(70, 100, 85, timestamp), // Middle candle with our timestamp (30% lower)
        createCandle(100, 102, 101, 4000),
        createCandle(100, 102, 101, 5000),
      ];

      const fractal = detector.detectFractal(candles);

      expect(fractal?.candleIndex).toBe(2);
      expect(fractal?.timestamp).toBe(timestamp);
    });
  });

  describe('isFractalAligned', () => {
    it('should return true if price within tolerance', () => {
      const fractalPrice = 100;
      const currentPrice = 100.2;
      const tolerance = 0.5; // 0.5% tolerance

      const aligned = detector.isFractalAligned(fractalPrice, currentPrice, tolerance);
      expect(aligned).toBe(true);
    });

    it('should return false if price outside tolerance', () => {
      const fractalPrice = 100;
      const currentPrice = 100.6;
      const tolerance = 0.5; // 0.5% tolerance

      const aligned = detector.isFractalAligned(fractalPrice, currentPrice, tolerance);
      expect(aligned).toBe(false);
    });

    it('should default tolerance to 0.3%', () => {
      const fractalPrice = 100;
      const currentPrice = 100.25; // 0.25% away

      const aligned = detector.isFractalAligned(fractalPrice, currentPrice); // No tolerance param
      expect(aligned).toBe(true); // Should use 0.3% default
    });
  });

  describe('getStrengthMultiplier', () => {
    it('should map strength 0 to multiplier 0.5', () => {
      const multiplier = detector.getStrengthMultiplier(0);
      expect(multiplier).toBe(0.5);
    });

    it('should map strength 100 to multiplier 1.5', () => {
      const multiplier = detector.getStrengthMultiplier(100);
      expect(multiplier).toBe(1.5);
    });

    it('should map strength 50 to multiplier 1.0', () => {
      const multiplier = detector.getStrengthMultiplier(50);
      expect(multiplier).toBe(1.0);
    });

    it('should scale linearly between 0.5 and 1.5', () => {
      const mult25 = detector.getStrengthMultiplier(25);
      const mult50 = detector.getStrengthMultiplier(50);
      const mult75 = detector.getStrengthMultiplier(75);

      expect(mult25).toBeCloseTo(0.75);
      expect(mult50).toBeCloseTo(1.0);
      expect(mult75).toBeCloseTo(1.25);
    });
  });
});
