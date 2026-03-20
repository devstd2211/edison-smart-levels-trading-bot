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
import { ErrorHandler } from '../../errors/ErrorHandler';
import { LoggerService, Candle, VolumeProfileConfig } from '../../types/legacy';
import {
  createVolumeProfileCandles,
  createVolumeProfileCandlesFromSpecs,
  createVolumeProfileBoundFactory,
  createVolumeProfileHarness,
  createVolumeProfileInvalidConfig,
  createInvalidVolumeProfileCandle,
  createVolumeProfileMockLogger,
  createVolumeProfileServiceWithHarness,
} from '../helpers/volume-profile-test.utils';

// ============================================================================
// TEST HELPERS
// ============================================================================

// ============================================================================
// TEST SUITES
// ============================================================================

describe('VolumeProfileService - Error Handling (Phase 8.9.47)', () => {
  let service: VolumeProfileService;
  let errorHandler: ErrorHandler;
  let mockLogger: LoggerService;
  type VolumeCandlesInput = Parameters<VolumeProfileService['calculate']>[0];
  let createService: ReturnType<typeof createVolumeProfileBoundFactory>['createService'];

  beforeEach(() => {
    const harness = createVolumeProfileHarness();
    mockLogger = harness.logger;
    errorHandler = harness.errorHandler;
    ({ createService } = createVolumeProfileBoundFactory({
      logger: mockLogger,
      errorHandler,
    }));
  });

  // =========================================================================
  // THROW VALIDATION TESTS
  // =========================================================================

  describe('THROW: Input Validation', () => {
    it('should throw on null candles array', () => {
      service = createService();

      expect(() => {
        service.calculate(null as unknown as VolumeCandlesInput);
      }).toThrow();
    });

    it('should throw on non-array candles input', () => {
      service = createService();

      expect(() => {
        service.calculate({ high: 100, low: 99 } as unknown as VolumeCandlesInput);
      }).toThrow();
    });

    it('should throw on empty candles array', () => {
      service = createService();

      expect(() => {
        service.calculate([]);
      }).toThrow();
    });

    it('should throw on candles with NaN values', () => {
      service = createService();

      const badCandles: Candle[] = [createInvalidVolumeProfileCandle({ high: NaN })];

      expect(() => {
        service.calculate(badCandles);
      }).toThrow();
    });

    it('should throw on candles with Infinity values', () => {
      service = createService();

      const badCandles: Candle[] = [createInvalidVolumeProfileCandle({ high: Infinity })];

      expect(() => {
        service.calculate(badCandles);
      }).toThrow();
    });

    it('should throw on negative volume in candles', () => {
      service = createService();

      const badCandles: Candle[] = [createInvalidVolumeProfileCandle({ volume: -1000 })];

      expect(() => {
        service.calculate(badCandles);
      }).toThrow();
    });

    it('should throw on invalid priceTickSize in constructor', () => {
      expect(() => {
        createVolumeProfileServiceWithHarness({
          configOverrides: createVolumeProfileInvalidConfig({ priceTickSize: NaN }),
          logger: mockLogger,
          errorHandler,
        });
      }).toThrow();
    });

    it('should throw on negative priceTickSize in constructor', () => {
      expect(() => {
        createVolumeProfileServiceWithHarness({
          configOverrides: createVolumeProfileInvalidConfig({ priceTickSize: -0.5 }),
          logger: mockLogger,
          errorHandler,
        });
      }).toThrow();
    });

    it('should throw on zero priceTickSize in constructor', () => {
      expect(() => {
        createVolumeProfileServiceWithHarness({
          configOverrides: createVolumeProfileInvalidConfig({ priceTickSize: 0 }),
          logger: mockLogger,
          errorHandler,
        });
      }).toThrow();
    });

    it('should throw on invalid lookbackCandles in constructor', () => {
      expect(() => {
        createVolumeProfileServiceWithHarness({
          configOverrides: createVolumeProfileInvalidConfig({ lookbackCandles: NaN }),
          logger: mockLogger,
          errorHandler,
        });
      }).toThrow();
    });

    it('should throw on invalid valueAreaPercent in constructor', () => {
      expect(() => {
        createVolumeProfileServiceWithHarness({
          configOverrides: createVolumeProfileInvalidConfig({ valueAreaPercent: 150 }),
          logger: mockLogger,
          errorHandler,
        });
      }).toThrow();
    });

    it('should throw on zero valueAreaPercent in constructor', () => {
      expect(() => {
        createVolumeProfileServiceWithHarness({
          configOverrides: createVolumeProfileInvalidConfig({ valueAreaPercent: 0 }),
          logger: mockLogger,
          errorHandler,
        });
      }).toThrow();
    });
  });

  // =========================================================================
  // GRACEFUL_DEGRADE DATA PROCESSING TESTS
  // =========================================================================

  describe('GRACEFUL_DEGRADE: Calculation Failures', () => {
    it('should calculate volume profile with valid candles', () => {
      service = createService();
      const candles = createVolumeProfileCandles(10);

      const result = service.calculate(candles);

      expect(result).toBeDefined();
      expect(result?.poc).toBeDefined();
      expect(result?.vah).toBeDefined();
      expect(result?.val).toBeDefined();
      expect(result?.totalVolume).toBeGreaterThan(0);
      expect(result?.nodes.length).toBeGreaterThan(0);
    });

    it('should return null when service is disabled', () => {
      service = createService({ enabled: false });
      const candles = createVolumeProfileCandles(10);

      const result = service.calculate(candles);

      expect(result).toBeNull();
    });

    it('should gracefully handle updateConfig with invalid priceTickSize', () => {
      service = createService();

      const initialConfig = service.getConfig();

      // This should not throw, just keep existing config
      service.updateConfig({
        priceTickSize: NaN,
      });

      const updatedConfig = service.getConfig();
      expect(updatedConfig.priceTickSize).toBe(initialConfig.priceTickSize);
    });

    it('should gracefully handle updateConfig with negative lookbackCandles', () => {
      service = createService();

      const initialConfig = service.getConfig();

      // This should not throw
      service.updateConfig({
        lookbackCandles: -100,
      });

      const updatedConfig = service.getConfig();
      expect(updatedConfig.lookbackCandles).toBe(initialConfig.lookbackCandles);
    });

    it('should gracefully handle updateConfig with invalid valueAreaPercent', () => {
      service = createService();

      const initialConfig = service.getConfig();

      // This should not throw
      service.updateConfig({
        valueAreaPercent: 150,
      });

      const updatedConfig = service.getConfig();
      expect(updatedConfig.valueAreaPercent).toBe(initialConfig.valueAreaPercent);
    });

    it('should calculate POC correctly', () => {
      service = createService();
      const candles = createVolumeProfileCandles(10);

      const result = service.calculate(candles);

      expect(result?.poc).toBeDefined();
      expect(Number.isFinite(result!.poc)).toBe(true);
    });

    it('should calculate VAH and VAL correctly', () => {
      service = createService();
      const candles = createVolumeProfileCandles(10);

      const result = service.calculate(candles);

      expect(result?.vah).toBeDefined();
      expect(result?.val).toBeDefined();
      expect(result!.val).toBeLessThanOrEqual(result!.vah);
    });

    it('should respect lookback parameter', () => {
      service = createService({ lookbackCandles: 5 });
      const candles = createVolumeProfileCandles(20);

      const result = service.calculate(candles);

      expect(result).toBeDefined();
      expect(result?.nodes.length).toBeGreaterThan(0);
    });

    it('should handle single candle', () => {
      service = createService();
      const candles = createVolumeProfileCandles(1);

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
      const failingLogger = createVolumeProfileMockLogger('debug');
      service = createService(undefined, failingLogger);
      const candles = createVolumeProfileCandles(10);

      // Should not throw despite logger errors
      const result = service.calculate(candles);
      expect(result).toBeDefined();
    });

    it('should skip logger errors during constructor init', () => {
      const failingLogger = createVolumeProfileMockLogger('info');

      expect(() => {
        service = createService(undefined, failingLogger);
      }).not.toThrow();

      expect(service).toBeDefined();
    });

    it('should skip logger errors during config update', () => {
      const failingLogger = createVolumeProfileMockLogger('info');
      service = createService(undefined, failingLogger);

      // Should not throw despite logger errors
      expect(() => {
        service.updateConfig({
          enabled: false,
        });
      }).not.toThrow();
    });

    it('should continue operation despite logger warn failure', () => {
      const failingLogger = createVolumeProfileMockLogger('warn');
      service = createService(undefined, failingLogger);
      const candles = createVolumeProfileCandles(10);

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
      service = createService();
      const candles = createVolumeProfileCandles(20);

      const result = service.calculate(candles);

      expect(result).toBeDefined();
      expect(result?.poc).toBeGreaterThan(0);
      expect(result?.vah).toBeGreaterThan(0);
      expect(result?.val).toBeGreaterThan(0);
      expect(result?.totalVolume).toBeGreaterThan(0);
      expect(result?.nodes.length).toBeGreaterThan(0);
    });

    it('should calculate accurate POC from volume distribution', () => {
      service = createService();
      const candles = createVolumeProfileCandles(10);

      const result = service.calculate(candles);

      // POC should be the price with highest volume (first node when sorted by volume desc)
      expect(result?.poc).toBeDefined();
      expect(result?.nodes[0].price).toBe(result?.poc);
    });

    it('should maintain VAL < VAH relationship', () => {
      service = createService();
      const candles = createVolumeProfileCandles(15);

      const result = service.calculate(candles);

      expect(result).toBeDefined();
      expect(result!.val).toBeLessThanOrEqual(result!.vah);
    });

    it('should update config successfully', () => {
      service = createService();

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
      service = createVolumeProfileServiceWithHarness({ logger: mockLogger, errorHandler });

      const initialConfig = service.getConfig();

      // Attempt invalid update
      service.updateConfig({
        priceTickSize: -1,
      });

      const config = service.getConfig();
      expect(config).toEqual(initialConfig);
    });

    it('should handle multiple calculations with same config', () => {
      service = createService();
      const candles1 = createVolumeProfileCandles(10);
      const candles2 = createVolumeProfileCandles(15);

      const result1 = service.calculate(candles1);
      const result2 = service.calculate(candles2);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1?.poc).toBeDefined();
      expect(result2?.poc).toBeDefined();
    });

    it('should handle config changes between calculations', () => {
      service = createService();
      const candles = createVolumeProfileCandles(20);

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
      service = createService(undefined, mockLogger, false);
      const candles = createVolumeProfileCandles(10);

      const result = service.calculate(candles);

      expect(result).toBeDefined();
      expect(result?.poc).toBeDefined();
    });

    it('should throw validation errors without ErrorHandler', () => {
      service = createService(undefined, mockLogger, false);

      expect(() => {
        service.calculate([]);
      }).toThrow();
    });

    it('should throw on invalid candles without ErrorHandler', () => {
      service = createService(undefined, mockLogger, false);

      const badCandles: Candle[] = [createInvalidVolumeProfileCandle({ low: NaN })];

      expect(() => {
        service.calculate(badCandles);
      }).toThrow();
    });

    it('should handle config with partial overrides without ErrorHandler', () => {
      service = createVolumeProfileServiceWithHarness({
        config: {
          lookbackCandles: 100,
          valueAreaPercent: 68,
        },
        logger: mockLogger,
        withErrorHandler: false,
      });

      const config = service.getConfig();
      expect(config.lookbackCandles).toBe(100);
      expect(config.valueAreaPercent).toBe(68);
      expect(config.priceTickSize).toBe(0.5); // Default
    });

    it('should throw on invalid constructor config without ErrorHandler', () => {
      expect(() => {
        createVolumeProfileServiceWithHarness({
          config: {
            priceTickSize: 0,
          },
          logger: mockLogger,
          withErrorHandler: false,
        });
      }).toThrow();
    });

    it('should check isEnabled() correctly without ErrorHandler', () => {
      service = createVolumeProfileServiceWithHarness({
        config: {
          enabled: false,
        },
        logger: mockLogger,
        withErrorHandler: false,
      });

      expect(service.isEnabled()).toBe(false);
    });
  });

  // =========================================================================
  // EDGE CASES
  // =========================================================================

  describe('Edge Cases', () => {
    it('should handle candles with very small price range', () => {
      service = createService();

      const candles = createVolumeProfileCandlesFromSpecs([
        { low: 100.0, high: 100.0002, close: 100.0001, volume: 1000, timestamp: 1000 },
      ]);

      const result = service.calculate(candles);
      expect(result).toBeDefined();
    });

    it('should handle candles with very large volume', () => {
      service = createService();

      const candles = createVolumeProfileCandlesFromSpecs([
        { low: 99.5, high: 100.5, close: 100, volume: 1e15, timestamp: 1000 },
      ]);

      const result = service.calculate(candles);
      expect(result).toBeDefined();
    });

    it('should handle different tick sizes', () => {
      service = createVolumeProfileServiceWithHarness({
        configOverrides: {
          priceTickSize: 0.25,
        },
        logger: mockLogger,
        errorHandler,
      });
      const candles = createVolumeProfileCandles(10);

      const result = service.calculate(candles);
      expect(result).toBeDefined();
    });

    it('should handle different value area percentages', () => {
      service = createVolumeProfileServiceWithHarness({
        configOverrides: {
          valueAreaPercent: 50,
        },
        logger: mockLogger,
        errorHandler,
      });
      const candles = createVolumeProfileCandles(10);

      const result = service.calculate(candles);
      expect(result).toBeDefined();
    });

    it('should calculate correctly with edge case value area percent (1%)', () => {
      service = createVolumeProfileServiceWithHarness({
        configOverrides: {
          valueAreaPercent: 1,
        },
        logger: mockLogger,
        errorHandler,
      });
      const candles = createVolumeProfileCandles(10);

      const result = service.calculate(candles);
      expect(result).toBeDefined();
      expect(result!.vah).toBeGreaterThanOrEqual(result!.val);
    });

    it('should calculate correctly with edge case value area percent (99%)', () => {
      service = createVolumeProfileServiceWithHarness({
        configOverrides: {
          valueAreaPercent: 99,
        },
        logger: mockLogger,
        errorHandler,
      });
      const candles = createVolumeProfileCandles(10);

      const result = service.calculate(candles);
      expect(result).toBeDefined();
      expect(result!.vah).toBeGreaterThanOrEqual(result!.val);
    });
  });
});
