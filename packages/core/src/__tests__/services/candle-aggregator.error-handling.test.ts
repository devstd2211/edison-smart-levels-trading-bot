/**
 * CandleAggregatorService Error Handling Tests (Phase 8.9.67)
 *
 * Test Coverage:
 * - THROW: Input validation (null/invalid candles, invalid timeframe)
 * - GRACEFUL_DEGRADE: Aggregation failures (NaN/Infinity)
 * - SKIP: Logging errors
 * - Integration: Multi-timeframe aggregation
 * - Backward Compatibility: Tests without ErrorHandler still work
 */

import type { CandleAggregatorService } from '../../services/candle-aggregator.service';
import type { LoggerService } from '../../services/logger.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  asCandleAggregatorLogger,
  createAggregatorMockCandle,
  createCandleAggregatorHarness,
  createCandleAggregatorService,
  createFifteenMinuteAggregatorCandles,
  createFiveMinuteAggregatorCandles,
  createOneHourAggregatorCandles,
  type CandleAggregatorMockLogger,
} from '../helpers/candle-aggregator-test.utils';

describe('CandleAggregatorService Error Handling (Phase 8.9.67)', () => {
  let service: CandleAggregatorService;
  let errorHandler: ErrorHandler;
  let mockLogger: CandleAggregatorMockLogger;
  type AggregateCandlesInput = Parameters<CandleAggregatorService['aggregateCandles']>[0];
  type AggregateTimeframeInput = Parameters<CandleAggregatorService['aggregateCandles']>[1];

  beforeEach(() => {
    ({ service, errorHandler, mockLogger } = createCandleAggregatorHarness());
  });

  describe('THROW: Input Validation', () => {
    test('should throw on null candles', () => {
      expect(() => {
        service.aggregateCandles(null as unknown as AggregateCandlesInput, 5);
      }).toThrow('Candles array cannot be null or undefined');
    });

    test('should throw on undefined candles', () => {
      expect(() => {
        service.aggregateCandles(undefined as unknown as AggregateCandlesInput, 5);
      }).toThrow('Candles array cannot be null or undefined');
    });

    test('should throw when candles is not an array', () => {
      expect(() => {
        service.aggregateCandles({ length: 1 } as unknown as AggregateCandlesInput, 5);
      }).toThrow('Candles must be an array');
    });

    test('should throw on null timeframe', () => {
      const candles = [createAggregatorMockCandle(1000, 100)];
      expect(() => {
        service.aggregateCandles(candles, null as unknown as AggregateTimeframeInput);
      }).toThrow('Timeframe minutes must be a valid finite number');
    });

    test('should throw on invalid timeframe (NaN)', () => {
      const candles = [createAggregatorMockCandle(1000, 100)];
      expect(() => {
        service.aggregateCandles(candles, NaN);
      }).toThrow('Timeframe minutes must be a valid finite number');
    });

    test('should throw on invalid timeframe (Infinity)', () => {
      const candles = [createAggregatorMockCandle(1000, 100)];
      expect(() => {
        service.aggregateCandles(candles, Infinity);
      }).toThrow('Timeframe minutes must be a valid finite number');
    });

    test('should throw on negative timeframe', () => {
      const candles = [createAggregatorMockCandle(1000, 100)];
      expect(() => {
        service.aggregateCandles(candles, -5);
      }).toThrow('Timeframe minutes must be greater than 0');
    });

    test('should throw on zero timeframe', () => {
      const candles = [createAggregatorMockCandle(1000, 100)];
      expect(() => {
        service.aggregateCandles(candles, 0);
      }).toThrow('Timeframe minutes must be greater than 0');
    });
  });

  describe('THROW: Count Validation', () => {
    test('should throw on invalid count (NaN)', () => {
      const candles = [createAggregatorMockCandle(1000, 100)];
      expect(() => {
        service.getLastCandles(candles, 5, NaN);
      }).toThrow('Count must be a non-negative finite number');
    });

    test('should throw on negative count', () => {
      const candles = [createAggregatorMockCandle(1000, 100)];
      expect(() => {
        service.getLastCandles(candles, 5, -1);
      }).toThrow('Count must be a non-negative finite number');
    });
  });

  describe('GRACEFUL_DEGRADE: Invalid Candle Data', () => {
    test('should handle NaN in open price gracefully', () => {
      const candles = [
        createAggregatorMockCandle(1000, 100),
        { ...createAggregatorMockCandle(2000, 100), open: NaN },
      ];
      const result = service.aggregateCandles(candles, 5);
      expect(result).toEqual([]); // Empty on graceful degrade
    });

    test('should handle NaN in high price gracefully', () => {
      const candles = [
        createAggregatorMockCandle(1000, 100),
        { ...createAggregatorMockCandle(2000, 100), high: NaN },
      ];
      const result = service.aggregateCandles(candles, 5);
      expect(result).toEqual([]); // Empty on graceful degrade
    });

    test('should handle Infinity in volume gracefully', () => {
      const candles = [
        createAggregatorMockCandle(1000, 100),
        { ...createAggregatorMockCandle(2000, 100), volume: Infinity },
      ];
      const result = service.aggregateCandles(candles, 5);
      expect(result).toEqual([]); // Empty on graceful degrade
    });

    test('should aggregate candles with different price levels', () => {
      const candles = [
        createAggregatorMockCandle(1000, 100),
        createAggregatorMockCandle(2000, 105),
        createAggregatorMockCandle(3000, 102),
      ];
      const result = service.aggregateCandles(candles, 5);
      expect(result.length).toBeGreaterThan(0); // Should handle gracefully
      expect(result[0].high).toBeGreaterThan(result[0].low);
    });

    test('should handle volume overflow gracefully', () => {
      const candles = [
        { ...createAggregatorMockCandle(1000, 100), volume: Number.MAX_SAFE_INTEGER / 2 },
        { ...createAggregatorMockCandle(2000, 100), volume: Number.MAX_SAFE_INTEGER / 2 },
      ];
      const result = service.aggregateCandles(candles, 5);
      // Should handle without throwing
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('SKIP: Logging Failures', () => {
    test('should not throw when logger fails', () => {
      const badLogger = {
        error: jest.fn(() => {
          throw new Error('Logger failed');
        }),
      };
      const badService = createCandleAggregatorService({
        logger: badLogger as unknown as LoggerService,
        errorHandler,
      });
      const candles = [
        createAggregatorMockCandle(1000, 100),
        { ...createAggregatorMockCandle(2000, 100), open: NaN },
      ];

      // Should not throw despite logger failure
      expect(() => {
        badService.aggregateCandles(candles, 5);
      }).not.toThrow();
    });
  });

  describe('Integration: Multi-Timeframe Aggregation', () => {
    test('should aggregate to 5-minute timeframe', () => {
      const candles = createFiveMinuteAggregatorCandles();
      const result = service.getCandles5m(candles);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].open).toBe(candles[0].open);
    });

    test('should aggregate to 15-minute timeframe', () => {
      const candles = createFifteenMinuteAggregatorCandles();
      const result = service.getCandles15m(candles);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].volume).toBeGreaterThan(0);
    });

    test('should aggregate to 1-hour timeframe', () => {
      const candles = createOneHourAggregatorCandles();
      const result = service.getCandles1h(candles);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].high).toBe(Math.max(...candles.map(c => c.high)));
    });

    test('should get last N candles correctly', () => {
      const candles = createFiveMinuteAggregatorCandles();
      const result = service.getLastCandles(candles, 5, 3);

      expect(result.length).toBeLessThanOrEqual(3);
    });

    test('should return empty array for empty candles', () => {
      const result = service.aggregateCandles([], 5);
      expect(result).toEqual([]);
    });

    test('should return original candles for 1m timeframe', () => {
      const candles = [createAggregatorMockCandle(1000, 100)];
      const result = service.aggregateCandles(candles, 1);
      expect(result).toEqual(candles);
    });
  });

  describe('Backward Compatibility: Without ErrorHandler', () => {
    test('should work without ErrorHandler provided', () => {
      const basicService = createCandleAggregatorService({
        logger: asCandleAggregatorLogger(mockLogger),
        withErrorHandler: false,
      });
      const candles = [createAggregatorMockCandle(1000, 100)];

      expect(() => {
        basicService.aggregateCandles(candles, 5);
      }).not.toThrow();
    });

    test('should throw on invalid input even without ErrorHandler', () => {
      const basicService = createCandleAggregatorService({
        logger: asCandleAggregatorLogger(mockLogger),
        withErrorHandler: false,
      });

      expect(() => {
        basicService.aggregateCandles(null as unknown as AggregateCandlesInput, 5);
      }).toThrow();
    });

    test('should work without logger', () => {
      const basicService = createCandleAggregatorService({
        errorHandler,
        withErrorHandler: false,
      });
      const candles = [createAggregatorMockCandle(1000, 100)];

      expect(() => {
        basicService.aggregateCandles(candles, 5);
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle single candle', () => {
      const candles = [createAggregatorMockCandle(1000, 100)];
      const result = service.aggregateCandles(candles, 5);

      expect(result.length).toBe(1);
      expect(result[0].open).toBe(100);
      expect(result[0].close).toBe(100);
    });

    test('should handle very large timeframe', () => {
      const candles = [createAggregatorMockCandle(1000, 100), createAggregatorMockCandle(2000, 101)];
      const result = service.aggregateCandles(candles, 1440); // 1 day

      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle volume accumulation', () => {
      const candles = [
        { ...createAggregatorMockCandle(1000, 100), volume: 1000 },
        { ...createAggregatorMockCandle(2000, 101), volume: 2000 },
        { ...createAggregatorMockCandle(3000, 102), volume: 3000 },
      ];
      const result = service.aggregateCandles(candles, 5);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].volume).toBe(6000); // 1000 + 2000 + 3000
    });

    test('should calculate correct high in aggregation', () => {
      const candles = [
        { ...createAggregatorMockCandle(1000, 100), high: 105 },
        { ...createAggregatorMockCandle(2000, 101), high: 110 },
        { ...createAggregatorMockCandle(3000, 102), high: 108 },
      ];
      const result = service.aggregateCandles(candles, 5);

      expect(result[0].high).toBe(110);
    });

    test('should calculate correct low in aggregation', () => {
      const candles = [
        { ...createAggregatorMockCandle(1000, 100), low: 98 },
        { ...createAggregatorMockCandle(2000, 101), low: 95 },
        { ...createAggregatorMockCandle(3000, 102), low: 97 },
      ];
      const result = service.aggregateCandles(candles, 5);

      expect(result[0].low).toBe(95);
    });
  });
});

