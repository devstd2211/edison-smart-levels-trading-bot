/**
 * Tests for TimeframeValidator
 * PHASE 6: Multi-Timeframe Optimization
 */

import { TimeframeValidator } from '../../utils/timeframe-validator';

describe('TimeframeValidator', () => {
  describe('validateNoLookAhead', () => {
    it('should validate closed candle (indicator from previous candle)', () => {
      const currentTime = Date.parse('2025-01-13T10:05:00Z'); // 10:05
      const indicatorTime = Date.parse('2025-01-13T10:04:00Z'); // 10:04 (M1 candle)
      const timeframeMinutes = 1;

      const result = TimeframeValidator.validateNoLookAhead(
        currentTime,
        indicatorTime,
        timeframeMinutes,
      );

      expect(result).toBe(true);
    });

    it('should reject current candle (look-ahead bias)', () => {
      const currentTime = Date.parse('2025-01-13T10:05:30Z'); // 10:05:30
      const indicatorTime = Date.parse('2025-01-13T10:05:00Z'); // 10:05 (current M1 candle)
      const timeframeMinutes = 1;

      const result = TimeframeValidator.validateNoLookAhead(
        currentTime,
        indicatorTime,
        timeframeMinutes,
      );

      expect(result).toBe(false);
    });

    it('should validate M5 candle from previous period', () => {
      const currentTime = Date.parse('2025-01-13T10:07:00Z'); // 10:07
      const indicatorTime = Date.parse('2025-01-13T10:00:00Z'); // 10:00 (last closed M5 candle: 10:00-10:05)
      const timeframeMinutes = 5;

      const result = TimeframeValidator.validateNoLookAhead(
        currentTime,
        indicatorTime,
        timeframeMinutes,
      );

      expect(result).toBe(true);
    });

    it('should reject M5 candle from current period', () => {
      const currentTime = Date.parse('2025-01-13T10:07:00Z'); // 10:07
      const indicatorTime = Date.parse('2025-01-13T10:05:00Z'); // 10:05 (current M5 candle: 10:05-10:10, not closed)
      const timeframeMinutes = 5;

      const result = TimeframeValidator.validateNoLookAhead(
        currentTime,
        indicatorTime,
        timeframeMinutes,
      );

      expect(result).toBe(false);
    });

    it('should validate M30 candle from previous period', () => {
      const currentTime = Date.parse('2025-01-13T10:15:00Z'); // 10:15
      const indicatorTime = Date.parse('2025-01-13T09:30:00Z'); // 09:30 (last closed M30: 09:30-10:00)
      const timeframeMinutes = 30;

      const result = TimeframeValidator.validateNoLookAhead(
        currentTime,
        indicatorTime,
        timeframeMinutes,
      );

      expect(result).toBe(true);
    });

    it('should reject M30 candle from current period', () => {
      const currentTime = Date.parse('2025-01-13T10:15:00Z'); // 10:15
      const indicatorTime = Date.parse('2025-01-13T10:00:00Z'); // 10:00 (current M30: 10:00-10:30, not closed)
      const timeframeMinutes = 30;

      const result = TimeframeValidator.validateNoLookAhead(
        currentTime,
        indicatorTime,
        timeframeMinutes,
      );

      expect(result).toBe(false);
    });
  });

  describe('getLastClosedCandleTime', () => {
    it('should return last closed M1 candle time', () => {
      const currentTime = Date.parse('2025-01-13T10:05:30Z'); // 10:05:30
      const timeframeMinutes = 1;

      const result = TimeframeValidator.getLastClosedCandleTime(currentTime, timeframeMinutes);

      expect(result).toBe(Date.parse('2025-01-13T10:04:00Z')); // 10:04 (last closed M1)
    });

    it('should return last closed M5 candle time', () => {
      const currentTime = Date.parse('2025-01-13T10:07:00Z'); // 10:07
      const timeframeMinutes = 5;

      const result = TimeframeValidator.getLastClosedCandleTime(currentTime, timeframeMinutes);

      expect(result).toBe(Date.parse('2025-01-13T10:00:00Z')); // 10:00 (last closed M5)
    });

    it('should return last closed M30 candle time', () => {
      const currentTime = Date.parse('2025-01-13T10:15:00Z'); // 10:15
      const timeframeMinutes = 30;

      const result = TimeframeValidator.getLastClosedCandleTime(currentTime, timeframeMinutes);

      expect(result).toBe(Date.parse('2025-01-13T09:30:00Z')); // 09:30 (last closed M30)
    });

    it('should handle exact candle open time', () => {
      const currentTime = Date.parse('2025-01-13T10:00:00Z'); // 10:00 (exact M30 open)
      const timeframeMinutes = 30;

      const result = TimeframeValidator.getLastClosedCandleTime(currentTime, timeframeMinutes);

      expect(result).toBe(Date.parse('2025-01-13T09:30:00Z')); // 09:30 (last closed M30)
    });
  });

  describe('getClosedCandles', () => {
    it('should filter candles to only include closed ones', () => {
      const currentTime = Date.parse('2025-01-13T10:07:00Z'); // 10:07
      const timeframeMinutes = 5;

      const candles = [
        { timestamp: Date.parse('2025-01-13T09:55:00Z'), close: 100 }, // Closed M5
        { timestamp: Date.parse('2025-01-13T10:00:00Z'), close: 101 }, // Last closed M5
        { timestamp: Date.parse('2025-01-13T10:05:00Z'), close: 102 }, // Current M5 (not closed)
        { timestamp: Date.parse('2025-01-13T10:06:00Z'), close: 103 }, // Current M5 (not closed)
      ];

      const result = TimeframeValidator.getClosedCandles(candles, currentTime, timeframeMinutes);

      expect(result).toHaveLength(2);
      expect(result[0].timestamp).toBe(Date.parse('2025-01-13T09:55:00Z'));
      expect(result[1].timestamp).toBe(Date.parse('2025-01-13T10:00:00Z'));
    });

    it('should handle M1 candles', () => {
      const currentTime = Date.parse('2025-01-13T10:05:30Z'); // 10:05:30
      const timeframeMinutes = 1;

      const candles = [
        { timestamp: Date.parse('2025-01-13T10:03:00Z'), close: 100 }, // Closed
        { timestamp: Date.parse('2025-01-13T10:04:00Z'), close: 101 }, // Last closed
        { timestamp: Date.parse('2025-01-13T10:05:00Z'), close: 102 }, // Current (not closed)
        { timestamp: Date.parse('2025-01-13T10:06:00Z'), close: 103 }, // Future (not closed)
      ];

      const result = TimeframeValidator.getClosedCandles(candles, currentTime, timeframeMinutes);

      expect(result).toHaveLength(2);
      expect(result[1].timestamp).toBe(Date.parse('2025-01-13T10:04:00Z'));
    });

    it('should return empty array when all candles are from current period', () => {
      const currentTime = Date.parse('2025-01-13T10:01:00Z'); // 10:01
      const timeframeMinutes = 5;

      const candles = [
        { timestamp: Date.parse('2025-01-13T10:01:00Z'), close: 100 }, // Current M5
        { timestamp: Date.parse('2025-01-13T10:02:00Z'), close: 101 }, // Current M5
      ];

      const result = TimeframeValidator.getClosedCandles(candles, currentTime, timeframeMinutes);

      expect(result).toHaveLength(0);
    });
  });
});
