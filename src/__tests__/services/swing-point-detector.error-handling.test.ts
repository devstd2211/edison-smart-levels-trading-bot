/**
 * Phase 8.9.44: SwingPointDetectorService - ErrorHandler Integration Tests
 *
 * Tests ErrorHandler integration in SwingPointDetectorService with:
 * - THROW strategy for constructor validation
 * - GRACEFUL_DEGRADE strategy for detection/pattern failures (return empty/false/neutral)
 * - SKIP strategy for logging failures (non-blocking)
 * - Safe defaults on errors
 *
 * Total: 18 comprehensive tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SwingPointDetectorService } from '../../services/swing-point-detector.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import {
  IndicatorCalculationError,
  CandleDataMissingError,
  ValidationError,
} from '../../errors/DomainErrors';
import { Candle, SwingPointType, LoggerService } from '../../types';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create mock candle for testing
 */
function createMockCandle(overrides?: Partial<Candle>): Candle {
  return {
    timestamp: Date.now(),
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    volume: 1000,
    ...overrides,
  };
}

/**
 * Create array of valid candles with swing patterns
 */
function createValidCandleArray(count: number): Candle[] {
  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    candles.push(
      createMockCandle({
        timestamp: Date.now() + i * 60000,
        open: 100 + i,
        high: 105 + i,
        low: 95 + i,
        close: 102 + i,
      })
    );
  }
  return candles;
}

/**
 * Create mock logger that throws on specific methods
 */
function createFailingLogger(methodToFail?: string): LoggerService {
  return {
    info: jest.fn<any>((_msg: string, _meta?: any) => {
      if (methodToFail === 'info') throw new Error('Logger.info failed');
    }),
    warn: jest.fn<any>((_msg: string, _meta?: any) => {
      if (methodToFail === 'warn') throw new Error('Logger.warn failed');
    }),
    debug: jest.fn<any>((_msg: string, _meta?: any) => {
      if (methodToFail === 'debug') throw new Error('Logger.debug failed');
    }),
    error: jest.fn<any>((_msg: string, _meta?: any) => {
      if (methodToFail === 'error') throw new Error('Logger.error failed');
    }),
  } as any;
}

/**
 * Create mock ErrorHandler for testing
 */
function createMockErrorHandler(): ErrorHandler {
  return {
    handle: jest.fn<any>(),
    handleAsync: jest.fn<any>(),
  } as any;
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Phase 8.9.44: SwingPointDetectorService - ErrorHandler Integration', () => {
  let mockLogger: LoggerService;
  let mockErrorHandler: ErrorHandler;
  let service: SwingPointDetectorService;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn<any>(),
      warn: jest.fn<any>(),
      debug: jest.fn<any>(),
      error: jest.fn<any>(),
    } as any;
    mockErrorHandler = createMockErrorHandler();
  });

  // ========================================================================
  // A. detectSwingPoints() Errors - GRACEFUL_DEGRADE (5 tests)
  // ========================================================================

  describe('A. detectSwingPoints() Errors - GRACEFUL_DEGRADE (5 tests)', () => {
    it('test-A1: Return empty arrays for null candles input', () => {
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);

      const result = service.detectSwingPoints(null as any);

      expect(result.highs).toEqual([]);
      expect(result.lows).toEqual([]);
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(ValidationError),
        expect.objectContaining({
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'SwingPointDetectorService.detectSwingPoints',
        })
      );
    });

    it('test-A2: Return empty arrays for insufficient candles', () => {
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);
      const candles = createValidCandleArray(3); // Need at least 5

      const result = service.detectSwingPoints(candles);

      expect(result.highs).toEqual([]);
      expect(result.lows).toEqual([]);
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(CandleDataMissingError),
        expect.objectContaining({
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        })
      );
    });

    it('test-A3: Skip candles with NaN prices', () => {
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);
      const candles = createValidCandleArray(7);
      // Inject NaN in middle candles
      candles[3].high = NaN;
      candles[4].low = NaN;

      const result = service.detectSwingPoints(candles);

      // Should still return results from valid candles, skipping NaN ones
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid candle price'),
        expect.any(Object)
      );
      expect(Array.isArray(result.highs)).toBe(true);
      expect(Array.isArray(result.lows)).toBe(true);
    });

    it('test-A4: Skip candles with Infinity prices', () => {
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);
      const candles = createValidCandleArray(7);
      // Inject Infinity in middle candles
      candles[3].high = Infinity;
      candles[4].low = -Infinity;

      const result = service.detectSwingPoints(candles);

      // Should skip invalid candles
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid candle price'),
        expect.any(Object)
      );
      expect(Array.isArray(result.highs)).toBe(true);
      expect(Array.isArray(result.lows)).toBe(true);
    });

    it('test-A5: Return empty arrays on algorithm exception', () => {
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);
      // Create candles that will cause unexpected error
      const candles: any = createValidCandleArray(5);
      // Modify to cause error in comparison logic
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
        })
      );
    });
  });

  // ========================================================================
  // B. Logging Failures - SKIP Strategy (3 tests)
  // ========================================================================

  describe('B. Logging Failures - SKIP Strategy (3 tests)', () => {
    it('test-B1: Skip logger.debug() failures during detection', () => {
      mockLogger = createFailingLogger('debug');
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);
      const candles = createValidCandleArray(5);

      // Should not throw despite logger.debug failing
      const result = service.detectSwingPoints(candles);

      expect(Array.isArray(result.highs)).toBe(true);
      expect(Array.isArray(result.lows)).toBe(true);
      // ErrorHandler should be called with SKIP strategy
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          strategy: RecoveryStrategy.SKIP,
        })
      );
    });

    it('test-B2: Skip logger.warn() failures', () => {
      mockLogger = createFailingLogger('warn');
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);
      const candles = createValidCandleArray(5);
      // Inject invalid candle to trigger logger.warn
      candles[2].high = NaN;

      // Should not throw despite logger.warn failing
      const result = service.detectSwingPoints(candles);

      expect(Array.isArray(result.highs)).toBe(true);
      expect(Array.isArray(result.lows)).toBe(true);
    });

    it('test-B3: Skip constructor logger.info() failures', () => {
      mockLogger = createFailingLogger('info');
      mockErrorHandler = createMockErrorHandler();

      // Should not throw during construction despite logger.info failing
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);

      expect(service).toBeDefined();
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          strategy: RecoveryStrategy.SKIP,
        })
      );
    });
  });

  // ========================================================================
  // C. Pattern Detection Errors - GRACEFUL_DEGRADE (4 tests)
  // ========================================================================

  describe('C. Pattern Detection Errors - GRACEFUL_DEGRADE (4 tests)', () => {
    it('test-C1: Return false for isHigherHigherLow with NaN prices', () => {
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);
      const candles = createValidCandleArray(7);
      const { highs, lows } = service.detectSwingPoints(candles);

      // Manually corrupt swing points with NaN
      const corruptedHighs = highs.map((h, i) => {
        if (i === highs.length - 1) {
          return { ...h, price: NaN };
        }
        return h;
      });

      const result = service.isHigherHigherLow(corruptedHighs, lows);

      expect(result).toBe(false);
    });

    it('test-C2: Return false for isLowerHigherLow with invalid data', () => {
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);
      const candles = createValidCandleArray(7);
      const { highs, lows } = service.detectSwingPoints(candles);

      // Inject Infinity into prices
      if (highs.length > 1) {
        (highs[0] as any).price = Infinity;
      }

      const result = service.isLowerHigherLow(highs, lows);

      expect(result).toBe(false);
    });

    it('test-C3: Return neutral strength (0.3) on calculation error', () => {
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);

      // Test with empty arrays to verify safe default behavior
      const result = service.calculateStrengthFromSwingPoints('BULLISH', [], []);

      // Empty arrays = 0-2 points = weak signal (0.5)
      expect(result).toBe(0.5);

      // Test with invalid input (non-array)
      mockErrorHandler = createMockErrorHandler();
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);

      const resultInvalid = service.calculateStrengthFromSwingPoints(
        'NEUTRAL',
        undefined as any,
        undefined as any
      );

      // Should return NEUTRAL (0.3) as safe default when hitting error
      expect(resultInvalid).toBe(0.3);
    });

    it('test-C4: Handle empty swing point arrays gracefully', () => {
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);

      const bullishResult = service.calculateStrengthFromSwingPoints('BULLISH', [], []);
      const bearishResult = service.calculateStrengthFromSwingPoints('BEARISH', [], []);
      const neutralResult = service.calculateStrengthFromSwingPoints('NEUTRAL', [], []);

      expect(bullishResult).toBe(0.5); // Weak signal (0-2 points)
      expect(bearishResult).toBe(0.5); // Weak signal (0-2 points)
      expect(neutralResult).toBe(0.3); // NEUTRAL
    });
  });

  // ========================================================================
  // D. Integration & E2E (4 tests)
  // ========================================================================

  describe('D. Integration & E2E (4 tests)', () => {
    it('test-D1: Full detection workflow with mixed valid/invalid candles', () => {
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);
      const candles = createValidCandleArray(10);

      // Mix in some invalid candles
      candles[3].high = NaN;
      candles[7].low = Infinity;
      candles[4].high = candles[4].low - 1; // high < low

      const result = service.detectSwingPoints(candles);

      // Should skip invalid candles and return valid detections
      expect(Array.isArray(result.highs)).toBe(true);
      expect(Array.isArray(result.lows)).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('test-D2: Pattern detection after failed swing point detection', () => {
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);

      // Run detection with insufficient data to force graceful degrade
      const result = service.detectSwingPoints(createValidCandleArray(2));

      // Try pattern detection on empty results
      const bullishPattern = service.isHigherHigherLow(result.highs, result.lows);
      const bearishPattern = service.isLowerHigherLow(result.highs, result.lows);

      expect(bullishPattern).toBe(false);
      expect(bearishPattern).toBe(false);
    });

    it('test-D3: Cascading failures (detection → pattern → strength)', () => {
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);

      // Start with invalid input
      const detectionResult = service.detectSwingPoints(null as any);

      // Use failed detection result for pattern analysis
      const patternResult = service.isHigherHigherLow(
        detectionResult.highs,
        detectionResult.lows
      );

      // Use failed pattern for strength calculation
      const strength = service.calculateStrengthFromSwingPoints(
        'BULLISH',
        detectionResult.highs,
        detectionResult.lows
      );

      expect(patternResult).toBe(false);
      expect(strength).toBe(0.5); // Weak (0-2 points)
    });

    it('test-D4: High-frequency detection with intermittent errors', () => {
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);

      // Run multiple detections with varying data quality
      let validResults = 0;
      for (let i = 0; i < 5; i++) {
        let candles = createValidCandleArray(7);
        if (i === 2) {
          // Corrupt one iteration
          candles = null as any;
        }
        const result = service.detectSwingPoints(candles);
        if (Array.isArray(result.highs) && Array.isArray(result.lows)) {
          validResults++;
        }
      }

      // Should recover after errors
      expect(validResults).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // E. Backward Compatibility (2 tests)
  // ========================================================================

  describe('E. Backward Compatibility (2 tests)', () => {
    it('test-E1: Works without ErrorHandler parameter', () => {
      // Constructor without ErrorHandler (optional parameter)
      service = new SwingPointDetectorService(mockLogger, 2);

      const candles = createValidCandleArray(7);
      const result = service.detectSwingPoints(candles);

      // Should work identically
      expect(Array.isArray(result.highs)).toBe(true);
      expect(Array.isArray(result.lows)).toBe(true);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('test-E2: Throws on validation error without ErrorHandler', () => {
      // Constructor with invalid lookbackPeriod, no ErrorHandler
      expect(() => {
        new SwingPointDetectorService(mockLogger, 0); // Invalid: must be >= 1
      }).toThrow(ValidationError);

      expect(() => {
        new SwingPointDetectorService(mockLogger, -5);
      }).toThrow(ValidationError);
    });
  });

  // ========================================================================
  // F. Strength Calculation Edge Cases (2 bonus tests)
  // ========================================================================

  describe('F. Strength Calculation Edge Cases (2 bonus tests)', () => {
    it('test-F1: Correctly calculate strength for different point counts', () => {
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);

      const emptyStrength = service.calculateStrengthFromSwingPoints('BULLISH', [], []);
      const weakStrength = service.calculateStrengthFromSwingPoints(
        'BULLISH',
        [{ price: 100, timestamp: Date.now(), type: SwingPointType.HIGH }],
        []
      );
      const mediumStrength = service.calculateStrengthFromSwingPoints(
        'BULLISH',
        [
          { price: 100, timestamp: Date.now(), type: SwingPointType.HIGH },
          { price: 102, timestamp: Date.now(), type: SwingPointType.HIGH },
          { price: 104, timestamp: Date.now(), type: SwingPointType.HIGH },
        ],
        []
      );
      const strongStrength = service.calculateStrengthFromSwingPoints(
        'BULLISH',
        Array(6).fill({ price: 100, timestamp: Date.now(), type: SwingPointType.HIGH }),
        Array(6).fill({ price: 50, timestamp: Date.now(), type: SwingPointType.LOW })
      );

      expect(emptyStrength).toBe(0.5); // 0-2 points = 50%
      expect(weakStrength).toBe(0.5); // 1 point = 50%
      expect(mediumStrength).toBe(0.7); // 3 points = 70%
      expect(strongStrength).toBe(0.9); // 12+ points = 90%
    });

    it('test-F2: Handle NEUTRAL bias correctly in strength calculation', () => {
      service = new SwingPointDetectorService(mockLogger, 2, mockErrorHandler);

      const neutralStrength = service.calculateStrengthFromSwingPoints(
        'NEUTRAL',
        Array(10).fill({ price: 100, timestamp: Date.now(), type: SwingPointType.HIGH }),
        Array(10).fill({ price: 50, timestamp: Date.now(), type: SwingPointType.LOW })
      );

      expect(neutralStrength).toBe(0.3); // NEUTRAL always = 30%
    });
  });
});
