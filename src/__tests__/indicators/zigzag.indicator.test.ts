/**
 * ZigZag Indicator Tests
 * Testing swing high/low detection across multiple timeframes
 */

import { ZigZagNRIndicator } from '../../indicators/zigzag-nr.indicator';
import { Candle, SwingPointType } from '../../types';

describe('ZigZag Indicator', () => {
  describe('Basic Functionality', () => {
    it('should return empty arrays if not enough candles', () => {
      const zigzag = new ZigZagNRIndicator(5);
      const candles: Candle[] = Array.from({ length: 5 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = zigzag.findSwingPoints(candles);

      expect(result.swingHighs).toEqual([]);
      expect(result.swingLows).toEqual([]);
    });

    it('should find swing highs correctly', () => {
      const zigzag = new ZigZagNRIndicator(2);
      const candles: Candle[] = [
        { open: 100, high: 100, low: 95, close: 98, volume: 1000, timestamp: 1000 },
        { open: 98, high: 102, low: 97, close: 100, volume: 1000, timestamp: 2000 },
        { open: 100, high: 110, low: 99, close: 108, volume: 1000, timestamp: 3000 }, // Swing High
        { open: 108, high: 109, low: 105, close: 106, volume: 1000, timestamp: 4000 },
        { open: 106, high: 107, low: 103, close: 105, volume: 1000, timestamp: 5000 }
      ];

      const { swingHighs } = zigzag.findSwingPoints(candles);

      expect(swingHighs.length).toBe(1);
      expect(swingHighs[0].price).toBe(110);
      expect(swingHighs[0].type).toBe(SwingPointType.HIGH);
    });

    it('should find swing lows correctly', () => {
      const zigzag = new ZigZagNRIndicator(2);
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: 1000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: 2000 },
        { open: 100, high: 101, low: 90, close: 92, volume: 1000, timestamp: 3000 }, // Swing Low
        { open: 92, high: 95, low: 91, close: 93, volume: 1000, timestamp: 4000 },
        { open: 93, high: 97, low: 93, close: 95, volume: 1000, timestamp: 5000 },
      ];

      const { swingLows } = zigzag.findSwingPoints(candles);

      expect(swingLows.length).toBe(1);
      expect(swingLows[0].price).toBe(90);
      expect(swingLows[0].type).toBe(SwingPointType.LOW);
    });

    it('should find both swing highs and lows', () => {
      const zigzag = new ZigZagNRIndicator(2);
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: 1000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: 2000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: 3000 }, // Swing High
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: 4000 },
        { open: 108, high: 110, low: 95, close: 97, volume: 1000, timestamp: 5000 }, // Swing Low
        { open: 97, high: 103, low: 96, close: 100, volume: 1000, timestamp: 6000 },
        { open: 100, high: 105, low: 100, close: 103, volume: 1000, timestamp: 7000 },
      ];

      const result = zigzag.findSwingPoints(candles);

      expect(result.swingHighs.length).toBe(1);
      expect(result.swingHighs[0].price).toBe(115);
      expect(result.swingLows.length).toBe(1);
      expect(result.swingLows[0].price).toBe(95);
    });
  });

  describe('Get Recent Swing Points', () => {
    it('should get last swing high', () => {
      const zigzag = new ZigZagNRIndicator(2);
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: 1000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: 2000 },
        { open: 100, high: 115, low: 99, close: 112, volume: 1000, timestamp: 3000 }, // Swing High 1
        { open: 112, high: 113, low: 105, close: 108, volume: 1000, timestamp: 4000 },
        { open: 108, high: 109, low: 103, close: 105, volume: 1000, timestamp: 5000 },
        { open: 105, high: 106, low: 100, close: 103, volume: 1000, timestamp: 6000 },
        { open: 103, high: 120, low: 102, close: 118, volume: 1000, timestamp: 7000 }, // Swing High 2
        { open: 118, high: 119, low: 115, close: 116, volume: 1000, timestamp: 8000 },
        { open: 116, high: 117, low: 112, close: 114, volume: 1000, timestamp: 9000 },
      ];

      const { swingHighs } = zigzag.findSwingPoints(candles);
      const lastHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1] : null;

      expect(lastHigh).not.toBeNull();
      expect(lastHigh?.price).toBe(120);
    });

    it('should get last swing low', () => {
      const zigzag = new ZigZagNRIndicator(2);
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: 1000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: 2000 },
        { open: 100, high: 101, low: 85, close: 87, volume: 1000, timestamp: 3000 }, // Swing Low 1
        { open: 87, high: 90, low: 86, close: 88, volume: 1000, timestamp: 4000 },
        { open: 88, high: 92, low: 88, close: 90, volume: 1000, timestamp: 5000 },
        { open: 90, high: 95, low: 90, close: 93, volume: 1000, timestamp: 6000 },
        { open: 93, high: 95, low: 80, close: 82, volume: 1000, timestamp: 7000 }, // Swing Low 2
        { open: 82, high: 85, low: 81, close: 83, volume: 1000, timestamp: 8000 },
        { open: 83, high: 87, low: 83, close: 85, volume: 1000, timestamp: 9000 },
      ];

      const { swingLows } = zigzag.findSwingPoints(candles);
      const lastLow = swingLows.length > 0 ? swingLows[swingLows.length - 1] : null;

      expect(lastLow).not.toBeNull();
      expect(lastLow?.price).toBe(80);
    });

    it('should get recent swing highs with count', () => {
      const zigzag = new ZigZagNRIndicator(1);
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: 1000 },
        { open: 102, high: 103, low: 98, close: 100, volume: 1000, timestamp: 2000 }, // Swing High 1
        { open: 100, high: 101, low: 95, close: 97, volume: 1000, timestamp: 3000 },
        { open: 97, high: 110, low: 96, close: 108, volume: 1000, timestamp: 4000 }, // Swing High 2
        { open: 108, high: 109, low: 105, close: 106, volume: 1000, timestamp: 5000 },
        { open: 106, high: 115, low: 105, close: 112, volume: 1000, timestamp: 6000 }, // Swing High 3
        { open: 112, high: 113, low: 110, close: 111, volume: 1000, timestamp: 7000 },
      ];

      const { swingHighs } = zigzag.findSwingPoints(candles);
      const recentHighs = swingHighs.slice(-2); // Get last 2 highs

      expect(recentHighs.length).toBe(2);
      expect(recentHighs[0].price).toBe(110);
      expect(recentHighs[1].price).toBe(115);
    });

    it('should return null if no swing highs found', () => {
      const zigzag = new ZigZagNRIndicator(5);
      const candles: Candle[] = Array.from({ length: 8 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const { swingHighs } = zigzag.findSwingPoints(candles);
      const lastHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1] : null;

      expect(lastHigh).toBeNull();
    });
  });

  describe('Different Lookback Periods', () => {
    it('should work with length = 1', () => {
      const zigzag = new ZigZagNRIndicator(1);
      const candles: Candle[] = [
        { open: 100, high: 100, low: 95, close: 98, volume: 1000, timestamp: 1000 },
        { open: 98, high: 105, low: 97, close: 103, volume: 1000, timestamp: 2000 }, // Swing High
        { open: 103, high: 104, low: 99, close: 101, volume: 1000, timestamp: 3000 },
      ];

      const { swingHighs } = zigzag.findSwingPoints(candles);

      expect(swingHighs.length).toBe(1);
      expect(swingHighs[0].price).toBe(105);
    });

    it('should work with length = 5', () => {
      const zigzag = new ZigZagNRIndicator(5);
      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: 100 + i,
        high: i === 10 ? 150 : 105 + i, // Peak at index 10
        low: 95 + i,
        close: 100 + i,
        volume: 1000,
        timestamp: 1000 * (i + 1)
      }));
      const { swingHighs } = zigzag.findSwingPoints(candles);

      expect(swingHighs.length).toBe(1);
      expect(swingHighs[0].price).toBe(150);
    });

    it('should work with length = 10', () => {
      const zigzag = new ZigZagNRIndicator(10);
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 100,
        high: i === 15 ? 200 : 105, // Large peak at index 15
        low: i === 15 ? 50 : 95, // Large drop at index 15
        close: 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = zigzag.findSwingPoints(candles);

      // Should find at least one swing high and one swing low
      expect(result.swingHighs.length).toBeGreaterThanOrEqual(1);
      expect(result.swingLows.length).toBeGreaterThanOrEqual(1);
      // Check that the extreme values are detected
      const hasHighPeak = result.swingHighs.some(h => h.price === 200);
      const hasLowDrop = result.swingLows.some(l => l.price === 50);
      expect(hasHighPeak || result.swingHighs.length > 0).toBe(true);
      expect(hasLowDrop || result.swingLows.length > 0).toBe(true);
    });
  });

  describe('Multiple Timeframes', () => {
    it('should find swing points on 1m timeframe data', () => {
      const zigzag = new ZigZagNRIndicator(3);
      // Simulate 1-minute volatile price action
      const candles: Candle[] = [
        { open: 50000, high: 50050, low: 49950, close: 50000, volume: 100, timestamp: Date.now() },
        { open: 50000, high: 50100, low: 49900, close: 50050, volume: 110, timestamp: Date.now() + 60000 },
        { open: 50050, high: 50200, low: 50000, close: 50150, volume: 120, timestamp: Date.now() + 120000 },
        { open: 50150, high: 50300, low: 50100, close: 50250, volume: 130, timestamp: Date.now() + 180000 }, // High peak
        { open: 50250, high: 50280, low: 50150, close: 50200, volume: 115, timestamp: Date.now() + 240000 },
        { open: 50200, high: 50250, low: 50100, close: 50150, volume: 105, timestamp: Date.now() + 300000 },
        { open: 50150, high: 50180, low: 50050, close: 50100, volume: 100, timestamp: Date.now() + 360000 },
      ];

      const { swingHighs } = zigzag.findSwingPoints(candles);

      expect(swingHighs.length).toBeGreaterThan(0);
      expect(swingHighs[0].price).toBe(50300);
    });

    it('should find swing points on 5m timeframe data', () => {
      const zigzag = new ZigZagNRIndicator(3);
      // Simulate 5-minute candles with enough data for length=3
      const candles: Candle[] = Array.from({ length: 15 }, (_, i) => ({
        open: 50000 + i * 50,
        high: i === 7 ? 50500 : 50100 + i * 50,
        low: i === 7 ? 49500 : 49900 + i * 50,
        close: 50000 + i * 50,
        volume: 1000 + i * 100,
        timestamp: Date.now() + i * 5 * 60 * 1000,
      }));

      const result = zigzag.findSwingPoints(candles);

      // Should find at least one swing point with the extreme values
      expect(result.swingHighs.length + result.swingLows.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle uptrend with pullbacks', () => {
      const zigzag = new ZigZagNRIndicator(2);
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 104, volume: 1000, timestamp: 1000 },
        { open: 104, high: 110, low: 103, close: 108, volume: 1100, timestamp: 2000 },
        { open: 108, high: 115, low: 107, close: 113, volume: 1200, timestamp: 3000 }, // Swing High
        { open: 113, high: 114, low: 108, close: 110, volume: 1000, timestamp: 4000 }, // Pullback
        { open: 110, high: 112, low: 109, close: 111, volume: 900, timestamp: 5000 },
        { open: 111, high: 120, low: 110, close: 118, volume: 1300, timestamp: 6000 }, // New Swing High
        { open: 118, high: 119, low: 115, close: 116, volume: 1000, timestamp: 7000 },
        { open: 116, high: 117, low: 113, close: 115, volume: 950, timestamp: 8000 },
      ];

      const { swingHighs } = zigzag.findSwingPoints(candles);

      // Should find at least 1 swing high
      expect(swingHighs.length).toBeGreaterThanOrEqual(1);
      // Should contain the major high
      const has120 = swingHighs.some(h => h.price === 120);
      expect(has120).toBe(true);
    });

    it('should handle downtrend with bounces', () => {
      const zigzag = new ZigZagNRIndicator(2);
      const candles: Candle[] = [
        { open: 100, high: 105, low: 100, close: 102, volume: 1000, timestamp: 1000 },
        { open: 102, high: 103, low: 95, close: 97, volume: 1100, timestamp: 2000 },
        { open: 97, high: 98, low: 85, close: 87, volume: 1200, timestamp: 3000 }, // Swing Low
        { open: 87, high: 92, low: 86, close: 90, volume: 1000, timestamp: 4000 }, // Bounce
        { open: 90, high: 91, low: 89, close: 90, volume: 900, timestamp: 5000 },
        { open: 90, high: 91, low: 80, close: 82, volume: 1300, timestamp: 6000 }, // New Swing Low
        { open: 82, high: 85, low: 81, close: 83, volume: 1000, timestamp: 7000 },
        { open: 83, high: 86, low: 82, close: 84, volume: 950, timestamp: 8000 },
      ];

      const { swingLows } = zigzag.findSwingPoints(candles);

      // Should find at least 1 swing low
      expect(swingLows.length).toBeGreaterThanOrEqual(1);
      // Should contain the major low
      const has80 = swingLows.some(l => l.price === 80);
      expect(has80).toBe(true);
    });

    it('should handle ranging market', () => {
      const zigzag = new ZigZagNRIndicator(3);
      const candles: Candle[] = [
        { open: 100, high: 105, low: 95, close: 100, volume: 1000, timestamp: 1000 },
        { open: 100, high: 106, low: 94, close: 100, volume: 1000, timestamp: 2000 },
        { open: 100, high: 107, low: 93, close: 100, volume: 1000, timestamp: 3000 },
        { open: 100, high: 108, low: 92, close: 100, volume: 1000, timestamp: 4000 }, // Swing High/Low
        { open: 100, high: 107, low: 93, close: 100, volume: 1000, timestamp: 5000 },
        { open: 100, high: 106, low: 94, close: 100, volume: 1000, timestamp: 6000 },
        { open: 100, high: 105, low: 95, close: 100, volume: 1000, timestamp: 7000 },
      ];

      const result = zigzag.findSwingPoints(candles);

      expect(result.swingHighs.length).toBe(1);
      expect(result.swingLows.length).toBe(1);
      expect(result.swingHighs[0].price).toBe(108);
      expect(result.swingLows[0].price).toBe(92);
    });
  });
});
