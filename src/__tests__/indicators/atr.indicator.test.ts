/**
 * ATR Indicator Tests
 * Testing ATR calculation for volatility measurement
 */

import { ATRIndicator } from '../../indicators/atr.indicator';
import { Candle } from '../../types';

describe('ATR Indicator', () => {
  describe('Basic Functionality', () => {
    it('should throw error if period < 1', () => {
      expect(() => new ATRIndicator(0)).toThrow('ATR period must be at least 1');
      expect(() => new ATRIndicator(-5)).toThrow('ATR period must be at least 1');
    });

    it('should throw error if not enough candles', () => {
      const atr = new ATRIndicator(14);
      const candles: Candle[] = [
        { open: 100, high: 105, low: 95, close: 102, volume: 1000, timestamp: 1000 },
        { open: 102, high: 108, low: 100, close: 105, volume: 1100, timestamp: 2000 },
      ];

      expect(() => atr.calculate(candles)).toThrow();
    });

    it('should calculate ATR with exact 15 candles (period 14)', () => {
      const atr = new ATRIndicator(14);
      const candles: Candle[] = Array.from({ length: 15 }, (_, i) => ({
        open: 100 + i,
        high: 105 + i,
        low: 95 + i,
        close: 100 + i + Math.sin(i) * 2,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = atr.calculate(candles);

      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
      expect(isNaN(result)).toBe(false);
    });

    it('should return ATR as percentage of price', () => {
      const atr = new ATRIndicator(14);
      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: 100,
        high: 110, // 10 point range
        low: 90,
        close: 100 + Math.sin(i) * 5,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = atr.calculate(candles);

      // With 10 point range on 100 price, ATR should be around 10-20%
      expect(result).toBeGreaterThan(5); // At least 5%
      expect(result).toBeLessThan(25); // Less than 25%
    });

    it('should throw error if getValue() called before initialization', () => {
      const atr = new ATRIndicator(14);

      expect(() => atr.getValue()).toThrow('ATR not initialized');
    });

    it('should throw error if update() called before initialization', () => {
      const atr = new ATRIndicator(14);
      const candle: Candle = { open: 100, high: 105, low: 95, close: 102, volume: 1000, timestamp: 1000 };

      expect(() => atr.update(candle, candle)).toThrow('ATR not initialized');
    });
  });

  describe('True Range Calculation', () => {
    it('should calculate TR correctly when High-Low is largest', () => {
      const atr = new ATRIndicator(2);
      const candles: Candle[] = [
        { open: 100, high: 110, low: 90, close: 100, volume: 1000, timestamp: 1000 },
        { open: 100, high: 115, low: 95, close: 105, volume: 1000, timestamp: 2000 }, // TR = 20 (high-low)
        { open: 105, high: 120, low: 100, close: 110, volume: 1000, timestamp: 3000 },
      ];

      const result = atr.calculate(candles);

      // ATR should reflect the 20-point range
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(50); // Sanity check
    });

    it('should calculate TR correctly with gaps (High - Prev Close)', () => {
      const atr = new ATRIndicator(2);
      const candles: Candle[] = [
        { open: 100, high: 105, low: 95, close: 100, volume: 1000, timestamp: 1000 },
        { open: 120, high: 125, low: 115, close: 120, volume: 1000, timestamp: 2000 }, // Gap up: TR = 25 (high - prev close)
        { open: 120, high: 125, low: 115, close: 120, volume: 1000, timestamp: 3000 },
      ];

      const result = atr.calculate(candles);

      // ATR should be significantly higher due to gap
      expect(result).toBeGreaterThan(10); // At least 10%
    });

    it('should calculate TR correctly with gap down (Prev Close - Low)', () => {
      const atr = new ATRIndicator(2);
      const candles: Candle[] = [
        { open: 100, high: 105, low: 95, close: 100, volume: 1000, timestamp: 1000 },
        { open: 80, high: 85, low: 75, close: 80, volume: 1000, timestamp: 2000 }, // Gap down: TR = 25 (prev close - low)
        { open: 80, high: 85, low: 75, close: 80, volume: 1000, timestamp: 3000 },
      ];

      const result = atr.calculate(candles);

      // ATR should be significantly higher due to gap
      expect(result).toBeGreaterThan(15);
    });
  });

  describe('Wilder\'s Smoothing', () => {
    it('should use Wilder smoothing for subsequent candles', () => {
      const atr = new ATRIndicator(5);
      const candles: Candle[] = [
        { open: 100, high: 110, low: 90, close: 100, volume: 1000, timestamp: 1000 },
        { open: 100, high: 110, low: 90, close: 105, volume: 1000, timestamp: 2000 },
        { open: 105, high: 115, low: 95, close: 110, volume: 1000, timestamp: 3000 },
        { open: 110, high: 120, low: 100, close: 115, volume: 1000, timestamp: 4000 },
        { open: 115, high: 125, low: 105, close: 120, volume: 1000, timestamp: 5000 },
        { open: 120, high: 130, low: 110, close: 125, volume: 1000, timestamp: 6000 },
        // Additional candles for smoothing
        { open: 125, high: 135, low: 115, close: 130, volume: 1000, timestamp: 7000 },
        { open: 130, high: 140, low: 120, close: 135, volume: 1000, timestamp: 8000 },
      ];

      const result = atr.calculate(candles);

      // ATR should be smoothed and positive
      expect(result).toBeGreaterThan(0);
      expect(atr.isInitialized()).toBe(true);
    });
  });

  describe('Update Method', () => {
    it('should update ATR incrementally with new candle', () => {
      const atr = new ATRIndicator(5);
      const candles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
        open: 100 + i * 5,
        high: 110 + i * 5,
        low: 90 + i * 5,
        close: 100 + i * 5,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const initialATR = atr.calculate(candles);
      expect(atr.isInitialized()).toBe(true);

      // Add new candle via update
      const newCandle: Candle = {
        open: 150,
        high: 160,
        low: 140,
        close: 155,
        volume: 1000,
        timestamp: 11000,
      };

      const updatedATR = atr.update(newCandle, candles[candles.length - 1]);

      // Updated ATR should be different from initial
      expect(updatedATR).not.toBe(initialATR);
      expect(updatedATR).toBeGreaterThan(0);
    });

    it('should maintain state across multiple updates', () => {
      const atr = new ATRIndicator(3);
      const candles: Candle[] = Array.from({ length: 5 }, (_, i) => ({
        open: 100,
        high: 110,
        low: 90,
        close: 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      atr.calculate(candles);

      let prevCandle = candles[candles.length - 1];

      // Update 3 times
      for (let i = 0; i < 3; i++) {
        const newCandle: Candle = {
          open: 100,
          high: 112,
          low: 88,
          close: 100,
          volume: 1000,
          timestamp: 6000 + i * 1000,
        };

        const result = atr.update(newCandle, prevCandle);
        expect(result).toBeGreaterThan(0);
        expect(atr.isInitialized()).toBe(true);

        prevCandle = newCandle;
      }
    });
  });

  describe('State Management', () => {
    it('should reset ATR state', () => {
      const atr = new ATRIndicator(5);
      const candles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
        open: 100,
        high: 110,
        low: 90,
        close: 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      atr.calculate(candles);
      expect(atr.isInitialized()).toBe(true);

      atr.reset();
      expect(atr.isInitialized()).toBe(false);
      expect(() => atr.getValue()).toThrow();
    });

    it('should return correct state', () => {
      const atr = new ATRIndicator(7);
      const candles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
        open: 100,
        high: 110,
        low: 90,
        close: 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      atr.calculate(candles);

      const state = atr.getState();

      expect(state.period).toBe(7);
      expect(state.initialized).toBe(true);
      expect(state.atr).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small price movements', () => {
      const atr = new ATRIndicator(14);
      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: 100,
        high: 100.01,
        low: 99.99,
        close: 100 + Math.sin(i) * 0.005,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = atr.calculate(candles);

      // ATR should be very small (< 0.1%)
      expect(result).toBeLessThan(0.1);
      expect(result).toBeGreaterThan(0);
    });

    it('should handle very large price movements', () => {
      const atr = new ATRIndicator(14);
      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: 100 + i * 50,
        high: 150 + i * 50,
        low: 50 + i * 50,
        close: 100 + i * 50,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = atr.calculate(candles);

      // ATR should be large (> 5%)
      expect(result).toBeGreaterThan(5);
    });

    it('should handle sideways market (no volatility)', () => {
      const atr = new ATRIndicator(14);
      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = atr.calculate(candles);

      // ATR should be low (< 3%)
      expect(result).toBeLessThan(3);
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('Multi-Timeframe Scenarios', () => {
    it('should calculate ATR for 1-minute timeframe (high volatility)', () => {
      const atr = new ATRIndicator(14);
      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: 100 + Math.sin(i) * 5,
        high: 105 + Math.sin(i) * 5,
        low: 95 + Math.sin(i) * 5,
        close: 100 + Math.sin(i + 1) * 5,
        volume: 1000,
        timestamp: 60000 * (i + 1), // 1 minute
      }));

      const result = atr.calculate(candles);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(20); // Sanity check
    });

    it('should calculate ATR for 1-hour timeframe (lower volatility)', () => {
      const atr = new ATRIndicator(14);
      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: 1000 + i * 2,
        high: 1010 + i * 2,
        low: 990 + i * 2,
        close: 1000 + i * 2,
        volume: 10000,
        timestamp: 3600000 * (i + 1), // 1 hour
      }));

      const result = atr.calculate(candles);

      // ATR should be around 1-2% for this range
      expect(result).toBeGreaterThan(0.5);
      expect(result).toBeLessThan(3);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should identify low volatility market (< 0.5%)', () => {
      const atr = new ATRIndicator(14);
      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: 10000,
        high: 10020, // 0.2% range
        low: 9980,
        close: 10000 + Math.sin(i) * 10,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = atr.calculate(candles);

      expect(result).toBeLessThan(0.5); // Low volatility
    });

    it('should identify normal volatility market (0.5% - 2%)', () => {
      const atr = new ATRIndicator(14);
      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: 10000,
        high: 10100, // 1% range
        low: 9900,
        close: 10000 + Math.sin(i) * 50,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = atr.calculate(candles);

      expect(result).toBeGreaterThan(0.5);
      expect(result).toBeLessThan(2);
    });

    it('should identify high volatility market (> 3%)', () => {
      const atr = new ATRIndicator(14);
      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: 10000 + i * 100,
        high: 10400 + i * 100, // 4% range
        low: 9600 + i * 100,
        close: 10000 + i * 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = atr.calculate(candles);

      expect(result).toBeGreaterThan(3); // High volatility
    });
  });
});
