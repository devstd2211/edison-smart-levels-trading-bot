/**
 * MLFeatureExtractorService Error Handling Tests (Phase 8.9.68)
 */

import { ErrorHandler } from '../../errors/ErrorHandler';
import { MLFeatureExtractorService } from '../../services/ml-feature-extractor.service';
import { Candle, LoggerService } from '../../types/legacy';
import {
  createMLFeatureCandle,
  createMLFeatureCandleSequence,
  createMLFeatureFailingLogger,
  createManagedMLFeatureExtractorContext,
  type ManagedMLFeatureExtractorContext,
} from '../helpers/ml-feature-extractor-test.utils';

const asCandles = (value: unknown): Candle[] => value as Candle[];
const asPatternType = (value: unknown): string => value as string;
const asOutcome = (value: unknown): 'WIN' | 'LOSS' => value as 'WIN' | 'LOSS';

describe('MLFeatureExtractorService Error Handling (Phase 8.9.68)', () => {
  let service: MLFeatureExtractorService;
  let errorHandler: ErrorHandler | undefined;
  let mockLogger: LoggerService;
  let createStandardService: ManagedMLFeatureExtractorContext['createStandardService'];
  let createLegacyService: ManagedMLFeatureExtractorContext['createLegacyService'];
  let cleanup: ManagedMLFeatureExtractorContext['cleanup'];

  beforeEach(() => {
    ({
      service,
      errorHandler,
      logger: mockLogger,
      createStandardService,
      createLegacyService,
      cleanup,
    } = createManagedMLFeatureExtractorContext());
  });

  afterEach(() => {
    cleanup();
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
      const candles = [createMLFeatureCandle(100), createMLFeatureCandle(101)];
      expect(() => {
        service.extractFeatures(candles, 'BREAKOUT', 'WIN');
      }).toThrow('Need at least 5 candles to extract features');
    });

    test('should throw on null pattern type', () => {
      const candles = createMLFeatureCandleSequence(10);
      expect(() => {
        service.extractFeatures(candles, asPatternType(null), 'WIN');
      }).toThrow('Pattern type must be a non-empty string');
    });

    test('should throw on empty pattern type', () => {
      const candles = createMLFeatureCandleSequence(10);
      expect(() => {
        service.extractFeatures(candles, '', 'WIN');
      }).toThrow('Pattern type must be a non-empty string');
    });

    test('should throw on invalid outcome', () => {
      const candles = createMLFeatureCandleSequence(10);
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
      const candles = createMLFeatureCandleSequence(30);
      expect(() => {
        service.extractFeaturesMultiTimeframe(candles, 'BREAKOUT', 'WIN', 50);
      }).toThrow('Need at least 50 1m candles for multi-timeframe extraction');
    });

    test('should throw on invalid minCandlesFor1m', () => {
      const candles = createMLFeatureCandleSequence(100);
      expect(() => {
        service.extractFeaturesMultiTimeframe(candles, 'BREAKOUT', 'WIN', -10);
      }).toThrow('minCandlesFor1m must be a positive finite number');
    });

    test('should throw on NaN minCandlesFor1m', () => {
      const candles = createMLFeatureCandleSequence(100);
      expect(() => {
        service.extractFeaturesMultiTimeframe(candles, 'BREAKOUT', 'WIN', NaN);
      }).toThrow('minCandlesFor1m must be a positive finite number');
    });
  });

  describe('GRACEFUL_DEGRADE: Feature Extraction Failures', () => {
    test('should handle candles with mixed valid/invalid data', () => {
      const candles = [
        createMLFeatureCandle(100, { timestamp: 1_000 }),
        createMLFeatureCandle(101, { timestamp: 2_000 }),
        createMLFeatureCandle(102, { timestamp: 3_000 }),
        createMLFeatureCandle(103, { timestamp: 4_000 }),
        createMLFeatureCandle(104, { timestamp: 5_000 }),
      ];
      const result = service.extractFeatures(candles, 'BREAKOUT', 'WIN');
      expect(result).toBeDefined();
      expect(result.priceAction).toBeDefined();
    });

    test('should handle feature extraction with extreme prices', () => {
      const candles = [
        createMLFeatureCandle(0.00001, { timestamp: 1_000, close: 0.00001 }),
        createMLFeatureCandle(0.000011, { timestamp: 2_000, close: 0.000011 }),
        createMLFeatureCandle(0.000012, { timestamp: 3_000, close: 0.000012 }),
        createMLFeatureCandle(0.000013, { timestamp: 4_000, close: 0.000013 }),
        createMLFeatureCandle(0.000014, { timestamp: 5_000, close: 0.000014 }),
      ];
      const result = service.extractFeatures(candles, 'MICRO_PRICE', 'WIN');
      expect(result).toBeDefined();
    });

    test('should handle multi-timeframe aggregation gracefully', () => {
      const candles = createMLFeatureCandleSequence(50);
      const result = service.extractFeaturesMultiTimeframe(candles, 'BREAKOUT', 'WIN', 50);
      expect(result).toBeDefined();
      expect(result.patternType).toBe('BREAKOUT');
      expect(result.multiTimeframeContext).toBeDefined();
    });
  });

  describe('SKIP: Logging Failures', () => {
    test('should not throw when logger fails on info', () => {
      const badLogger = createMLFeatureFailingLogger({ info: 'Logger failed' }) as LoggerService;
      const badService = createStandardService({ logger: badLogger, errorHandler });
      const candles = createMLFeatureCandleSequence(10);

      expect(() => {
        badService.extractFeatures(candles, 'BREAKOUT', 'WIN');
      }).not.toThrow();
    });

    test('should not throw when logger fails on error', () => {
      const badLogger = createMLFeatureFailingLogger({ error: 'Logger error failed' }) as LoggerService;
      const badService = createStandardService({ logger: badLogger, errorHandler });
      const candles = createMLFeatureCandleSequence(10);

      expect(() => {
        badService.extractFeatures(candles, 'BREAKOUT', 'WIN');
      }).not.toThrow();
    });
  });

  describe('Integration: Feature Extraction', () => {
    test('should extract features with valid 5+ candles', () => {
      const candles = createMLFeatureCandleSequence(10);
      const result = service.extractFeatures(candles, 'BREAKOUT', 'WIN');

      expect(result).toBeDefined();
      expect(result.patternType).toBe('BREAKOUT');
      expect(result.label).toBe('WIN');
      expect(result.priceAction).toBeDefined();
      expect(result.technicalIndicators).toBeDefined();
      expect(result.volatility).toBeDefined();
    });

    test('should extract multi-timeframe features with 50+ candles', () => {
      const candles = createMLFeatureCandleSequence(60);
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
      const candles = createMLFeatureCandleSequence(50);
      expect(() => {
        service.extractFeaturesMultiTimeframe(candles, 'PATTERN', 'WIN', 50);
      }).not.toThrow();
    });

    test('should handle exactly 5 candles for extractFeatures', () => {
      const candles = createMLFeatureCandleSequence(5);
      expect(() => {
        service.extractFeatures(candles, 'SIMPLE', 'WIN');
      }).not.toThrow();
    });

    test('should extract features with LOSS outcome', () => {
      const candles = createMLFeatureCandleSequence(10);
      const result = service.extractFeatures(candles, 'LOSING_PATTERN', 'LOSS');

      expect(result.label).toBe('LOSS');
      expect(result.patternType).toBe('LOSING_PATTERN');
    });

    test('should extract features with various pattern types', () => {
      const candles = createMLFeatureCandleSequence(10);
      const patterns = ['BREAKOUT', 'RETEST', 'REVERSAL', 'CONSOLIDATION', 'LIQUIDITY_SWEEP'];

      for (const pattern of patterns) {
        const result = service.extractFeatures(candles, pattern, 'WIN');
        expect(result.patternType).toBe(pattern);
      }
    });
  });

  describe('Backward Compatibility: Without ErrorHandler', () => {
    test('should work without ErrorHandler provided', () => {
      const basicService = createLegacyService({ logger: mockLogger });
      const candles = createMLFeatureCandleSequence(10);

      expect(() => {
        basicService.extractFeatures(candles, 'BREAKOUT', 'WIN');
      }).not.toThrow();
    });

    test('should work without logger', () => {
      const basicService = createStandardService({ errorHandler });
      const candles = createMLFeatureCandleSequence(10);

      expect(() => {
        basicService.extractFeatures(candles, 'BREAKOUT', 'WIN');
      }).not.toThrow();
    });

    test('should work without any optional parameters', () => {
      const basicService = createLegacyService();
      const candles = createMLFeatureCandleSequence(10);

      expect(() => {
        basicService.extractFeatures(candles, 'BREAKOUT', 'WIN');
      }).not.toThrow();
    });

    test('should throw on invalid input even without ErrorHandler', () => {
      const basicService = createLegacyService({ logger: mockLogger });

      expect(() => {
        basicService.extractFeatures(asCandles(null), 'BREAKOUT', 'WIN');
      }).toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle pattern type with special characters', () => {
      const candles = createMLFeatureCandleSequence(10);
      expect(() => {
        service.extractFeatures(candles, 'PATTERN_WITH_SPECIAL-CHARS_123', 'WIN');
      }).not.toThrow();
    });

    test('should handle very large candle price', () => {
      const candles = [
        ...createMLFeatureCandleSequence(4),
        createMLFeatureCandle(100_000.5, { timestamp: 5_000, close: 100_000.5 }),
      ];
      expect(() => {
        service.extractFeatures(candles, 'HIGH_PRICE', 'WIN');
      }).not.toThrow();
    });

    test('should handle very small candle price', () => {
      const candles = [
        ...createMLFeatureCandleSequence(4),
        createMLFeatureCandle(0.00001, { timestamp: 5_000, close: 0.00001 }),
      ];
      expect(() => {
        service.extractFeatures(candles, 'SMALL_PRICE', 'WIN');
      }).not.toThrow();
    });

    test('should handle candles with zero volume', () => {
      const candles = [
        ...createMLFeatureCandleSequence(4),
        createMLFeatureCandle(100, { timestamp: 5_000, volume: 0 }),
      ];
      expect(() => {
        service.extractFeatures(candles, 'ZERO_VOLUME', 'WIN');
      }).not.toThrow();
    });

    test('should handle 100+ candles for multi-timeframe', () => {
      const candles = createMLFeatureCandleSequence(100);
      expect(() => {
        service.extractFeaturesMultiTimeframe(candles, 'LONG_HISTORY', 'WIN', 50);
      }).not.toThrow();
    });

    test('should handle identical prices across candles', () => {
      const candles = Array.from({ length: 10 }, (_, i) =>
        createMLFeatureCandle(100, {
          timestamp: 1_000 + i * 1_000,
          high: 100,
          low: 100,
          volume: 1_000,
        }),
      );

      expect(() => {
        service.extractFeatures(candles, 'FLAT_MARKET', 'WIN');
      }).not.toThrow();
    });
  });
});
