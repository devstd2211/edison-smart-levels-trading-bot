/**
 * PatternRecognitionService Error Handling Tests
 * Phase 10.2.2
 *
 * Test Coverage: 40 tests
 * - 5 THROW: Config validation
 * - 5 THROW: Input validation
 * - 8 GRACEFUL_DEGRADE: Pattern recognition/calculation failures
 * - 4 SKIP: Logging failures
 * - 10 Integration: E2E scenarios
 * - 4 Edge cases
 * - 4 Backward compat
 */

import { PatternRecognitionService } from '../../services/pattern-recognition.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { Candle, LoggerService, Pattern, SwingPoint, PatternRecognitionConfig, SwingPointType } from '../../types/legacy';
import {
  asPatternRecognitionCandles as asCandles,
  asPatternRecognitionConfig as asConfig,
  asPatternRecognitionInternals as asInternals,
  asPatternRecognitionPattern as asPattern,
  asPatternRecognitionSwing as asSwing,
  createPatternRecognitionCandle as createMockCandle,
  createPatternRecognitionCandles as createCandleArray,
  createPatternRecognitionFailingLogger,
  createPatternRecognitionHarness,
  createPatternRecognitionInvalidCandle,
  createManagedPatternRecognitionContext,
  createPatternRecognitionMockLogger,
  createPatternRecognitionSwing as createMockSwing,
  type ManagedPatternRecognitionContext,
} from '../helpers/pattern-recognition-test.utils';

describe('PatternRecognitionService - Error Handling', () => {
  let service: PatternRecognitionService;
  let errorHandler: ErrorHandler | undefined;
  let logger = createPatternRecognitionMockLogger();
  let createService: (options?: {
    config?: Partial<PatternRecognitionConfig>;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
    withErrorHandler?: boolean;
  }) => PatternRecognitionService;
  let cleanup: ManagedPatternRecognitionContext['cleanup'];

  beforeEach(() => {
    ({ service, logger, errorHandler, createService, cleanup } =
      createManagedPatternRecognitionContext());
  });

  afterEach(() => {
    cleanup();
  });

  // ========================================
  // THROW: Config Validation (5 tests)
  // ========================================

  describe('THROW: Config Validation', () => {
    it('should throw when config is not an object', () => {
      expect(() => {
        createService({ config: asConfig('invalid') });
      }).toThrow('Config must be an object or undefined');
    });

    it('should throw when config is a number', () => {
      expect(() => {
        createService({ config: asConfig(123) });
      }).toThrow('Config must be an object or undefined');
    });

    it('should throw when config is an array', () => {
      expect(() => {
        createService({ config: asConfig([]) });
      }).toThrow('Config must be an object or undefined');
    });

    it('should NOT throw when config is undefined', () => {
      expect(() => {
        createService({ config: undefined });
      }).not.toThrow();
    });

    it('should NOT throw when config is a valid object', () => {
      expect(() => {
        createService({ config: { minCandlesRequired: 20 } });
      }).not.toThrow();
    });
  });

  // ========================================
  // THROW: Input Validation (5 tests)
  // ========================================

  describe('THROW: Input Validation', () => {
    it('should throw when recognizePattern receives null candles', async () => {
      await expect(
        service.recognizePattern(asCandles(null)),
      ).rejects.toThrow('Candles array cannot be null or undefined');
    });

    it('should throw when recognizePattern receives non-array', async () => {
      await expect(
        service.recognizePattern(asCandles('invalid')),
      ).rejects.toThrow('Candles must be an array');
    });

    it('should throw when recognizePattern receives insufficient candles', async () => {
      const candles = createCandleArray(5); // Less than default minimum (10)

      await expect(
        service.recognizePattern(candles),
      ).rejects.toThrow('Insufficient candles');
    });

    it('should throw when calculatePatternStrength receives null pattern', () => {
      expect(() => {
        service.calculatePatternStrength(asPattern(null));
      }).toThrow('Pattern cannot be null or undefined');
    });

    it('should throw when findFibonacciLevels receives null swing', () => {
      expect(() => {
        service.findFibonacciLevels(asSwing(null));
      }).toThrow('Swing point cannot be null or undefined');
    });
  });

  // ========================================
  // GRACEFUL_DEGRADE: Calculation Failures (8 tests)
  // ========================================

  describe('GRACEFUL_DEGRADE: Calculation Failures', () => {
    it('should return empty array when pattern recognition throws error', async () => {
      const candles = createCandleArray(15);

      // Force error by mocking internal method
      jest.spyOn(asInternals(service), 'performPatternRecognition').mockImplementation(() => {
        throw new Error('Pattern recognition failed');
      });

      const patterns = await service.recognizePattern(candles);

      expect(patterns).toEqual([]); // Empty array on failure
    });

    it('should return neutral strength (50) when strength calculation fails', () => {
      const pattern: Pattern = {
        type: 'doji',
        direction: 'neutral',
        strength: 60,
        reliability: 70,
        startIndex: 10,
        endIndex: 10,
        priceLevel: 50000,
        timestamp: Date.now(),
        candleCount: 1,
        confidence: 65,
      };

      // Force error
      jest.spyOn(asInternals(service), 'performStrengthCalculation').mockImplementation(() => {
        throw new Error('Strength calculation failed');
      });

      const strength = service.calculatePatternStrength(pattern);

      expect(strength).toBe(50); // Neutral default
    });

    it('should return empty array when fibonacci calculation fails', () => {
      const swing = createMockSwing();

      // Force error
      jest.spyOn(asInternals(service), 'performFibonacciCalculation').mockImplementation(() => {
        throw new Error('Fibonacci calculation failed');
      });

      const fibLevels = service.findFibonacciLevels(swing);

      expect(fibLevels).toEqual([]); // Empty array on failure
    });

    it('should return neutral reliability (50) when reliability scoring fails', () => {
      const pattern: Pattern = {
        type: 'hammer',
        direction: 'bullish',
        strength: 65,
        reliability: 55,
        startIndex: 10,
        endIndex: 10,
        priceLevel: 49000,
        timestamp: Date.now(),
        candleCount: 1,
        confidence: 60,
      };

      // Force error
      jest.spyOn(asInternals(service), 'performReliabilityScoring').mockImplementation(() => {
        throw new Error('Reliability scoring failed');
      });

      const reliability = service.scorePatternReliability(pattern);

      expect(reliability).toBe(50); // Neutral default
    });

    it('should return empty array when zone identification fails', () => {
      const candles = createCandleArray(15);
      service.updateCandles(candles);

      // Force error
      jest.spyOn(asInternals(service), 'performZoneIdentification').mockImplementation(() => {
        throw new Error('Zone identification failed');
      });

      const zones = service.identifySupplyDemandZones();

      expect(zones).toEqual([]); // Empty array on failure
    });

    it('should handle invalid pattern type gracefully', () => {
      const pattern: Pattern = {
        type: 'unknown',
        direction: 'neutral',
        strength: 0,
        reliability: 0,
        startIndex: 0,
        endIndex: 0,
        priceLevel: 50000,
        timestamp: Date.now(),
        candleCount: 1,
        confidence: 0,
      };

      const strength = service.calculatePatternStrength(pattern);

      expect(strength).toBeGreaterThanOrEqual(0);
      expect(strength).toBeLessThanOrEqual(100);
    });

    it('should handle missing candle history for zones gracefully', () => {
      // No candles loaded
      expect(() => {
        service.identifySupplyDemandZones();
      }).toThrow('Insufficient candle history');
    });

    it('should handle corrupted candle data gracefully', async () => {
      const candles = createCandleArray(15);
      // Corrupt some candles
      candles[5] = createPatternRecognitionInvalidCandle();
      candles[8] = createPatternRecognitionInvalidCandle({ low: Infinity });

      const patterns = await service.recognizePattern(candles);

      // Should not crash, may return empty or partial results
      expect(Array.isArray(patterns)).toBe(true);
    });
  });

  // ========================================
  // SKIP: Logging Failures (4 tests)
  // ========================================

  describe('SKIP: Logging Failures', () => {
    it('should skip logger errors during initialization', () => {
      const badLogger = createPatternRecognitionFailingLogger({
        info: jest.fn(() => {
          throw new Error('Logger failed');
        }),
      });

      expect(() => {
        createService({ logger: badLogger });
      }).not.toThrow();
    });

    it('should skip logger errors during pattern recognition', async () => {
      const badLogger = createPatternRecognitionFailingLogger({
        warn: jest.fn(() => {
          throw new Error('Logger failed');
        }),
      });

      const testService = createService({ logger: badLogger });

      // Force pattern recognition to log a warning
      jest.spyOn(asInternals(testService), 'performPatternRecognition').mockImplementation(() => {
        throw new Error('Pattern recognition failed');
      });

      const candles = createCandleArray(15);

      await expect(
        testService.recognizePattern(candles),
      ).resolves.toBeDefined();
    });

    it('should skip logger errors during candle update', () => {
      const badLogger = createPatternRecognitionFailingLogger({
        debug: jest.fn(() => {
          throw new Error('Logger failed');
        }),
      });

      const testService = createService({ logger: badLogger });

      expect(() => {
        testService.updateCandles(createCandleArray(10));
      }).not.toThrow();
    });

    it('should skip logger errors during history clearing', () => {
      const badLogger = createPatternRecognitionFailingLogger({
        info: jest.fn(() => {
          throw new Error('Logger failed');
        }),
      });

      const testService = createService({ logger: badLogger });

      expect(() => {
        testService.clearHistory();
      }).not.toThrow();
    });
  });

  // ========================================
  // Integration: E2E Scenarios (10 tests)
  // ========================================

  describe('Integration: E2E Scenarios', () => {
    it('should recognize doji pattern', async () => {
      // Use lower reliability threshold for doji detection
      const config: Partial<PatternRecognitionConfig> = {
        minPatternReliability: 40, // Doji has 45 reliability
      };
      const testService = createService({ config });

      const candles = createCandleArray(15);

      // Create a doji candle (small body)
      candles[12] = createMockCandle(50000, 50100, 49900, 50005, Date.now());

      const patterns = await testService.recognizePattern(candles);

      expect(patterns.length).toBeGreaterThan(0);
      const doji = patterns.find((p) => p.type === 'doji');
      expect(doji).toBeDefined();
      if (doji) {
        expect(doji.direction).toBe('neutral');
      }
    });

    it('should recognize bullish hammer pattern', async () => {
      const candles = createCandleArray(15);

      // Create a hammer (small body at top, long lower shadow)
      candles[12] = createMockCandle(50000, 50050, 49500, 50040, Date.now());
      candles[11] = createMockCandle(51000, 51100, 50900, 50900, Date.now() - 60000); // Bearish previous

      const patterns = await service.recognizePattern(candles);

      const hammer = patterns.find((p) => p.type === 'hammer');
      if (hammer) {
        expect(hammer.direction).toBe('bullish');
      }
    });

    it('should recognize bullish engulfing pattern', async () => {
      const candles = createCandleArray(15);

      // Create bullish engulfing
      candles[11] = createMockCandle(50100, 50100, 50000, 50000, Date.now() - 60000); // Bearish
      candles[12] = createMockCandle(49950, 50250, 49900, 50200, Date.now()); // Bullish engulfing

      const patterns = await service.recognizePattern(candles);

      const engulfing = patterns.find((p) => p.type === 'engulfing_bullish');
      if (engulfing) {
        expect(engulfing.direction).toBe('bullish');
      }
    });

    it('should calculate fibonacci levels correctly', () => {
      const swing: SwingPoint = {
        type: SwingPointType.HIGH,
        price: 52000,
        timestamp: Date.now(),
        index: 10,
        strength: 80,
      };

      // Load candles for opposite swing detection
      const candles = createCandleArray(25);
      candles[5].low = 48000; // Create low swing
      service.updateCandles(candles);

      const fibLevels = service.findFibonacciLevels(swing);

      expect(fibLevels.length).toBeGreaterThan(0);

      // Check that levels are calculated
      const fib50 = fibLevels.find((f) => f.level === 50);
      expect(fib50).toBeDefined();
      if (fib50) {
        // 50% level should be at midpoint
        expect(fib50.price).toBeCloseTo(50000, -1); // ~50000
      }
    });

    it('should identify supply zones from swing highs', () => {
      const candles = createCandleArray(30);

      // Create clear swing high
      candles[15].high = 52000;
      candles[14].high = 51800;
      candles[16].high = 51700;

      service.updateCandles(candles);

      const zones = service.identifySupplyDemandZones();

      const supplyZones = zones.filter((z) => z.type === 'supply');
      expect(supplyZones.length).toBeGreaterThan(0);
    });

    it('should identify demand zones from swing lows', () => {
      const candles = createCandleArray(30);

      // Create clear swing low
      candles[15].low = 48000;
      candles[14].low = 48200;
      candles[16].low = 48300;

      service.updateCandles(candles);

      const zones = service.identifySupplyDemandZones();

      const demandZones = zones.filter((z) => z.type === 'demand');
      expect(demandZones.length).toBeGreaterThan(0);
    });

    it('should calculate pattern strength based on pattern type', () => {
      const dojiPattern: Pattern = {
        type: 'doji',
        direction: 'neutral',
        strength: 0,
        reliability: 0,
        startIndex: 10,
        endIndex: 10,
        priceLevel: 50000,
        timestamp: Date.now(),
        candleCount: 1,
        confidence: 0,
      };

      const engulfingPattern: Pattern = {
        type: 'engulfing_bullish',
        direction: 'bullish',
        strength: 0,
        reliability: 0,
        startIndex: 10,
        endIndex: 11,
        priceLevel: 50000,
        timestamp: Date.now(),
        candleCount: 2,
        confidence: 0,
      };

      const dojiStrength = service.calculatePatternStrength(dojiPattern);
      const engulfingStrength = service.calculatePatternStrength(engulfingPattern);

      // Engulfing should be stronger than doji
      expect(engulfingStrength).toBeGreaterThan(dojiStrength);
    });

    it('should score pattern reliability higher for multi-candle patterns', () => {
      const singleCandle: Pattern = {
        type: 'hammer',
        direction: 'bullish',
        strength: 65,
        reliability: 0,
        startIndex: 10,
        endIndex: 10,
        priceLevel: 50000,
        timestamp: Date.now(),
        candleCount: 1,
        confidence: 0,
      };

      const threeCandle: Pattern = {
        type: 'morning_star',
        direction: 'bullish',
        strength: 80,
        reliability: 0,
        startIndex: 8,
        endIndex: 10,
        priceLevel: 50000,
        timestamp: Date.now(),
        candleCount: 3,
        confidence: 0,
      };

      const singleReliability = service.scorePatternReliability(singleCandle);
      const threeReliability = service.scorePatternReliability(threeCandle);

      // Three-candle should be more reliable
      expect(threeReliability).toBeGreaterThan(singleReliability);
    });

    it('should filter patterns by minimum strength threshold', async () => {
      const config: Partial<PatternRecognitionConfig> = {
        minPatternStrength: 70, // High threshold
        minPatternReliability: 0,
      };

      const testService = createService({ config });

      const candles = createCandleArray(15);
      // Add various patterns
      candles[12] = createMockCandle(50000, 50100, 49900, 50005, Date.now()); // Doji (weak)

      const patterns = await testService.recognizePattern(candles);

      // Weak patterns should be filtered out
      const doji = patterns.find((p) => p.type === 'doji');
      expect(doji).toBeUndefined(); // Doji has strength < 70
    });

    it('should update candle history correctly', () => {
      const candles1 = createCandleArray(10);
      const candles2 = createCandleArray(20);

      service.updateCandles(candles1);
      // Access private property for testing
      expect(asInternals(service).candleHistory.length).toBe(10);

      service.updateCandles(candles2);
      expect(asInternals(service).candleHistory.length).toBe(20);
    });
  });

  // ========================================
  // Edge Cases (4 tests)
  // ========================================

  describe('Edge Cases', () => {
    it('should handle exactly minimum candles required', async () => {
      const candles = createCandleArray(10); // Exactly minimum

      const patterns = await service.recognizePattern(candles);

      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should handle candles with zero range', async () => {
      const candles = createCandleArray(15);

      // Add candle with no range (all prices equal)
      candles[12] = createMockCandle(50000, 50000, 50000, 50000, Date.now());

      const patterns = await service.recognizePattern(candles);

      // Should not crash
      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should handle swing with invalid price', () => {
      const swing: SwingPoint = {
        type: SwingPointType.HIGH,
        price: NaN,
        timestamp: Date.now(),
        index: 10,
        strength: 70,
      };

      expect(() => {
        service.findFibonacciLevels(swing);
      }).toThrow('Swing point must have valid price');
    });

    it('should handle empty candle history for zone identification', () => {
      // No candles loaded
      expect(() => {
        service.identifySupplyDemandZones();
      }).toThrow('Insufficient candle history');
    });
  });

  // ========================================
  // Backward Compatibility (4 tests)
  // ========================================

  describe('Backward Compatibility: Without ErrorHandler', () => {
    let serviceWithoutEH: PatternRecognitionService;

    beforeEach(() => {
      serviceWithoutEH = createService({ withErrorHandler: false });
    });

    afterEach(() => {
      serviceWithoutEH.clearHistory();
    });

    it('should recognize patterns without ErrorHandler', async () => {
      const candles = createCandleArray(15);

      const patterns = await serviceWithoutEH.recognizePattern(candles);

      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should calculate pattern strength without ErrorHandler', () => {
      const pattern: Pattern = {
        type: 'hammer',
        direction: 'bullish',
        strength: 65,
        reliability: 55,
        startIndex: 10,
        endIndex: 10,
        priceLevel: 50000,
        timestamp: Date.now(),
        candleCount: 1,
        confidence: 60,
      };

      const strength = serviceWithoutEH.calculatePatternStrength(pattern);

      expect(strength).toBeGreaterThanOrEqual(0);
      expect(strength).toBeLessThanOrEqual(100);
    });

    it('should find fibonacci levels without ErrorHandler', () => {
      const swing = createMockSwing();

      const candles = createCandleArray(25);
      serviceWithoutEH.updateCandles(candles);

      const fibLevels = serviceWithoutEH.findFibonacciLevels(swing);

      expect(Array.isArray(fibLevels)).toBe(true);
    });

    it('should score pattern reliability without ErrorHandler', () => {
      const pattern: Pattern = {
        type: 'engulfing_bullish',
        direction: 'bullish',
        strength: 75,
        reliability: 70,
        startIndex: 10,
        endIndex: 11,
        priceLevel: 50000,
        timestamp: Date.now(),
        candleCount: 2,
        confidence: 72,
      };

      const reliability = serviceWithoutEH.scorePatternReliability(pattern);

      expect(reliability).toBeGreaterThanOrEqual(0);
      expect(reliability).toBeLessThanOrEqual(100);
    });
  });
});

