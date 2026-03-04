/**
 * Weight Matrix Calculator Service - Error Handling Tests
 * Phase 8.9.61
 *
 * Tests for ErrorHandler integration with THROW/GRACEFUL_DEGRADE/SKIP strategies
 */

import { WeightMatrixCalculatorService } from '../../services/weight-matrix-calculator.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { RecoveryStrategy } from '../../errors/ErrorHandler';
import { WeightMatrixConfig, WeightMatrixInput, SignalDirection, LoggerService } from '../../types/legacy';

// ============================================================================
// FIXTURES
// ============================================================================

const createMockLogger = (): LoggerService => new LoggerService('ERROR', './logs', false);

const createMockErrorHandler = () => {
  return new ErrorHandler(createMockLogger());
};

const createMockConfig = (): WeightMatrixConfig => ({
  enabled: true,
  minConfidenceToEnter: 65,
  minConfidenceForReducedSize: 50,
  reducedSizeMultiplier: 0.5,
  weights: {
    rsi: { enabled: true, maxPoints: 20, thresholds: { excellent: 20, good: 30, ok: 40, weak: 50 } },
    stochastic: { enabled: false, maxPoints: 15, thresholds: { excellent: 15, good: 20, ok: 30 } },
    ema: { enabled: false, maxPoints: 15, thresholds: { excellent: 0.5, good: 1.0, ok: 1.5 } },
    bollingerBands: { enabled: false, maxPoints: 20, thresholds: { excellent: 95, good: 85, ok: 75 } },
    atr: { enabled: true, maxPoints: 10, thresholds: { excellent: 2.0, good: 1.5, ok: 1.2 } },
    volume: { enabled: true, maxPoints: 15, thresholds: { excellent: 2.0, good: 1.5, ok: 1.2, weak: 1.0 } },
    delta: { enabled: false, maxPoints: 10, thresholds: { excellent: 2.0, good: 1.5, ok: 1.2 } },
    orderbook: { enabled: false, maxPoints: 10, thresholds: { excellent: 80, good: 60, ok: 40 } },
    imbalance: { enabled: false, maxPoints: 10, thresholds: { excellent: 70, good: 50, ok: 30 } },
    levelStrength: { enabled: false, maxPoints: 15, thresholds: { excellent: 5, good: 3, ok: 2 } },
    levelDistance: { enabled: false, maxPoints: 15, thresholds: { excellent: 0.5, good: 1.0, ok: 1.5, weak: 2.0 } },
    swingPoints: { enabled: false, maxPoints: 15, thresholds: {} },
    chartPatterns: { enabled: false, maxPoints: 10, thresholds: { excellent: 90, good: 70, ok: 50 } },
    candlePatterns: { enabled: false, maxPoints: 10, thresholds: { excellent: 90, good: 70, ok: 50 } },
    seniorTFAlignment: { enabled: false, maxPoints: 20, thresholds: {} },
    btcCorrelation: { enabled: false, maxPoints: 15, thresholds: {} },
    tfAlignment: { enabled: false, maxPoints: 15, thresholds: { excellent: 90, good: 70, ok: 50 } },
    divergence: { enabled: false, maxPoints: 15, thresholds: {} },
    liquiditySweep: { enabled: false, maxPoints: 10, thresholds: {} },
  },
});

const createMockInput = (): WeightMatrixInput => ({
  rsi: 25,
  atr: { current: 2.5, average: 1.0 },
  volume: { current: 2.0, average: 1.0 },
});

// ============================================================================
// TESTS
// ============================================================================

describe('WeightMatrixCalculatorService - Error Handling (Phase 8.9.61)', () => {
  let service: WeightMatrixCalculatorService;
  let errorHandler: ErrorHandler;
  let mockLogger: LoggerService;

  beforeEach(() => {
    mockLogger = createMockLogger();
    errorHandler = createMockErrorHandler();
  });

  // ==========================================================================
  // GROUP 1: THROW Config Validation Tests (6 tests)
  // ==========================================================================

  describe('THROW: Config Validation', () => {
    it('should throw on null config', () => {
      expect(() => {
        new WeightMatrixCalculatorService(
          null as unknown as WeightMatrixConfig,
          mockLogger,
          errorHandler,
        );
      }).toThrow('WeightMatrixConfig cannot be null or undefined');
    });

    it('should throw on undefined config', () => {
      expect(() => {
        new WeightMatrixCalculatorService(
          undefined as unknown as WeightMatrixConfig,
          mockLogger,
          errorHandler,
        );
      }).toThrow('WeightMatrixConfig cannot be null or undefined');
    });

    it('should throw on invalid minConfidenceToEnter (negative)', () => {
      const config = createMockConfig();
      config.minConfidenceToEnter = -10;

      expect(() => {
        new WeightMatrixCalculatorService(config, mockLogger, errorHandler);
      }).toThrow('minConfidenceToEnter must be 0-100');
    });

    it('should throw on invalid minConfidenceToEnter (>100)', () => {
      const config = createMockConfig();
      config.minConfidenceToEnter = 150;

      expect(() => {
        new WeightMatrixCalculatorService(config, mockLogger, errorHandler);
      }).toThrow('minConfidenceToEnter must be 0-100');
    });

    it('should throw on invalid minConfidenceForReducedSize (negative)', () => {
      const config = createMockConfig();
      config.minConfidenceForReducedSize = -5;

      expect(() => {
        new WeightMatrixCalculatorService(config, mockLogger, errorHandler);
      }).toThrow('minConfidenceForReducedSize must be 0-100');
    });

    it('should throw on invalid minConfidenceForReducedSize (>100)', () => {
      const config = createMockConfig();
      config.minConfidenceForReducedSize = 120;

      expect(() => {
        new WeightMatrixCalculatorService(config, mockLogger, errorHandler);
      }).toThrow('minConfidenceForReducedSize must be 0-100');
    });
  });

  // ==========================================================================
  // GROUP 2: THROW Input Validation Tests (4 tests)
  // ==========================================================================

  describe('THROW: Input Validation', () => {
    beforeEach(() => {
      service = new WeightMatrixCalculatorService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should throw on null input', () => {
      expect(() => {
        service.calculateScore(null as unknown as WeightMatrixInput, SignalDirection.LONG);
      }).toThrow('WeightMatrixInput cannot be null or undefined');
    });

    it('should throw on undefined input', () => {
      expect(() => {
        service.calculateScore(undefined as unknown as WeightMatrixInput, SignalDirection.LONG);
      }).toThrow('WeightMatrixInput cannot be null or undefined');
    });

    it('should throw on null direction', () => {
      const input = createMockInput();

      expect(() => {
        service.calculateScore(input, null as unknown as SignalDirection);
      }).toThrow('SignalDirection must be LONG or SHORT');
    });

    it('should throw on invalid direction', () => {
      const input = createMockInput();

      expect(() => {
        service.calculateScore(input, 'MIDDLE' as unknown as SignalDirection);
      }).toThrow('SignalDirection must be LONG or SHORT');
    });
  });

  // ==========================================================================
  // GROUP 3: GRACEFUL_DEGRADE Calculation Failure Tests (5 tests)
  // ==========================================================================

  describe('GRACEFUL_DEGRADE: Calculation Failures', () => {
    beforeEach(() => {
      service = new WeightMatrixCalculatorService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should handle NaN in ATR average (division by zero)', () => {
      const input = createMockInput();
      input.atr = { current: 2.5, average: NaN };

      const result = service.calculateScore(input, SignalDirection.LONG);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle Infinity in ATR current', () => {
      const input = createMockInput();
      input.atr = { current: Infinity, average: 1.0 };

      const result = service.calculateScore(input, SignalDirection.LONG);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero volume average (division by zero)', () => {
      const input = createMockInput();
      input.volume = { current: 2.0, average: 0 };

      const result = service.calculateScore(input, SignalDirection.LONG);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle negative ATR values', () => {
      const input = createMockInput();
      input.atr = { current: -1.0, average: 1.0 };

      const result = service.calculateScore(input, SignalDirection.LONG);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle negative volume values', () => {
      const input = createMockInput();
      input.volume = { current: -2.0, average: 1.0 };

      const result = service.calculateScore(input, SignalDirection.LONG);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // GROUP 4: SKIP Logger Error Tests (2 tests)
  // ==========================================================================

  describe('SKIP: Logger Errors', () => {
    beforeEach(() => {
      service = new WeightMatrixCalculatorService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should skip logger errors during initialization', () => {
      jest.spyOn(mockLogger, 'info').mockImplementation(() => {
        throw new Error('Logger failed');
      });

      expect(() => {
        new WeightMatrixCalculatorService(createMockConfig(), mockLogger, errorHandler);
      }).not.toThrow();
    });

    it('should skip logger errors during calculation', () => {
      jest.spyOn(mockLogger, 'debug').mockImplementation(() => {
        throw new Error('Logger failed');
      });

      const input = createMockInput();

      expect(() => {
        service.calculateScore(input, SignalDirection.LONG);
      }).not.toThrow();
    });
  });

  // ==========================================================================
  // GROUP 5: Backward Compatibility Tests (3 tests)
  // ==========================================================================

  describe('Backward Compatibility: No ErrorHandler', () => {
    it('should throw on null config without ErrorHandler', () => {
      expect(() => {
        new WeightMatrixCalculatorService(null as unknown as WeightMatrixConfig, mockLogger);
      }).toThrow('WeightMatrixConfig cannot be null or undefined');
    });

    it('should throw on null input without ErrorHandler', () => {
      service = new WeightMatrixCalculatorService(createMockConfig(), mockLogger);

      expect(() => {
        service.calculateScore(null as unknown as WeightMatrixInput, SignalDirection.LONG);
      }).toThrow('WeightMatrixInput cannot be null or undefined');
    });

    it('should calculate score correctly without ErrorHandler', () => {
      service = new WeightMatrixCalculatorService(createMockConfig(), mockLogger);
      const input = createMockInput();

      const result = service.calculateScore(input, SignalDirection.LONG);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // GROUP 6: E2E Recovery Scenarios (3 tests)
  // ==========================================================================

  describe('E2E: Error Recovery Scenarios', () => {
    beforeEach(() => {
      service = new WeightMatrixCalculatorService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should recover from invalid config and succeed with valid config', () => {
      // First attempt with invalid config
      expect(() => {
        new WeightMatrixCalculatorService(
          { ...createMockConfig(), minConfidenceToEnter: 150 },
          mockLogger,
          errorHandler
        );
      }).toThrow();

      // Second attempt with valid config
      const validService = new WeightMatrixCalculatorService(createMockConfig(), mockLogger, errorHandler);
      const input = createMockInput();

      expect(() => {
        validService.calculateScore(input, SignalDirection.LONG);
      }).not.toThrow();
    });

    it('should handle calculation errors and return safe default', () => {
      const input: WeightMatrixInput = {
        rsi: NaN,
        atr: { current: NaN, average: NaN },
        volume: { current: Infinity, average: 0 },
      };

      const result = service.calculateScore(input, SignalDirection.LONG);

      expect(result).toBeDefined();
      expect(result.totalScore).toBe(0);
      expect(result.confidence).toBe(0);
      expect(result.contributions).toBeDefined();
    });

    it('should maintain consistency across multiple calculations', () => {
      const inputs = [
        createMockInput(),
        createMockInput(),
        createMockInput(),
      ];

      const results = inputs.map(input => service.calculateScore(input, SignalDirection.LONG));

      // All results should have confidence > 0 for valid inputs
      results.forEach(result => {
        expect(result.confidence).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================================================
  // GROUP 7: Edge Cases (2 tests)
  // ==========================================================================

  describe('Edge Cases: Complex Scenarios', () => {
    beforeEach(() => {
      service = new WeightMatrixCalculatorService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should handle all factors with extreme values', () => {
      const input: WeightMatrixInput = {
        rsi: 0.0001,
        atr: { current: 1000000, average: 0.0001 },
        volume: { current: 1e15, average: 1e-15 },
      };

      const result = service.calculateScore(input, SignalDirection.LONG);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should return valid confidence when all calculations fail', () => {
      const input: WeightMatrixInput = {
        rsi: NaN,
        atr: { current: NaN, average: NaN },
        volume: { current: NaN, average: NaN },
      };

      const result = service.calculateScore(input, SignalDirection.SHORT);

      expect(result.confidence).toBe(0);
      expect(result.totalScore).toBe(0);
      expect(Object.keys(result.contributions).length).toBeLessThanOrEqual(3);
    });
  });

  // ==========================================================================
  // GROUP 8: Threshold Decision Tests (2 tests)
  // ==========================================================================

  describe('Threshold Decision Functions', () => {
    beforeEach(() => {
      service = new WeightMatrixCalculatorService(createMockConfig(), mockLogger, errorHandler);
    });

    it('should correctly evaluate shouldEnter threshold', () => {
      // Below threshold (64%)
      expect(service.shouldEnter(64)).toBe(false);

      // At threshold (65%)
      expect(service.shouldEnter(65)).toBe(true);

      // Above threshold (75%)
      expect(service.shouldEnter(75)).toBe(true);
    });

    it('should correctly evaluate shouldEnterWithReducedSize threshold', () => {
      // Below range (49%)
      expect(service.shouldEnterWithReducedSize(49)).toBe(false);

      // In range (50-64%)
      expect(service.shouldEnterWithReducedSize(55)).toBe(true);

      // At upper boundary - should be false since >= 65 is main enter
      expect(service.shouldEnterWithReducedSize(65)).toBe(false);

      // Above range (75%)
      expect(service.shouldEnterWithReducedSize(75)).toBe(false);
    });
  });
});
