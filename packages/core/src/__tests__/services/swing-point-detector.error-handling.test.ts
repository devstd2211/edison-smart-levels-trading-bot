import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SwingPointDetectorService } from '../../services/swing-point-detector.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import {
  IndicatorCalculationError,
  CandleDataMissingError,
  ValidationError,
} from '../../errors/DomainErrors';
import { Candle, SwingPointType, LoggerService } from '../../types/legacy';
import {
  asSwingPointDetectorCandles,
  asSwingPointDetectorSwingPoints,
  createSwingPoint,
  createSwingPointDetectorCandleArray,
  createSwingPointDetectorFailingLogger,
  createManagedSwingPointDetectorContext,
  createSwingPointDetectorInvalidCandle,
  createSwingPointDetectorMockErrorHandler,
  createSwingPointDetectorMockLogger,
} from '../helpers/swing-point-detector-test.utils';

type ManagedSwingPointDetectorFixtures = ReturnType<typeof createManagedSwingPointDetectorContext>;
type SwingPointDetectorFixtureState = {
  runtime: Pick<ManagedSwingPointDetectorFixtures, 'logger' | 'errorHandler' | 'service'>;
  factories: Pick<ManagedSwingPointDetectorFixtures, 'createService'>;
  cleanup: ManagedSwingPointDetectorFixtures['cleanup'];
};
type SwingPointDetectorFixtures = Omit<SwingPointDetectorFixtureState, 'cleanup'>;

function bindSwingPointDetectorFixtures(): () => SwingPointDetectorFixtures {
  let fixtureState: SwingPointDetectorFixtureState;

  beforeEach(() => {
    const managedContext = createManagedSwingPointDetectorContext({
      logger: createSwingPointDetectorMockLogger(),
      errorHandler: createSwingPointDetectorMockErrorHandler(),
    });
    fixtureState = {
      runtime: {
        logger: managedContext.logger,
        errorHandler: managedContext.errorHandler as ErrorHandler,
        service: managedContext.service,
      },
      factories: {
        createService: managedContext.createService,
      },
      cleanup: managedContext.cleanup,
    };
  });

  afterEach(() => {
    fixtureState.cleanup();
  });

  return () => ({
    runtime: fixtureState.runtime,
    factories: fixtureState.factories,
  });
}

describe('Phase 8.9.44: SwingPointDetectorService - ErrorHandler Integration', () => {
  let mockLogger: LoggerService;
  let mockErrorHandler: ErrorHandler;
  let service: SwingPointDetectorService;
  let createService: SwingPointDetectorFixtures['factories']['createService'];
  const getFixtures = bindSwingPointDetectorFixtures();

  beforeEach(() => {
    const { runtime, factories } = getFixtures();
    ({
      logger: mockLogger,
      service,
    } = runtime);
    mockErrorHandler = runtime.errorHandler as ErrorHandler;
    ({ createService } = factories);
  });

  describe('A. detectSwingPoints() Errors - GRACEFUL_DEGRADE (5 tests)', () => {
    it('test-A1: Return empty arrays for null candles input', () => {
      const result = service.detectSwingPoints(asSwingPointDetectorCandles(null));

      expect(result.highs).toEqual([]);
      expect(result.lows).toEqual([]);
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(ValidationError),
        expect.objectContaining({
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'SwingPointDetectorService.detectSwingPoints',
        }),
      );
    });

    it('test-A2: Return empty arrays for insufficient candles', () => {
      const candles = createSwingPointDetectorCandleArray(3);

      const result = service.detectSwingPoints(candles);

      expect(result.highs).toEqual([]);
      expect(result.lows).toEqual([]);
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(CandleDataMissingError),
        expect.objectContaining({
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        }),
      );
    });

    it('test-A3: Skip candles with NaN prices', () => {
      const candles = createSwingPointDetectorCandleArray(7);
      candles[3] = createSwingPointDetectorInvalidCandle();
      candles[4] = createSwingPointDetectorInvalidCandle({ high: 108, low: NaN });

      const result = service.detectSwingPoints(candles);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid candle price'),
        expect.any(Object),
      );
      expect(Array.isArray(result.highs)).toBe(true);
      expect(Array.isArray(result.lows)).toBe(true);
    });

    it('test-A4: Skip candles with Infinity prices', () => {
      const candles = createSwingPointDetectorCandleArray(7);
      candles[3] = createSwingPointDetectorInvalidCandle({ high: Infinity });
      candles[4] = createSwingPointDetectorInvalidCandle({ high: 109, low: -Infinity });

      const result = service.detectSwingPoints(candles);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid candle price'),
        expect.any(Object),
      );
      expect(Array.isArray(result.highs)).toBe(true);
      expect(Array.isArray(result.lows)).toBe(true);
    });

    it('test-A5: Return empty arrays on algorithm exception', () => {
      const candles = createSwingPointDetectorCandleArray(5) as Candle[];
      Object.defineProperty(candles[2], 'high', {
        get() {
          throw new Error('Unexpected access');
        },
      });

      const result = service.detectSwingPoints(candles);

      expect(result.highs).toEqual([]);
      expect(result.lows).toEqual([]);
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(IndicatorCalculationError),
        expect.objectContaining({
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'SwingPointDetectorService.detectSwingPoints',
        }),
      );
    });
  });

  describe('B. Logging Failures - SKIP Strategy (3 tests)', () => {
    it('test-B1: Skip logger.debug() failures during detection', () => {
      mockLogger = createSwingPointDetectorFailingLogger('debug');
      service = createService({ logger: mockLogger });
      const candles = createSwingPointDetectorCandleArray(5);

      const result = service.detectSwingPoints(candles);

      expect(Array.isArray(result.highs)).toBe(true);
      expect(Array.isArray(result.lows)).toBe(true);
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          strategy: RecoveryStrategy.SKIP,
        }),
      );
    });

    it('test-B2: Skip logger.warn() failures', () => {
      mockLogger = createSwingPointDetectorFailingLogger('warn');
      service = createService({ logger: mockLogger });
      const candles = createSwingPointDetectorCandleArray(5);
      candles[2] = createSwingPointDetectorInvalidCandle();

      const result = service.detectSwingPoints(candles);

      expect(Array.isArray(result.highs)).toBe(true);
      expect(Array.isArray(result.lows)).toBe(true);
    });

    it('test-B3: Skip constructor logger.info() failures', () => {
      mockLogger = createSwingPointDetectorFailingLogger('info');
      mockErrorHandler = createSwingPointDetectorMockErrorHandler();
      service = createService({ logger: mockLogger, errorHandler: mockErrorHandler });

      expect(service).toBeDefined();
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          strategy: RecoveryStrategy.SKIP,
        }),
      );
    });
  });

  describe('C. Pattern Detection Errors - GRACEFUL_DEGRADE (4 tests)', () => {
    it('test-C1: Return false for isHigherHigherLow with NaN prices', () => {
      const candles = createSwingPointDetectorCandleArray(7);
      const { highs, lows } = service.detectSwingPoints(candles);
      const corruptedHighs = highs.map((h, i) => (i === highs.length - 1 ? { ...h, price: NaN } : h));

      const result = service.isHigherHigherLow(corruptedHighs, lows);

      expect(result).toBe(false);
    });

    it('test-C2: Return false for isLowerHigherLow with invalid data', () => {
      const candles = createSwingPointDetectorCandleArray(7);
      const { highs, lows } = service.detectSwingPoints(candles);

      if (highs.length > 1) {
        (highs[0] as unknown as { price: number }).price = Infinity;
      }

      const result = service.isLowerHigherLow(highs, lows);

      expect(result).toBe(false);
    });

    it('test-C3: Return neutral strength (0.3) on calculation error', () => {
      const result = service.calculateStrengthFromSwingPoints('BULLISH', [], []);
      expect(result).toBe(0.5);

      mockErrorHandler = createSwingPointDetectorMockErrorHandler();
      service = createService({ errorHandler: mockErrorHandler });
      const resultInvalid = service.calculateStrengthFromSwingPoints(
        'NEUTRAL',
        asSwingPointDetectorSwingPoints(undefined),
        asSwingPointDetectorSwingPoints(undefined),
      );

      expect(resultInvalid).toBe(0.3);
    });

    it('test-C4: Handle empty swing point arrays gracefully', () => {
      const bullishResult = service.calculateStrengthFromSwingPoints('BULLISH', [], []);
      const bearishResult = service.calculateStrengthFromSwingPoints('BEARISH', [], []);
      const neutralResult = service.calculateStrengthFromSwingPoints('NEUTRAL', [], []);

      expect(bullishResult).toBe(0.5);
      expect(bearishResult).toBe(0.5);
      expect(neutralResult).toBe(0.3);
    });
  });

  describe('D. Integration & E2E (4 tests)', () => {
    it('test-D1: Full detection workflow with mixed valid/invalid candles', () => {
      const candles = createSwingPointDetectorCandleArray(10);
      candles[3] = createSwingPointDetectorInvalidCandle();
      candles[7] = createSwingPointDetectorInvalidCandle({ high: 112, low: Infinity });
      candles[4] = createSwingPointDetectorInvalidCandle({ high: 90, low: 91 });

      const result = service.detectSwingPoints(candles);

      expect(Array.isArray(result.highs)).toBe(true);
      expect(Array.isArray(result.lows)).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('test-D2: Pattern detection after failed swing point detection', () => {
      const result = service.detectSwingPoints(createSwingPointDetectorCandleArray(2));
      const bullishPattern = service.isHigherHigherLow(result.highs, result.lows);
      const bearishPattern = service.isLowerHigherLow(result.highs, result.lows);

      expect(bullishPattern).toBe(false);
      expect(bearishPattern).toBe(false);
    });

    it('test-D3: Cascading failures (detection → pattern → strength)', () => {
      const detectionResult = service.detectSwingPoints(asSwingPointDetectorCandles(null));
      const patternResult = service.isHigherHigherLow(detectionResult.highs, detectionResult.lows);
      const strength = service.calculateStrengthFromSwingPoints(
        'BULLISH',
        detectionResult.highs,
        detectionResult.lows,
      );

      expect(patternResult).toBe(false);
      expect(strength).toBe(0.5);
    });

    it('test-D4: High-frequency detection with intermittent errors', () => {
      let validResults = 0;
      for (let i = 0; i < 5; i++) {
        let candles = createSwingPointDetectorCandleArray(7);
        if (i === 2) {
          candles = asSwingPointDetectorCandles(null);
        }
        const result = service.detectSwingPoints(candles);
        if (Array.isArray(result.highs) && Array.isArray(result.lows)) {
          validResults++;
        }
      }

      expect(validResults).toBeGreaterThan(0);
    });
  });

  describe('E. Backward Compatibility (2 tests)', () => {
    it('test-E1: Works without ErrorHandler parameter', () => {
      service = createService({ withErrorHandler: false });

      const candles = createSwingPointDetectorCandleArray(7);
      const result = service.detectSwingPoints(candles);

      expect(Array.isArray(result.highs)).toBe(true);
      expect(Array.isArray(result.lows)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('test-E2: Throws on validation error without ErrorHandler', () => {
      expect(() => {
        createService({ lookbackPeriod: 0, withErrorHandler: false });
      }).toThrow(ValidationError);

      expect(() => {
        createService({ lookbackPeriod: -5, withErrorHandler: false });
      }).toThrow(ValidationError);
    });
  });

  describe('F. Strength Calculation Edge Cases (2 bonus tests)', () => {
    it('test-F1: Correctly calculate strength for different point counts', () => {
      const emptyStrength = service.calculateStrengthFromSwingPoints('BULLISH', [], []);
      const weakStrength = service.calculateStrengthFromSwingPoints(
        'BULLISH',
        [createSwingPoint(100, SwingPointType.HIGH)],
        [],
      );
      const mediumStrength = service.calculateStrengthFromSwingPoints(
        'BULLISH',
        [
          createSwingPoint(100, SwingPointType.HIGH),
          createSwingPoint(102, SwingPointType.HIGH),
          createSwingPoint(104, SwingPointType.HIGH),
        ],
        [],
      );
      const strongStrength = service.calculateStrengthFromSwingPoints(
        'BULLISH',
        Array(6).fill(createSwingPoint(100, SwingPointType.HIGH)),
        Array(6).fill(createSwingPoint(50, SwingPointType.LOW)),
      );

      expect(emptyStrength).toBe(0.5);
      expect(weakStrength).toBe(0.5);
      expect(mediumStrength).toBe(0.7);
      expect(strongStrength).toBe(0.9);
    });

    it('test-F2: Handle NEUTRAL bias correctly in strength calculation', () => {
      const neutralStrength = service.calculateStrengthFromSwingPoints(
        'NEUTRAL',
        Array(10).fill(createSwingPoint(100, SwingPointType.HIGH)),
        Array(10).fill(createSwingPoint(50, SwingPointType.LOW)),
      );

      expect(neutralStrength).toBe(0.3);
    });
  });
});
