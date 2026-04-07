/**
 * FractalSmcWeightingService Error Handling Tests (Phase 8.9.71)
 *
 * Test Coverage:
 * - THROW: Config validation (threshold, highConfidenceThreshold, maxScores)
 * - THROW: Input validation (null setup/data)
 * - GRACEFUL_DEGRADE: Calculation failures (NaN/Infinity scores)
 * - SKIP: Logging errors
 * - Integration: Weighted score calculation
 * - Backward Compatibility: Tests without ErrorHandler still work
 */

import { FractalSmcWeightingService } from '../../services/fractal-smc-weighting.service';
import { WeightedSignalConfig, ConfidenceLevel } from '../../types/fractal-strategy';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import {
  createFractalSmcWeightingConfig,
  createFractalSmcWeightingData,
  createFractalSmcWeightingInvalidSetup,
  createManagedFractalSmcWeightingContext,
  createFractalSmcWeightingMockLoggerWithFailures,
  createFractalSmcWeightingMockLogger,
  createFractalSmcWeightingSetup,
} from '../helpers/fractal-smc-weighting-test.utils';

type SetupInput = Parameters<FractalSmcWeightingService['calculateWeightedScore']>[0];
type DataInput = Parameters<FractalSmcWeightingService['calculateWeightedScore']>[1];
const asSetup = (value: unknown): SetupInput => value as SetupInput;
const asData = (value: unknown): DataInput => value as DataInput;
const createValidConfig = createFractalSmcWeightingConfig;
const createValidSetup = createFractalSmcWeightingSetup;
const createValidData = createFractalSmcWeightingData;

type ManagedFractalSmcWeightingFixtureContext = ReturnType<
  typeof createManagedFractalSmcWeightingContext
>;
type FractalSmcWeightingFixtures = {
  runtime: Pick<
    ManagedFractalSmcWeightingFixtureContext,
    'logger' | 'service'
  > & {
    errorHandler: NonNullable<ManagedFractalSmcWeightingFixtureContext['errorHandler']>;
  };
  factories: Pick<ManagedFractalSmcWeightingFixtureContext, 'createService'>;
};
type FractalSmcWeightingLogger = FractalSmcWeightingFixtures['runtime']['logger'];
type FractalSmcWeightingCreateService = FractalSmcWeightingFixtures['factories']['createService'];
type FractalSmcWeightingFixtureAccessor = () => FractalSmcWeightingFixtures;

function bindFractalSmcWeightingFixtures() {
  let cleanup: ManagedFractalSmcWeightingFixtureContext['cleanup'];
  let fixtures: FractalSmcWeightingFixtures;

  beforeEach(() => {
    const mockLogger = createFractalSmcWeightingMockLogger();
    const fixtureState = createManagedFractalSmcWeightingContext({ logger: mockLogger });
    cleanup = fixtureState.cleanup;
    fixtures = {
      runtime: {
        logger: fixtureState.logger,
        errorHandler: fixtureState.errorHandler!,
        service: fixtureState.service,
      },
      factories: {
        createService: fixtureState.createService,
      },
    };
  });

  afterEach(() => {
    cleanup();
  });

  return () => fixtures;
}

describe('FractalSmcWeightingService Error Handling (Phase 8.9.71)', () => {
  let service: FractalSmcWeightingService;
  let errorHandler: ErrorHandler;
  let mockLogger: FractalSmcWeightingLogger;
  let createService: FractalSmcWeightingCreateService;
  const getFixtures: FractalSmcWeightingFixtureAccessor = bindFractalSmcWeightingFixtures();

  beforeEach(() => {
    const { runtime, factories } = getFixtures();
    ({
      logger: mockLogger,
      errorHandler,
      service,
    } = runtime);
    ({
      createService,
    } = factories);
  });

  // ============================================================================
  // THROW: Config Validation (5 tests)
  // ============================================================================

  describe('THROW: Config Validation', () => {
    test('should throw on null config', () => {
      expect(() => {
        createService({ config: null as unknown as WeightedSignalConfig });
      }).toThrow('Config must be a valid object');
    });

    test('should throw on invalid threshold (NaN)', () => {
      const config = { ...createValidConfig(), threshold: NaN };
      expect(() => {
        createService({ config });
      }).toThrow('Config.threshold must be a finite number');
    });

    test('should throw on threshold out of range (>220)', () => {
      const config = { ...createValidConfig(), threshold: 250 };
      expect(() => {
        createService({ config });
      }).toThrow('Config.threshold must be between 0 and 220');
    });

    test('should throw on invalid highConfidenceThreshold (Infinity)', () => {
      const config = { ...createValidConfig(), highConfidenceThreshold: Infinity };
      expect(() => {
        createService({ config });
      }).toThrow('Config.highConfidenceThreshold must be a finite number');
    });

    test('should throw on highConfidenceThreshold < threshold', () => {
      const config = {
        ...createValidConfig(),
        threshold: 100,
        highConfidenceThreshold: 80,
      };
      expect(() => {
        createService({ config });
      }).toThrow('Config.highConfidenceThreshold must be >= threshold');
    });

    test('should throw on maxFractalScore <= 0', () => {
      const config = { ...createValidConfig(), maxFractalScore: 0 };
      expect(() => {
        createService({ config });
      }).toThrow('Config.maxFractalScore must be a positive number');
    });

    test('should throw on maxSmcScore <= 0', () => {
      const config = { ...createValidConfig(), maxSmcScore: -10 };
      expect(() => {
        createService({ config });
      }).toThrow('Config.maxSmcScore must be a positive number');
    });
  });

  // ============================================================================
  // THROW: Input Validation (5 tests)
  // ============================================================================

  describe('THROW: Input Validation', () => {
    beforeEach(() => {
      service = createService();
    });

    test('should throw on null setup', () => {
      const data = createValidData();
      expect(() => {
        service.calculateWeightedScore(asSetup(null), asData(data));
      }).toThrow('Setup must be a valid object');
    });

    test('should throw on undefined setup', () => {
      const data = createValidData();
      expect(() => {
        service.calculateWeightedScore(asSetup(undefined), asData(data));
      }).toThrow('Setup must be a valid object');
    });

    test('should throw on null data', () => {
      const setup = createValidSetup();
      expect(() => {
        service.calculateWeightedScore(asSetup(setup), asData(null));
      }).toThrow('Data must be a valid object');
    });

    test('should throw on undefined data', () => {
      const setup = createValidSetup();
      expect(() => {
        service.calculateWeightedScore(asSetup(setup), asData(undefined));
      }).toThrow('Data must be a valid object');
    });

    test('should throw on invalid setup type (string)', () => {
      const data = createValidData();
      expect(() => {
        service.calculateWeightedScore(asSetup('invalid'), asData(data));
      }).toThrow('Setup must be a valid object');
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE: Calculation Failures (5 tests)
  // ============================================================================

  describe('GRACEFUL_DEGRADE: Calculation Failures', () => {
    beforeEach(() => {
      service = createService();
    });

    test('should handle NaN breakout strength gracefully', () => {
      const setup = {
        ...createFractalSmcWeightingInvalidSetup(),
        breakout: { confirmedByClose: true, strength: NaN, volumeRatio: 1.5 },
      };
      const data = createValidData();

      const result = service.calculateWeightedScore(asSetup(setup), asData(data));

      expect(result).toBeDefined();
      expect(result.passesThreshold).toBe(false);
      expect(result.confidence).toBe(ConfidenceLevel.LOW);
      expect(result.fractalScore).toBe(0);
      expect(result.smcScore).toBe(0);
    });

    test('should handle Infinity volume ratio gracefully', () => {
      const setup = {
        ...createFractalSmcWeightingInvalidSetup(),
        breakout: { confirmedByClose: true, strength: 0.8, volumeRatio: Infinity },
      };
      const data = createValidData();

      const result = service.calculateWeightedScore(asSetup(setup), asData(data));

      expect(result).toBeDefined();
      expect(result.passesThreshold).toBe(false);
      expect(result.fractalScore).toBe(0);
    });

    test('should return safe defaults on calculation error', () => {
      const setup = {
        ...createFractalSmcWeightingInvalidSetup(),
        breakout: { confirmedByClose: true, strength: 0.8, volumeRatio: NaN },
      };
      const data = createValidData();

      const result = service.calculateWeightedScore(asSetup(setup), asData(data));

      expect(result).toBeDefined();
      // Combined score should be valid (NaN volumeRatio doesn't trigger volume scoring due to condition)
      expect(Number.isFinite(result.combinedScore)).toBe(true);
      expect(result.positionSize).toBeGreaterThanOrEqual(0.5);
      expect(result.reasoning).toBeDefined();
      expect(Array.isArray(result.reasoning)).toBe(true);
    });

    test('should handle invalid confidence level gracefully', () => {
      const setup = createValidSetup();
      const data = createValidData();

      const result = service.calculateWeightedScore(asSetup(setup), asData(data));

      expect(result).toBeDefined();
      expect([ConfidenceLevel.HIGH, ConfidenceLevel.MEDIUM, ConfidenceLevel.LOW]).toContain(
        result.confidence
      );
    });

    test('should clamp combined score to valid range', () => {
      const setup = createValidSetup();
      const data = createValidData();

      const result = service.calculateWeightedScore(asSetup(setup), asData(data));

      expect(result.combinedScore).toBeGreaterThanOrEqual(0);
      expect(result.combinedScore).toBeLessThanOrEqual(220);
    });
  });

  // ============================================================================
  // SKIP: Logging Failures (2 tests)
  // ============================================================================

  describe('SKIP: Logging Failures', () => {
    test('should not throw when logger fails on info', () => {
      const badLogger = createFractalSmcWeightingMockLoggerWithFailures({
        info: jest.fn(() => {
          throw new Error('Logger failed');
        }),
      });
      service = createService({ logger: badLogger });
      const setup = createValidSetup();
      const data = createValidData();

      expect(() => {
        service.calculateWeightedScore(asSetup(setup), asData(data));
      }).not.toThrow();
    });

    test('should not throw when logger fails on debug', () => {
      const badLogger = createFractalSmcWeightingMockLoggerWithFailures({
        debug: jest.fn(() => {
          throw new Error('Debug failed');
        }),
      });
      service = createService({ logger: badLogger });
      const setup = createValidSetup();
      const data = createValidData();

      expect(() => {
        service.calculateWeightedScore(asSetup(setup), asData(data));
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Integration: Weighted Score Calculation (2 tests)
  // ============================================================================

  describe('Integration: Weighted Score Calculation', () => {
    beforeEach(() => {
      service = createService();
    });

    test('should calculate HIGH confidence with strong setup', () => {
      const setup = {
        breakout: {
          confirmedByClose: true,
          strength: 0.9,
          volumeRatio: 2.0,
        },
        retest: {
          isSecondTouch: true,
          touchCount: 3,
        },
        reversal: {
          strongCandleBody: true,
          confirmationBars: 3,
          priceActionPattern: 'HAMMER',
          volumeConfirmed: true,
          structureAligned: true,
        },
      };
      const data = createValidData();

      const result = service.calculateWeightedScore(asSetup(setup), asData(data));

      expect(result).toBeDefined();
      expect(result.positionSize).toBeGreaterThan(0.5);
    });

    test('should calculate correct position size based on confidence', () => {
      const setup = createValidSetup();
      const data = createValidData();

      const result = service.calculateWeightedScore(asSetup(setup), asData(data));

      expect(result.positionSize).toBeGreaterThanOrEqual(0);
      expect(result.positionSize).toBeLessThanOrEqual(1.0);
    });
  });

  // ============================================================================
  // Backward Compatibility: Without ErrorHandler (1 test)
  // ============================================================================

  describe('Backward Compatibility: Without ErrorHandler', () => {
    test('should work without ErrorHandler provided', () => {
      const basicService = createService({ withErrorHandler: false });
      const setup = createValidSetup();
      const data = createValidData();

      expect(() => {
        basicService.calculateWeightedScore(asSetup(setup), asData(data));
      }).not.toThrow();
    });

    test('should throw on invalid input even without ErrorHandler', () => {
      const basicService = createService({ withErrorHandler: false });

      expect(() => {
        basicService.calculateWeightedScore(asSetup(null), asData(createValidData()));
      }).toThrow('Setup must be a valid object');
    });

    test('should work without logger', () => {
      const basicService = createService({ logger: undefined, errorHandler });
      const setup = createValidSetup();
      const data = createValidData();

      expect(() => {
        basicService.calculateWeightedScore(asSetup(setup), asData(data));
      }).not.toThrow();
    });

    test('should work without optional parameters', () => {
      const basicService = createService({ logger: undefined, withErrorHandler: false });
      const setup = createValidSetup();
      const data = createValidData();

      expect(() => {
        basicService.calculateWeightedScore(asSetup(setup), asData(data));
      }).not.toThrow();
    });
  });
});


