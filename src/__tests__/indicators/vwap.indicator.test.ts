/**
 * Tests for VWAPIndicator
 * PHASE 6: Multi-Timeframe Optimization
 */

import { VWAPIndicator } from '../../indicators/vwap.indicator';
import { Candle } from '../../types';

describe('VWAPIndicator', () => {
  let indicator: VWAPIndicator;

  beforeEach(() => {
    indicator = new VWAPIndicator();
  });

  describe('calculate', () => {
    it('should calculate VWAP correctly', () => {
      const candles: Candle[] = [
        {
          timestamp: 1000,
          open: 100,
          high: 105,
          low: 95,
          close: 102,
          volume: 1000,
        },
        {
          timestamp: 2000,
          open: 102,
          high: 108,
          low: 100,
          close: 106,
          volume: 1500,
        },
        {
          timestamp: 3000,
          open: 106,
          high: 110,
          low: 104,
          close: 108,
          volume: 2000,
        },
      ];

      // Manual calculation:
      // Candle 1: Typical = (105 + 95 + 102) / 3 = 100.67, Volume = 1000
      // Candle 2: Typical = (108 + 100 + 106) / 3 = 104.67, Volume = 1500
      // Candle 3: Typical = (110 + 104 + 108) / 3 = 107.33, Volume = 2000
      // VWAP = (100.67*1000 + 104.67*1500 + 107.33*2000) / (1000 + 1500 + 2000)
      //      = (100666.67 + 157000 + 214666.67) / 4500
      //      = 472333.34 / 4500
      //      = 104.96

      const vwap = indicator.calculate(candles);

      expect(vwap).toBeCloseTo(104.96, 1);
    });

    it('should return 0 for empty candles', () => {
      const candles: Candle[] = [];
      const vwap = indicator.calculate(candles);
      expect(vwap).toBe(0);
    });

    it('should return 0 when total volume is zero', () => {
      const candles: Candle[] = [
        {
          timestamp: 1000,
          open: 100,
          high: 105,
          low: 95,
          close: 102,
          volume: 0,
        },
      ];

      const vwap = indicator.calculate(candles);
      expect(vwap).toBe(0);
    });

    it('should calculate VWAP with single candle', () => {
      const candles: Candle[] = [
        {
          timestamp: 1000,
          open: 100,
          high: 105,
          low: 95,
          close: 102,
          volume: 1000,
        },
      ];

      // Typical = (105 + 95 + 102) / 3 = 100.67
      const vwap = indicator.calculate(candles);
      expect(vwap).toBeCloseTo(100.67, 1);
    });

    it('should weight high volume candles more heavily', () => {
      const candles: Candle[] = [
        {
          timestamp: 1000,
          open: 100,
          high: 100,
          low: 100,
          close: 100,
          volume: 100, // Low volume at 100
        },
        {
          timestamp: 2000,
          open: 200,
          high: 200,
          low: 200,
          close: 200,
          volume: 900, // High volume at 200
        },
      ];

      // VWAP should be closer to 200 due to higher volume
      // VWAP = (100*100 + 200*900) / (100 + 900) = (10000 + 180000) / 1000 = 190
      const vwap = indicator.calculate(candles);
      expect(vwap).toBeCloseTo(190, 1);
    });
  });

  describe('analyze', () => {
    const candles: Candle[] = [
      {
        timestamp: 1000,
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000,
      },
      {
        timestamp: 2000,
        open: 102,
        high: 108,
        low: 100,
        close: 106,
        volume: 1000,
      },
    ];

    it('should detect price ABOVE VWAP', () => {
      // VWAP ≈ 102.67, current price = 110
      const result = indicator.analyze(candles, 110);

      expect(result.position).toBe('ABOVE');
      expect(result.vwap).toBeCloseTo(102.67, 1);
      expect(result.distance).toBeGreaterThan(0);
      expect(result.distancePercent).toBeGreaterThan(0);
    });

    it('should detect price BELOW VWAP', () => {
      // VWAP ≈ 102.67, current price = 100
      const result = indicator.analyze(candles, 100);

      expect(result.position).toBe('BELOW');
      expect(result.vwap).toBeCloseTo(102.67, 1);
      expect(result.distance).toBeLessThan(0);
      expect(result.distancePercent).toBeLessThan(0);
    });

    it('should detect price AT VWAP', () => {
      // VWAP ≈ 103.67, current price ≈ 103.67
      const vwap = indicator.calculate(candles);
      const result = indicator.analyze(candles, vwap);

      expect(result.position).toBe('AT');
      expect(result.distancePercent).toBeCloseTo(0, 2);
    });

    it('should calculate distance percent correctly', () => {
      // VWAP ≈ 103.67, current price = 110
      const result = indicator.analyze(candles, 110);

      const expectedPercent = ((110 - result.vwap) / result.vwap) * 100;
      expect(result.distancePercent).toBeCloseTo(expectedPercent, 1);
    });
  });

  describe('isAligned', () => {
    const candles: Candle[] = [
      {
        timestamp: 1000,
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000,
      },
      {
        timestamp: 2000,
        open: 102,
        high: 108,
        low: 100,
        close: 106,
        volume: 1000,
      },
    ];
    // VWAP ≈ 103.67

    it('should align LONG when price ABOVE VWAP', () => {
      const aligned = indicator.isAligned(candles, 110, 'LONG');
      expect(aligned).toBe(true);
    });

    it('should align LONG when price AT VWAP', () => {
      const vwap = indicator.calculate(candles);
      const aligned = indicator.isAligned(candles, vwap, 'LONG');
      expect(aligned).toBe(true);
    });

    it('should NOT align LONG when price BELOW VWAP', () => {
      const aligned = indicator.isAligned(candles, 100, 'LONG');
      expect(aligned).toBe(false);
    });

    it('should align SHORT when price BELOW VWAP', () => {
      const aligned = indicator.isAligned(candles, 100, 'SHORT');
      expect(aligned).toBe(true);
    });

    it('should align SHORT when price AT VWAP', () => {
      const vwap = indicator.calculate(candles);
      const aligned = indicator.isAligned(candles, vwap, 'SHORT');
      expect(aligned).toBe(true);
    });

    it('should NOT align SHORT when price ABOVE VWAP', () => {
      const aligned = indicator.isAligned(candles, 110, 'SHORT');
      expect(aligned).toBe(false);
    });
  });
});
