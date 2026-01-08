/**
 * EMA Indicator NEW Tests
 * Testing EMA calculation with ConfigNew structure
 */

import { EMAIndicatorNew } from '../../indicators/ema.indicator-new';
import type { Candle } from '../../types/core';
import type { EmaIndicatorConfigNew } from '../../types/config-new.types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const validEmaConfig: EmaIndicatorConfigNew = {
  enabled: true,
  fastPeriod: 9,
  slowPeriod: 21,
  baseConfidence: 0.5,
  strengthMultiplier: 0.2,
};

const disabledEmaConfig: EmaIndicatorConfigNew = {
  enabled: false,
  fastPeriod: 9,
  slowPeriod: 21,
  baseConfidence: 0.5,
  strengthMultiplier: 0.2,
};

function createCandles(count: number, basePrice: number = 100): Candle[] {
  return Array.from({ length: count }, (_, i) => ({
    open: basePrice + i,
    high: basePrice + i + 5,
    low: basePrice + i - 5,
    close: basePrice + i,
    volume: 1000,
    timestamp: 1000 * (i + 1),
  }));
}

describe('EMA Indicator NEW', () => {
  describe('Configuration Validation', () => {
    it('should throw if enabled is missing', () => {
      const badConfig = { ...validEmaConfig, enabled: undefined } as any;
      expect(() => new EMAIndicatorNew(badConfig)).toThrow(/enabled.*boolean/i);
    });

    it('should throw if fastPeriod is missing', () => {
      const badConfig = { ...validEmaConfig, fastPeriod: undefined };
      expect(() => new EMAIndicatorNew(badConfig as any)).toThrow(/fastPeriod/i);
    });

    it('should throw if slowPeriod is missing', () => {
      const badConfig = { ...validEmaConfig, slowPeriod: undefined };
      expect(() => new EMAIndicatorNew(badConfig as any)).toThrow(/slowPeriod/i);
    });

    it('should throw if baseConfidence is missing', () => {
      const badConfig = { ...validEmaConfig, baseConfidence: undefined };
      expect(() => new EMAIndicatorNew(badConfig as any)).toThrow(/baseConfidence/i);
    });

    it('should throw if strengthMultiplier is missing', () => {
      const badConfig = { ...validEmaConfig, strengthMultiplier: undefined };
      expect(() => new EMAIndicatorNew(badConfig as any)).toThrow(/strengthMultiplier/i);
    });

    it('should throw if fastPeriod is invalid (negative)', () => {
      const badConfig = { ...validEmaConfig, fastPeriod: -1 };
      expect(() => new EMAIndicatorNew(badConfig)).toThrow(/fastPeriod/i);
    });

    it('should throw if slowPeriod is invalid (zero)', () => {
      const badConfig = { ...validEmaConfig, slowPeriod: 0 };
      expect(() => new EMAIndicatorNew(badConfig)).toThrow(/slowPeriod/i);
    });

    it('should throw if baseConfidence is out of range', () => {
      const badConfig = { ...validEmaConfig, baseConfidence: 1.5 };
      expect(() => new EMAIndicatorNew(badConfig)).toThrow(/baseConfidence/i);
    });

    it('should throw if strengthMultiplier is negative', () => {
      const badConfig = { ...validEmaConfig, strengthMultiplier: -0.1 };
      expect(() => new EMAIndicatorNew(badConfig)).toThrow(/strengthMultiplier/i);
    });

    it('should create with valid config', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);
      expect(ema).toBeDefined();
      expect(ema.isEnabled()).toBe(true);
    });
  });

  describe('Disabled Config', () => {
    it('should throw when calculating with disabled indicator', () => {
      const ema = new EMAIndicatorNew(disabledEmaConfig);
      const candles = createCandles(30);

      expect(() => ema.calculate(candles)).toThrow(/disabled/i);
    });

    it('should return false for isEnabled when disabled', () => {
      const ema = new EMAIndicatorNew(disabledEmaConfig);
      expect(ema.isEnabled()).toBe(false);
    });
  });

  describe('Basic Functionality', () => {
    it('should throw error if not enough candles', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);
      const candles = createCandles(10); // Need 21

      expect(() => ema.calculate(candles)).toThrow(/enough candles/i);
    });

    it('should calculate EMAs with exact slowPeriod candles', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);
      const candles = createCandles(21);

      const result = ema.calculate(candles);

      expect(result.fast).toBeGreaterThan(0);
      expect(result.slow).toBeGreaterThan(0);
      expect(typeof result.diff).toBe('number');
    });

    it('should calculate with more than slowPeriod candles', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);
      const candles = createCandles(50);

      const result = ema.calculate(candles);

      expect(result.fast).toBeGreaterThan(0);
      expect(result.slow).toBeGreaterThan(0);
    });

    it('should return diff as (fast - slow)', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);
      const candles = createCandles(30);

      const result = ema.calculate(candles);
      const expectedDiff = result.fast - result.slow;

      expect(result.diff).toBeCloseTo(expectedDiff, 10);
    });
  });

  describe('Update Method', () => {
    it('should throw if update called before initialize', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);

      expect(() => ema.update(100)).toThrow(/not initialized/i);
    });

    it('should throw if price is invalid (NaN)', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);
      const candles = createCandles(30);
      ema.calculate(candles);

      expect(() => ema.update(NaN)).toThrow(/invalid price/i);
    });

    it('should throw if price is negative', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);
      const candles = createCandles(30);
      ema.calculate(candles);

      expect(() => ema.update(-10)).toThrow(/invalid price/i);
    });

    it('should allow incremental updates', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);
      const candles = createCandles(25);

      const initialResult = ema.calculate(candles);
      const updatedResult = ema.update(125);

      expect(updatedResult.fast).toBeGreaterThan(initialResult.fast);
      expect(updatedResult.slow).toBeGreaterThan(initialResult.slow);
    });

    it('should update EMAs consistently', () => {
      const ema1 = new EMAIndicatorNew(validEmaConfig);
      const ema2 = new EMAIndicatorNew(validEmaConfig);

      const candles = createCandles(30);

      // Calculate all at once
      const result1 = ema1.calculate(candles);

      // Calculate incrementally
      const initialCandles = candles.slice(0, 25);
      ema2.calculate(initialCandles);
      for (let i = 25; i < candles.length; i++) {
        ema2.update(candles[i].close);
      }
      const result2 = ema2.getValue();

      expect(result1.fast).toBeCloseTo(result2.fast, 8);
      expect(result1.slow).toBeCloseTo(result2.slow, 8);
    });
  });

  describe('State Management', () => {
    it('should track state correctly', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);

      let state = ema.getState();
      expect(state.initialized).toBe(false);
      expect(state.fastEma).toBe(0);
      expect(state.slowEma).toBe(0);

      const candles = createCandles(30);
      ema.calculate(candles);

      state = ema.getState();
      expect(state.initialized).toBe(true);
      expect(state.fastEma).toBeGreaterThan(0);
      expect(state.slowEma).toBeGreaterThan(0);
    });

    it('should reset state correctly', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);
      const candles = createCandles(30);

      ema.calculate(candles);
      expect(ema.getState().initialized).toBe(true);

      ema.reset();
      const state = ema.getState();

      expect(state.initialized).toBe(false);
      expect(state.fastEma).toBe(0);
      expect(state.slowEma).toBe(0);
    });

    it('should throw error when getting value before initialization', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);

      expect(() => ema.getValue()).toThrow(/not initialized/i);
    });
  });

  describe('Config Retrieval', () => {
    it('should return original config values', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);
      const config = ema.getConfig();

      expect(config.enabled).toBe(validEmaConfig.enabled);
      expect(config.fastPeriod).toBe(validEmaConfig.fastPeriod);
      expect(config.slowPeriod).toBe(validEmaConfig.slowPeriod);
      expect(config.baseConfidence).toBe(validEmaConfig.baseConfidence);
      expect(config.strengthMultiplier).toBe(validEmaConfig.strengthMultiplier);
    });
  });

  describe('Crossover Detection', () => {
    it('should detect bullish crossover (fast > slow in uptrend)', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);
      const candles: Candle[] = Array.from({ length: 40 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: i < 20 ? 100 - i : 80 + (i - 20) * 2, // Down then up
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = ema.calculate(candles);

      // Fast should be above slow after uptrend
      expect(result.fast).toBeGreaterThan(result.slow);
      expect(result.diff).toBeGreaterThan(0);
    });

    it('should detect bearish crossover (fast < slow in downtrend)', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);
      const candles: Candle[] = Array.from({ length: 40 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: i < 20 ? 100 + i : 120 - (i - 20) * 2, // Up then down
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = ema.calculate(candles);

      // Fast should be below slow after downtrend
      expect(result.fast).toBeLessThan(result.slow);
      expect(result.diff).toBeLessThan(0);
    });

    it('should maintain relative positions in sideways market', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 100,
        high: 105,
        low: 95,
        close: 100 + Math.sin(i * 0.5) * 2, // Oscillating
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = ema.calculate(candles);

      // Difference should be small in sideways market
      expect(Math.abs(result.diff)).toBeLessThan(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large prices', () => {
      const config: EmaIndicatorConfigNew = {
        ...validEmaConfig,
      };
      const ema = new EMAIndicatorNew(config);
      const basePrice = 1000000;

      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: basePrice + i * 1000,
        high: basePrice + i * 1000 + 500,
        low: basePrice + i * 1000 - 500,
        close: basePrice + i * 1000,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = ema.calculate(candles);

      expect(result.fast).toBeGreaterThan(0);
      expect(result.slow).toBeGreaterThan(0);
      expect(isNaN(result.diff)).toBe(false);
    });

    it('should handle very small prices', () => {
      const config: EmaIndicatorConfigNew = {
        ...validEmaConfig,
      };
      const ema = new EMAIndicatorNew(config);
      const basePrice = 0.00001;

      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: basePrice,
        high: basePrice + 0.000001,
        low: basePrice - 0.000001,
        close: basePrice + i * 0.0000001,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = ema.calculate(candles);

      expect(result.fast).toBeGreaterThan(0);
      expect(result.slow).toBeGreaterThan(0);
      expect(isNaN(result.diff)).toBe(false);
    });

    it('should work with different fast/slow period ratios', () => {
      const configs: EmaIndicatorConfigNew[] = [
        { enabled: true, fastPeriod: 5, slowPeriod: 10, baseConfidence: 0.5, strengthMultiplier: 0.2 },
        { enabled: true, fastPeriod: 12, slowPeriod: 26, baseConfidence: 0.5, strengthMultiplier: 0.2 },
        { enabled: true, fastPeriod: 3, slowPeriod: 50, baseConfidence: 0.5, strengthMultiplier: 0.2 },
      ];

      const candles = createCandles(60);

      for (const config of configs) {
        const ema = new EMAIndicatorNew(config);
        const result = ema.calculate(candles);

        expect(result.fast).toBeGreaterThan(0);
        expect(result.slow).toBeGreaterThan(0);
      }
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle strong uptrend correctly', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);
      const candles: Candle[] = Array.from({ length: 50 }, (_, i) => ({
        open: 50000 + i * 100,
        high: 50100 + i * 100,
        low: 50000 + i * 100,
        close: 50050 + i * 100,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = ema.calculate(candles);

      // In uptrend, fast should be above slow
      expect(result.fast).toBeGreaterThan(result.slow);
      expect(result.diff).toBeGreaterThan(0);
    });

    it('should respond faster with shorter periods', () => {
      const fastConfig: EmaIndicatorConfigNew = {
        enabled: true,
        fastPeriod: 5,
        slowPeriod: 20,
        baseConfidence: 0.5,
        strengthMultiplier: 0.2,
      };

      const ema = new EMAIndicatorNew(fastConfig);
      const candles = createCandles(25, 100);

      ema.calculate(candles);

      // Add a spike
      const spikePrice = 125;
      const resultAfterSpike = ema.update(spikePrice);

      // Fast should respond more to spike
      expect(resultAfterSpike.diff).toBeGreaterThan(0);
    });
  });

  describe('Multiple Timeframes', () => {
    it('should work with 1m candles', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 50000 + i * 10,
        high: 50010 + i * 10,
        low: 49990 + i * 10,
        close: 50000 + i * 10,
        volume: 1000 + i * 10,
        timestamp: Date.now() + i * 60 * 1000,
      }));

      const result = ema.calculate(candles);

      expect(result.fast).toBeGreaterThan(0);
      expect(result.slow).toBeGreaterThan(0);
    });

    it('should work with 5m candles', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 50000 + i * 50,
        high: 50050 + i * 50,
        low: 49950 + i * 50,
        close: 50000 + i * 50,
        volume: 5000 + i * 50,
        timestamp: Date.now() + i * 5 * 60 * 1000,
      }));

      const result = ema.calculate(candles);

      expect(result.fast).toBeGreaterThan(0);
      expect(result.slow).toBeGreaterThan(0);
    });

    it('should work with 1h candles', () => {
      const ema = new EMAIndicatorNew(validEmaConfig);
      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: 50000 + i * 200,
        high: 50200 + i * 200,
        low: 49800 + i * 200,
        close: 50000 + i * 200,
        volume: 10000 + i * 100,
        timestamp: Date.now() + i * 60 * 60 * 1000,
      }));

      const result = ema.calculate(candles);

      expect(result.fast).toBeGreaterThan(0);
      expect(result.slow).toBeGreaterThan(0);
    });
  });
});
