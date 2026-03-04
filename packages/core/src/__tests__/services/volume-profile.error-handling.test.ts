/**
 * Phase 8.9.47: VolumeProfileService Error Handling Tests
 *
 * Tests ErrorHandler integration with recovery strategies:
 * - THROW: Input validation (empty arrays, NaN/Infinity in candles, invalid config)
 * - GRACEFUL_DEGRADE: Calculation failures
 * - SKIP: Logger errors
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { VolumeProfileService } from '../../services/volume-profile.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { ValidationError, ConfigurationError } from '../../errors/DomainErrors';
import { LoggerService, Candle } from '../../types/legacy';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create mock logger for testing
 */
function createMockLogger(methodToFail?: string): LoggerService {
  return {
    minLevel: 'debug',
    logDir: '/tmp',
    logToFile: false,
    logs: [],
    info: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'info') throw new Error('Logger.info failed');
    }),
    warn: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'warn') throw new Error('Logger.warn failed');
    }),
    debug: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'debug') throw new Error('Logger.debug failed');
    }),
    error: jest.fn((_msg: string, _meta?: unknown) => {
      if (methodToFail === 'error') throw new Error('Logger.error failed');
    }),
  } as unknown as LoggerService;
}

/**
 * Create valid candles for testing
 */
function createValidCandles(count: number = 10): Candle[] {
  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    candles.push({
      timestamp: 1000 + i * 60,
      open: 100 + i * 0.1,
      high: 100.5 + i * 0.1,
      low: 99.5 + i * 0.1,
      close: 100 + i * 0.1,
      volume: 1000 + i * 10,
    });
  }
  return candles;
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('VolumeProfileService - Error Handling (Phase 8.9.47)', () => {
  let service: VolumeProfileService;
  let errorHandler: ErrorHandler;
  let mockLogger: LoggerService;
  type VolumeCandlesInput = Parameters<VolumeProfileService['calculate']>[0];

  beforeEach(() => {
    mockLogger = createMockLogger();
    errorHandler = new ErrorHandler(mockLogger);
  });

  // =========================================================================
  // THROW VALIDATION TESTS
  // =========================================================================

  describe('THROW: Input Validation', () => {
    it('should throw on null candles array', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);

      expect(() => {
        service.calculate(null as unknown as VolumeCandlesInput);
      }).toThrow();
    });

    it('should throw on non-array candles input', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);

      expect(() => {
        service.calculate({ high: 100, low: 99 } as unknown as VolumeCandlesInput);
      }).toThrow();
    });

    it('should throw on empty candles array', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);

      expect(() => {
        service.calculate([]);
      }).toThrow();
    });

    it('should throw on candles with NaN values', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);

      const badCandles: Candle[] = [
        {
          timestamp: 1000,
          open: 100,
          high: NaN,
          low: 99.5,
          close: 100,
          volume: 1000,
        },
      ];

      expect(() => {
        service.calculate(badCandles);
      }).toThrow();
    });

    it('should throw on candles with Infinity values', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);

      const badCandles: Candle[] = [
        {
          timestamp: 1000,
          open: 100,
          high: Infinity,
          low: 99.5,
          close: 100,
          volume: 1000,
        },
      ];

      expect(() => {
        service.calculate(badCandles);
      }).toThrow();
    });

    it('should throw on negative volume in candles', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);

      const badCandles: Candle[] = [
        {
          timestamp: 1000,
          open: 100,
          high: 100.5,
          low: 99.5,
          close: 100,
          volume: -1000,
        },
      ];

      expect(() => {
        service.calculate(badCandles);
      }).toThrow();
    });

    it('should throw on invalid priceTickSize in constructor', () => {
      expect(() => {
        new VolumeProfileService(
          mockLogger,
          {
            priceTickSize: NaN,
          },
          errorHandler
        );
      }).toThrow();
    });

    it('should throw on negative priceTickSize in constructor', () => {
      expect(() => {
        new VolumeProfileService(
          mockLogger,
          {
            priceTickSize: -0.5,
          },
          errorHandler
        );
      }).toThrow();
    });

    it('should throw on zero priceTickSize in constructor', () => {
      expect(() => {
        new VolumeProfileService(
          mockLogger,
          {
            priceTickSize: 0,
          },
          errorHandler
        );
      }).toThrow();
    });

    it('should throw on invalid lookbackCandles in constructor', () => {
      expect(() => {
        new VolumeProfileService(
          mockLogger,
          {
            lookbackCandles: NaN,
          },
          errorHandler
        );
      }).toThrow();
    });

    it('should throw on invalid valueAreaPercent in constructor', () => {
      expect(() => {
        new VolumeProfileService(
          mockLogger,
          {
            valueAreaPercent: 150, // > 100
          },
          errorHandler
        );
      }).toThrow();
    });

    it('should throw on zero valueAreaPercent in constructor', () => {
      expect(() => {
        new VolumeProfileService(
          mockLogger,
          {
            valueAreaPercent: 0,
          },
          errorHandler
        );
      }).toThrow();
    });
  });

  // =========================================================================
  // GRACEFUL_DEGRADE DATA PROCESSING TESTS
  // =========================================================================

  describe('GRACEFUL_DEGRADE: Calculation Failures', () => {
    it('should calculate volume profile with valid candles', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);
      const candles = createValidCandles(10);

      const result = service.calculate(candles);

      expect(result).toBeDefined();
      expect(result?.poc).toBeDefined();
      expect(result?.vah).toBeDefined();
      expect(result?.val).toBeDefined();
      expect(result?.totalVolume).toBeGreaterThan(0);
      expect(result?.nodes.length).toBeGreaterThan(0);
    });

    it('should return null when service is disabled', () => {
      service = new VolumeProfileService(
        mockLogger,
        {
          enabled: false,
        },
        errorHandler
      );
      const candles = createValidCandles(10);

      const result = service.calculate(candles);

      expect(result).toBeNull();
    });

    it('should gracefully handle updateConfig with invalid priceTickSize', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);

      const initialConfig = service.getConfig();

      // This should not throw, just keep existing config
      service.updateConfig({
        priceTickSize: NaN,
      });

      const updatedConfig = service.getConfig();
      expect(updatedConfig.priceTickSize).toBe(initialConfig.priceTickSize);
    });

    it('should gracefully handle updateConfig with negative lookbackCandles', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);

      const initialConfig = service.getConfig();

      // This should not throw
      service.updateConfig({
        lookbackCandles: -100,
      });

      const updatedConfig = service.getConfig();
      expect(updatedConfig.lookbackCandles).toBe(initialConfig.lookbackCandles);
    });

    it('should gracefully handle updateConfig with invalid valueAreaPercent', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);

      const initialConfig = service.getConfig();

      // This should not throw
      service.updateConfig({
        valueAreaPercent: 150,
      });

      const updatedConfig = service.getConfig();
      expect(updatedConfig.valueAreaPercent).toBe(initialConfig.valueAreaPercent);
    });

    it('should calculate POC correctly', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);
      const candles = createValidCandles(10);

      const result = service.calculate(candles);

      expect(result?.poc).toBeDefined();
      expect(Number.isFinite(result!.poc)).toBe(true);
    });

    it('should calculate VAH and VAL correctly', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);
      const candles = createValidCandles(10);

      const result = service.calculate(candles);

      expect(result?.vah).toBeDefined();
      expect(result?.val).toBeDefined();
      expect(result!.val).toBeLessThanOrEqual(result!.vah);
    });

    it('should respect lookback parameter', () => {
      service = new VolumeProfileService(
        mockLogger,
        {
          lookbackCandles: 5,
        },
        errorHandler
      );
      const candles = createValidCandles(20);

      const result = service.calculate(candles);

      expect(result).toBeDefined();
      expect(result?.nodes.length).toBeGreaterThan(0);
    });

    it('should handle single candle', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);
      const candles = createValidCandles(1);

      const result = service.calculate(candles);

      expect(result).toBeDefined();
      expect(result?.totalVolume).toBe(1000);
    });
  });

  // =========================================================================
  // SKIP LOGGING FAILURE TESTS
  // =========================================================================

  describe('SKIP: Logging Failures', () => {
    it('should skip logger errors during calculate', () => {
      const failingLogger = createMockLogger('debug');
      service = new VolumeProfileService(failingLogger, undefined, errorHandler);
      const candles = createValidCandles(10);

      // Should not throw despite logger errors
      const result = service.calculate(candles);
      expect(result).toBeDefined();
    });

    it('should skip logger errors during constructor init', () => {
      const failingLogger = createMockLogger('info');

      expect(() => {
        service = new VolumeProfileService(failingLogger, undefined, errorHandler);
      }).not.toThrow();

      expect(service).toBeDefined();
    });

    it('should skip logger errors during config update', () => {
      const failingLogger = createMockLogger('info');
      service = new VolumeProfileService(failingLogger, undefined, errorHandler);

      // Should not throw despite logger errors
      expect(() => {
        service.updateConfig({
          enabled: false,
        });
      }).not.toThrow();
    });

    it('should continue operation despite logger warn failure', () => {
      const failingLogger = createMockLogger('warn');
      service = new VolumeProfileService(failingLogger, undefined, errorHandler);
      const candles = createValidCandles(10);

      // Should handle gracefully
      const result = service.calculate(candles);
      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // INTEGRATION E2E SCENARIOS
  // =========================================================================

  describe('Integration: E2E Scenarios', () => {
    it('should calculate complete volume profile with E2E workflow', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);
      const candles = createValidCandles(20);

      const result = service.calculate(candles);

      expect(result).toBeDefined();
      expect(result?.poc).toBeGreaterThan(0);
      expect(result?.vah).toBeGreaterThan(0);
      expect(result?.val).toBeGreaterThan(0);
      expect(result?.totalVolume).toBeGreaterThan(0);
      expect(result?.nodes.length).toBeGreaterThan(0);
    });

    it('should calculate accurate POC from volume distribution', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);
      const candles = createValidCandles(10);

      const result = service.calculate(candles);

      // POC should be the price with highest volume (first node when sorted by volume desc)
      expect(result?.poc).toBeDefined();
      expect(result?.nodes[0].price).toBe(result?.poc);
    });

    it('should maintain VAL < VAH relationship', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);
      const candles = createValidCandles(15);

      const result = service.calculate(candles);

      expect(result).toBeDefined();
      expect(result!.val).toBeLessThanOrEqual(result!.vah);
    });

    it('should update config successfully', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);

      const initialConfig = service.getConfig();
      expect(initialConfig.enabled).toBe(true);

      service.updateConfig({
        enabled: false,
      });

      const updatedConfig = service.getConfig();
      expect(updatedConfig.enabled).toBe(false);
      expect(updatedConfig.lookbackCandles).toBe(initialConfig.lookbackCandles);
    });

    it('should preserve config on invalid update', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);

      const initialConfig = service.getConfig();

      // Attempt invalid update
      service.updateConfig({
        priceTickSize: -1,
      });

      const config = service.getConfig();
      expect(config).toEqual(initialConfig);
    });

    it('should handle multiple calculations with same config', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);
      const candles1 = createValidCandles(10);
      const candles2 = createValidCandles(15);

      const result1 = service.calculate(candles1);
      const result2 = service.calculate(candles2);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1?.poc).toBeDefined();
      expect(result2?.poc).toBeDefined();
    });

    it('should handle config changes between calculations', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);
      const candles = createValidCandles(20);

      const result1 = service.calculate(candles);

      service.updateConfig({
        lookbackCandles: 5,
      });

      const result2 = service.calculate(candles);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  // =========================================================================
  // BACKWARD COMPATIBILITY TESTS
  // =========================================================================

  describe('Backward Compatibility: Without ErrorHandler', () => {
    it('should work without ErrorHandler (backward compatible)', () => {
      service = new VolumeProfileService(mockLogger);
      const candles = createValidCandles(10);

      const result = service.calculate(candles);

      expect(result).toBeDefined();
      expect(result?.poc).toBeDefined();
    });

    it('should throw validation errors without ErrorHandler', () => {
      service = new VolumeProfileService(mockLogger);

      expect(() => {
        service.calculate([]);
      }).toThrow();
    });

    it('should throw on invalid candles without ErrorHandler', () => {
      service = new VolumeProfileService(mockLogger);

      const badCandles: Candle[] = [
        {
          timestamp: 1000,
          open: 100,
          high: 100.5,
          low: NaN,
          close: 100,
          volume: 1000,
        },
      ];

      expect(() => {
        service.calculate(badCandles);
      }).toThrow();
    });

    it('should handle config with partial overrides without ErrorHandler', () => {
      service = new VolumeProfileService(mockLogger, {
        lookbackCandles: 100,
        valueAreaPercent: 68,
      });

      const config = service.getConfig();
      expect(config.lookbackCandles).toBe(100);
      expect(config.valueAreaPercent).toBe(68);
      expect(config.priceTickSize).toBe(0.5); // Default
    });

    it('should throw on invalid constructor config without ErrorHandler', () => {
      expect(() => {
        new VolumeProfileService(mockLogger, {
          priceTickSize: 0,
        });
      }).toThrow();
    });

    it('should check isEnabled() correctly without ErrorHandler', () => {
      service = new VolumeProfileService(mockLogger, {
        enabled: false,
      });

      expect(service.isEnabled()).toBe(false);
    });
  });

  // =========================================================================
  // EDGE CASES
  // =========================================================================

  describe('Edge Cases', () => {
    it('should handle candles with very small price range', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);

      const candles = [
        {
          timestamp: 1000,
          open: 100.0001,
          high: 100.0002,
          low: 100.0000,
          close: 100.0001,
          volume: 1000,
        },
      ];

      const result = service.calculate(candles);
      expect(result).toBeDefined();
    });

    it('should handle candles with very large volume', () => {
      service = new VolumeProfileService(mockLogger, undefined, errorHandler);

      const candles = [
        {
          timestamp: 1000,
          open: 100,
          high: 100.5,
          low: 99.5,
          close: 100,
          volume: 1e15, // Very large number
        },
      ];

      const result = service.calculate(candles);
      expect(result).toBeDefined();
    });

    it('should handle different tick sizes', () => {
      service = new VolumeProfileService(
        mockLogger,
        {
          priceTickSize: 0.25,
        },
        errorHandler
      );
      const candles = createValidCandles(10);

      const result = service.calculate(candles);
      expect(result).toBeDefined();
    });

    it('should handle different value area percentages', () => {
      service = new VolumeProfileService(
        mockLogger,
        {
          valueAreaPercent: 50,
        },
        errorHandler
      );
      const candles = createValidCandles(10);

      const result = service.calculate(candles);
      expect(result).toBeDefined();
    });

    it('should calculate correctly with edge case value area percent (1%)', () => {
      service = new VolumeProfileService(
        mockLogger,
        {
          valueAreaPercent: 1,
        },
        errorHandler
      );
      const candles = createValidCandles(10);

      const result = service.calculate(candles);
      expect(result).toBeDefined();
      expect(result!.vah).toBeGreaterThanOrEqual(result!.val);
    });

    it('should calculate correctly with edge case value area percent (99%)', () => {
      service = new VolumeProfileService(
        mockLogger,
        {
          valueAreaPercent: 99,
        },
        errorHandler
      );
      const candles = createValidCandles(10);

      const result = service.calculate(candles);
      expect(result).toBeDefined();
      expect(result!.vah).toBeGreaterThanOrEqual(result!.val);
    });
  });
});
