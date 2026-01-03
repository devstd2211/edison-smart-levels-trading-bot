/**
 * Bollinger Bands Indicator Tests
 * Testing BB calculation, squeeze detection, adaptive parameters
 */

import { BollingerBandsIndicator } from '../../indicators/bollinger.indicator';
import { Candle } from '../../types';

describe('BollingerBandsIndicator', () => {
  describe('Basic Functionality', () => {
    it('should throw error if not enough candles', () => {
      const bb = new BollingerBandsIndicator(20, 2.0);
      const candles: Candle[] = Array.from({ length: 10 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      expect(() => bb.calculate(candles)).toThrow();
    });

    it('should calculate BB with sufficient candles', () => {
      const bb = new BollingerBandsIndicator(20, 2.0);
      const candles: Candle[] = Array.from({ length: 50 }, (_, i) => ({
        open: 100 + i,
        high: 110 + i,
        low: 90 + i,
        close: 100 + i + Math.sin(i) * 10,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = bb.calculate(candles);

      expect(result.upper).toBeGreaterThan(result.middle);
      expect(result.middle).toBeGreaterThan(result.lower);
      expect(result.width).toBeGreaterThan(0);
      expect(result.percentB).toBeGreaterThanOrEqual(0);
      expect(result.percentB).toBeLessThanOrEqual(1);
    });

    it('should calculate correct SMA for middle band', () => {
      const bb = new BollingerBandsIndicator(5, 2.0);
      const candles: Candle[] = [
        { open: 100, high: 105, low: 95, close: 100, volume: 1000, timestamp: 1000 },
        { open: 100, high: 105, low: 95, close: 102, volume: 1000, timestamp: 2000 },
        { open: 100, high: 105, low: 95, close: 98, volume: 1000, timestamp: 3000 },
        { open: 100, high: 105, low: 95, close: 104, volume: 1000, timestamp: 4000 },
        { open: 100, high: 105, low: 95, close: 96, volume: 1000, timestamp: 5000 },
      ];

      const result = bb.calculate(candles);

      // SMA = (100 + 102 + 98 + 104 + 96) / 5 = 100
      expect(result.middle).toBeCloseTo(100, 1);
    });

    it('should calculate upper and lower bands with stdDev=2', () => {
      const bb = new BollingerBandsIndicator(5, 2.0);
      // Create candles with known std deviation
      const candles: Candle[] = [
        { open: 100, high: 105, low: 95, close: 98, volume: 1000, timestamp: 1000 },
        { open: 100, high: 105, low: 95, close: 100, volume: 1000, timestamp: 2000 },
        { open: 100, high: 105, low: 95, close: 100, volume: 1000, timestamp: 3000 },
        { open: 100, high: 105, low: 95, close: 100, volume: 1000, timestamp: 4000 },
        { open: 100, high: 105, low: 95, close: 102, volume: 1000, timestamp: 5000 },
      ];

      const result = bb.calculate(candles);

      // Middle = 100
      // Std dev ≈ 1.414
      // Upper ≈ 100 + 2*1.414 = 102.828
      // Lower ≈ 100 - 2*1.414 = 97.172
      expect(result.middle).toBeCloseTo(100, 1);
      expect(result.upper).toBeGreaterThan(result.middle);
      expect(result.lower).toBeLessThan(result.middle);
    });

    it('should calculate percentB correctly', () => {
      const bb = new BollingerBandsIndicator(5, 2.0);
      const candles: Candle[] = [];

      // Create candles where we can predict %B
      for (let i = 0; i < 5; i++) {
        candles.push({
          open: 100,
          high: 110,
          low: 90,
          close: 100,
          volume: 1000,
          timestamp: 1000 * (i + 1),
        });
      }

      const result = bb.calculate(candles);

      // Price at middle → %B should be around 0.5
      expect(result.percentB).toBeCloseTo(0.5, 0);
    });
  });

  describe('Position Detection', () => {
    it('isNearLowerBand should return true when percentB <= 0.15', () => {
      const bb = new BollingerBandsIndicator(20, 2.0);

      expect(bb.isNearLowerBand(0.10)).toBe(true);
      expect(bb.isNearLowerBand(0.15)).toBe(true);
      expect(bb.isNearLowerBand(0.00)).toBe(true);
    });

    it('isNearLowerBand should return false when percentB > 0.15', () => {
      const bb = new BollingerBandsIndicator(20, 2.0);

      expect(bb.isNearLowerBand(0.16)).toBe(false);
      expect(bb.isNearLowerBand(0.50)).toBe(false);
      expect(bb.isNearLowerBand(1.00)).toBe(false);
    });

    it('isNearUpperBand should return true when percentB >= 0.85', () => {
      const bb = new BollingerBandsIndicator(20, 2.0);

      expect(bb.isNearUpperBand(0.90)).toBe(true);
      expect(bb.isNearUpperBand(0.85)).toBe(true);
      expect(bb.isNearUpperBand(1.00)).toBe(true);
    });

    it('isNearUpperBand should return false when percentB < 0.85', () => {
      const bb = new BollingerBandsIndicator(20, 2.0);

      expect(bb.isNearUpperBand(0.84)).toBe(false);
      expect(bb.isNearUpperBand(0.50)).toBe(false);
      expect(bb.isNearUpperBand(0.00)).toBe(false);
    });

    it('isInMiddleZone should return true when percentB between 0.3 and 0.7', () => {
      const bb = new BollingerBandsIndicator(20, 2.0);

      expect(bb.isInMiddleZone(0.50)).toBe(true);
      expect(bb.isInMiddleZone(0.40)).toBe(true);
      expect(bb.isInMiddleZone(0.60)).toBe(true);
    });

    it('isInMiddleZone should return false outside 0.3-0.7', () => {
      const bb = new BollingerBandsIndicator(20, 2.0);

      expect(bb.isInMiddleZone(0.29)).toBe(false);
      expect(bb.isInMiddleZone(0.71)).toBe(false);
      expect(bb.isInMiddleZone(0.10)).toBe(false);
      expect(bb.isInMiddleZone(0.90)).toBe(false);
    });
  });

  describe('Squeeze Detection', () => {
    it('isSqueeze should return false without enough history', () => {
      const bb = new BollingerBandsIndicator(20, 2.0);
      const candles: Candle[] = Array.from({ length: 25 }, (_, i) => ({
        open: 100,
        high: 110,
        low: 90,
        close: 100 + Math.sin(i) * 5,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      bb.calculate(candles);

      // Not enough history yet (< 20 entries)
      expect(bb.isSqueeze()).toBe(false);
    });

    it('isSqueeze should detect squeeze when width narrows', () => {
      const bb = new BollingerBandsIndicator(5, 2.0);

      // Create wide bands first (high volatility)
      for (let i = 0; i < 25; i++) {
        const candles: Candle[] = Array.from({ length: 5 }, (_, j) => ({
          open: 100,
          high: 120,
          low: 80,
          close: 100 + Math.sin(j) * 15, // High volatility
          volume: 1000,
          timestamp: 1000 * (j + 1),
        }));
        bb.calculate(candles);
      }

      // Now create narrow bands (low volatility = squeeze)
      const narrowCandles: Candle[] = Array.from({ length: 5 }, (_, j) => ({
        open: 100,
        high: 102,
        low: 98,
        close: 100 + Math.sin(j) * 0.5, // Very low volatility
        volume: 1000,
        timestamp: 1000 * (j + 25 + 1),
      }));

      bb.calculate(narrowCandles);

      // Squeeze should be detected (current width < 80% of average)
      expect(bb.isSqueeze(0.8)).toBe(true);
    });
  });

  describe('Adaptive Parameters', () => {
    it('getAdaptiveParams should return high volatility params', () => {
      const bb = new BollingerBandsIndicator(20, 2.0);

      const atr = 6; // High ATR
      const price = 100;
      const params = bb.getAdaptiveParams(atr, price);

      // Volatility = 6/100 = 0.06 > 0.05 → high volatility
      expect(params.period).toBe(20);
      expect(params.stdDev).toBe(2.5);
    });

    it('getAdaptiveParams should return medium volatility params', () => {
      const bb = new BollingerBandsIndicator(20, 2.0);

      const atr = 4; // Medium ATR
      const price = 100;
      const params = bb.getAdaptiveParams(atr, price);

      // Volatility = 4/100 = 0.04 (0.03 < vol < 0.05) → medium volatility
      expect(params.period).toBe(20);
      expect(params.stdDev).toBe(2.0);
    });

    it('getAdaptiveParams should return low volatility params', () => {
      const bb = new BollingerBandsIndicator(20, 2.0);

      const atr = 2; // Low ATR
      const price = 100;
      const params = bb.getAdaptiveParams(atr, price);

      // Volatility = 2/100 = 0.02 < 0.03 → low volatility
      expect(params.period).toBe(20);
      expect(params.stdDev).toBe(1.5);
    });

    it('applyAdaptiveParams should update indicator parameters', () => {
      const bb = new BollingerBandsIndicator(20, 2.0);

      bb.applyAdaptiveParams({ period: 25, stdDev: 2.5 });

      const params = bb.getParams();
      expect(params.period).toBe(25);
      expect(params.stdDev).toBe(2.5);
    });
  });

  describe('History Management', () => {
    it('should store calculation history', () => {
      const bb = new BollingerBandsIndicator(5, 2.0);
      const candles: Candle[] = Array.from({ length: 5 }, (_, i) => ({
        open: 100,
        high: 110,
        low: 90,
        close: 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      bb.calculate(candles);
      const history = bb.getHistory();

      expect(history.length).toBe(1);
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('upper');
      expect(history[0]).toHaveProperty('middle');
      expect(history[0]).toHaveProperty('lower');
      expect(history[0]).toHaveProperty('width');
    });

    it('should limit history to 100 entries', () => {
      const bb = new BollingerBandsIndicator(5, 2.0);

      // Calculate 150 times
      for (let i = 0; i < 150; i++) {
        const candles: Candle[] = Array.from({ length: 5 }, (_, j) => ({
          open: 100,
          high: 110,
          low: 90,
          close: 100,
          volume: 1000,
          timestamp: 1000 * (j + i * 5 + 1),
        }));
        bb.calculate(candles);
      }

      const history = bb.getHistory();
      expect(history.length).toBe(100);
    });

    it('reset should clear history', () => {
      const bb = new BollingerBandsIndicator(5, 2.0);
      const candles: Candle[] = Array.from({ length: 5 }, (_, i) => ({
        open: 100,
        high: 110,
        low: 90,
        close: 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      bb.calculate(candles);
      expect(bb.getHistory().length).toBe(1);

      bb.reset();
      expect(bb.getHistory().length).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero volatility gracefully', () => {
      const bb = new BollingerBandsIndicator(5, 2.0);
      const candles: Candle[] = [];

      // All candles with same close price (no volatility)
      for (let i = 0; i < 5; i++) {
        candles.push({
          open: 100,
          high: 100,
          low: 100,
          close: 100,
          volume: 1000,
          timestamp: 1000 * (i + 1),
        });
      }

      const result = bb.calculate(candles);

      expect(result.upper).toBe(result.middle);
      expect(result.lower).toBe(result.middle);
      expect(result.percentB).toBe(0.5); // Price at middle when no range
    });
  });
});
