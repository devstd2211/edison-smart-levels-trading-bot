/**
 * MLSignalValidatorService Error Handling Tests
 * Phase 10.2.1
 *
 * Test Coverage: 45 tests
 * - 5 THROW: Config validation
 * - 6 THROW: Input validation
 * - 8 GRACEFUL_DEGRADE: Calculation failures
 * - 4 SKIP: Logging failures
 * - 10 Integration: E2E scenarios
 * - 8 Edge cases: Extreme values, no history, etc.
 * - 4 Backward compat: Works without ErrorHandler
 */

import { MLSignalValidatorService } from '../../services/ml-signal-validator.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { LoggerService } from '../../services/logger.service';
import { Signal, SignalType, SignalDirection, LogLevel } from '../../types';
import {
  MarketContext,
  MarketRegime,
  SignalRecord,
  MLSignalValidatorConfig,
} from '../../types/ml-signal-validator.interface';

describe('MLSignalValidatorService - Error Handling', () => {
  let service: MLSignalValidatorService;
  let errorHandler: ErrorHandler;
  let logger: LoggerService;

  const createMockSignal = (overrides?: Partial<Signal>): Signal => ({
    direction: SignalDirection.LONG,
    type: SignalType.LEVEL_BASED,
    confidence: 75,
    price: 50000,
    stopLoss: 49500,
    takeProfits: [{ level: 1, percent: 2, sizePercent: 100, price: 51000, hit: false }],
    reason: 'Test signal',
    timestamp: Date.now(),
    ...overrides,
  });

  const createMockContext = (overrides?: Partial<MarketContext>): MarketContext => ({
    regime: 'trending_up' as MarketRegime,
    volatility: 1.0,
    trendStrength: 0.7,
    currentPrice: 50000,
    volumeRatio: 1.2,
    timestamp: Date.now(),
    ...overrides,
  });

  const createMockSignalRecord = (overrides?: Partial<SignalRecord>): SignalRecord => ({
    signal: createMockSignal(),
    context: createMockContext(),
    wasWinner: true,
    profitLoss: 2.5,
    actualRR: 3.0,
    duration: 3600000, // 1 hour
    timestamp: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    errorHandler = new ErrorHandler(logger);
    service = new MLSignalValidatorService(undefined, undefined, logger, errorHandler);
  });

  afterEach(() => {
    service.clearHistory();
  });

  // ========================================
  // THROW: Config Validation (5 tests)
  // ========================================

  describe('THROW: Config Validation', () => {
    it('should throw when config is not an object', () => {
      expect(() => {
        new MLSignalValidatorService('invalid' as any, undefined, logger, errorHandler);
      }).toThrow('Config must be an object or undefined');
    });

    it('should throw when config is a number', () => {
      expect(() => {
        new MLSignalValidatorService(123 as any, undefined, logger, errorHandler);
      }).toThrow('Config must be an object or undefined');
    });

    it('should throw when config is an array', () => {
      expect(() => {
        new MLSignalValidatorService([] as any, undefined, logger, errorHandler);
      }).toThrow('Config must be an object or undefined');
    });

    it('should NOT throw when config is undefined', () => {
      expect(() => {
        new MLSignalValidatorService(undefined, undefined, logger, errorHandler);
      }).not.toThrow();
    });

    it('should NOT throw when config is a valid object', () => {
      expect(() => {
        new MLSignalValidatorService(
          { minHistoricalSamples: 50 }, undefined, logger,
          errorHandler,
        );
      }).not.toThrow();
    });
  });

  // ========================================
  // THROW: Input Validation (6 tests)
  // ========================================

  describe('THROW: Input Validation', () => {
    it('should throw when validateSignal receives null signal', async () => {
      const context = createMockContext();

      await expect(
        service.validateSignal(null as any, context),
      ).rejects.toThrow('Signal cannot be null or undefined');
    });

    it('should throw when validateSignal receives null context', async () => {
      const signal = createMockSignal();

      await expect(
        service.validateSignal(signal, null as any),
      ).rejects.toThrow('Market context cannot be null or undefined');
    });

    it('should throw when signal confidence is NaN', async () => {
      const signal = createMockSignal({ confidence: NaN });
      const context = createMockContext();

      await expect(
        service.validateSignal(signal, context),
      ).rejects.toThrow('Signal confidence must be a valid number');
    });

    it('should throw when signal type is empty string', async () => {
      const signal = createMockSignal({ type: '' as any });
      const context = createMockContext();

      await expect(
        service.validateSignal(signal, context),
      ).rejects.toThrow('Signal type must be a non-empty string');
    });

    it('should throw when calculateWinRate receives null', () => {
      expect(() => {
        service.calculateWinRate(null as any);
      }).toThrow('Signals array cannot be null or undefined');
    });

    it('should throw when adjustConfidenceByRegime receives invalid confidence', () => {
      expect(() => {
        service.adjustConfidenceByRegime(NaN, 'trending_up', SignalType.LEVEL_BASED);
      }).toThrow('Confidence must be a valid number');
    });
  });

  // ========================================
  // GRACEFUL_DEGRADE: Calculation Failures (8 tests)
  // ========================================

  describe('GRACEFUL_DEGRADE: Calculation Failures', () => {
    it('should return conservative result when validation throws error', async () => {
      const signal = createMockSignal();
      const context = createMockContext();

      // Force error by mocking internal method
      jest.spyOn(service as any, 'performValidation').mockImplementation(() => {
        throw new Error('Validation failed');
      });

      const result = await service.validateSignal(signal, context);

      expect(result.originalConfidence).toBe(75);
      expect(result.adjustedConfidence).toBeLessThan(75); // Penalized
      expect(result.recommendedAction).toBe('hold'); // Conservative
      expect(result.riskLevel).toBe('high'); // Conservative
      expect(result.expectedWinRate).toBe(50);
      expect(result.expectedRR).toBe(2.0);
    });

    it('should return default 50% when win rate calculation fails', () => {
      const signals = [createMockSignalRecord()];

      // Force error
      jest.spyOn(service as any, 'performWinRateCalculation').mockImplementation(() => {
        throw new Error('Win rate calc failed');
      });

      const winRate = service.calculateWinRate(signals);

      expect(winRate).toBe(50); // Safe default
    });

    it('should return original confidence when regime adjustment fails', () => {
      const confidence = 80;

      // Force error
      jest.spyOn(service as any, 'performRegimeAdjustment').mockImplementation(() => {
        throw new Error('Regime adjustment failed');
      });

      const adjusted = service.adjustConfidenceByRegime(
        confidence,
        'trending_up',
        SignalType.LEVEL_BASED,
      );

      expect(adjusted).toBe(80); // No adjustment
    });

    it('should return neutral score (50) when quality scoring fails', async () => {
      const signal = createMockSignal();
      const context = createMockContext();

      // Force error
      jest.spyOn(service as any, 'performQualityScoring').mockImplementation(() => {
        throw new Error('Scoring failed');
      });

      const score = await service.scoreSignalQuality(signal, context);

      expect(score).toBe(50); // Neutral
    });

    it('should handle NaN in win rate calculation gracefully', () => {
      // Create signals that would produce NaN
      const signals: SignalRecord[] = [];

      jest.spyOn(service as any, 'performWinRateCalculation').mockImplementation(() => {
        throw new Error('Win rate calculation resulted in invalid number');
      });

      const winRate = service.calculateWinRate(signals);

      expect(winRate).toBe(50); // Default
    });

    it('should handle Infinity in regime adjustment gracefully', () => {
      jest.spyOn(service as any, 'performRegimeAdjustment').mockImplementation(() => {
        throw new Error('Regime adjustment resulted in invalid number');
      });

      const adjusted = service.adjustConfidenceByRegime(
        75,
        'volatile',
        SignalType.REVERSAL,
      );

      expect(adjusted).toBe(75); // Original value
    });

    it('should handle missing stats gracefully in validation', async () => {
      const signal = createMockSignal();
      const context = createMockContext();

      // No historical data added
      const result = await service.validateSignal(signal, context);

      expect(result).toBeDefined();
      expect(result.expectedWinRate).toBe(50); // Default for no history
      expect(result.adjustedConfidence).toBeGreaterThan(0);
    });

    it('should handle corrupted signal records gracefully', async () => {
      const signal = createMockSignal();
      const context = createMockContext();

      // Add corrupted record
      service.addSignalRecord({
        signal: createMockSignal(),
        context: createMockContext(),
        wasWinner: true,
        profitLoss: NaN, // Corrupted
        actualRR: Infinity, // Corrupted
        duration: -1,
        timestamp: Date.now(),
      });

      const result = await service.validateSignal(signal, context);

      expect(result).toBeDefined();
      expect(isFinite(result.adjustedConfidence)).toBe(true);
    });
  });

  // ========================================
  // SKIP: Logging Failures (4 tests)
  // ========================================

  describe('SKIP: Logging Failures', () => {
    it('should skip logger errors during initialization', () => {
      const badLogger = {
        info: jest.fn(() => {
          throw new Error('Logger failed');
        }),
      } as any;

      expect(() => {
        new MLSignalValidatorService(undefined, undefined, badLogger, errorHandler);
      }).not.toThrow();
    });

    it('should skip logger errors during validation', async () => {
      const badLogger = {
        warn: jest.fn(() => {
          throw new Error('Logger failed');
        }),
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
      } as any;

      const testService = new MLSignalValidatorService(undefined, undefined, badLogger, errorHandler);

      // Force validation to log a warning
      jest.spyOn(testService as any, 'performValidation').mockImplementation(() => {
        throw new Error('Validation failed');
      });

      const signal = createMockSignal();
      const context = createMockContext();

      await expect(
        testService.validateSignal(signal, context),
      ).resolves.toBeDefined();
    });

    it('should skip logger errors when adding signal records', () => {
      const badLogger = {
        debug: jest.fn(() => {
          throw new Error('Logger failed');
        }),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      } as any;

      const testService = new MLSignalValidatorService(undefined, undefined, badLogger, errorHandler);

      expect(() => {
        testService.addSignalRecord(createMockSignalRecord());
      }).not.toThrow();
    });

    it('should skip logger errors during history clearing', () => {
      const badLogger = {
        info: jest.fn(() => {
          throw new Error('Logger failed');
        }),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      } as any;

      const testService = new MLSignalValidatorService(undefined, undefined, badLogger, errorHandler);

      expect(() => {
        testService.clearHistory();
      }).not.toThrow();
    });
  });

  // ========================================
  // Integration: E2E Scenarios (10 tests)
  // ========================================

  describe('Integration: E2E Scenarios', () => {
    it('should validate signal with no historical data', async () => {
      const signal = createMockSignal({ confidence: 70 });
      const context = createMockContext();

      const result = await service.validateSignal(signal, context);

      expect(result.originalConfidence).toBe(70);
      expect(result.adjustedConfidence).toBeGreaterThan(0);
      expect(result.adjustedConfidence).toBeLessThanOrEqual(100);
      expect(result.expectedWinRate).toBe(50); // Default
      expect(result.expectedRR).toBe(2.0);
    });

    it('should boost confidence for high win rate signals', async () => {
      // Add 50 winning signals
      for (let i = 0; i < 50; i++) {
        service.addSignalRecord(
          createMockSignalRecord({
            signal: createMockSignal({ type: SignalType.LEVEL_BASED }),
            wasWinner: i < 40, // 80% win rate
          }),
        );
      }

      const signal = createMockSignal({
        confidence: 60,
        type: SignalType.LEVEL_BASED,
        timestamp: Date.now(),
      });
      const context = createMockContext();

      const result = await service.validateSignal(signal, context);

      expect(result.adjustedConfidence).toBeGreaterThan(result.originalConfidence);
      expect(result.expectedWinRate).toBeGreaterThan(70);
      expect(result.recommendedAction).toBe('buy');
    });

    it('should penalize confidence for low win rate signals', async () => {
      // Add 50 signals with low win rate
      for (let i = 0; i < 50; i++) {
        service.addSignalRecord(
          createMockSignalRecord({
            signal: createMockSignal({ type: SignalType.COUNTER_TREND }),
            wasWinner: i < 15, // 30% win rate
          }),
        );
      }

      const signal = createMockSignal({
        confidence: 70,
        type: SignalType.COUNTER_TREND,
        timestamp: Date.now(),
      });
      const context = createMockContext();

      const result = await service.validateSignal(signal, context);

      expect(result.adjustedConfidence).toBeLessThan(result.originalConfidence);
      expect(result.expectedWinRate).toBeLessThan(40);
    });

    it('should apply time decay to old signals', async () => {
      const oldTimestamp = Date.now() - 10 * 60 * 60 * 1000; // 10 hours ago
      const signal = createMockSignal({
        confidence: 80,
        timestamp: oldTimestamp,
      });
      const context = createMockContext();

      const result = await service.validateSignal(signal, context);

      // Time decay should reduce confidence
      expect(result.adjustedConfidence).toBeLessThan(result.originalConfidence);
      expect(result.adjustmentFactors?.timeDecay).toBeLessThan(1.0);
    });

    it('should boost trend-following signals in trending market', async () => {
      const signal = createMockSignal({
        type: SignalType.TREND_FOLLOWING,
        confidence: 60,
        timestamp: Date.now(),
      });
      const context = createMockContext({ regime: 'trending_up' });

      const result = await service.validateSignal(signal, context);

      expect(result.adjustmentFactors?.regimeAdjustment).toBeGreaterThan(1.0);
      expect(result.adjustedConfidence).toBeGreaterThan(result.originalConfidence * 0.95);
    });

    it('should penalize trend-following signals in range-bound market', async () => {
      const signal = createMockSignal({
        type: SignalType.TREND_FOLLOWING,
        confidence: 70,
        timestamp: Date.now(),
      });
      const context = createMockContext({ regime: 'range_bound' });

      const result = await service.validateSignal(signal, context);

      expect(result.adjustmentFactors?.regimeAdjustment).toBeLessThan(1.0);
      expect(result.adjustedConfidence).toBeLessThan(result.originalConfidence);
    });

    it('should penalize confidence in high volatility', async () => {
      const signal = createMockSignal({ confidence: 75, timestamp: Date.now() });
      const context = createMockContext({ volatility: 3.0 }); // Very high volatility (> 1.5 * 1.5 = 2.25)

      const result = await service.validateSignal(signal, context);

      expect(result.adjustmentFactors?.volatilityAdjustment).toBeLessThan(1.0);
      expect(result.riskLevel).toBe('high');
    });

    it('should calculate win rate correctly from history', () => {
      const signals = [
        createMockSignalRecord({ wasWinner: true }),
        createMockSignalRecord({ wasWinner: true }),
        createMockSignalRecord({ wasWinner: false }),
        createMockSignalRecord({ wasWinner: true }),
        createMockSignalRecord({ wasWinner: false }),
      ];

      const winRate = service.calculateWinRate(signals);

      expect(winRate).toBe(60); // 3/5 = 60%
    });

    it('should score high quality signals higher', async () => {
      // Add strong historical performance
      for (let i = 0; i < 40; i++) {
        service.addSignalRecord(
          createMockSignalRecord({
            signal: createMockSignal({ type: SignalType.REVERSAL }),
            wasWinner: i < 32, // 80% win rate
            actualRR: 3.5,
          }),
        );
      }

      const signal = createMockSignal({
        type: SignalType.REVERSAL,
        confidence: 85,
      });
      const context = createMockContext({ regime: 'volatile' }); // Good for reversals

      const score = await service.scoreSignalQuality(signal, context);

      expect(score).toBeGreaterThan(70); // High quality
    });

    it('should provide recommended action based on adjusted confidence', async () => {
      const signal1 = createMockSignal({ confidence: 85, timestamp: Date.now() });
      const signal2 = createMockSignal({ confidence: 65, timestamp: Date.now() });
      const signal3 = createMockSignal({ confidence: 45, timestamp: Date.now() });
      const context = createMockContext();

      const result1 = await service.validateSignal(signal1, context);
      const result2 = await service.validateSignal(signal2, context);
      const result3 = await service.validateSignal(signal3, context);

      expect(result1.recommendedAction).toBe('strong_buy');
      expect(result2.recommendedAction).toBe('buy');
      expect(result3.recommendedAction).toBe('hold');
    });
  });

  // ========================================
  // Edge Cases (8 tests)
  // ========================================

  describe('Edge Cases', () => {
    it('should handle zero confidence', async () => {
      const signal = createMockSignal({ confidence: 0, timestamp: Date.now() });
      const context = createMockContext();

      const result = await service.validateSignal(signal, context);

      expect(result.adjustedConfidence).toBe(0);
      expect(result.recommendedAction).toBe('hold');
    });

    it('should handle 100% confidence', async () => {
      const signal = createMockSignal({ confidence: 100, timestamp: Date.now() });
      const context = createMockContext();

      const result = await service.validateSignal(signal, context);

      expect(result.adjustedConfidence).toBeGreaterThan(0);
      expect(result.adjustedConfidence).toBeLessThanOrEqual(100);
    });

    it('should handle empty signal history', () => {
      const signals: SignalRecord[] = [];

      const winRate = service.calculateWinRate(signals);

      expect(winRate).toBe(50); // Neutral
    });

    it('should handle all winning signals (100% win rate)', () => {
      const signals = [
        createMockSignalRecord({ wasWinner: true }),
        createMockSignalRecord({ wasWinner: true }),
        createMockSignalRecord({ wasWinner: true }),
      ];

      const winRate = service.calculateWinRate(signals);

      expect(winRate).toBe(100);
    });

    it('should handle all losing signals (0% win rate)', () => {
      const signals = [
        createMockSignalRecord({ wasWinner: false }),
        createMockSignalRecord({ wasWinner: false }),
        createMockSignalRecord({ wasWinner: false }),
      ];

      const winRate = service.calculateWinRate(signals);

      expect(winRate).toBe(0);
    });

    it('should handle extremely old signals', async () => {
      const veryOldTimestamp = Date.now() - 100 * 60 * 60 * 1000; // 100 hours ago
      const signal = createMockSignal({
        confidence: 90,
        timestamp: veryOldTimestamp,
      });
      const context = createMockContext();

      const result = await service.validateSignal(signal, context);

      // Extreme time decay
      expect(result.adjustedConfidence).toBeLessThan(result.originalConfidence * 0.5);
      expect(result.adjustmentFactors?.timeDecay).toBeLessThan(0.5);
    });

    it('should handle unknown market regime', async () => {
      const signal = createMockSignal({ confidence: 70, timestamp: Date.now() });
      const context = createMockContext({ regime: 'unknown' });

      const result = await service.validateSignal(signal, context);

      expect(result).toBeDefined();
      expect(result.adjustmentFactors?.regimeAdjustment).toBe(1.0); // No adjustment
    });

    it('should clamp adjusted confidence to 0-100 range', async () => {
      const signal = createMockSignal({ confidence: 95, timestamp: Date.now() });
      const context = createMockContext();

      // Force multiplier to go over 100
      jest.spyOn(service as any, 'getRegimeMultiplier').mockReturnValue(2.0);

      const result = await service.validateSignal(signal, context);

      expect(result.adjustedConfidence).toBeLessThanOrEqual(100);
      expect(result.adjustedConfidence).toBeGreaterThanOrEqual(0);
    });
  });

  // ========================================
  // Backward Compatibility (4 tests)
  // ========================================

  describe('Backward Compatibility: Without ErrorHandler', () => {
    let serviceWithoutEH: MLSignalValidatorService;

    beforeEach(() => {
      const testLogger = new LoggerService(LogLevel.ERROR, './logs', false);
      serviceWithoutEH = new MLSignalValidatorService(undefined, undefined, testLogger);
    });

    afterEach(() => {
      serviceWithoutEH.clearHistory();
    });

    it('should validate signals without ErrorHandler', async () => {
      const signal = createMockSignal({ confidence: 70 });
      const context = createMockContext();

      const result = await serviceWithoutEH.validateSignal(signal, context);

      expect(result).toBeDefined();
      expect(result.originalConfidence).toBe(70);
      expect(result.adjustedConfidence).toBeGreaterThan(0);
    });

    it('should calculate win rate without ErrorHandler', () => {
      const signals = [
        createMockSignalRecord({ wasWinner: true }),
        createMockSignalRecord({ wasWinner: false }),
      ];

      const winRate = serviceWithoutEH.calculateWinRate(signals);

      expect(winRate).toBe(50);
    });

    it('should adjust confidence by regime without ErrorHandler', () => {
      const adjusted = serviceWithoutEH.adjustConfidenceByRegime(
        75,
        'trending_up',
        SignalType.TREND_FOLLOWING,
      );

      expect(adjusted).toBeGreaterThanOrEqual(0);
      expect(adjusted).toBeLessThanOrEqual(100);
    });

    it('should score signal quality without ErrorHandler', async () => {
      const signal = createMockSignal();
      const context = createMockContext();

      const score = await serviceWithoutEH.scoreSignalQuality(signal, context);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});
