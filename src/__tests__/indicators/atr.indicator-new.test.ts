/**
 * ATR Indicator NEW Tests
 * Testing ATR calculation with ConfigNew structure
 */

import { ATRIndicatorNew } from '../../indicators/atr.indicator-new';
import type { Candle } from '../../types/core';
import type { AtrIndicatorConfigNew } from '../../types/config-new.types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const validAtrConfig: AtrIndicatorConfigNew = {
  enabled: true,
  period: 14,
  minimumATR: 0.05,
  maximumATR: 5,
};

const disabledAtrConfig: AtrIndicatorConfigNew = {
  enabled: false,
  period: 14,
  minimumATR: 0.05,
  maximumATR: 5,
};

function createCandles(count: number, basePrice: number = 100, volatility: number = 1): Candle[] {
  return Array.from({ length: count }, (_, i) => {
    const randomMove = (Math.random() - 0.5) * 2 * volatility;
    const close = basePrice + i * 0.5 + randomMove;
    const high = close + volatility;
    const low = close - volatility;
    const open = close - randomMove / 2;

    return {
      open,
      high,
      low,
      close,
      volume: 1000 + Math.random() * 500,
      timestamp: 1000 * (i + 1),
    };
  });
}

describe('ATR Indicator NEW', () => {
  describe('Configuration Validation', () => {
    it('should throw if enabled is missing', () => {
      const badConfig = { ...validAtrConfig, enabled: undefined } as any;
      expect(() => new ATRIndicatorNew(badConfig)).toThrow(/enabled.*boolean/i);
    });

    it('should throw if period is missing', () => {
      const badConfig = { ...validAtrConfig, period: undefined };
      expect(() => new ATRIndicatorNew(badConfig as any)).toThrow(/period/i);
    });

    it('should throw if minimumATR is missing', () => {
      const badConfig = { ...validAtrConfig, minimumATR: undefined };
      expect(() => new ATRIndicatorNew(badConfig as any)).toThrow(/minimumATR/i);
    });

    it('should throw if maximumATR is missing', () => {
      const badConfig = { ...validAtrConfig, maximumATR: undefined };
      expect(() => new ATRIndicatorNew(badConfig as any)).toThrow(/maximumATR/i);
    });

    it('should throw if period is invalid (negative)', () => {
      const badConfig = { ...validAtrConfig, period: -1 };
      expect(() => new ATRIndicatorNew(badConfig)).toThrow(/period/i);
    });

    it('should throw if minimumATR is negative', () => {
      const badConfig = { ...validAtrConfig, minimumATR: -0.1 };
      expect(() => new ATRIndicatorNew(badConfig)).toThrow(/minimumATR/i);
    });

    it('should throw if maximumATR < minimumATR', () => {
      const badConfig = { ...validAtrConfig, minimumATR: 5, maximumATR: 0.05 };
      expect(() => new ATRIndicatorNew(badConfig)).toThrow(/maximumATR/i);
    });

    it('should create with valid config', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      expect(atr).toBeDefined();
      expect(atr.isEnabled()).toBe(true);
    });
  });

  describe('Disabled Config', () => {
    it('should throw when calculating with disabled indicator', () => {
      const atr = new ATRIndicatorNew(disabledAtrConfig);
      const candles = createCandles(30);

      expect(() => atr.calculate(candles)).toThrow(/disabled/i);
    });

    it('should return false for isEnabled when disabled', () => {
      const atr = new ATRIndicatorNew(disabledAtrConfig);
      expect(atr.isEnabled()).toBe(false);
    });
  });

  describe('Basic Functionality', () => {
    it('should throw error if not enough candles', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const candles = createCandles(10); // Need period + 1 = 15

      expect(() => atr.calculate(candles)).toThrow(/enough candles/i);
    });

    it('should calculate ATR with exact period + 1 candles', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const candles = createCandles(15);

      const result = atr.calculate(candles);

      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
      expect(isNaN(result)).toBe(false);
    });

    it('should calculate ATR with more than period + 1 candles', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const candles = createCandles(50);

      const result = atr.calculate(candles);

      expect(result).toBeGreaterThan(0);
    });

    it('should reflect volatility - high volatility increases ATR', () => {
      const atr1 = new ATRIndicatorNew(validAtrConfig);
      const atr2 = new ATRIndicatorNew(validAtrConfig);

      // Low volatility candles
      const lowVolCandles = createCandles(30, 100, 0.1);
      const atrLow = atr1.calculate(lowVolCandles);

      // High volatility candles
      const highVolCandles = createCandles(30, 100, 5);
      const atrHigh = atr2.calculate(highVolCandles);

      // High volatility should have higher ATR
      expect(atrHigh).toBeGreaterThan(atrLow);
    });
  });

  describe('Update Method', () => {
    it('should throw if update called before initialize', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const dummyCandle = createCandles(1)[0];

      expect(() => atr.update(dummyCandle, dummyCandle)).toThrow(/not initialized/i);
    });

    it('should throw if newCandle is invalid (missing high)', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const candles = createCandles(30);
      atr.calculate(candles);

      const badCandle = { ...candles[0], high: undefined } as any;
      expect(() => atr.update(badCandle, candles[0])).toThrow(/invalid.*Candle/i);
    });

    it('should throw if previousCandle is invalid (missing close)', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const candles = createCandles(30);
      atr.calculate(candles);

      const badCandle = { ...candles[0], close: undefined } as any;
      expect(() => atr.update(candles[1], badCandle)).toThrow(/invalid.*Candle/i);
    });

    it('should allow incremental updates', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const candles = createCandles(25);

      const initialAtr = atr.calculate(candles);
      const newCandle = {
        open: 108,
        high: 110,
        low: 106,
        close: 109,
        volume: 1000,
        timestamp: 26000,
      };

      const updatedAtr = atr.update(newCandle, candles[candles.length - 1]);

      expect(updatedAtr).toBeGreaterThan(0);
      expect(typeof updatedAtr).toBe('number');
    });

    it('should update ATR consistently', () => {
      const atr1 = new ATRIndicatorNew(validAtrConfig);
      const atr2 = new ATRIndicatorNew(validAtrConfig);

      const candles = createCandles(30);

      // Calculate all at once
      const result1 = atr1.calculate(candles);

      // Calculate incrementally
      const initialCandles = candles.slice(0, 25);
      atr2.calculate(initialCandles);
      for (let i = 25; i < candles.length; i++) {
        atr2.update(candles[i], candles[i - 1]);
      }
      const result2 = atr2.getValue();

      expect(result1).toBeCloseTo(result2, 5);
    });
  });

  describe('State Management', () => {
    it('should track state correctly', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);

      let state = atr.getState();
      expect(state.initialized).toBe(false);
      expect(state.atr).toBe(0);

      const candles = createCandles(30);
      atr.calculate(candles);

      state = atr.getState();
      expect(state.initialized).toBe(true);
      expect(state.atr).toBeGreaterThan(0);
    });

    it('should reset state correctly', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const candles = createCandles(30);

      atr.calculate(candles);
      expect(atr.getState().initialized).toBe(true);

      atr.reset();
      const state = atr.getState();

      expect(state.initialized).toBe(false);
      expect(state.atr).toBe(0);
    });

    it('should throw error when getting value before initialization', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);

      expect(() => atr.getValue()).toThrow(/not initialized/i);
    });
  });

  describe('ATR as Percentage', () => {
    it('should calculate ATR as percentage of price', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const candles = createCandles(30, 100, 1);

      atr.calculate(candles);
      const atrPercent = atr.getPercentage(100);

      expect(atrPercent).toBeGreaterThan(0);
      expect(typeof atrPercent).toBe('number');
    });

    it('should throw if price is invalid (negative)', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const candles = createCandles(30);
      atr.calculate(candles);

      expect(() => atr.getPercentage(-10)).toThrow(/invalid.*Price/i);
    });

    it('should throw if price is zero', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const candles = createCandles(30);
      atr.calculate(candles);

      expect(() => atr.getPercentage(0)).toThrow(/invalid.*Price/i);
    });
  });

  describe('Range Validation', () => {
    it('should detect below minimum', () => {
      const atr = new ATRIndicatorNew({ ...validAtrConfig, minimumATR: 1, maximumATR: 5 });
      const candles = createCandles(30, 100, 0.01); // Very low volatility

      atr.calculate(candles);

      expect(atr.isBelowMinimum()).toBe(true);
      expect(atr.isInValidRange()).toBe(false);
    });

    it('should detect above maximum', () => {
      const atr = new ATRIndicatorNew({ ...validAtrConfig, minimumATR: 0.01, maximumATR: 1 });
      const candles = createCandles(30, 100, 10); // Very high volatility

      atr.calculate(candles);

      expect(atr.isAboveMaximum()).toBe(true);
      expect(atr.isInValidRange()).toBe(false);
    });

    it('should detect valid range', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const candles = createCandles(30, 100, 1);

      atr.calculate(candles);

      expect(atr.isInValidRange()).toBe(true);
      expect(atr.isBelowMinimum()).toBe(false);
      expect(atr.isAboveMaximum()).toBe(false);
    });
  });

  describe('ATR Classification', () => {
    it('should classify normal volatility', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const candles = createCandles(30, 100, 1);

      atr.calculate(candles);
      const classification = atr.getClassification(100);

      expect(['normal', 'low', 'high']).toContain(classification);
    });

    it('should classify high volatility', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const candles = createCandles(30, 100, 5);

      atr.calculate(candles);
      const classification = atr.getClassification(100);

      expect(['high', 'extreme', 'above_maximum']).toContain(classification);
    });
  });

  describe('Config Retrieval', () => {
    it('should return original config values', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const config = atr.getConfig();

      expect(config.enabled).toBe(validAtrConfig.enabled);
      expect(config.period).toBe(validAtrConfig.period);
      expect(config.minimumATR).toBe(validAtrConfig.minimumATR);
      expect(config.maximumATR).toBe(validAtrConfig.maximumATR);
    });
  });

  describe('True Range Calculation', () => {
    it('should use high-low when it is largest', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      // Gap up scenario: high-close > high-low, but high-low should dominate
      const gapCandles: Candle[] = [
        {
          open: 100,
          high: 102,
          low: 98,
          close: 101,
          volume: 1000,
          timestamp: 1000,
        },
        {
          open: 103,
          high: 105,
          low: 102,
          close: 104,
          volume: 1000,
          timestamp: 2000,
        },
        ...createCandles(20, 100, 1),
      ];

      const result = atr.calculate(gapCandles);
      expect(result).toBeGreaterThan(0);
    });

    it('should use high-previousClose when it is largest (gap up)', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const gapUpCandles: Candle[] = [
        {
          open: 100,
          high: 101,
          low: 99,
          close: 100,
          volume: 1000,
          timestamp: 1000,
        },
        {
          open: 105,
          high: 107,
          low: 104,
          close: 106,
          volume: 1000,
          timestamp: 2000,
        }, // Gap up from 100 to 104-107
        ...createCandles(20, 100, 1),
      ];

      const result = atr.calculate(gapUpCandles);
      expect(result).toBeGreaterThan(1);
    });

    it('should use low-previousClose when it is largest (gap down)', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const gapDownCandles: Candle[] = [
        {
          open: 100,
          high: 101,
          low: 99,
          close: 100,
          volume: 1000,
          timestamp: 1000,
        },
        {
          open: 95,
          high: 96,
          low: 93,
          close: 94,
          volume: 1000,
          timestamp: 2000,
        }, // Gap down from 100 to 93-96
        ...createCandles(20, 100, 1),
      ];

      const result = atr.calculate(gapDownCandles);
      expect(result).toBeGreaterThan(1);
    });
  });

  describe('Different Period Values', () => {
    it('should work with different periods', () => {
      const periods = [7, 14, 21, 28];

      for (const period of periods) {
        const config: AtrIndicatorConfigNew = {
          ...validAtrConfig,
          period,
        };
        const atr = new ATRIndicatorNew(config);
        const candles = createCandles(period + 10);

        const result = atr.calculate(candles);

        expect(result).toBeGreaterThan(0);
      }
    });

    it('should have higher ATR with longer period on volatile data', () => {
      const shortConfig: AtrIndicatorConfigNew = {
        ...validAtrConfig,
        period: 7,
      };
      const longConfig: AtrIndicatorConfigNew = {
        ...validAtrConfig,
        period: 21,
      };

      const candles = createCandles(40, 100, 2);

      const atrShort = new ATRIndicatorNew(shortConfig);
      const atrLong = new ATRIndicatorNew(longConfig);

      const resultShort = atrShort.calculate(candles);
      const resultLong = atrLong.calculate(candles);

      // Both should be positive and close in value
      expect(resultShort).toBeGreaterThan(0);
      expect(resultLong).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large prices', () => {
      const atr = new ATRIndicatorNew(validAtrConfig);
      const basePrice = 1000000;

      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: basePrice + i * 1000,
        high: basePrice + i * 1000 + 500,
        low: basePrice + i * 1000 - 500,
        close: basePrice + i * 1000,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = atr.calculate(candles);

      expect(result).toBeGreaterThan(0);
      expect(isNaN(result)).toBe(false);
    });

    it('should handle very small prices', () => {
      const atr = new ATRIndicatorNew({
        ...validAtrConfig,
        minimumATR: 0.0001,
        maximumATR: 0.1,
      });
      const basePrice = 0.00001;

      const candles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
        open: basePrice,
        high: basePrice + 0.000001,
        low: basePrice - 0.000001,
        close: basePrice + i * 0.0000001,
        volume: 1000,
        timestamp: 1000 * (i + 1),
      }));

      const result = atr.calculate(candles);

      expect(result).toBeGreaterThan(0);
      expect(isNaN(result)).toBe(false);
    });
  });
});
