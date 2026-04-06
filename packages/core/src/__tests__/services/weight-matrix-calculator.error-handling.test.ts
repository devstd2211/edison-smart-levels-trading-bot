/**
 * Weight Matrix Calculator Service - Error Handling Tests
 * Phase 8.9.61
 *
 * Tests for ErrorHandler integration with THROW/GRACEFUL_DEGRADE/SKIP strategies
 */

import { WeightMatrixCalculatorService } from '../../services/weight-matrix-calculator.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { WeightMatrixConfig, WeightMatrixInput, SignalDirection, LoggerService } from '../../types/legacy';
import {
  createManagedErrorWeightMatrixContext,
  createWeightMatrixErrorConfig,
  createWeightMatrixInput,
  type ManagedErrorWeightMatrixContext,
} from '../helpers/weight-matrix-calculator-test.utils';

// ============================================================================
// FIXTURES
// ============================================================================

// ============================================================================
// TESTS
// ============================================================================

type ErrorWeightMatrixFixtures = {
  runtime: Pick<ManagedErrorWeightMatrixContext, 'logger' | 'errorHandler' | 'config'>;
  factories: Pick<ManagedErrorWeightMatrixContext, 'createStandardErrorService' | 'createLegacyErrorService'>;
};
type WeightMatrixStandardServiceFactory = ErrorWeightMatrixFixtures['factories']['createStandardErrorService'];
type WeightMatrixLegacyServiceFactory = ErrorWeightMatrixFixtures['factories']['createLegacyErrorService'];

function bindErrorWeightMatrixFixtures() {
  let cleanup: () => void;
  let fixtures: ErrorWeightMatrixFixtures;

  beforeEach(() => {
    const managedContext = createManagedErrorWeightMatrixContext();
    fixtures = {
      runtime: {
        logger: managedContext.logger,
        errorHandler: managedContext.errorHandler as ErrorHandler,
        config: managedContext.config,
      },
      factories: {
        createStandardErrorService: managedContext.createStandardErrorService,
        createLegacyErrorService: managedContext.createLegacyErrorService,
      },
    };
    cleanup = managedContext.cleanup;
  });

  afterEach(() => {
    cleanup();
  });

  return () => fixtures;
}

describe('WeightMatrixCalculatorService - Error Handling (Phase 8.9.61)', () => {
  let service: WeightMatrixCalculatorService;
  let errorHandler: ErrorHandler;
  let mockLogger: LoggerService;
  let errorConfig: WeightMatrixConfig;
  let createService: (config?: WeightMatrixConfig) => ReturnType<WeightMatrixStandardServiceFactory>;
  let createLegacyService: (config?: WeightMatrixConfig) => ReturnType<WeightMatrixLegacyServiceFactory>;
  let createStandardErrorService: WeightMatrixStandardServiceFactory;
  let createLegacyErrorService: WeightMatrixLegacyServiceFactory;
  const getFixtures = bindErrorWeightMatrixFixtures();

  beforeEach(() => {
    const { runtime, factories } = getFixtures();
    ({ logger: mockLogger, config: errorConfig } = runtime);
    errorHandler = runtime.errorHandler as ErrorHandler;
    ({ createStandardErrorService, createLegacyErrorService } = factories);
    createService = (config = errorConfig) =>
      createStandardErrorService({ config });
    createLegacyService = (config = errorConfig) =>
      createLegacyErrorService({ config });
  });

  // ==========================================================================
  // GROUP 1: THROW Config Validation Tests (6 tests)
  // ==========================================================================

  describe('THROW: Config Validation', () => {
    it('should throw on null config', () => {
      expect(() => {
        createStandardErrorService({
          config: null as unknown as WeightMatrixConfig,
        });
      }).toThrow('WeightMatrixConfig cannot be null or undefined');
    });

    it('should throw on undefined config', () => {
      expect(() => {
        createStandardErrorService({
          config: undefined as unknown as WeightMatrixConfig,
        });
      }).toThrow('WeightMatrixConfig cannot be null or undefined');
    });

    it('should throw on invalid minConfidenceToEnter (negative)', () => {
      const config = createWeightMatrixErrorConfig();
      config.minConfidenceToEnter = -10;

      expect(() => {
        createStandardErrorService({ config });
      }).toThrow('minConfidenceToEnter must be 0-100');
    });

    it('should throw on invalid minConfidenceToEnter (>100)', () => {
      const config = createWeightMatrixErrorConfig();
      config.minConfidenceToEnter = 150;

      expect(() => {
        createStandardErrorService({ config });
      }).toThrow('minConfidenceToEnter must be 0-100');
    });

    it('should throw on invalid minConfidenceForReducedSize (negative)', () => {
      const config = createWeightMatrixErrorConfig();
      config.minConfidenceForReducedSize = -5;

      expect(() => {
        createStandardErrorService({ config });
      }).toThrow('minConfidenceForReducedSize must be 0-100');
    });

    it('should throw on invalid minConfidenceForReducedSize (>100)', () => {
      const config = createWeightMatrixErrorConfig();
      config.minConfidenceForReducedSize = 120;

      expect(() => {
        createStandardErrorService({ config });
      }).toThrow('minConfidenceForReducedSize must be 0-100');
    });
  });

  // ==========================================================================
  // GROUP 2: THROW Input Validation Tests (4 tests)
  // ==========================================================================

  describe('THROW: Input Validation', () => {
    beforeEach(() => {
      service = createService();
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
      const input = createWeightMatrixInput();

      expect(() => {
        service.calculateScore(input, null as unknown as SignalDirection);
      }).toThrow('SignalDirection must be LONG or SHORT');
    });

    it('should throw on invalid direction', () => {
      const input = createWeightMatrixInput();

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
      service = createService();
    });

    it('should handle NaN in ATR average (division by zero)', () => {
      const input = createWeightMatrixInput();
      input.atr = { current: 2.5, average: NaN };

      const result = service.calculateScore(input, SignalDirection.LONG);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle Infinity in ATR current', () => {
      const input = createWeightMatrixInput();
      input.atr = { current: Infinity, average: 1.0 };

      const result = service.calculateScore(input, SignalDirection.LONG);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero volume average (division by zero)', () => {
      const input = createWeightMatrixInput();
      input.volume = { current: 2.0, average: 0 };

      const result = service.calculateScore(input, SignalDirection.LONG);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle negative ATR values', () => {
      const input = createWeightMatrixInput();
      input.atr = { current: -1.0, average: 1.0 };

      const result = service.calculateScore(input, SignalDirection.LONG);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle negative volume values', () => {
      const input = createWeightMatrixInput();
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
      service = createService();
    });

    it('should skip logger errors during initialization', () => {
      jest.spyOn(mockLogger, 'info').mockImplementation(() => {
        throw new Error('Logger failed');
      });

      expect(() => {
        createService();
      }).not.toThrow();
    });

    it('should skip logger errors during calculation', () => {
      jest.spyOn(mockLogger, 'debug').mockImplementation(() => {
        throw new Error('Logger failed');
      });

      const input = createWeightMatrixInput();

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
        createLegacyErrorService({
          config: null as unknown as WeightMatrixConfig,
        });
      }).toThrow('WeightMatrixConfig cannot be null or undefined');
    });

    it('should throw on null input without ErrorHandler', () => {
      service = createLegacyService(createWeightMatrixErrorConfig());

      expect(() => {
        service.calculateScore(null as unknown as WeightMatrixInput, SignalDirection.LONG);
      }).toThrow('WeightMatrixInput cannot be null or undefined');
    });

    it('should calculate score correctly without ErrorHandler', () => {
      service = createLegacyService(createWeightMatrixErrorConfig());
      const input = createWeightMatrixInput();

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
      service = createService();
    });

    it('should recover from invalid config and succeed with valid config', () => {
      // First attempt with invalid config
      expect(() => {
        createStandardErrorService({
          config: { ...errorConfig, minConfidenceToEnter: 150 },
        });
      }).toThrow();

      // Second attempt with valid config
      const validService = createService();
      const input = createWeightMatrixInput();

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
        createWeightMatrixInput(),
        createWeightMatrixInput(),
        createWeightMatrixInput(),
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
      service = createService();
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
      service = createService();
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
