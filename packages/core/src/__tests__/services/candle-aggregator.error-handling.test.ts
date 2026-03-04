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

import { CandleAggregatorService } from '../../services/candle-aggregator.service';
import { Candle } from '../../types/legacy';
import { LoggerService } from '../../services/logger.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn(),
});

describe('CandleAggregatorService Error Handling (Phase 8.9.67)', () => {
  let service: CandleAggregatorService;
  let errorHandler: ErrorHandler;
  const mockLogger = createMockLogger();
  type AggregateCandlesInput = Parameters<CandleAggregatorService['aggregateCandles']>[0];
  type AggregateTimeframeInput = Parameters<CandleAggregatorService['aggregateCandles']>[1];

  beforeEach(() => {
    errorHandler = new ErrorHandler(mockLogger as unknown as LoggerService);
    service = new CandleAggregatorService(mockLogger as unknown as LoggerService, errorHandler);
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
      const candles = [createMockCandle(1000, 100)];
      expect(() => {
        service.aggregateCandles(candles, null as unknown as AggregateTimeframeInput);
      }).toThrow('Timeframe minutes must be a valid finite number');
    });

    test('should throw on invalid timeframe (NaN)', () => {
      const candles = [createMockCandle(1000, 100)];
      expect(() => {
        service.aggregateCandles(candles, NaN);
      }).toThrow('Timeframe minutes must be a valid finite number');
    });

    test('should throw on invalid timeframe (Infinity)', () => {
      const candles = [createMockCandle(1000, 100)];
      expect(() => {
        service.aggregateCandles(candles, Infinity);
      }).toThrow('Timeframe minutes must be a valid finite number');
    });

    test('should throw on negative timeframe', () => {
      const candles = [createMockCandle(1000, 100)];
      expect(() => {
        service.aggregateCandles(candles, -5);
      }).toThrow('Timeframe minutes must be greater than 0');
    });

    test('should throw on zero timeframe', () => {
      const candles = [createMockCandle(1000, 100)];
      expect(() => {
        service.aggregateCandles(candles, 0);
      }).toThrow('Timeframe minutes must be greater than 0');
    });
  });

  describe('THROW: Count Validation', () => {
    test('should throw on invalid count (NaN)', () => {
      const candles = [createMockCandle(1000, 100)];
      expect(() => {
        service.getLastCandles(candles, 5, NaN);
      }).toThrow('Count must be a non-negative finite number');
    });

    test('should throw on negative count', () => {
      const candles = [createMockCandle(1000, 100)];
      expect(() => {
        service.getLastCandles(candles, 5, -1);
      }).toThrow('Count must be a non-negative finite number');
    });
  });

  describe('GRACEFUL_DEGRADE: Invalid Candle Data', () => {
    test('should handle NaN in open price gracefully', () => {
      const candles = [
        createMockCandle(1000, 100),
        { ...createMockCandle(2000, 100), open: NaN },
      ];
      const result = service.aggregateCandles(candles, 5);
      expect(result).toEqual([]); // Empty on graceful degrade
    });

    test('should handle NaN in high price gracefully', () => {
      const candles = [
        createMockCandle(1000, 100),
        { ...createMockCandle(2000, 100), high: NaN },
      ];
      const result = service.aggregateCandles(candles, 5);
      expect(result).toEqual([]); // Empty on graceful degrade
    });

    test('should handle Infinity in volume gracefully', () => {
      const candles = [
        createMockCandle(1000, 100),
        { ...createMockCandle(2000, 100), volume: Infinity },
      ];
      const result = service.aggregateCandles(candles, 5);
      expect(result).toEqual([]); // Empty on graceful degrade
    });

    test('should aggregate candles with different price levels', () => {
      const candles = [
        createMockCandle(1000, 100),
        createMockCandle(2000, 105),
        createMockCandle(3000, 102),
      ];
      const result = service.aggregateCandles(candles, 5);
      expect(result.length).toBeGreaterThan(0); // Should handle gracefully
      expect(result[0].high).toBeGreaterThan(result[0].low);
    });

    test('should handle volume overflow gracefully', () => {
      const candles = [
        { ...createMockCandle(1000, 100), volume: Number.MAX_SAFE_INTEGER / 2 },
        { ...createMockCandle(2000, 100), volume: Number.MAX_SAFE_INTEGER / 2 },
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
      const badService = new CandleAggregatorService(badLogger as unknown as LoggerService, errorHandler);
      const candles = [
        createMockCandle(1000, 100),
        { ...createMockCandle(2000, 100), open: NaN },
      ];

      // Should not throw despite logger failure
      expect(() => {
        badService.aggregateCandles(candles, 5);
      }).not.toThrow();
    });
  });

  describe('Integration: Multi-Timeframe Aggregation', () => {
    test('should aggregate to 5-minute timeframe', () => {
      const candles = create5MinuteCandles();
      const result = service.getCandles5m(candles);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].open).toBe(candles[0].open);
    });

    test('should aggregate to 15-minute timeframe', () => {
      const candles = create15MinuteCandles();
      const result = service.getCandles15m(candles);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].volume).toBeGreaterThan(0);
    });

    test('should aggregate to 1-hour timeframe', () => {
      const candles = create1HourCandles();
      const result = service.getCandles1h(candles);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].high).toBe(Math.max(...candles.map(c => c.high)));
    });

    test('should get last N candles correctly', () => {
      const candles = create5MinuteCandles();
      const result = service.getLastCandles(candles, 5, 3);

      expect(result.length).toBeLessThanOrEqual(3);
    });

    test('should return empty array for empty candles', () => {
      const result = service.aggregateCandles([], 5);
      expect(result).toEqual([]);
    });

    test('should return original candles for 1m timeframe', () => {
      const candles = [createMockCandle(1000, 100)];
      const result = service.aggregateCandles(candles, 1);
      expect(result).toEqual(candles);
    });
  });

  describe('Backward Compatibility: Without ErrorHandler', () => {
    test('should work without ErrorHandler provided', () => {
      const basicService = new CandleAggregatorService(mockLogger);
      const candles = [createMockCandle(1000, 100)];

      expect(() => {
        basicService.aggregateCandles(candles, 5);
      }).not.toThrow();
    });

    test('should throw on invalid input even without ErrorHandler', () => {
      const basicService = new CandleAggregatorService(mockLogger);

      expect(() => {
        basicService.aggregateCandles(null as unknown as AggregateCandlesInput, 5);
      }).toThrow();
    });

    test('should work without logger', () => {
      const basicService = new CandleAggregatorService(undefined, errorHandler);
      const candles = [createMockCandle(1000, 100)];

      expect(() => {
        basicService.aggregateCandles(candles, 5);
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle single candle', () => {
      const candles = [createMockCandle(1000, 100)];
      const result = service.aggregateCandles(candles, 5);

      expect(result.length).toBe(1);
      expect(result[0].open).toBe(100);
      expect(result[0].close).toBe(100);
    });

    test('should handle very large timeframe', () => {
      const candles = [createMockCandle(1000, 100), createMockCandle(2000, 101)];
      const result = service.aggregateCandles(candles, 1440); // 1 day

      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle volume accumulation', () => {
      const candles = [
        { ...createMockCandle(1000, 100), volume: 1000 },
        { ...createMockCandle(2000, 101), volume: 2000 },
        { ...createMockCandle(3000, 102), volume: 3000 },
      ];
      const result = service.aggregateCandles(candles, 5);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].volume).toBe(6000); // 1000 + 2000 + 3000
    });

    test('should calculate correct high in aggregation', () => {
      const candles = [
        { ...createMockCandle(1000, 100), high: 105 },
        { ...createMockCandle(2000, 101), high: 110 },
        { ...createMockCandle(3000, 102), high: 108 },
      ];
      const result = service.aggregateCandles(candles, 5);

      expect(result[0].high).toBe(110);
    });

    test('should calculate correct low in aggregation', () => {
      const candles = [
        { ...createMockCandle(1000, 100), low: 98 },
        { ...createMockCandle(2000, 101), low: 95 },
        { ...createMockCandle(3000, 102), low: 97 },
      ];
      const result = service.aggregateCandles(candles, 5);

      expect(result[0].low).toBe(95);
    });
  });
});

// Helper functions
function createMockCandle(timestamp: number, price: number): Candle {
  return {
    timestamp,
    open: price,
    high: price + 1,
    low: price - 1,
    close: price,
    volume: 1000,
  };
}

function create5MinuteCandles(): Candle[] {
  const candles: Candle[] = [];
  let timestamp = 1000;
  let price = 100;

  // Create 10 minutes worth of candles (10 x 1-minute)
  for (let i = 0; i < 10; i++) {
    candles.push({
      timestamp,
      open: price,
      high: price + 0.5,
      low: price - 0.5,
      close: price,
      volume: 100 + i * 10,
    });
    timestamp += 60000; // 1 minute
    price += 0.1;
  }

  return candles;
}

function create15MinuteCandles(): Candle[] {
  const candles: Candle[] = [];
  let timestamp = 1000;
  let price = 100;

  // Create 30 minutes worth of candles (30 x 1-minute)
  for (let i = 0; i < 30; i++) {
    candles.push({
      timestamp,
      open: price,
      high: price + 0.5,
      low: price - 0.5,
      close: price,
      volume: 100 + i * 5,
    });
    timestamp += 60000; // 1 minute
    price += 0.05;
  }

  return candles;
}

function create1HourCandles(): Candle[] {
  const candles: Candle[] = [];
  let timestamp = 1000;
  let price = 100;

  // Create 60 minutes worth of candles (60 x 1-minute)
  for (let i = 0; i < 60; i++) {
    candles.push({
      timestamp,
      open: price,
      high: price + 0.5,
      low: price - 0.5,
      close: price,
      volume: 100 + i * 2,
    });
    timestamp += 60000; // 1 minute
    price += 0.02;
  }

  return candles;
}
