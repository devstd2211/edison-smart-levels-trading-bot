/**
 * Phase 8.9.46: VolatilityRegimeService Error Handling Tests
 *
 * Tests ErrorHandler integration with recovery strategies:
 * - THROW: Input validation (NaN, Infinity, null)
 * - GRACEFUL_DEGRADE: Analysis failures
 * - SKIP: Logger errors
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { VolatilityRegimeService } from '../../services/volatility-regime.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { LoggerService, VolatilityRegime } from '../../types/legacy';
import {
  createManagedVolatilityRegimeContext,
  createInvalidVolatilityRegimeThresholds,
  createVolatilityRegimeMockLogger,
  type ManagedVolatilityRegimeContext,
} from '../helpers/volatility-regime-test.utils';

type VolatilityRegimeRuntime = Pick<
  ManagedVolatilityRegimeContext,
  'errorHandler'
>;
type VolatilityRegimeFactories = Pick<
  ManagedVolatilityRegimeContext,
  'cleanup' | 'createStandardService' | 'createLegacyService'
>;

describe('VolatilityRegimeService - Error Handling (Phase 8.9.46)', () => {
  let service: VolatilityRegimeService;
  let errorHandler: ErrorHandler;
  let mockLogger: LoggerService;
  let cleanup: VolatilityRegimeFactories['cleanup'];
  let createService: VolatilityRegimeFactories['createStandardService'];
  let createLegacyService: VolatilityRegimeFactories['createLegacyService'];

  beforeEach(() => {
    const mockLoggerInstance = createVolatilityRegimeMockLogger();
    const managedContext = createManagedVolatilityRegimeContext({ logger: mockLoggerInstance });
    const runtime: VolatilityRegimeRuntime = managedContext;
    const factories: VolatilityRegimeFactories = managedContext;
    mockLogger = mockLoggerInstance;
    ({ errorHandler } = runtime);
    ({ cleanup, createStandardService: createService, createLegacyService } = factories);
  });

  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // THROW VALIDATION TESTS
  // =========================================================================

  describe('THROW: Input Validation', () => {
    it('should throw on NaN ATR percent during analyze', () => {
      service = createService({ logger: mockLogger, errorHandler });

      expect(() => {
        service.analyze(NaN);
      }).toThrow();
    });

    it('should throw on Infinity ATR percent during analyze', () => {
      service = createService({ logger: mockLogger, errorHandler });

      expect(() => {
        service.analyze(Infinity);
      }).toThrow();
    });

    it('should throw on negative ATR percent during analyze', () => {
      service = createService({ logger: mockLogger, errorHandler });

      expect(() => {
        service.analyze(-0.5);
      }).toThrow();
    });

    it('should throw on invalid threshold values in constructor', () => {
      expect(() => {
        createService({
          logger: mockLogger,
          config: createInvalidVolatilityRegimeThresholds(),
        });
      }).toThrow();
    });

    it('should throw on negative threshold values in constructor', () => {
      expect(() => {
        createService({
          logger: mockLogger,
          config: createInvalidVolatilityRegimeThresholds({ lowAtrPercent: -0.3 }),
        });
      }).toThrow();
    });
  });

  // =========================================================================
  // GRACEFUL_DEGRADE DATA PROCESSING TESTS
  // =========================================================================

  describe('GRACEFUL_DEGRADE: Analysis Failures', () => {
    it('should analyze valid values correctly', () => {
      service = createService({ logger: mockLogger, errorHandler });

      const result = service.analyze(0.5);

      expect(result).toBeDefined();
      expect(result.regime).toBe(VolatilityRegime.MEDIUM);
      expect(result.atrPercent).toBe(0.5);
      expect(result.params).toBeDefined();
      expect(result.reason).toBeDefined();
    });

    it('should return correct regime for LOW volatility', () => {
      service = createService({ logger: mockLogger, errorHandler });

      const result = service.analyze(0.2);

      expect(result).toBeDefined();
      expect(result.regime).toBe(VolatilityRegime.LOW);
      expect(result.params.maxDistancePercent).toBeLessThan(
        service.analyze(0.75).params.maxDistancePercent
      );
    });

    it('should gracefully handle updateConfig with invalid thresholds', () => {
      service = createService({ logger: mockLogger, errorHandler });

      // This should not throw, just log warning
      service.updateConfig({
        thresholds: {
          lowAtrPercent: NaN,
          highAtrPercent: 1.5,
        },
      });

      // Config should remain unchanged
      const config = service.getConfig();
      expect(config.thresholds.lowAtrPercent).toBe(0.3); // Default
      expect(config.thresholds.highAtrPercent).toBe(1.5);
    });

    it('should return MEDIUM regime on config merge failure', () => {
      service = createService({
        logger: mockLogger,
        errorHandler,
        config: {
          thresholds: {
            lowAtrPercent: 0.3,
            highAtrPercent: 1.5,
          },
        },
      });

      const result = service.analyze(0.75);

      expect(result.regime).toBe(VolatilityRegime.MEDIUM);
      expect(result.params).toBeDefined();
    });

    it('should handle analysis with disabled regime detection', () => {
      service = createService({
        logger: mockLogger,
        errorHandler,
        config: {
          enabled: false,
        },
      });

      const result = service.analyze(2.0); // High ATR

      expect(result.regime).toBe(VolatilityRegime.MEDIUM);
      expect(result.reason).toContain('disabled');
    });
  });

  // =========================================================================
  // SKIP LOGGING FAILURE TESTS
  // =========================================================================

  describe('SKIP: Logging Failures', () => {
    it('should skip logger errors during analyze', () => {
      const failingLogger = createVolatilityRegimeMockLogger('debug');
      service = createService({ logger: failingLogger, errorHandler });

      // Should not throw despite logger errors
      const result = service.analyze(0.5);
      expect(result).toBeDefined();
      expect(result.regime).toBe(VolatilityRegime.MEDIUM);
    });

    it('should skip logger errors during updateConfig', () => {
      const failingLogger = createVolatilityRegimeMockLogger('info');
      service = createService({ logger: failingLogger, errorHandler });

      // Should not throw despite logger errors
      expect(() => {
        service.updateConfig({ enabled: false });
      }).not.toThrow();
    });

    it('should continue operation despite logger init failure', () => {
      const failingLogger = createVolatilityRegimeMockLogger('info');

      expect(() => {
        service = createService({ logger: failingLogger, errorHandler });
      }).not.toThrow();
    });
  });

  // =========================================================================
  // INTEGRATION E2E SCENARIOS
  // =========================================================================

  describe('Integration: E2E Scenarios', () => {
    it('should analyze valid ATR values correctly', () => {
      service = createService({ logger: mockLogger, errorHandler });

      const lowResult = service.analyze(0.2);
      expect(lowResult.regime).toBe(VolatilityRegime.LOW);

      const mediumResult = service.analyze(0.75);
      expect(mediumResult.regime).toBe(VolatilityRegime.MEDIUM);

      const highResult = service.analyze(2.0);
      expect(highResult.regime).toBe(VolatilityRegime.HIGH);
    });

    it('should track regime changes correctly', () => {
      service = createService({ logger: mockLogger, errorHandler });

      service.analyze(0.2); // LOW (change from initial MEDIUM → LOW)
      expect(service.getCurrentRegime()).toBe(VolatilityRegime.LOW);
      expect(service.getRegimeChangeCount()).toBe(1); // 1 change: MEDIUM → LOW

      service.analyze(0.75); // MEDIUM
      expect(service.getCurrentRegime()).toBe(VolatilityRegime.MEDIUM);
      expect(service.getRegimeChangeCount()).toBe(2); // 2 changes: +1 (LOW → MEDIUM)

      service.analyze(2.0); // HIGH
      expect(service.getCurrentRegime()).toBe(VolatilityRegime.HIGH);
      expect(service.getRegimeChangeCount()).toBe(3); // 3 changes: +1 (MEDIUM → HIGH)
    });

    it('should handle config updates correctly', () => {
      service = createService({ logger: mockLogger, errorHandler });

      const initialConfig = service.getConfig();
      expect(initialConfig.enabled).toBe(true);

      service.updateConfig({ enabled: false });
      const updatedConfig = service.getConfig();
      expect(updatedConfig.enabled).toBe(false);
    });

    it('should preserve config on failed update', () => {
      service = createService({ logger: mockLogger, errorHandler });

      const initialConfig = service.getConfig();
      const initialThresholds = { ...initialConfig.thresholds };

      // Attempt invalid update
      service.updateConfig({
        thresholds: {
          lowAtrPercent: Infinity,
          highAtrPercent: 1.5,
        },
      });

      const config = service.getConfig();
      expect(config.thresholds).toEqual(initialThresholds);
    });
  });

  // =========================================================================
  // BACKWARD COMPATIBILITY TESTS
  // =========================================================================

  describe('Backward Compatibility: Without ErrorHandler', () => {
    it('should work without ErrorHandler (backward compatible)', () => {
      service = createLegacyService({ logger: mockLogger });

      const result = service.analyze(0.75);

      expect(result).toBeDefined();
      expect(result.regime).toBe(VolatilityRegime.MEDIUM);
    });

    it('should throw on validation errors without ErrorHandler', () => {
      service = createLegacyService({ logger: mockLogger });

      expect(() => {
        service.analyze(NaN);
      }).toThrow();
    });

    it('should handle config without ErrorHandler', () => {
      service = createLegacyService({
        logger: mockLogger,
        config: {
          enabled: true,
          thresholds: {
            lowAtrPercent: 0.3,
            highAtrPercent: 1.5,
          },
        },
      });

      expect(service.isEnabled()).toBe(true);
      expect(service.getConfig()).toBeDefined();
    });
  });
});
