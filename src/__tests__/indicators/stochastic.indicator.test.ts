/**
 * Stochastic Oscillator Indicator Tests
 * Testing %K and %D calculation, oversold/overbought detection
 */

import { StochasticIndicator } from '../../indicators/stochastic.indicator';
import { Candle } from '../../types';

describe('StochasticIndicator', () => {
  describe('Basic Functionality', () => {
    it('should throw error if not enough candles', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });
      const candles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      // Need at least kPeriod + smooth + dPeriod - 2 = 14 + 3 + 3 - 2 = 18
      expect(() => stoch.calculate(candles)).toThrow();
    });

    it('should calculate %K and %D with sufficient candles', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 100 + i + Math.sin(i) * 10,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = stoch.calculate(candles);

      expect(result.k).toBeGreaterThanOrEqual(0);
      expect(result.k).toBeLessThanOrEqual(100);
      expect(result.d).toBeGreaterThanOrEqual(0);
      expect(result.d).toBeLessThanOrEqual(100);
      expect(typeof result.k).toBe('number');
      expect(typeof result.d).toBe('number');
    });

    it('should return 100 when price is at highest high', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });
      const candles: Candle[] = [];

      // First 14 candles with range 90-110
      for (let i = 0; i < 14; i++) {
        candles.push({
          open: 100,
          high: 110,
          low: 90,
          close: 100,
          volume: 1000,
          timestamp: 1000 * (i + 1),
        });
      }

      // Add more candles to reach required count
      for (let i = 14; i < 30; i++) {
        candles.push({
          open: 100,
          high: 110,
          low: 90,
          close: 110, // Close at highest high
          volume: 1000,
          timestamp: 1000 * (i + 1),
        });
      }

      const result = stoch.calculate(candles);

      expect(result.k).toBeCloseTo(100, 0);
    });

    it('should return 0 when price is at lowest low', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });
      const candles: Candle[] = [];

      // First 14 candles with range 90-110
      for (let i = 0; i < 14; i++) {
        candles.push({
          open: 100,
          high: 110,
          low: 90,
          close: 100,
          volume: 1000,
          timestamp: 1000 * (i + 1),
        });
      }

      // Add more candles to reach required count
      for (let i = 14; i < 30; i++) {
        candles.push({
          open: 100,
          high: 110,
          low: 90,
          close: 90, // Close at lowest low
          volume: 1000,
          timestamp: 1000 * (i + 1),
        });
      }

      const result = stoch.calculate(candles);

      expect(result.k).toBeCloseTo(0, 0);
    });

    it('should return 50 when price is at middle of range', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });
      const candles: Candle[] = [];

      // All candles with range 90-110, close at 100 (middle)
      for (let i = 0; i < 30; i++) {
        candles.push({
          open: 100,
          high: 110,
          low: 90,
          close: 100,
          volume: 1000,
          timestamp: 1000 * (i + 1),
        });
      }

      const result = stoch.calculate(candles);

      expect(result.k).toBeCloseTo(50, 0);
    });
  });

  describe('Oversold/Overbought Detection', () => {
    it('isOversold should return true when k < 20', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });

      expect(stoch.isOversold(15)).toBe(true);
      expect(stoch.isOversold(19.9)).toBe(true);
      expect(stoch.isOversold(0)).toBe(true);
    });

    it('isOversold should return false when k >= 20', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });

      expect(stoch.isOversold(20)).toBe(false);
      expect(stoch.isOversold(50)).toBe(false);
      expect(stoch.isOversold(100)).toBe(false);
    });

    it('isOverbought should return true when k > 80', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });

      expect(stoch.isOverbought(85)).toBe(true);
      expect(stoch.isOverbought(80.1)).toBe(true);
      expect(stoch.isOverbought(100)).toBe(true);
    });

    it('isOverbought should return false when k <= 80', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });

      expect(stoch.isOverbought(80)).toBe(false);
      expect(stoch.isOverbought(50)).toBe(false);
      expect(stoch.isOverbought(0)).toBe(false);
    });
  });

  describe('RSI Confirmation', () => {
    it('confirmOversoldWithRSI should return true when both oversold', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });

      expect(stoch.confirmOversoldWithRSI(15, 25)).toBe(true);
      expect(stoch.confirmOversoldWithRSI(10, 20)).toBe(true);
    });

    it('confirmOversoldWithRSI should return false when only one oversold', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });

      expect(stoch.confirmOversoldWithRSI(15, 50)).toBe(false); // Only stoch
      expect(stoch.confirmOversoldWithRSI(50, 25)).toBe(false); // Only RSI
      expect(stoch.confirmOversoldWithRSI(50, 50)).toBe(false); // Neither
    });

    it('confirmOverboughtWithRSI should return true when both overbought', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });

      expect(stoch.confirmOverboughtWithRSI(85, 75)).toBe(true);
      expect(stoch.confirmOverboughtWithRSI(90, 80)).toBe(true);
    });

    it('confirmOverboughtWithRSI should return false when only one overbought', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });

      expect(stoch.confirmOverboughtWithRSI(85, 50)).toBe(false); // Only stoch
      expect(stoch.confirmOverboughtWithRSI(50, 75)).toBe(false); // Only RSI
      expect(stoch.confirmOverboughtWithRSI(50, 50)).toBe(false); // Neither
    });
  });

  describe('Crossover Detection', () => {
    it('detectCrossover should detect bullish crossover', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });

      // %K crosses above %D
      const crossover = stoch.detectCrossover(55, 50, 45, 50);
      expect(crossover).toBe('BULLISH');
    });

    it('detectCrossover should detect bearish crossover', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });

      // %K crosses below %D
      const crossover = stoch.detectCrossover(45, 50, 55, 50);
      expect(crossover).toBe('BEARISH');
    });

    it('detectCrossover should return NONE when no crossover', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });

      // %K stays above %D
      expect(stoch.detectCrossover(55, 50, 60, 50)).toBe('NONE');

      // %K stays below %D
      expect(stoch.detectCrossover(45, 50, 40, 50)).toBe('NONE');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero range gracefully', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });
      const candles: Candle[] = [];

      // All candles with same high and low (no volatility)
      for (let i = 0; i < 30; i++) {
        candles.push({
          open: 100,
          high: 100,
          low: 100,
          close: 100,
          volume: 1000,
          timestamp: 1000 * (i + 1),
        });
      }

      const result = stoch.calculate(candles);

      // Should return 70 (ZERO_RANGE_FALLBACK = CONFIDENCE_THRESHOLDS.MODERATE) when no range
      expect(result.k).toBe(70);
      expect(result.d).toBe(70);
    });

    it('reset should clear history', () => {
      const stoch = new StochasticIndicator({ kPeriod: 14, dPeriod: 3, smooth: 3 });
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 100,
        high: 110,
        low: 90,
        close: 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      stoch.calculate(candles);
      expect(stoch.getKHistory().length).toBeGreaterThan(0);

      stoch.reset();
      expect(stoch.getKHistory().length).toBe(0);
    });
  });
});
