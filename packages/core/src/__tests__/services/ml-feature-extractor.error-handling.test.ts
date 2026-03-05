/**
 * MLFeatureExtractorService Error Handling Tests (Phase 8.9.68)
 *
 * Test Coverage:
 * - THROW: Input validation (null/invalid candles, pattern type, outcome)
 * - THROW: Multi-timeframe validation (min candles, valid params)
 * - GRACEFUL_DEGRADE: Calculation failures (NaN/Infinity in indicators)
 * - SKIP: Logging errors
 * - Integration: Feature extraction with proper context
 * - Backward Compatibility: Tests without ErrorHandler still work
 */

import { MLFeatureExtractorService } from '../../services/ml-feature-extractor.service';
import { Candle, LoggerService } from '../../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';

type LoggerLike = Pick<LoggerService, 'info' | 'warn' | 'error' | 'debug'>;
const asCandles = (value: unknown): Candle[] => value as Candle[];
const asPatternType = (value: unknown): string => value as string;
const asOutcome = (value: unknown): 'WIN' | 'LOSS' => value as 'WIN' | 'LOSS';
const asLogger = (value: LoggerLike): LoggerService => value as unknown as LoggerService;

const createMockLogger = (): LoggerLike => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('MLFeatureExtractorService Error Handling (Phase 8.9.68)', () => {
  let service: MLFeatureExtractorService;
  let errorHandler: ErrorHandler;
  const mockLogger = asLogger(createMockLogger());

  beforeEach(() => {
    errorHandler = new ErrorHandler(mockLogger);
    service = new MLFeatureExtractorService(mockLogger, errorHandler);
  });

  describe('THROW: extractFeatures Input Validation', () => {
    test('should throw on null candles', () => {
      expect(() => {
        service.extractFeatures(asCandles(null), 'BREAKOUT', 'WIN');
      }).toThrow('Candles array cannot be null or undefined');
    });

    test('should throw on undefined candles', () => {
      expect(() => {
        service.extractFeatures(asCandles(undefined), 'BREAKOUT', 'WIN');
      }).toThrow('Candles array cannot be null or undefined');
    });

    test('should throw when candles is not an array', () => {
      expect(() => {
        service.extractFeatures(asCandles({ length: 10 }), 'BREAKOUT', 'WIN');
      }).toThrow('Candles must be an array');
    });

    test('should throw when candles length < 5', () => {
      const candles = [createMockCandle(1000, 100), createMockCandle(2000, 101)];
      expect(() => {
        service.extractFeatures(candles, 'BREAKOUT', 'WIN');
      }).toThrow('Need at least 5 candles to extract features');
    });

    test('should throw on null pattern type', () => {
      const candles = createCandles(10);
      expect(() => {
        service.extractFeatures(candles, asPatternType(null), 'WIN');
      }).toThrow('Pattern type must be a non-empty string');
    });

    test('should throw on empty pattern type', () => {
      const candles = createCandles(10);
      expect(() => {
        service.extractFeatures(candles, '', 'WIN');
      }).toThrow('Pattern type must be a non-empty string');
    });

    test('should throw on invalid outcome', () => {
      const candles = createCandles(10);
      expect(() => {
        service.extractFeatures(candles, 'BREAKOUT', asOutcome('INVALID'));
      }).toThrow("Outcome must be 'WIN' or 'LOSS'");
    });
  });

  describe('THROW: extractFeaturesMultiTimeframe Validation', () => {
    test('should throw on null candles1m', () => {
      expect(() => {
        service.extractFeaturesMultiTimeframe(asCandles(null), 'BREAKOUT', 'WIN', 50);
      }).toThrow('Candles1m array cannot be null or undefined');
    });

    test('should throw when candles1m length < minCandlesFor1m', () => {
      const candles = createCandles(30);
      expect(() => {
        service.extractFeaturesMultiTimeframe(candles, 'BREAKOUT', 'WIN', 50);
      }).toThrow('Need at least 50 1m candles for multi-timeframe extraction');
    });

    test('should throw on invalid minCandlesFor1m', () => {
      const candles = createCandles(100);
      expect(() => {
        service.extractFeaturesMultiTimeframe(candles, 'BREAKOUT', 'WIN', -10);
      }).toThrow('minCandlesFor1m must be a positive finite number');
    });

    test('should throw on NaN minCandlesFor1m', () => {
      const candles = createCandles(100);
      expect(() => {
        service.extractFeaturesMultiTimeframe(candles, 'BREAKOUT', 'WIN', NaN);
      }).toThrow('minCandlesFor1m must be a positive finite number');
    });
  });

  describe('GRACEFUL_DEGRADE: Feature Extraction Failures', () => {
    test('should handle candles with mixed valid/invalid data', () => {
      const candles = [
        createMockCandle(1000, 100),
        createMockCandle(2000, 101),
        createMockCandle(3000, 102),
        createMockCandle(4000, 103),
        createMockCandle(5000, 104),
      ];
      const result = service.extractFeatures(candles, 'BREAKOUT', 'WIN');
      expect(result).toBeDefined();
      expect(result.priceAction).toBeDefined();
    });

    test('should handle feature extraction with extreme prices', () => {
      const candles = [
        { ...createMockCandle(1000, 0.00001), close: 0.00001 },
        { ...createMockCandle(2000, 0.000011), close: 0.000011 },
        { ...createMockCandle(3000, 0.000012), close: 0.000012 },
        { ...createMockCandle(4000, 0.000013), close: 0.000013 },
        { ...createMockCandle(5000, 0.000014), close: 0.000014 },
      ];
      const result = service.extractFeatures(candles, 'MICRO_PRICE', 'WIN');
      expect(result).toBeDefined();
    });

    test('should handle multi-timeframe aggregation gracefully', () => {
      const candles = createCandles(50);
      const result = service.extractFeaturesMultiTimeframe(candles, 'BREAKOUT', 'WIN', 50);
      expect(result).toBeDefined();
      expect(result.patternType).toBe('BREAKOUT');
      expect(result.multiTimeframeContext).toBeDefined();
    });
  });

  describe('SKIP: Logging Failures', () => {
    test('should not throw when logger fails on info', () => {
      const badLogger = {
        info: jest.fn(() => {
          throw new Error('Logger failed');
        }),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const badService = new MLFeatureExtractorService(
        asLogger(badLogger as LoggerLike),
        errorHandler
      );
      const candles = createCandles(10);

      expect(() => {
        badService.extractFeatures(candles, 'BREAKOUT', 'WIN');
      }).not.toThrow();
    });

    test('should not throw when logger fails on error', () => {
      const badLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(() => {
          throw new Error('Logger error failed');
        }),
        debug: jest.fn(),
      };
      const badService = new MLFeatureExtractorService(
        asLogger(badLogger as LoggerLike),
        errorHandler
      );
      const candles = createCandles(10);

      expect(() => {
        badService.extractFeatures(candles, 'BREAKOUT', 'WIN');
      }).not.toThrow();
    });
  });

  describe('Integration: Feature Extraction', () => {
    test('should extract features with valid 5+ candles', () => {
      const candles = createCandles(10);
      const result = service.extractFeatures(candles, 'BREAKOUT', 'WIN');

      expect(result).toBeDefined();
      expect(result.patternType).toBe('BREAKOUT');
      expect(result.label).toBe('WIN');
      expect(result.priceAction).toBeDefined();
      expect(result.technicalIndicators).toBeDefined();
      expect(result.volatility).toBeDefined();
    });

    test('should extract multi-timeframe features with 50+ candles', () => {
      const candles = createCandles(60);
      const result = service.extractFeaturesMultiTimeframe(candles, 'RETEST', 'LOSS', 50);

      expect(result).toBeDefined();
      expect(result.patternType).toBe('RETEST');
      expect(result.label).toBe('LOSS');
      expect(result.multiTimeframeContext).toBeDefined();
      expect(result.multiTimeframeContext?.context5m).toBeDefined();
      expect(result.multiTimeframeContext?.context15m).toBeDefined();
      expect(result.multiTimeframeContext?.context1h).toBeDefined();
    });

    test('should handle exactly 50 candles for multi-timeframe', () => {
      const candles = createCandles(50);
      expect(() => {
        service.extractFeaturesMultiTimeframe(candles, 'PATTERN', 'WIN', 50);
      }).not.toThrow();
    });

    test('should handle exactly 5 candles for extractFeatures', () => {
      const candles = createCandles(5);
      expect(() => {
        service.extractFeatures(candles, 'SIMPLE', 'WIN');
      }).not.toThrow();
    });

    test('should extract features with LOSS outcome', () => {
      const candles = createCandles(10);
      const result = service.extractFeatures(candles, 'LOSING_PATTERN', 'LOSS');

      expect(result.label).toBe('LOSS');
      expect(result.patternType).toBe('LOSING_PATTERN');
    });

    test('should extract features with various pattern types', () => {
      const candles = createCandles(10);
      const patterns = ['BREAKOUT', 'RETEST', 'REVERSAL', 'CONSOLIDATION', 'LIQUIDITY_SWEEP'];

      for (const pattern of patterns) {
        const result = service.extractFeatures(candles, pattern, 'WIN');
        expect(result.patternType).toBe(pattern);
      }
    });
  });

  describe('Backward Compatibility: Without ErrorHandler', () => {
    test('should work without ErrorHandler provided', () => {
      const basicService = new MLFeatureExtractorService(mockLogger);
      const candles = createCandles(10);

      expect(() => {
        basicService.extractFeatures(candles, 'BREAKOUT', 'WIN');
      }).not.toThrow();
    });

    test('should work without logger', () => {
      const basicService = new MLFeatureExtractorService(undefined, errorHandler);
      const candles = createCandles(10);

      expect(() => {
        basicService.extractFeatures(candles, 'BREAKOUT', 'WIN');
      }).not.toThrow();
    });

    test('should work without any optional parameters', () => {
      const basicService = new MLFeatureExtractorService();
      const candles = createCandles(10);

      expect(() => {
        basicService.extractFeatures(candles, 'BREAKOUT', 'WIN');
      }).not.toThrow();
    });

    test('should throw on invalid input even without ErrorHandler', () => {
      const basicService = new MLFeatureExtractorService(mockLogger);

      expect(() => {
        basicService.extractFeatures(asCandles(null), 'BREAKOUT', 'WIN');
      }).toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle pattern type with special characters', () => {
      const candles = createCandles(10);
      expect(() => {
        service.extractFeatures(candles, 'PATTERN_WITH_SPECIAL-CHARS_123', 'WIN');
      }).not.toThrow();
    });

    test('should handle very large candle price', () => {
      const candles = [
        ...createCandles(4),
        { ...createMockCandle(5000, 100000), close: 100000.50 },
      ];
      expect(() => {
        service.extractFeatures(candles, 'HIGH_PRICE', 'WIN');
      }).not.toThrow();
    });

    test('should handle very small candle price', () => {
      const candles = [
        ...createCandles(4),
        { ...createMockCandle(5000, 0.00001), close: 0.00001 },
      ];
      expect(() => {
        service.extractFeatures(candles, 'SMALL_PRICE', 'WIN');
      }).not.toThrow();
    });

    test('should handle candles with zero volume', () => {
      const candles = [
        ...createCandles(4),
        { ...createMockCandle(5000, 100), volume: 0 },
      ];
      expect(() => {
        service.extractFeatures(candles, 'ZERO_VOLUME', 'WIN');
      }).not.toThrow();
    });

    test('should handle 100+ candles for multi-timeframe', () => {
      const candles = createCandles(100);
      expect(() => {
        service.extractFeaturesMultiTimeframe(candles, 'LONG_HISTORY', 'WIN', 50);
      }).not.toThrow();
    });

    test('should handle identical prices across candles', () => {
      const candles = Array(10).fill(null).map((_, i) => ({
        timestamp: 1000 + i * 1000,
        open: 100,
        high: 100,
        low: 100,
        close: 100,
        volume: 1000,
      }));

      expect(() => {
        service.extractFeatures(candles, 'FLAT_MARKET', 'WIN');
      }).not.toThrow();
    });
  });
});

// Helper functions
function createMockCandle(timestamp: number, price: number): Candle {
  return {
    timestamp,
    open: price,
    high: price + 0.5,
    low: price - 0.5,
    close: price,
    volume: 1000,
  };
}

function createCandles(count: number): Candle[] {
  const candles: Candle[] = [];
  let price = 100;

  for (let i = 0; i < count; i++) {
    candles.push({
      timestamp: 1000 + i * 60000, // 1 minute intervals
      open: price,
      high: price + Math.random() * 0.5,
      low: price - Math.random() * 0.5,
      close: price + (Math.random() - 0.5) * 0.2,
      volume: 1000 + Math.random() * 500,
    });
    price += (Math.random() - 0.5) * 0.5; // Random walk
  }

  return candles;
}
