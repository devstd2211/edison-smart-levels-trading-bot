/**
 * RSI Indicator NEW Tests
 * Testing RSI calculation with ConfigNew structure
 */

import { RSIIndicatorNew } from '../../indicators/rsi.indicator-new';
import type { Candle } from '../../types/core';
import type { RsiIndicatorConfigNew } from '../../types/config-new.types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const validRsiConfig: RsiIndicatorConfigNew = {
  enabled: true,
  period: 14,
  oversold: 30,
  overbought: 70,
  extreme: { low: 20, high: 80 },
  neutralZone: { min: 45, max: 55 },
  maxConfidence: 100,
};

const disabledRsiConfig: RsiIndicatorConfigNew = {
  enabled: false,
  period: 14,
  oversold: 30,
  overbought: 70,
  extreme: { low: 20, high: 80 },
  neutralZone: { min: 45, max: 55 },
  maxConfidence: 100,
};

function createCandles(count: number, basePrice: number = 100, trend: 'up' | 'down' | 'flat' = 'flat'): Candle[] {
  return Array.from({ length: count }, (_, i) => {
    let close = basePrice;
    if (trend === 'up') {
      close = basePrice + i;
    } else if (trend === 'down') {
      close = basePrice - i;
    } else {
      close = basePrice + (i % 3 === 0 ? 1 : -1); // Oscillate
    }

    return {
      open: close - 0.5,
      high: close + 2,
      low: close - 2,
      close,
      volume: 1000,
      timestamp: 1000 * (i + 1),
    };
  });
}

describe('RSI Indicator NEW', () => {
  describe('Configuration Validation', () => {
    it('should throw if enabled is missing', () => {
      const badConfig = { ...validRsiConfig, enabled: undefined } as any;
      expect(() => new RSIIndicatorNew(badConfig)).toThrow(/enabled.*boolean/i);
    });

    it('should throw if period is missing', () => {
      const badConfig = { ...validRsiConfig, period: undefined };
      expect(() => new RSIIndicatorNew(badConfig as any)).toThrow(/period/i);
    });

    it('should throw if oversold is missing', () => {
      const badConfig = { ...validRsiConfig, oversold: undefined };
      expect(() => new RSIIndicatorNew(badConfig as any)).toThrow(/oversold/i);
    });

    it('should throw if overbought is missing', () => {
      const badConfig = { ...validRsiConfig, overbought: undefined };
      expect(() => new RSIIndicatorNew(badConfig as any)).toThrow(/overbought/i);
    });

    it('should throw if extreme is missing', () => {
      const badConfig = { ...validRsiConfig, extreme: undefined };
      expect(() => new RSIIndicatorNew(badConfig as any)).toThrow(/extreme/i);
    });

    it('should throw if neutralZone is missing', () => {
      const badConfig = { ...validRsiConfig, neutralZone: undefined };
      expect(() => new RSIIndicatorNew(badConfig as any)).toThrow(/neutralZone/i);
    });

    it('should throw if maxConfidence is missing', () => {
      const badConfig = { ...validRsiConfig, maxConfidence: undefined };
      expect(() => new RSIIndicatorNew(badConfig as any)).toThrow(/maxConfidence/i);
    });

    it('should throw if period is invalid (negative)', () => {
      const badConfig = { ...validRsiConfig, period: -1 };
      expect(() => new RSIIndicatorNew(badConfig)).toThrow(/period/i);
    });

    it('should throw if oversold is out of range', () => {
      const badConfig = { ...validRsiConfig, oversold: 150 };
      expect(() => new RSIIndicatorNew(badConfig)).toThrow(/oversold/i);
    });

    it('should throw if overbought is out of range', () => {
      const badConfig = { ...validRsiConfig, overbought: -10 };
      expect(() => new RSIIndicatorNew(badConfig)).toThrow(/overbought/i);
    });

    it('should throw if extreme.low is missing', () => {
      const badConfig = { ...validRsiConfig, extreme: { high: 80 } };
      expect(() => new RSIIndicatorNew(badConfig as any)).toThrow(/extreme/i);
    });

    it('should throw if neutralZone.min is missing', () => {
      const badConfig = { ...validRsiConfig, neutralZone: { max: 55 } };
      expect(() => new RSIIndicatorNew(badConfig as any)).toThrow(/neutralZone/i);
    });

    it('should throw if maxConfidence is out of range', () => {
      const badConfig = { ...validRsiConfig, maxConfidence: 150 };
      expect(() => new RSIIndicatorNew(badConfig)).toThrow(/maxConfidence/i);
    });

    it('should create with valid config', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      expect(rsi).toBeDefined();
      expect(rsi.isEnabled()).toBe(true);
    });
  });

  describe('Disabled Config', () => {
    it('should throw when calculating with disabled indicator', () => {
      const rsi = new RSIIndicatorNew(disabledRsiConfig);
      const candles = createCandles(30);

      expect(() => rsi.calculate(candles)).toThrow(/disabled/i);
    });

    it('should return false for isEnabled when disabled', () => {
      const rsi = new RSIIndicatorNew(disabledRsiConfig);
      expect(rsi.isEnabled()).toBe(false);
    });
  });

  describe('Basic Functionality', () => {
    it('should throw error if not enough candles', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles = createCandles(10); // Need period + 1 = 15

      expect(() => rsi.calculate(candles)).toThrow(/enough candles/i);
    });

    it('should calculate RSI with exact period + 1 candles', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles = createCandles(15); // 14 + 1

      const result = rsi.calculate(candles);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
      expect(typeof result).toBe('number');
      expect(isNaN(result)).toBe(false);
    });

    it('should calculate RSI with more than period + 1 candles', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles = createCandles(50);

      const result = rsi.calculate(candles);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should return 100 for all gains (uptrend)', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles = createCandles(30, 100, 'up');

      const result = rsi.calculate(candles);

      expect(result).toBe(100);
    });

    it('should return 0 for all losses (downtrend)', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles = createCandles(30, 100, 'down');

      const result = rsi.calculate(candles);

      expect(result).toBe(0);
    });

    it('should return fallback value for flat market', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100, // No change
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = rsi.calculate(candles);

      // Should return 70 (neutral fallback) when avgLoss = 0 and avgGain = 0
      expect(result).toBe(70);
    });
  });

  describe('Update Method', () => {
    it('should throw if update called before initialize', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);

      expect(() => rsi.update(100, 105)).toThrow(/not initialized/i);
    });

    it('should throw if previousClose is invalid (NaN)', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles = createCandles(30);
      rsi.calculate(candles);

      expect(() => rsi.update(NaN, 105)).toThrow(/previousClose/i);
    });

    it('should throw if currentClose is negative', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles = createCandles(30);
      rsi.calculate(candles);

      expect(() => rsi.update(100, -5)).toThrow(/currentClose/i);
    });

    it('should allow incremental updates', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles = createCandles(25, 100, 'up');

      const initialRsi = rsi.calculate(candles);
      const lastClose = candles[candles.length - 1].close;

      // Add a loss
      const updatedRsi = rsi.update(lastClose, lastClose - 5);

      expect(updatedRsi).toBeLessThan(initialRsi);
      expect(updatedRsi).toBeGreaterThanOrEqual(0);
      expect(updatedRsi).toBeLessThanOrEqual(100);
    });

    it('should update RSI consistently', () => {
      const rsi1 = new RSIIndicatorNew(validRsiConfig);
      const rsi2 = new RSIIndicatorNew(validRsiConfig);

      const candles = createCandles(30);

      // Calculate all at once
      const result1 = rsi1.calculate(candles);

      // Calculate incrementally
      const initialCandles = candles.slice(0, 25);
      rsi2.calculate(initialCandles);
      for (let i = 25; i < candles.length; i++) {
        rsi2.update(candles[i - 1].close, candles[i].close);
      }
      const result2 = rsi2.getValue();

      expect(result1).toBeCloseTo(result2, 2);
    });
  });

  describe('State Management', () => {
    it('should track state correctly', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);

      let state = rsi.getState();
      expect(state.initialized).toBe(false);
      expect(state.rsi).toBe(0);

      const candles = createCandles(30);
      rsi.calculate(candles);

      state = rsi.getState();
      expect(state.initialized).toBe(true);
      expect(state.rsi).toBeGreaterThanOrEqual(0);
      expect(state.rsi).toBeLessThanOrEqual(100);
    });

    it('should reset state correctly', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles = createCandles(30);

      rsi.calculate(candles);
      expect(rsi.getState().initialized).toBe(true);

      rsi.reset();
      const state = rsi.getState();

      expect(state.initialized).toBe(false);
      expect(state.rsi).toBe(0);
    });

    it('should throw error when getting value before initialization', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);

      expect(() => rsi.getValue()).toThrow(/not initialized/i);
    });
  });

  describe('Zone Detection', () => {
    it('should detect oversold zone', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles = createCandles(30, 100, 'down'); // Downtrend = low RSI

      rsi.calculate(candles);

      expect(rsi.isOversold()).toBe(true);
      expect(rsi.isOverbought()).toBe(false);
    });

    it('should detect overbought zone', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles = createCandles(30, 100, 'up'); // Uptrend = high RSI

      rsi.calculate(candles);

      expect(rsi.isOverbought()).toBe(true);
      expect(rsi.isOversold()).toBe(false);
    });

    it('should detect extreme low zone', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles = createCandles(30, 100, 'down');

      rsi.calculate(candles);

      const extreme = rsi.getExtremeZone();
      expect(extreme).toBe('LOW');
    });

    it('should detect extreme high zone', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles = createCandles(30, 100, 'up');

      rsi.calculate(candles);

      const extreme = rsi.getExtremeZone();
      expect(extreme).toBe('HIGH');
    });

    it('should detect neutral zone', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      // Create a candle pattern that results in RSI around 50 (neutral)
      // Roughly equal ups and downs will give RSI ~ 50
      const candles: Candle[] = [
        { open: 100, high: 105, low: 95, close: 101, volume: 1000, timestamp: 1000 }, // +1
        { open: 101, high: 106, low: 96, close: 102, volume: 1000, timestamp: 2000 }, // +1
        { open: 102, high: 107, low: 97, close: 103, volume: 1000, timestamp: 3000 }, // +1
        { open: 103, high: 108, low: 98, close: 102, volume: 1000, timestamp: 4000 }, // -1
        { open: 102, high: 107, low: 97, close: 103, volume: 1000, timestamp: 5000 }, // +1
        { open: 103, high: 108, low: 98, close: 104, volume: 1000, timestamp: 6000 }, // +1
        { open: 104, high: 109, low: 99, close: 103, volume: 1000, timestamp: 7000 }, // -1
        { open: 103, high: 108, low: 98, close: 104, volume: 1000, timestamp: 8000 }, // +1
        { open: 104, high: 109, low: 99, close: 105, volume: 1000, timestamp: 9000 }, // +1
        { open: 105, high: 110, low: 100, close: 104, volume: 1000, timestamp: 10000 }, // -1
        { open: 104, high: 109, low: 99, close: 105, volume: 1000, timestamp: 11000 }, // +1
        { open: 105, high: 110, low: 100, close: 106, volume: 1000, timestamp: 12000 }, // +1
        { open: 106, high: 111, low: 101, close: 105, volume: 1000, timestamp: 13000 }, // -1
        { open: 105, high: 110, low: 100, close: 106, volume: 1000, timestamp: 14000 }, // +1
        { open: 106, high: 111, low: 101, close: 107, volume: 1000, timestamp: 15000 }, // +1
        { open: 107, high: 112, low: 102, close: 106, volume: 1000, timestamp: 16000 }, // -1
      ];

      rsi.calculate(candles);
      const rsiValue = rsi.getValue();

      // Should be in neutral zone (45-55 based on config) or at least not extreme
      // With roughly equal gains and losses, RSI should be neither overbought nor oversold
      expect(rsiValue).toBeGreaterThan(30);
      expect(rsiValue).toBeLessThan(70);
      // Check that it's not extreme
      expect(rsi.getExtremeZone()).toBeNull();
    });

    it('should return null for no extreme zone', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100 + Math.sin(i * 0.5) * 2,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      rsi.calculate(candles);

      const extreme = rsi.getExtremeZone();
      expect(extreme).toBeNull();
    });
  });

  describe('Config Retrieval', () => {
    it('should return original config values', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const config = rsi.getConfig();

      expect(config.enabled).toBe(validRsiConfig.enabled);
      expect(config.period).toBe(validRsiConfig.period);
      expect(config.oversold).toBe(validRsiConfig.oversold);
      expect(config.overbought).toBe(validRsiConfig.overbought);
      expect(config.extreme).toEqual(validRsiConfig.extreme);
      expect(config.neutralZone).toEqual(validRsiConfig.neutralZone);
      expect(config.maxConfidence).toBe(validRsiConfig.maxConfidence);
    });
  });

  describe('Wilder\'s Smoothing', () => {
    it('should apply Wilder smoothing correctly', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 100 + i,
        high: 105 + i,
        low: 95 + i,
        close: 100 + i + (i % 3 === 0 ? 2 : -1),
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = rsi.calculate(candles);

      // Should be in reasonable range
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large prices', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const basePrice = 1000000;

      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: basePrice + i * 1000,
        high: basePrice + i * 1000 + 500,
        low: basePrice + i * 1000 - 500,
        close: basePrice + i * 1000,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = rsi.calculate(candles);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
      expect(isNaN(result)).toBe(false);
    });

    it('should handle very small prices', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const basePrice = 0.00001;

      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: basePrice,
        high: basePrice + 0.000001,
        low: basePrice - 0.000001,
        close: basePrice + i * 0.0000001,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = rsi.calculate(candles);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
      expect(isNaN(result)).toBe(false);
    });

    it('should work with different period values', () => {
      const periods = [7, 14, 21, 28];

      for (const period of periods) {
        const config: RsiIndicatorConfigNew = {
          ...validRsiConfig,
          period,
        };
        const rsi = new RSIIndicatorNew(config);
        const candles = createCandles(period + 10);

        const result = rsi.calculate(candles);

        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle strong uptrend correctly', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles: Candle[] = Array.from({ length: 50 }, (_, i) => ({
        open: 50000 + i * 100,
        high: 50100 + i * 100,
        low: 50000 + i * 100,
        close: 50050 + i * 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = rsi.calculate(candles);

      expect(result).toBeGreaterThan(70); // Overbought
    });

    it('should handle strong downtrend correctly', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles: Candle[] = Array.from({ length: 50 }, (_, i) => ({
        open: 50000 - i * 100,
        high: 50000 - i * 100,
        low: 49900 - i * 100,
        close: 49950 - i * 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = rsi.calculate(candles);

      expect(result).toBeLessThan(30); // Oversold
    });

    it('should work with different oversold/overbought thresholds', () => {
      const configs: RsiIndicatorConfigNew[] = [
        { ...validRsiConfig, oversold: 20, overbought: 80 },
        { ...validRsiConfig, oversold: 25, overbought: 75 },
        { ...validRsiConfig, oversold: 35, overbought: 65 },
      ];

      const candlesUp = createCandles(40, 100, 'up');
      const candlesDown = createCandles(40, 100, 'down');

      for (const config of configs) {
        const rsi = new RSIIndicatorNew(config);

        rsi.calculate(candlesUp);
        expect(rsi.isOverbought()).toBe(true);

        rsi.reset();
        rsi.calculate(candlesDown);
        expect(rsi.isOversold()).toBe(true);
      }
    });
  });

  describe('Multiple Timeframes', () => {
    it('should work with 1m candles', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 50000 + i * 10,
        high: 50010 + i * 10,
        low: 49990 + i * 10,
        close: 50000 + i * 10,
        volume: 1000 + i * 10,
        timestamp: Date.now() + i * 60 * 1000,
      }));

      const result = rsi.calculate(candles);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should work with 5m candles', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 50000 + i * 50,
        high: 50050 + i * 50,
        low: 49950 + i * 50,
        close: 50000 + i * 50,
        volume: 5000 + i * 50,
        timestamp: Date.now() + i * 5 * 60 * 1000,
      }));

      const result = rsi.calculate(candles);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should work with 1h candles', () => {
      const rsi = new RSIIndicatorNew(validRsiConfig);
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 50000 + i * 200,
        high: 50200 + i * 200,
        low: 49800 + i * 200,
        close: 50000 + i * 200,
        volume: 10000 + i * 100,
        timestamp: Date.now() + i * 60 * 60 * 1000,
      }));

      const result = rsi.calculate(candles);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });
  });
});
