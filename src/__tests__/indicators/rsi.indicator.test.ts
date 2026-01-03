/**
 * RSI Indicator Tests
 * Testing RSI calculation across multiple timeframes
 */

import { RSIIndicator } from '../../indicators/rsi.indicator';
import { Candle } from '../../types';

describe('RSI Indicator', () => {
  describe('Basic Functionality', () => {
    it('should throw error if not enough candles', () => {
      const rsi = new RSIIndicator(14);
      const candles: Candle[] = [
        { open: 100, high: 105, low: 95, close: 102, volume: 1000, timestamp: 1000 },
        { open: 102, high: 108, low: 100, close: 105, volume: 1100, timestamp: 2000 },
      ];

      expect(() => rsi.calculate(candles)).toThrow();
    });

    it('should calculate RSI with exact 15 candles (period 14)', () => {
      const rsi = new RSIIndicator(14);
      const candles: Candle[] = Array.from({ length: 15 }, (_, i) => ({
        open: 100 + i,
        high: 105 + i,
        low: 95 + i,
        close: 100 + i + Math.sin(i) * 5,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = rsi.calculate(candles);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
      expect(typeof result).toBe('number');
      expect(isNaN(result)).toBe(false);
    });

    it('should return 100 for all gains, no losses', () => {
      const rsi = new RSIIndicator(14);
      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: 100 + i,
        high: 105 + i,
        low: 100 + i,
        close: 101 + i, // Always increasing
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = rsi.calculate(candles);

      expect(result).toBe(100);
    });

    it('should return 0 for all losses, no gains', () => {
      const rsi = new RSIIndicator(14);
      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: 100 - i,
        high: 100 - i,
        low: 95 - i,
        close: 99 - i, // Always decreasing
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = rsi.calculate(candles);

      expect(result).toBe(0);
    });

    it('should return 70 for neutral market (no gains, no losses)', () => {
      const rsi = new RSIIndicator(14);
      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100, // No change
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = rsi.calculate(candles);

      expect(result).toBe(70); // ZERO_DIVISION_FALLBACK = CONFIDENCE_THRESHOLDS.MODERATE = 70
    });
  });

  describe('Wilder\'s Smoothing', () => {
    it('should use Wilder smoothing for subsequent candles', () => {
      const rsi = new RSIIndicator(14);
      const candles: Candle[] = [
        { open: 100, high: 105, low: 95, close: 100, volume: 1000, timestamp: 1000 },
        { open: 100, high: 105, low: 95, close: 101, volume: 1000, timestamp: 2000 },
        { open: 101, high: 106, low: 96, close: 102, volume: 1000, timestamp: 3000 },
        { open: 102, high: 107, low: 97, close: 103, volume: 1000, timestamp: 4000 },
        { open: 103, high: 108, low: 98, close: 104, volume: 1000, timestamp: 5000 },
        { open: 104, high: 109, low: 99, close: 105, volume: 1000, timestamp: 6000 },
        { open: 105, high: 110, low: 100, close: 106, volume: 1000, timestamp: 7000 },
        { open: 106, high: 111, low: 101, close: 107, volume: 1000, timestamp: 8000 },
        { open: 107, high: 112, low: 102, close: 108, volume: 1000, timestamp: 9000 },
        { open: 108, high: 113, low: 103, close: 109, volume: 1000, timestamp: 10000 },
        { open: 109, high: 114, low: 104, close: 110, volume: 1000, timestamp: 11000 },
        { open: 110, high: 115, low: 105, close: 111, volume: 1000, timestamp: 12000 },
        { open: 111, high: 116, low: 106, close: 112, volume: 1000, timestamp: 13000 },
        { open: 112, high: 117, low: 107, close: 113, volume: 1000, timestamp: 14000 },
        { open: 113, high: 118, low: 108, close: 114, volume: 1000, timestamp: 15000 },
        // Additional candles to test smoothing
        { open: 114, high: 119, low: 109, close: 115, volume: 1000, timestamp: 16000 },
        { open: 115, high: 120, low: 110, close: 114, volume: 1000, timestamp: 17000 }, // Small loss
        { open: 114, high: 119, low: 109, close: 115, volume: 1000, timestamp: 18000 },
      ];

      const result = rsi.calculate(candles);

      // RSI should be between 70-100 (overbought) due to mostly gains
      expect(result).toBeGreaterThan(70);
      expect(result).toBeLessThanOrEqual(100);
    });
  });

  describe('Update Method', () => {
    it('should allow incremental updates', () => {
      const rsi = new RSIIndicator(14);
      const candles: Candle[] = Array.from({ length: 15 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100 + i,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const initialRSI = rsi.calculate(candles);

      // Add one more candle via update (add a decrease to ensure RSI changes)
      const updatedRSI = rsi.update(candles[candles.length - 1].close, 110);

      expect(updatedRSI).toBeGreaterThanOrEqual(0);
      expect(updatedRSI).toBeLessThanOrEqual(100);
      // RSI should change when we add a loss after all gains
      expect(updatedRSI).toBeLessThan(initialRSI);
    });

    it('should throw error if update called before initialize', () => {
      const rsi = new RSIIndicator(14);

      expect(() => rsi.update(100, 105)).toThrow('RSI not initialized');
    });
  });

  describe('State Management', () => {
    it('should track state correctly', () => {
      const rsi = new RSIIndicator(14);

      // Initial state
      let state = rsi.getState();
      expect(state.initialized).toBe(false);
      expect(state.avgGain).toBe(0);
      expect(state.avgLoss).toBe(0);

      // After calculation
      const candles: Candle[] = Array.from({ length: 15 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100 + i,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      rsi.calculate(candles);
      state = rsi.getState();

      expect(state.initialized).toBe(true);
      expect(state.avgGain).toBeGreaterThan(0);
      expect(state.avgLoss).toBeGreaterThanOrEqual(0);
    });

    it('should reset state correctly', () => {
      const rsi = new RSIIndicator(14);
      const candles: Candle[] = Array.from({ length: 15 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100 + i,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      rsi.calculate(candles);
      rsi.reset();

      const state = rsi.getState();
      expect(state.initialized).toBe(false);
      expect(state.avgGain).toBe(0);
      expect(state.avgLoss).toBe(0);
    });
  });

  describe('Multiple Timeframes', () => {
    it('should calculate RSI correctly for 1m timeframe', () => {
      const rsi = new RSIIndicator(14);

      // Simulate 1-minute candles
      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: 50000 + i * 10,
        high: 50010 + i * 10,
        low: 49990 + i * 10,
        close: 50000 + i * 10 + (i % 2 === 0 ? 5 : -3),
        volume: 1000 + i * 10,
        timestamp: Date.now() + i * 60 * 1000, // 1 minute apart
      }));

      const result = rsi.calculate(candles);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should calculate RSI correctly for 5m timeframe', () => {
      const rsi = new RSIIndicator(14);

      // Simulate 5-minute candles
      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: 50000 + i * 50,
        high: 50050 + i * 50,
        low: 49950 + i * 50,
        close: 50000 + i * 50 + (i % 3 === 0 ? 20 : -10),
        volume: 5000 + i * 50,
        timestamp: Date.now() + i * 5 * 60 * 1000, // 5 minutes apart
      }));

      const result = rsi.calculate(candles);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should calculate RSI correctly for 1h timeframe', () => {
      const rsi = new RSIIndicator(14);

      // Simulate 1-hour candles
      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: 50000 + i * 200,
        high: 50200 + i * 200,
        low: 49800 + i * 200,
        close: 50000 + i * 200 + (i % 4 === 0 ? 100 : -50),
        volume: 10000 + i * 100,
        timestamp: Date.now() + i * 60 * 60 * 1000, // 1 hour apart
      }));

      const result = rsi.calculate(candles);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle sideways market (oscillating)', () => {
      const rsi = new RSIIndicator(14);
      const basePrice = 50000;

      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: basePrice,
        high: basePrice + 50,
        low: basePrice - 50,
        close: basePrice + Math.sin(i * 0.5) * 30, // Oscillating
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = rsi.calculate(candles);

      // Should be near neutral (around 50), but allow some variance
      expect(result).toBeGreaterThan(35);
      expect(result).toBeLessThan(65);
    });

    it('should handle trending market (uptrend)', () => {
      const rsi = new RSIIndicator(14);
      const basePrice = 50000;

      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: basePrice + i * 20,
        high: basePrice + i * 20 + 30,
        low: basePrice + i * 20 - 10,
        close: basePrice + i * 20 + 15, // Consistent uptrend
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = rsi.calculate(candles);

      // Should be overbought (> 70)
      expect(result).toBeGreaterThan(70);
    });

    it('should handle trending market (downtrend)', () => {
      const rsi = new RSIIndicator(14);
      const basePrice = 50000;

      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: basePrice - i * 20,
        high: basePrice - i * 20 + 10,
        low: basePrice - i * 20 - 30,
        close: basePrice - i * 20 - 15, // Consistent downtrend
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = rsi.calculate(candles);

      // Should be oversold (< 30)
      expect(result).toBeLessThan(30);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large prices', () => {
      const rsi = new RSIIndicator(14);
      const basePrice = 1000000;

      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: basePrice + i * 1000,
        high: basePrice + i * 1000 + 500,
        low: basePrice + i * 1000 - 500,
        close: basePrice + i * 1000 + 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = rsi.calculate(candles);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
      expect(isNaN(result)).toBe(false);
    });

    it('should handle very small price changes', () => {
      const rsi = new RSIIndicator(14);
      const basePrice = 0.00001;

      const candles: Candle[] = Array.from({ length: 20 }, (_, i) => ({
        open: basePrice,
        high: basePrice + 0.000001,
        low: basePrice - 0.000001,
        close: basePrice + (i % 2 === 0 ? 0.0000005 : -0.0000003),
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = rsi.calculate(candles);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
      expect(isNaN(result)).toBe(false);
    });
  });
});
