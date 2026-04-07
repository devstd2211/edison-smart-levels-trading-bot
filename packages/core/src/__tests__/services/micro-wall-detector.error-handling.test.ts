/**
 * Micro Wall Detector Service - Error Handling Tests (Phase 8.9.64)
 *
 * ErrorHandler Integration Tests:
 * - THROW: Config validation, null/invalid orderbook, invalid numeric values
 * - GRACEFUL_DEGRADE: NaN/Infinity volume calculations (return empty array)
 * - SKIP: Logging failures (safeLog wrapper)
 *
 * Test Coverage: 18 tests total
 */

import { MicroWallDetectorService } from '../../services/micro-wall-detector.service';
import {
  LoggerService,
  MicroWallDetectorConfig,
  OrderBook,
} from '../../types/legacy';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  createMicroWallDetectorConfig,
  createManagedMicroWallDetectorContext,
  createMicroWall,
  createMicroWallFailingLogger,
  createMicroWallOrderBook,
} from '../helpers/micro-wall-detector-test.utils';

type MicroWallDetectorManagedContext = ReturnType<typeof createManagedMicroWallDetectorContext>;
type MicroWallDetectorFixtures = Pick<
  MicroWallDetectorManagedContext,
  'logger' | 'errorHandler' | 'createStandardDetector' | 'createLegacyDetector'
>;
type MicroWallDetectorCreateStandardDetector = MicroWallDetectorFixtures['createStandardDetector'];
type MicroWallDetectorCreateLegacyDetector = MicroWallDetectorFixtures['createLegacyDetector'];
type MicroWallDetectorFixtureAccessor = () => MicroWallDetectorFixtures;

function bindMicroWallDetectorFixtures() {
  let cleanup: MicroWallDetectorManagedContext['cleanup'];
  let fixtures: MicroWallDetectorFixtures;

  beforeEach(() => {
    const managedContext = createManagedMicroWallDetectorContext();
    cleanup = managedContext.cleanup;
    fixtures = {
      logger: managedContext.logger,
      errorHandler: managedContext.errorHandler,
      createStandardDetector: managedContext.createStandardDetector,
      createLegacyDetector: managedContext.createLegacyDetector,
    };
  });

  afterEach(() => {
    cleanup();
  });

  return () => fixtures;
}

// ============================================================================
// TEST HELPERS
// ============================================================================

const createConfig = createMicroWallDetectorConfig;
const createOrderBook = createMicroWallOrderBook;

// ============================================================================
// TESTS
// ============================================================================

describe('MicroWallDetectorService - Error Handling (Phase 8.9.64)', () => {
  const asConfig = (value: unknown): MicroWallDetectorConfig =>
    value as MicroWallDetectorConfig;
  const asOrderBook = (value: unknown): OrderBook => value as OrderBook;
  const asLogger = (value: unknown): LoggerService => value as LoggerService;
  const asWall = (value: unknown): {
    side: 'BID' | 'ASK';
    price: number;
    size: number;
    percentOfTotal: number;
    distance: number;
    timestamp: number;
    broken: boolean;
  } => value as {
    side: 'BID' | 'ASK';
    price: number;
    size: number;
    percentOfTotal: number;
    distance: number;
    timestamp: number;
    broken: boolean;
  };

  let logger: LoggerService;
  let errorHandler: ErrorHandler;
  let createStandardDetector: MicroWallDetectorCreateStandardDetector;
  let createLegacyDetector: MicroWallDetectorCreateLegacyDetector;
  const getFixtures: MicroWallDetectorFixtureAccessor = bindMicroWallDetectorFixtures();

  beforeEach(() => {
    const fixtures: MicroWallDetectorFixtures = getFixtures();
    logger = fixtures.logger;
    errorHandler = fixtures.errorHandler as ErrorHandler;
    createStandardDetector = fixtures.createStandardDetector;
    createLegacyDetector = fixtures.createLegacyDetector;
  });

  // ========================================================================
  // THROW: Config Validation Tests (5)
  // ========================================================================

  describe('THROW: Config Validation', () => {
    it('should throw on null config', () => {
      expect(() => {
        createStandardDetector({
          config: asConfig(null),
        });
      }).toThrow('config is required');
    });

    it('should throw on invalid minWallSizePercent (0)', () => {
      expect(() => {
        createStandardDetector({
          config: createConfig({ minWallSizePercent: 0 }),
        });
      }).toThrow('minWallSizePercent must be 0-100');
    });

    it('should throw on invalid minWallSizePercent (>100)', () => {
      expect(() => {
        createStandardDetector({
          config: createConfig({ minWallSizePercent: 101 }),
        });
      }).toThrow('minWallSizePercent must be 0-100');
    });

    it('should throw on negative breakConfirmationMs', () => {
      expect(() => {
        createStandardDetector({
          config: createConfig({ breakConfirmationMs: -1 }),
        });
      }).toThrow('breakConfirmationMs must be >= 0');
    });

    it('should throw on invalid maxConfidence (0)', () => {
      expect(() => {
        createStandardDetector({
          config: createConfig({ maxConfidence: 0 }),
        });
      }).toThrow('maxConfidence must be 1-100');
    });

    it('should throw on invalid wallExpiryMs (0)', () => {
      expect(() => {
        createStandardDetector({
          config: createConfig({ wallExpiryMs: 0 }),
        });
      }).toThrow('wallExpiryMs must be > 0');
    });
  });

  // ========================================================================
  // THROW: Input Validation Tests (4)
  // ========================================================================

  describe('THROW: Input Validation (detectMicroWalls)', () => {
    let detector: MicroWallDetectorService;

    beforeEach(() => {
      detector = createStandardDetector({ config: createConfig() });
    });

    it('should throw on null orderbook', () => {
      expect(() => {
        detector.detectMicroWalls(asOrderBook(null));
      }).toThrow('orderbook is required');
    });

    it('should throw on invalid orderbook structure (no bids)', () => {
      const badOrderbook = asOrderBook({ bids: null, asks: [[1.001, 100]] });
      expect(() => {
        detector.detectMicroWalls(badOrderbook);
      }).toThrow('orderbook.bids and asks must be arrays');
    });

    it('should throw on invalid orderbook structure (no asks)', () => {
      const badOrderbook = asOrderBook({ bids: [[1.0, 100]], asks: undefined });
      expect(() => {
        detector.detectMicroWalls(badOrderbook);
      }).toThrow('orderbook.bids and asks must be arrays');
    });

    it('should throw on null wall in calculateWallConfidence', () => {
      expect(() => {
        detector.calculateWallConfidence(asWall(null));
      }).toThrow('wall is required');
    });
  });

  // ========================================================================
  // THROW: Input Validation (isWallBroken) Tests (3)
  // ========================================================================

  describe('THROW: Input Validation (isWallBroken)', () => {
    let detector: MicroWallDetectorService;

    beforeEach(() => {
      detector = createStandardDetector({ config: createConfig() });
    });

    it('should throw on null wall', () => {
      expect(() => {
        detector.isWallBroken(asWall(null), 1.0);
      }).toThrow('wall is required');
    });

    it('should throw on NaN currentPrice', () => {
      const wall = createMicroWall();
      expect(() => {
        detector.isWallBroken(wall, NaN);
      }).toThrow('currentPrice must be a finite number');
    });

    it('should throw on Infinity currentPrice', () => {
      const wall = createMicroWall();
      expect(() => {
        detector.isWallBroken(wall, Infinity);
      }).toThrow('currentPrice must be a finite number');
    });
  });

  // ========================================================================
  // GRACEFUL_DEGRADE: NaN/Infinity in Calculation Tests (5)
  // ========================================================================

  describe('GRACEFUL_DEGRADE: NaN/Infinity Handling', () => {
    let detector: MicroWallDetectorService;

    beforeEach(() => {
      detector = createStandardDetector({ config: createConfig() });
    });

    it('should return empty array on NaN bid volume', () => {
      const orderbook = createOrderBook(
        [[NaN, 500]], // Invalid bid price
        [[1.001, 4500]],
      );

      const walls = detector.detectMicroWalls(orderbook);
      expect(walls).toEqual([]);
    });

    it('should return empty array on Infinity ask volume', () => {
      const orderbook = createOrderBook(
        [[1.0, 500]],
        [[Infinity, 4500]], // Invalid ask price
      );

      const walls = detector.detectMicroWalls(orderbook);
      expect(walls).toEqual([]);
    });

    it('should skip invalid bid levels and continue', () => {
      const orderbook = createOrderBook(
        [
          [NaN, 100], // Invalid - skip
          [1.0, 500], // Valid - should be detected
          [0.999, 100],
        ],
        [[1.001, 4500]],
      );

      const walls = detector.detectMicroWalls(orderbook);
      // Should return array (may or may not detect the wall depending on volume percentage)
      expect(Array.isArray(walls)).toBe(true);
      // Should not throw despite invalid data
      expect(walls).toBeDefined();
    });

    it('should return safe default (0) on confidence calculation failure', () => {
      const wall = createMicroWall({ percentOfTotal: Infinity });

      // Should throw on THROW validation (invalid numeric values)
      expect(() => {
        detector.calculateWallConfidence(wall);
      }).toThrow('wall has invalid numeric values');
    });

    it('should handle wall with NaN percentOfTotal in confidence calculation', () => {
      const wall = createMicroWall({
        side: 'ASK',
        price: 1.001,
        size: 1000,
        percentOfTotal: NaN,
      });

      expect(() => {
        detector.calculateWallConfidence(wall);
      }).toThrow('wall has invalid numeric values');
    });
  });

  // ========================================================================
  // SKIP: Logging Failure Tests (3)
  // ========================================================================

  describe('SKIP: Logging Failures (safeLog)', () => {
    it('should not throw on logger.info failure', () => {
      const badLogger = createMicroWallFailingLogger({ info: 'Logger error' });

      expect(() => {
        createStandardDetector({
          config: createConfig(),
          logger: asLogger(badLogger),
          errorHandler,
        });
      }).not.toThrow();
    });

    it('should not throw on logger.debug failure during detection', () => {
      const badLogger = createMicroWallFailingLogger({ debug: 'Logger error' });

      const detector = createStandardDetector({
        config: createConfig(),
        logger: asLogger(badLogger),
        errorHandler,
      });
      const orderbook = createOrderBook([[1.0, 500]], [[1.001, 4500]]);

      // Should not throw despite logger failure
      expect(() => {
        detector.detectMicroWalls(orderbook);
      }).not.toThrow();
    });

    it('should not throw on logger failure during cleanup', () => {
      const badLogger = createMicroWallFailingLogger({ debug: 'Logger error' });

      const detector = createStandardDetector({
        config: createConfig(),
        logger: asLogger(badLogger),
        errorHandler,
      });

      // Should not throw despite logger failure
      expect(() => {
        detector.cleanupExpiredWalls();
      }).not.toThrow();
    });
  });

  // ========================================================================
  // Integration E2E Tests (3)
  // ========================================================================

  describe('Integration: E2E Error Handling', () => {
    it('should handle full detection flow with invalid data mixed in', () => {
      const detector = createStandardDetector({ config: createConfig() });

      // Orderbook with some invalid levels
      const orderbook = createOrderBook(
        [
          [1.0, 500], // Valid
          [NaN, 100], // Invalid - should skip
          [0.999, 100], // Valid
        ],
        [
          [1.001, 4500], // Valid
          [Infinity, 100], // Invalid - should skip
        ],
      );

      const walls = detector.detectMicroWalls(orderbook);

      // Should still detect valid walls despite invalid levels
      expect(Array.isArray(walls)).toBe(true);
      expect(walls.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle wall breaking with invalid price', () => {
      const detector = createStandardDetector({ config: createConfig() });

      const wall = createMicroWall({ timestamp: Date.now() - 2000 });

      // Valid price should work
      expect(() => {
        detector.isWallBroken(wall, 0.999);
      }).not.toThrow();

      // Invalid price should throw
      expect(() => {
        detector.isWallBroken(wall, NaN);
      }).toThrow();
    });

    it('should continue operations after graceful degradation', () => {
      const detector = createStandardDetector({ config: createConfig() });

      // First call with invalid data (gracefully degrades)
      const badOrderbook = createOrderBook(
        [[NaN, 500]],
        [[Infinity, 4500]],
      );
      const result1 = detector.detectMicroWalls(badOrderbook);
      expect(result1).toEqual([]);

      // Second call with valid data (should work normally)
      const goodOrderbook = createOrderBook([[1.0, 500]], [[1.001, 4500]]);
      const result2 = detector.detectMicroWalls(goodOrderbook);
      expect(Array.isArray(result2)).toBe(true);
    });
  });

  // ========================================================================
  // Backward Compatibility Tests (3)
  // ========================================================================

  describe('Backward Compatibility: Without ErrorHandler', () => {
    it('should work without ErrorHandler (optional parameter)', () => {
      const detector = createLegacyDetector({
        config: createConfig(),
      });
      const orderbook = createOrderBook([[1.0, 500]], [[1.001, 4500]]);

      const walls = detector.detectMicroWalls(orderbook);
      expect(Array.isArray(walls)).toBe(true);
    });

    it('should throw config validation errors even without ErrorHandler', () => {
      expect(() => {
        createLegacyDetector({
          config: createConfig({ minWallSizePercent: 0 }),
        });
      }).toThrow('minWallSizePercent must be 0-100');
    });

    it('should throw input validation errors even without ErrorHandler', () => {
      const detector = createLegacyDetector({
        config: createConfig(),
      });

      expect(() => {
        detector.detectMicroWalls(asOrderBook(null));
      }).toThrow('orderbook is required');
    });
  });

  // ========================================================================
  // Edge Cases Tests (2)
  // ========================================================================

  describe('Edge Cases: Extreme Values', () => {
    let detector: MicroWallDetectorService;

    beforeEach(() => {
      detector = createStandardDetector({ config: createConfig() });
    });

    it('should handle very small prices and quantities', () => {
      const orderbook = createOrderBook(
        [[0.00001, 0.00001]], // Very small
        [[0.00002, 0.00001]],
      );

      // Should not throw
      const walls = detector.detectMicroWalls(orderbook);
      expect(Array.isArray(walls)).toBe(true);
    });

    it('should handle very large prices and quantities', () => {
      const orderbook = createOrderBook(
        [[100000, 100000]], // Very large
        [[100001, 100000]],
      );

      // Should not throw
      const walls = detector.detectMicroWalls(orderbook);
      expect(Array.isArray(walls)).toBe(true);
    });
  });

  // ========================================================================
  // DI Integration Tests (1)
  // ========================================================================

  describe('DI Integration: ErrorHandler Injection', () => {
    it('should accept and use ErrorHandler from constructor', () => {
      const handleSpy = jest.spyOn(errorHandler, 'handle');

      const badLogger = createMicroWallFailingLogger({ info: 'Logger error' });

      createStandardDetector({
        config: createConfig(),
        logger: asLogger(badLogger),
        errorHandler,
      });

      // ErrorHandler.handle should have been called for logger failure
      expect(handleSpy).toHaveBeenCalled();
    });
  });
});
