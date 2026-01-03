/**
 * Price Momentum Analyzer - Unit Tests
 *
 * Tests for real-time momentum validation
 * Verifies that price is actually moving in the signal direction
 *
 * Key: 5 candles = 4 transitions (comparisons between consecutive closes)
 * closesHigher = number of times candle[i].close > candle[i-1].close
 * Confidence = 50 + closesHigher * 10
 */

import { PriceMomentumAnalyzer } from '../../analyzers/price-momentum.analyzer';
import { Candle, SignalDirection } from '../../types';

describe('PriceMomentumAnalyzer', () => {
  let analyzer: PriceMomentumAnalyzer;

  beforeEach(() => {
    analyzer = new PriceMomentumAnalyzer();
  });

  describe('analyze()', () => {
    it('should return null if fewer than 5 candles provided', () => {
      const candles: Candle[] = [
        { open: 100, high: 105, low: 95, close: 102, volume: 1000, timestamp: Date.now() },
        { open: 102, high: 107, low: 101, close: 105, volume: 1000, timestamp: Date.now() },
      ];

      const result = analyzer.analyze(candles);
      expect(result).toBeNull();
    });

    it('should return LONG signal when all 4 transitions are upward (candles close higher)', () => {
      const candles: Candle[] = [
        { open: 100, high: 102, low: 99, close: 100, volume: 1000, timestamp: Date.now() }, // base
        { open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: Date.now() }, // 101 > 100 UP
        { open: 101, high: 103, low: 100, close: 102, volume: 1000, timestamp: Date.now() }, // 102 > 101 UP
        { open: 102, high: 104, low: 101, close: 103, volume: 1000, timestamp: Date.now() }, // 103 > 102 UP
        { open: 103, high: 105, low: 102, close: 104, volume: 1000, timestamp: Date.now() }, // 104 > 103 UP
      ];

      const result = analyzer.analyze(candles);
      expect(result).not.toBeNull();
      expect(result?.direction).toBe(SignalDirection.LONG);
      expect(result?.confidence).toBe(90); // 4 transitions up: 50 + 4*10 = 90
    });

    it('should return LONG signal when exactly 3 of 4 transitions are upward', () => {
      const candles: Candle[] = [
        { open: 100, high: 102, low: 99, close: 100, volume: 1000, timestamp: Date.now() }, // base
        { open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: Date.now() }, // 101 > 100 UP
        { open: 101, high: 103, low: 100, close: 100, volume: 1000, timestamp: Date.now() }, // 100 < 101 DOWN
        { open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: Date.now() }, // 101 > 100 UP
        { open: 101, high: 103, low: 100, close: 102, volume: 1000, timestamp: Date.now() }, // 102 > 101 UP
      ];

      const result = analyzer.analyze(candles);
      expect(result).not.toBeNull();
      expect(result?.direction).toBe(SignalDirection.LONG);
      expect(result?.confidence).toBe(80); // 3 transitions up: 50 + 3*10 = 80
    });

    it('should return SHORT signal when all 4 transitions are downward (candles close lower)', () => {
      const candles: Candle[] = [
        { open: 100, high: 101, low: 98, close: 100, volume: 1000, timestamp: Date.now() }, // base
        { open: 100, high: 101, low: 98, close: 99, volume: 1000, timestamp: Date.now() },  // 99 < 100 DOWN
        { open: 99, high: 100, low: 97, close: 98, volume: 1000, timestamp: Date.now() },   // 98 < 99 DOWN
        { open: 98, high: 99, low: 96, close: 97, volume: 1000, timestamp: Date.now() },    // 97 < 98 DOWN
        { open: 97, high: 98, low: 95, close: 96, volume: 1000, timestamp: Date.now() },    // 96 < 97 DOWN
      ];

      const result = analyzer.analyze(candles);
      expect(result).not.toBeNull();
      expect(result?.direction).toBe(SignalDirection.SHORT);
      expect(result?.confidence).toBe(90); // 4 transitions down: 50 + 4*10 = 90
    });

    it('should return SHORT signal when exactly 3 of 4 transitions are downward', () => {
      const candles: Candle[] = [
        { open: 100, high: 102, low: 99, close: 100, volume: 1000, timestamp: Date.now() }, // base
        { open: 100, high: 102, low: 99, close: 99, volume: 1000, timestamp: Date.now() },  // 99 < 100 DOWN
        { open: 99, high: 101, low: 98, close: 100, volume: 1000, timestamp: Date.now() },  // 100 > 99 UP
        { open: 100, high: 102, low: 99, close: 98, volume: 1000, timestamp: Date.now() },  // 98 < 100 DOWN
        { open: 98, high: 100, low: 97, close: 97, volume: 1000, timestamp: Date.now() },   // 97 < 98 DOWN
      ];

      const result = analyzer.analyze(candles);
      expect(result).not.toBeNull();
      expect(result?.direction).toBe(SignalDirection.SHORT);
      expect(result?.confidence).toBe(80); // 3 transitions down: 50 + 3*10 = 80
    });

    it('should return null when no clear momentum (equal ups and downs)', () => {
      const candles: Candle[] = [
        { open: 100, high: 102, low: 99, close: 100, volume: 1000, timestamp: Date.now() }, // base
        { open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: Date.now() }, // 101 > 100 UP
        { open: 101, high: 103, low: 100, close: 100, volume: 1000, timestamp: Date.now() }, // 100 < 101 DOWN
        { open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: Date.now() }, // 101 > 100 UP
        { open: 101, high: 103, low: 100, close: 100, volume: 1000, timestamp: Date.now() }, // 100 < 101 DOWN
      ];

      const result = analyzer.analyze(candles);
      expect(result).toBeNull(); // 2 ups, 2 downs - no majority (< 3 for either direction)
    });

    it('should cap confidence at 100%', () => {
      const candles: Candle[] = [
        { open: 100, high: 102, low: 99, close: 100, volume: 1000, timestamp: Date.now() },
        { open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: Date.now() },
        { open: 101, high: 103, low: 100, close: 102, volume: 1000, timestamp: Date.now() },
        { open: 102, high: 104, low: 101, close: 103, volume: 1000, timestamp: Date.now() },
        { open: 103, high: 105, low: 102, close: 104, volume: 1000, timestamp: Date.now() },
      ];

      const result = analyzer.analyze(candles);
      expect(result?.confidence).toBeLessThanOrEqual(100);
      expect(result?.confidence).toBe(90); // 4 transitions: 50 + 4*10 = 90
    });
  });

  describe('supportsMomentum()', () => {
    it('should return true when momentum supports the given direction', () => {
      const candles: Candle[] = [
        { open: 100, high: 102, low: 99, close: 100, volume: 1000, timestamp: Date.now() },
        { open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: Date.now() },
        { open: 101, high: 103, low: 100, close: 102, volume: 1000, timestamp: Date.now() },
        { open: 102, high: 104, low: 101, close: 103, volume: 1000, timestamp: Date.now() },
        { open: 103, high: 105, low: 102, close: 104, volume: 1000, timestamp: Date.now() },
      ];

      expect(analyzer.supportsMomentum(candles, SignalDirection.LONG)).toBe(true);
      expect(analyzer.supportsMomentum(candles, SignalDirection.SHORT)).toBe(false);
    });

    it('should return false when no momentum', () => {
      const candles: Candle[] = [
        { open: 100, high: 102, low: 99, close: 100, volume: 1000, timestamp: Date.now() },
        { open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: Date.now() },
        { open: 101, high: 103, low: 100, close: 100, volume: 1000, timestamp: Date.now() },
        { open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: Date.now() },
        { open: 101, high: 103, low: 100, close: 100.5, volume: 1000, timestamp: Date.now() },
      ];

      expect(analyzer.supportsMomentum(candles, SignalDirection.LONG)).toBe(false);
      expect(analyzer.supportsMomentum(candles, SignalDirection.SHORT)).toBe(false);
    });
  });

  describe('getMomentumStrength()', () => {
    it('should return 0.9 for strong LONG momentum (4 transitions up)', () => {
      const candles: Candle[] = [
        { open: 100, high: 102, low: 99, close: 100, volume: 1000, timestamp: Date.now() },
        { open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: Date.now() },
        { open: 101, high: 103, low: 100, close: 102, volume: 1000, timestamp: Date.now() },
        { open: 102, high: 104, low: 101, close: 103, volume: 1000, timestamp: Date.now() },
        { open: 103, high: 105, low: 102, close: 104, volume: 1000, timestamp: Date.now() },
      ];

      const strength = analyzer.getMomentumStrength(candles, SignalDirection.LONG);
      expect(strength).toBe(0.9); // 90% confidence / 100 (4 transitions up: 50 + 4*10)
    });

    it('should return 0.8 for moderate LONG momentum (3 of 4 transitions up)', () => {
      const candles: Candle[] = [
        { open: 100, high: 102, low: 99, close: 100, volume: 1000, timestamp: Date.now() },
        { open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: Date.now() },
        { open: 101, high: 103, low: 100, close: 100, volume: 1000, timestamp: Date.now() },
        { open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: Date.now() },
        { open: 101, high: 103, low: 100, close: 102, volume: 1000, timestamp: Date.now() },
      ];

      const strength = analyzer.getMomentumStrength(candles, SignalDirection.LONG);
      expect(strength).toBe(0.8); // 80% confidence / 100 (3 transitions up: 50 + 3*10)
    });

    it('should return 0 for no momentum', () => {
      const candles: Candle[] = [
        { open: 100, high: 102, low: 99, close: 100, volume: 1000, timestamp: Date.now() },
        { open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: Date.now() },
        { open: 101, high: 103, low: 100, close: 100, volume: 1000, timestamp: Date.now() },
        { open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: Date.now() },
        { open: 101, high: 103, low: 100, close: 100, volume: 1000, timestamp: Date.now() },
      ];

      const strength = analyzer.getMomentumStrength(candles, SignalDirection.LONG);
      expect(strength).toBe(0); // No LONG momentum (2 ups, 2 downs)
    });

    it('should return 0 when checking wrong direction', () => {
      const candles: Candle[] = [
        { open: 100, high: 102, low: 99, close: 100, volume: 1000, timestamp: Date.now() },
        { open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: Date.now() },
        { open: 101, high: 103, low: 100, close: 102, volume: 1000, timestamp: Date.now() },
        { open: 102, high: 104, low: 101, close: 103, volume: 1000, timestamp: Date.now() },
        { open: 103, high: 105, low: 102, close: 104, volume: 1000, timestamp: Date.now() },
      ];

      // LONG momentum exists, but checking for SHORT
      const strength = analyzer.getMomentumStrength(candles, SignalDirection.SHORT);
      expect(strength).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle candles with equal open/close (doji)', () => {
      const candles: Candle[] = [
        { open: 100, high: 102, low: 99, close: 100, volume: 1000, timestamp: Date.now() },  // base
        { open: 100, high: 102, low: 99, close: 100, volume: 1000, timestamp: Date.now() },  // 100 = 100 FLAT
        { open: 100, high: 102, low: 99, close: 100, volume: 1000, timestamp: Date.now() },  // 100 = 100 FLAT
        { open: 100, high: 102, low: 99, close: 100, volume: 1000, timestamp: Date.now() },  // 100 = 100 FLAT
        { open: 100, high: 102, low: 99, close: 101, volume: 1000, timestamp: Date.now() },  // 101 > 100 UP
      ];

      const result = analyzer.analyze(candles);
      // 1 transition up, 3 flat/down transitions = 1 UP < 3 (for LONG)
      // closesLower = 4 - 1 = 3, so SHORT signal with confidence 80
      expect(result?.direction).toBe(SignalDirection.SHORT);
      expect(result?.confidence).toBe(80);
    });

    it('should handle gaps correctly', () => {
      const candles: Candle[] = [
        { open: 100, high: 102, low: 99, close: 100, volume: 1000, timestamp: Date.now() },   // base
        { open: 110, high: 112, low: 109, close: 111, volume: 1000, timestamp: Date.now() },  // gap up, 111 > 100 UP
        { open: 111, high: 113, low: 110, close: 112, volume: 1000, timestamp: Date.now() },  // 112 > 111 UP
        { open: 112, high: 114, low: 111, close: 113, volume: 1000, timestamp: Date.now() },  // 113 > 112 UP
        { open: 113, high: 115, low: 112, close: 114, volume: 1000, timestamp: Date.now() },  // 114 > 113 UP
      ];

      const result = analyzer.analyze(candles);
      expect(result?.direction).toBe(SignalDirection.LONG);
      expect(result?.confidence).toBe(90); // 4 transitions up: 50 + 4*10 = 90
    });
  });
});
