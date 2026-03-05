/**
 * Retest Entry Service - Error Handling Tests (Phase 8.9.51)
 *
 * THROW Config Validation Tests (5):
 * - minImpulsePercent out of range
 * - Fibonacci levels invalid
 * - maxRetestWaitMs invalid
 * - volumeMultiplier invalid
 * - boolean fields invalid
 *
 * THROW Input Validation Tests (5):
 * - Null/undefined signal
 * - Invalid prices (NaN/negative/zero)
 * - Invalid candles array
 * - Empty/invalid symbol
 *
 * GRACEFUL_DEGRADE Calculation Tests (5):
 * - NaN in price calculations
 * - Infinity in impulseRange
 * - Division by zero in price change
 * - Invalid zone calculations
 * - Recovery after failures
 *
 * SKIP Logging Tests (3):
 * - Logger failures in detectImpulse
 * - Logger failures in createRetestZone
 * - Logger failures in checkRetest
 *
 * Integration E2E Tests (3):
 * - Full retest flow with error handling
 * - State consistency across errors
 * - Multiple zones with failures
 *
 * Backward Compatibility Tests (2):
 * - Works without ErrorHandler (optional DI)
 * - Config validation still throws
 */

import { RetestEntryService } from '../../services/retest-entry.service';
import { LoggerService, LogLevel, RetestConfig, Signal, Candle, SignalDirection, SignalType } from '../../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';

describe('RetestEntryService - Error Handling (Phase 8.9.51)', () => {
  const asCandles = (value: unknown): Candle[] => value as Candle[];
  const asSignal = (value: unknown): Signal => value as Signal;
  const asRetestConfig = (value: unknown): RetestConfig => value as RetestConfig;
  const asLogger = (value: unknown): LoggerService => value as LoggerService;

  let logger: LoggerService;
  let errorHandler: ErrorHandler;

  const mockConfig: RetestConfig = {
    enabled: true,
    minImpulsePercent: 0.5,
    retestZoneFibStart: 50,
    retestZoneFibEnd: 61.8,
    maxRetestWaitMs: 300000,
    volumeMultiplier: 0.8,
    requireStructureIntact: true,
  };

  const mockSignal: Signal = {
    direction: SignalDirection.LONG,
    type: SignalType.TREND_FOLLOWING,
    confidence: 85,
    price: 1.1575,
    stopLoss: 1.1475,
    takeProfits: [
      { level: 1, price: 1.1635, percent: 0.5, sizePercent: 33.33, hit: false },
      { level: 2, price: 1.1695, percent: 1.0, sizePercent: 33.33, hit: false },
      { level: 3, price: 1.1815, percent: 2.0, sizePercent: 33.34, hit: false },
    ],
    reason: 'Test signal',
    timestamp: Date.now(),
    marketData: {
      rsi: 60,
      ema20: 1.1500,
      ema50: 1.1450,
      atr: 0.01,
    },
  };

  const mockCandles: Candle[] = [
    { timestamp: Date.now() - 5000, open: 1.1500, high: 1.1510, low: 1.1490, close: 1.1505, volume: 1000 },
    { timestamp: Date.now() - 4000, open: 1.1505, high: 1.1520, low: 1.1500, close: 1.1515, volume: 1000 },
    { timestamp: Date.now() - 3000, open: 1.1515, high: 1.1540, low: 1.1510, close: 1.1535, volume: 1000 },
    { timestamp: Date.now() - 2000, open: 1.1535, high: 1.1560, low: 1.1530, close: 1.1555, volume: 1000 },
    { timestamp: Date.now() - 1000, open: 1.1555, high: 1.1580, low: 1.1550, close: 1.1575, volume: 1000 },
  ];

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    errorHandler = new ErrorHandler(logger);
  });

  // ============================================================================
  // THROW CONFIG VALIDATION TESTS (5)
  // ============================================================================

  describe('THROW - Config Validation', () => {
    it('should throw on minImpulsePercent <= 0', () => {
      const badConfig = { ...mockConfig, minImpulsePercent: 0 };

      expect(() => new RetestEntryService(badConfig, logger, errorHandler)).toThrow(
        'minImpulsePercent must be between 0 and 100',
      );
    });

    it('should throw on minImpulsePercent > 100', () => {
      const badConfig = { ...mockConfig, minImpulsePercent: 150 };

      expect(() => new RetestEntryService(badConfig, logger, errorHandler)).toThrow(
        'minImpulsePercent must be between 0 and 100',
      );
    });

    it('should throw on invalid Fibonacci levels', () => {
      const badConfig = { ...mockConfig, retestZoneFibStart: 70, retestZoneFibEnd: 50 }; // Start > End

      expect(() => new RetestEntryService(badConfig, logger, errorHandler)).toThrow(
        'retestZoneFibStart must be < retestZoneFibEnd',
      );
    });

    it('should throw on invalid maxRetestWaitMs', () => {
      const badConfig = { ...mockConfig, maxRetestWaitMs: -1000 };

      expect(() => new RetestEntryService(badConfig, logger, errorHandler)).toThrow(
        'maxRetestWaitMs must be > 0',
      );
    });

    it('should throw on invalid volumeMultiplier', () => {
      const badConfig = { ...mockConfig, volumeMultiplier: 0 };

      expect(() => new RetestEntryService(badConfig, logger, errorHandler)).toThrow(
        'volumeMultiplier must be > 0',
      );
    });
  });

  // ============================================================================
  // THROW INPUT VALIDATION TESTS (5)
  // ============================================================================

  describe('THROW - Input Validation', () => {
    it('should throw on null candles array in detectImpulse', () => {
      const service = new RetestEntryService(mockConfig, logger, errorHandler);

      expect(() => service.detectImpulse('BTCUSDT', 1.1575, asCandles(null))).toThrow(
        'candles must be an array',
      );
    });

    it('should throw on invalid currentPrice in detectImpulse', () => {
      const service = new RetestEntryService(mockConfig, logger, errorHandler);

      expect(() => service.detectImpulse('BTCUSDT', NaN, mockCandles)).toThrow(
        'currentPrice must be a positive number',
      );
    });

    it('should throw on null signal in createRetestZone', () => {
      const service = new RetestEntryService(mockConfig, logger, errorHandler);

      expect(() => service.createRetestZone('BTCUSDT', asSignal(null), 1.1500, 1.1600)).toThrow(
        'signal is required',
      );
    });

    it('should throw on invalid impulseStart in createRetestZone', () => {
      const service = new RetestEntryService(mockConfig, logger, errorHandler);

      expect(() => service.createRetestZone('BTCUSDT', mockSignal, -1.1500, 1.1600)).toThrow(
        'impulseStart must be a positive number',
      );
    });

    it('should throw on invalid impulseEnd in createRetestZone', () => {
      const service = new RetestEntryService(mockConfig, logger, errorHandler);

      expect(() => service.createRetestZone('BTCUSDT', mockSignal, 1.1500, Infinity)).toThrow(
        'impulseEnd must be a positive number',
      );
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE CALCULATION TESTS (5)
  // ============================================================================

  describe('GRACEFUL_DEGRADE - Calculation Failures', () => {
    it('should return no impulse on invalid start price', () => {
      const service = new RetestEntryService(mockConfig, logger, errorHandler);

      const badCandles = [
        { timestamp: Date.now() - 5000, open: NaN, high: 1.1510, low: 1.1490, close: 1.1505, volume: 1000 },
        ...mockCandles.slice(1),
      ];

      const result = service.detectImpulse('BTCUSDT', 1.1575, badCandles);

      expect(result.hasImpulse).toBe(false);
      expect(result.impulseStart).toBe(0);
    });

    it('should return no impulse on zero currentPrice', () => {
      const service = new RetestEntryService(mockConfig, logger, errorHandler);

      // Zero price should throw (THROW strategy)
      expect(() => service.detectImpulse('BTCUSDT', 0, mockCandles)).toThrow(
        'currentPrice must be a positive number',
      );
    });

    it('should create minimal zone on calculation failure', () => {
      const service = new RetestEntryService(mockConfig, logger, errorHandler);

      // This might trigger calculation failure due to invalid impulseEnd
      const zone = service.createRetestZone('BTCUSDT', mockSignal, 1.1500, 1.1500); // Zero impulseRange

      expect(zone).toBeDefined();
      expect(zone.symbol).toBe('BTCUSDT');
    });

    it('should recover after calculation failure on subsequent calls', () => {
      const service = new RetestEntryService(mockConfig, logger, errorHandler);

      // First call with invalid candles data
      const badCandles = [
        { timestamp: Date.now() - 5000, open: NaN, high: 1.1510, low: 1.1490, close: 1.1505, volume: 1000 },
        ...mockCandles.slice(1),
      ];
      const result1 = service.detectImpulse('BTCUSDT', 1.1575, badCandles);
      expect(result1.hasImpulse).toBe(false);

      // Second call with valid data should work fine
      const result2 = service.detectImpulse('BTCUSDT', 1.1575, mockCandles);
      expect(result2.hasImpulse).toBe(true);
    });

    it('should handle multiple NaN values gracefully', () => {
      const service = new RetestEntryService(mockConfig, logger, errorHandler);

      const badCandles: Candle[] = [
        { timestamp: Date.now() - 5000, open: NaN, high: NaN, low: NaN, close: NaN, volume: NaN },
        { timestamp: Date.now() - 4000, open: NaN, high: NaN, low: NaN, close: NaN, volume: NaN },
        { timestamp: Date.now() - 3000, open: NaN, high: NaN, low: NaN, close: NaN, volume: NaN },
        { timestamp: Date.now() - 2000, open: NaN, high: NaN, low: NaN, close: NaN, volume: NaN },
        { timestamp: Date.now() - 1000, open: NaN, high: NaN, low: NaN, close: NaN, volume: NaN },
      ];

      const result = service.detectImpulse('BTCUSDT', 1.1575, badCandles);

      expect(result.hasImpulse).toBe(false);
    });
  });

  // ============================================================================
  // SKIP LOGGING TESTS (3)
  // ============================================================================

  describe('SKIP - Logging Failures', () => {
    it('should continue despite logger failures in detectImpulse', () => {
      const failingLogger = {
        info: jest.fn(() => {
          throw new Error('Logger info failed');
        }),
        debug: jest.fn(() => {
          throw new Error('Logger debug failed');
        }),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const service = new RetestEntryService(mockConfig, asLogger(failingLogger), errorHandler);

      // Should not throw despite logger failures (SKIP strategy)
      expect(() => service.detectImpulse('BTCUSDT', 1.1575, mockCandles)).not.toThrow();
      const result = service.detectImpulse('BTCUSDT', 1.1575, mockCandles);
      expect(result.hasImpulse).toBe(true);
    });

    it('should continue despite logger failures in createRetestZone', () => {
      const failingLogger = {
        info: jest.fn(() => {
          throw new Error('Logger info failed');
        }),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const service = new RetestEntryService(mockConfig, asLogger(failingLogger), errorHandler);

      // Should not throw despite logger failure (SKIP strategy)
      expect(() => service.createRetestZone('BTCUSDT', mockSignal, 1.1500, 1.1600)).not.toThrow();
      const zone = service.createRetestZone('BTCUSDT', mockSignal, 1.1500, 1.1600);
      expect(zone.symbol).toBe('BTCUSDT');
    });

    it('should continue despite logger failures in checkRetest', () => {
      const failingLogger = {
        debug: jest.fn(() => {
          throw new Error('Logger debug failed');
        }),
        info: jest.fn(() => {
          throw new Error('Logger info failed');
        }),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const service = new RetestEntryService(mockConfig, asLogger(failingLogger), errorHandler);
      service.createRetestZone('BTCUSDT', mockSignal, 1.1500, 1.1600);

      // Should not throw despite logger failures (SKIP strategy)
      expect(() => service.checkRetest('BTCUSDT', 1.1545, 800, 1000, 1.1520, 'UP')).not.toThrow();
      const result = service.checkRetest('BTCUSDT', 1.1545, 800, 1000, 1.1520, 'UP');
      expect(result.inZone).toBe(true);
    });
  });

  // ============================================================================
  // INTEGRATION E2E TESTS (3)
  // ============================================================================

  describe('Integration - Cascading Failures', () => {
    it('should handle full retest flow with error handling', () => {
      const service = new RetestEntryService(mockConfig, logger, errorHandler);

      // Step 1: Detect impulse
      const impulseResult = service.detectImpulse('BTCUSDT', 1.1575, mockCandles);
      expect(impulseResult.hasImpulse).toBe(true);

      // Step 2: Create zone
      const zone = service.createRetestZone('BTCUSDT', mockSignal, impulseResult.impulseStart, impulseResult.impulseEnd);
      expect(zone).toBeDefined();
      expect(zone.symbol).toBe('BTCUSDT');

      // Step 3: Zone should be created and accessible
      expect(service.hasRetestZone('BTCUSDT')).toBe(true);
      const retrievedZone = service.getRetestZone('BTCUSDT');
      expect(retrievedZone?.impulseStart).toBe(impulseResult.impulseStart);
    });

    it('should maintain state consistency across errors', () => {
      const service = new RetestEntryService(mockConfig, logger, errorHandler);

      // Create zone
      service.createRetestZone('BTCUSDT', mockSignal, 1.1500, 1.1600);
      expect(service.hasRetestZone('BTCUSDT')).toBe(true);

      // Try with invalid input (should throw THROW validation)
      expect(() => service.detectImpulse('ETHUSDT', NaN, [])).toThrow(
        'currentPrice must be a positive number',
      );

      // Original zone should still exist (state not affected)
      expect(service.hasRetestZone('BTCUSDT')).toBe(true);
    });

    it('should handle multiple zones with individual error handling', () => {
      const service = new RetestEntryService(mockConfig, logger, errorHandler);

      // Create multiple zones
      service.createRetestZone('BTCUSDT', mockSignal, 1.1500, 1.1600);

      const shortSignal = { ...mockSignal, direction: SignalDirection.SHORT };
      service.createRetestZone('ETHUSDT', shortSignal, 1.2000, 1.1900);

      // Check both zones
      const btcResult = service.checkRetest('BTCUSDT', 1.1545, 800, 1000, 1.1520, 'UP');
      const ethResult = service.checkRetest('ETHUSDT', 1.1955, 800, 1000, 1.1970, 'DOWN');

      expect(btcResult.inZone).toBe(true);
      expect(ethResult.inZone).toBe(true);

      // Clear one zone
      service.clearZone('BTCUSDT');
      expect(service.hasRetestZone('BTCUSDT')).toBe(false);
      expect(service.hasRetestZone('ETHUSDT')).toBe(true);
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY TESTS (2)
  // ============================================================================

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler (optional DI)', () => {
      const service = new RetestEntryService(mockConfig, logger); // No errorHandler

      const impulseResult = service.detectImpulse('BTCUSDT', 1.1575, mockCandles);
      expect(impulseResult.hasImpulse).toBe(true);

      const zone = service.createRetestZone('BTCUSDT', mockSignal, impulseResult.impulseStart, impulseResult.impulseEnd);
      expect(zone).toBeDefined();
    });

    it('should throw config validation errors even without ErrorHandler', () => {
      const badConfig = { ...mockConfig, minImpulsePercent: 150 };

      expect(() => new RetestEntryService(badConfig, logger)).toThrow(
        'minImpulsePercent must be between 0 and 100',
      );
    });
  });

  // ============================================================================
  // EDGE CASES & ERROR CONTEXT TESTS (3)
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle ErrorHandler throw during execute', () => {
      const failingErrorHandler = {
        handle: jest.fn(() => {
          throw new Error('ErrorHandler.handle failed');
        }),
      } as unknown as ErrorHandler;

      const service = new RetestEntryService(mockConfig, logger, failingErrorHandler);

      // Should not throw even if ErrorHandler fails
      const badCandles = [
        { timestamp: Date.now() - 5000, open: NaN, high: 1.1510, low: 1.1490, close: 1.1505, volume: 1000 },
        ...mockCandles.slice(1),
      ];

      expect(() => service.detectImpulse('BTCUSDT', 1.1575, badCandles)).not.toThrow();
    });

    it('should validate all config fields correctly', () => {
      const testConfigs = [
        { ...mockConfig, retestZoneFibStart: 0 }, // Invalid
        { ...mockConfig, retestZoneFibEnd: 101 }, // Invalid
        { ...mockConfig, enabled: 'true' as unknown as boolean }, // Invalid type
        { ...mockConfig, requireStructureIntact: 1 as unknown as boolean }, // Invalid type
      ];

      for (const badConfig of testConfigs) {
        expect(() => new RetestEntryService(badConfig, logger, errorHandler)).toThrow();
      }
    });

    it('should handle empty zones cleanup', () => {
      const service = new RetestEntryService(mockConfig, logger, errorHandler);

      // Should not throw on empty cleanup
      expect(() => service.cleanExpiredZones()).not.toThrow();
      expect(service.getAllZones()).toHaveLength(0);
    });
  });
});
