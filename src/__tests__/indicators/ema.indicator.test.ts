/**
 * EMA Indicator Tests
 * Testing EMA calculation and Fast/Slow EMA crossovers
 */

import { EMAIndicator } from '../../indicators/ema.indicator';
import { Candle } from '../../types';

describe('EMA Indicator', () => {
  describe('Basic Functionality', () => {
    it('should throw error if not enough candles', () => {
      const ema = new EMAIndicator(14);
      const candles: Candle[] = [
        { open: 100, high: 105, low: 95, close: 102, volume: 1000, timestamp: 1000 },
        { open: 102, high: 108, low: 100, close: 105, volume: 1100, timestamp: 2000 },
      ];

      expect(() => ema.calculate(candles)).toThrow();
    });

    it('should calculate EMA with exact period candles', () => {
      const ema = new EMAIndicator(10);
      const candles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
        open: 100 + i,
        high: 105 + i,
        low: 95 + i,
        close: 100 + i,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = ema.calculate(candles);

      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
      expect(isNaN(result)).toBe(false);
    });

    it('should calculate correct EMA for known values', () => {
      const ema = new EMAIndicator(5);
      const candles: Candle[] = [
        { open: 10, high: 11, low: 9, close: 10, volume: 1000, timestamp: 1000 },
        { open: 10, high: 11, low: 9, close: 11, volume: 1000, timestamp: 2000 },
        { open: 11, high: 12, low: 10, close: 12, volume: 1000, timestamp: 3000 },
        { open: 12, high: 13, low: 11, close: 13, volume: 1000, timestamp: 4000 },
        { open: 13, high: 14, low: 12, close: 14, volume: 1000, timestamp: 5000 },
        { open: 14, high: 15, low: 13, close: 15, volume: 1000, timestamp: 6000 },
      ];

      const result = ema.calculate(candles);

      // First EMA (SMA) = (10+11+12+13+14)/5 = 12
      // Multiplier = 2/(5+1) = 0.333
      // Second EMA = (15 - 12) * 0.333 + 12 = 13
      expect(result).toBeCloseTo(13, 0);
    });

    it('should give more weight to recent prices', () => {
      const ema = new EMAIndicator(10);
      const candles1: Candle[] = Array.from({ length: 15 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const ema1 = ema.calculate(candles1);

      // Add spike at the end
      const candles2 = [...candles1];
      candles2[14] = { open: 100, high: 120, low: 95, close: 120, volume: 1000, timestamp: 15000 };
      ema.reset();
      const ema2 = ema.calculate(candles2);

      // EMA with spike should be significantly higher
      expect(ema2).toBeGreaterThan(ema1 + 2);
    });
  });

  describe('Update Method', () => {
    it('should allow incremental updates', () => {
      const ema = new EMAIndicator(10);
      const candles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100 + i,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const initialEMA = ema.calculate(candles);
      const updatedEMA = ema.update(110);

      expect(updatedEMA).toBeGreaterThan(initialEMA);
      expect(updatedEMA).toBeLessThan(110); // EMA lags behind price
    });

    it('should throw error if update called before initialize', () => {
      const ema = new EMAIndicator(10);

      expect(() => ema.update(100)).toThrow('EMA not initialized');
    });

    it('should update EMA consistently', () => {
      const ema1 = new EMAIndicator(10);
      const ema2 = new EMAIndicator(10);

      const candles: Candle[] = Array.from({ length: 12 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100 + i,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      // Calculate all at once
      const result1 = ema1.calculate(candles);

      // Calculate incrementally
      const initialCandles = candles.slice(0, 10);
      ema2.calculate(initialCandles);
      ema2.update(candles[10].close);
      const result2 = ema2.update(candles[11].close);

      expect(result1).toBeCloseTo(result2, 10);
    });
  });

  describe('State Management', () => {
    it('should track state correctly', () => {
      const ema = new EMAIndicator(10);

      let state = ema.getState();
      expect(state.initialized).toBe(false);
      expect(state.ema).toBe(0);

      const candles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100 + i,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      ema.calculate(candles);
      state = ema.getState();

      expect(state.initialized).toBe(true);
      expect(state.ema).toBeGreaterThan(0);
    });

    it('should reset state correctly', () => {
      const ema = new EMAIndicator(10);
      const candles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100 + i,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      ema.calculate(candles);
      ema.reset();

      const state = ema.getState();
      expect(state.initialized).toBe(false);
      expect(state.ema).toBe(0);
    });

    it('should throw error when getting value before initialization', () => {
      const ema = new EMAIndicator(10);

      expect(() => ema.getValue()).toThrow('EMA not initialized');
    });
  });

  describe('Multiple Timeframes', () => {
    it('should calculate EMA correctly for 1m timeframe', () => {
      const ema = new EMAIndicator(20);

      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 50000 + i * 10,
        high: 50010 + i * 10,
        low: 49990 + i * 10,
        close: 50000 + i * 10,
        volume: 1000 + i * 10,
        timestamp: Date.now() + i * 60 * 1000,
      }));

      const result = ema.calculate(candles);

      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
      expect(isNaN(result)).toBe(false);
    });

    it('should calculate EMA correctly for 5m timeframe', () => {
      const ema = new EMAIndicator(20);

      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 50000 + i * 50,
        high: 50050 + i * 50,
        low: 49950 + i * 50,
        close: 50000 + i * 50,
        volume: 5000 + i * 50,
        timestamp: Date.now() + i * 5 * 60 * 1000,
      }));

      const result = ema.calculate(candles);

      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
      expect(isNaN(result)).toBe(false);
    });

    it('should calculate EMA correctly for 1h timeframe', () => {
      const ema = new EMAIndicator(20);

      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 50000 + i * 200,
        high: 50200 + i * 200,
        low: 49800 + i * 200,
        close: 50000 + i * 200,
        volume: 10000 + i * 100,
        timestamp: Date.now() + i * 60 * 60 * 1000,
      }));

      const result = ema.calculate(candles);

      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
      expect(isNaN(result)).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large prices', () => {
      const ema = new EMAIndicator(10);
      const basePrice = 1000000;

      const candles: Candle[] = Array.from({ length: 15 }, (_, i) => ({
        open: basePrice + i * 1000,
        high: basePrice + i * 1000 + 500,
        low: basePrice + i * 1000 - 500,
        close: basePrice + i * 1000,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = ema.calculate(candles);

      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
      expect(isNaN(result)).toBe(false);
    });

    it('should handle very small prices', () => {
      const ema = new EMAIndicator(10);
      const basePrice = 0.00001;

      const candles: Candle[] = Array.from({ length: 15 }, (_, i) => ({
        open: basePrice,
        high: basePrice + 0.000001,
        low: basePrice - 0.000001,
        close: basePrice + i * 0.0000001,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = ema.calculate(candles);

      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
      expect(isNaN(result)).toBe(false);
    });
  });
});

describe('Fast/Slow EMA Crossover', () => {
  describe('Bullish Crossover', () => {
    it('should detect bullish crossover (fast crosses slow upward)', () => {
      const fastEMA = new EMAIndicator(9);
      const slowEMA = new EMAIndicator(21);

      // Create downtrend then uptrend
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: i < 15 ? 100 - i : 85 + (i - 15) * 2, // Down then up
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const fast = fastEMA.calculate(candles);
      const slow = slowEMA.calculate(candles);

      // Fast should be above slow after uptrend
      expect(fast).toBeGreaterThan(slow);
    });

    it('should track crossover transition', () => {
      const fastEMA = new EMAIndicator(5);
      const slowEMA = new EMAIndicator(10);

      // Create downtrend
      const downCandles: Candle[] = Array.from({ length: 15 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100 - i,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const fastBefore = fastEMA.calculate(downCandles);
      const slowBefore = slowEMA.calculate(downCandles);

      // Fast should be below slow in downtrend
      expect(fastBefore).toBeLessThan(slowBefore);

      // Add uptrend candles
      for (let i = 0; i < 10; i++) {
        const newPrice = downCandles[downCandles.length - 1].close + i * 2;
        fastEMA.update(newPrice);
        slowEMA.update(newPrice);
      }

      const fastAfter = fastEMA.getValue();
      const slowAfter = slowEMA.getValue();

      // Fast should cross above slow
      expect(fastAfter).toBeGreaterThan(slowAfter);
    });
  });

  describe('Bearish Crossover', () => {
    it('should detect bearish crossover (fast crosses slow downward)', () => {
      const fastEMA = new EMAIndicator(9);
      const slowEMA = new EMAIndicator(21);

      // Create uptrend then downtrend
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: i < 15 ? 100 + i : 115 - (i - 15) * 2, // Up then down
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const fast = fastEMA.calculate(candles);
      const slow = slowEMA.calculate(candles);

      // Fast should be below slow after downtrend
      expect(fast).toBeLessThan(slow);
    });

    it('should track bearish crossover transition', () => {
      const fastEMA = new EMAIndicator(5);
      const slowEMA = new EMAIndicator(10);

      // Create uptrend
      const upCandles: Candle[] = Array.from({ length: 15 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100 + i,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const fastBefore = fastEMA.calculate(upCandles);
      const slowBefore = slowEMA.calculate(upCandles);

      // Fast should be above slow in uptrend
      expect(fastBefore).toBeGreaterThan(slowBefore);

      // Add downtrend candles
      for (let i = 0; i < 10; i++) {
        const newPrice = upCandles[upCandles.length - 1].close - i * 2;
        fastEMA.update(newPrice);
        slowEMA.update(newPrice);
      }

      const fastAfter = fastEMA.getValue();
      const slowAfter = slowEMA.getValue();

      // Fast should cross below slow
      expect(fastAfter).toBeLessThan(slowAfter);
    });
  });

  describe('No Crossover (Sideways)', () => {
    it('should maintain relative positions in sideways market', () => {
      const fastEMA = new EMAIndicator(9);
      const slowEMA = new EMAIndicator(21);

      // Sideways market
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100 + Math.sin(i * 0.5) * 2, // Oscillating around 100
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const fast = fastEMA.calculate(candles);
      const slow = slowEMA.calculate(candles);

      // Both should be close to 100
      expect(fast).toBeGreaterThan(95);
      expect(fast).toBeLessThan(105);
      expect(slow).toBeGreaterThan(95);
      expect(slow).toBeLessThan(105);

      // Difference should be small in sideways market
      expect(Math.abs(fast - slow)).toBeLessThan(5);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle trending market correctly', () => {
      const fastEMA = new EMAIndicator(12);
      const slowEMA = new EMAIndicator(26);

      // Strong uptrend
      const candles: Candle[] = Array.from({ length: 40 }, (_, i) => ({
        open: 50000 + i * 100,
        high: 50100 + i * 100,
        low: 50000 + i * 100,
        close: 50050 + i * 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const fast = fastEMA.calculate(candles);
      const slow = slowEMA.calculate(candles);

      // In uptrend, fast should be above slow
      expect(fast).toBeGreaterThan(slow);
      // Both should be trending up
      expect(fast).toBeGreaterThan(50000);
      expect(slow).toBeGreaterThan(50000);
    });

    it('should respond faster with short period', () => {
      const fastEMA = new EMAIndicator(5);
      const slowEMA = new EMAIndicator(20);

      const candles: Candle[] = Array.from({ length: 25 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      fastEMA.calculate(candles);
      slowEMA.calculate(candles);

      // Add a price spike
      const spikePrice = 120;
      const fastAfterSpike = fastEMA.update(spikePrice);
      const slowAfterSpike = slowEMA.update(spikePrice);

      // Fast EMA should respond more to spike
      expect(fastAfterSpike).toBeGreaterThan(slowAfterSpike);
      expect(fastAfterSpike - 100).toBeGreaterThan(slowAfterSpike - 100);
    });
  });
});
