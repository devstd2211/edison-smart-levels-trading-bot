/**
 * Orderbook Imbalance Service - Error Handling Tests (Phase 8.9.49)
 *
 * THROW Validation Tests (5):
 * - Config validation: levels < 1
 * - Config validation: minImbalancePercent out of range
 * - Config validation: enabled not boolean
 * - Input validation: null orderbook
 * - Input validation: invalid bids/asks structure
 *
 * GRACEFUL_DEGRADE Calculation Tests (5):
 * - NaN/Infinity in bid quantities
 * - NaN/Infinity in ask quantities
 * - Calculation result is NaN/Infinity
 * - Volume sum produces non-finite
 * - Imbalance calculation produces non-finite
 *
 * SKIP Logging Tests (3):
 * - Logger failures in constructor
 * - Logger failures in analyze()
 * - Logger failures in safeLog()
 *
 * Integration E2E Tests (3):
 * - Full analysis with cascading failures
 * - Mixed valid/invalid scenarios
 * - Error recovery and fallback
 *
 * Backward Compatibility Tests (2):
 * - Works without ErrorHandler (optional DI)
 * - All legacy tests still passing
 */

import { OrderbookImbalanceService } from '../../services/orderbook-imbalance.service';
import { OrderbookImbalanceConfig, LoggerService } from '../../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import {
  createOrderbookImbalanceConfig,
  createOrderbookImbalanceFailingLogger,
  createManagedOrderbookImbalanceContext,
  createOrderbookImbalanceOrderbook,
  createOrderbookImbalanceScenario,
  createStandardOrderbookImbalanceService,
  type ManagedOrderbookImbalanceContext,
} from '../helpers/orderbook-imbalance-test.utils';

function bindOrderbookImbalanceContext() {
  let context: ManagedOrderbookImbalanceContext;

  beforeEach(() => {
    context = createManagedOrderbookImbalanceContext();
  });

  afterEach(() => {
    context.cleanup();
  });

  return () => context;
}

describe('OrderbookImbalanceService - Error Handling (Phase 8.9.49)', () => {
  type OrderbookImbalanceFixtures = Pick<
    ManagedOrderbookImbalanceContext,
    'logger' | 'errorHandler' | 'createService' | 'createLegacyService'
  >;
  const asOrderbook = (
    value: unknown
  ): { bids: [number, number][]; asks: [number, number][] } =>
    value as { bids: [number, number][]; asks: [number, number][] };
  const asLogger = (value: unknown): LoggerService => value as LoggerService;

  let logger: LoggerService;
  let errorHandler: ErrorHandler | undefined;
  let createService: ManagedOrderbookImbalanceContext['createService'];
  let createLegacyService: ManagedOrderbookImbalanceContext['createLegacyService'];
  const getContext = bindOrderbookImbalanceContext();

  beforeEach(() => {
    const context = getContext();
    const fixtures: OrderbookImbalanceFixtures = {
      logger: context.logger,
      errorHandler: context.errorHandler,
      createService: context.createService,
      createLegacyService: context.createLegacyService,
    };

    ({ logger, errorHandler } = fixtures);
    createService = fixtures.createService;
    createLegacyService = fixtures.createLegacyService;
  });

  // ============================================================================
  // THROW VALIDATION TESTS (5)
  // ============================================================================

  describe('THROW - Config Validation', () => {
    it('should throw on invalid levels (< 1)', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig({
        levels: 0,
      });

      expect(() => createStandardOrderbookImbalanceService({ config, logger, errorHandler })).toThrow(
        'config.levels must be >= 1',
      );
    });

    it('should throw on negative minImbalancePercent', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig({
        minImbalancePercent: -10,
      });

      expect(() => createStandardOrderbookImbalanceService({ config, logger, errorHandler })).toThrow(
        'config.minImbalancePercent must be between 0 and 100',
      );
    });

    it('should throw on minImbalancePercent > 100', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig({
        minImbalancePercent: 150,
      });

      expect(() => createStandardOrderbookImbalanceService({ config, logger, errorHandler })).toThrow(
        'config.minImbalancePercent must be between 0 and 100',
      );
    });

    it('should throw on non-boolean enabled', () => {
      const config = {
        enabled: 'true' as unknown as boolean, // Invalid: string instead of boolean
        minImbalancePercent: 30,
        levels: 10,
      };

      expect(() => createStandardOrderbookImbalanceService({ config, logger, errorHandler })).toThrow(
        'config.enabled must be boolean',
      );
    });
  });

  describe('THROW - Input Validation', () => {
    it('should throw on null orderbook', () => {
      const service = createService();

      expect(() => service.analyze(asOrderbook(null))).toThrow('orderbook is required');
    });

    it('should throw on undefined orderbook', () => {
      const service = createService();

      expect(() => service.analyze(asOrderbook(undefined))).toThrow('orderbook is required');
    });

    it('should throw on non-array bids', () => {
      const service = createService();

      const orderbook = createOrderbookImbalanceOrderbook({
        bids: 'not-an-array' as unknown as [number, number][],
      });

      expect(() => service.analyze(orderbook)).toThrow('bids and asks must be arrays');
    });

    it('should throw on non-array asks', () => {
      const service = createService();

      const orderbook = createOrderbookImbalanceOrderbook({
        asks: 'not-an-array' as unknown as [number, number][],
      });

      expect(() => service.analyze(orderbook)).toThrow('bids and asks must be arrays');
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE CALCULATION TESTS (5)
  // ============================================================================

  describe('GRACEFUL_DEGRADE - Calculation Failures', () => {
    it('should return neutral analysis on NaN bid quantity', () => {
      const service = createService();

      const orderbook = createOrderbookImbalanceScenario({
        bidQuantities: [NaN],
      });

      const analysis = service.analyze(orderbook);

      // Should return neutral (GRACEFUL_DEGRADE)
      expect(analysis.direction).toBe('NEUTRAL');
      expect(analysis.bidVolume).toBe(0);
      expect(analysis.askVolume).toBe(0);
      expect(analysis.totalVolume).toBe(0);
      expect(analysis.imbalance).toBe(0);
    });

    it('should return neutral analysis on Infinity ask quantity', () => {
      const service = createService();

      const orderbook = createOrderbookImbalanceScenario({
        askQuantities: [Infinity],
      });

      const analysis = service.analyze(orderbook);

      // Should return neutral (GRACEFUL_DEGRADE)
      expect(analysis.direction).toBe('NEUTRAL');
      expect(analysis.bidVolume).toBe(0);
      expect(analysis.askVolume).toBe(0);
    });

    it('should return neutral analysis on negative infinity', () => {
      const service = createService();

      const orderbook = createOrderbookImbalanceScenario({
        bidQuantities: [-Infinity],
      });

      const analysis = service.analyze(orderbook);

      // Should return neutral (GRACEFUL_DEGRADE)
      expect(analysis.direction).toBe('NEUTRAL');
      expect(analysis.bidVolume).toBe(0);
      expect(analysis.askVolume).toBe(0);
    });

    it('should handle mixed valid and invalid quantities', () => {
      const service = createService();

      const orderbook = createOrderbookImbalanceScenario({
        bidQuantities: [10, NaN],
      });

      const analysis = service.analyze(orderbook);

      // Should return neutral on first invalid quantity (GRACEFUL_DEGRADE)
      expect(analysis.direction).toBe('NEUTRAL');
    });

    it('should handle calculation overflow gracefully', () => {
      const service = createService();

      const orderbook = createOrderbookImbalanceScenario({
        bidQuantities: [Number.MAX_VALUE],
        askQuantities: [Number.MAX_VALUE],
      });

      const analysis = service.analyze(orderbook);

      // Should return neutral on overflow (GRACEFUL_DEGRADE)
      expect(analysis.direction).toBe('NEUTRAL');
    });
  });

  // ============================================================================
  // SKIP LOGGING TESTS (3)
  // ============================================================================

  describe('SKIP - Logging Failures', () => {
    it('should continue despite logger.info failure in constructor', () => {
      const failingLogger = createOrderbookImbalanceFailingLogger(logger, {
        info: jest.fn(() => {
          throw new Error('Logger info failed');
        }),
      });

      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();

      // Should not throw despite logger failure (SKIP strategy)
      expect(
        () => createStandardOrderbookImbalanceService({ config, logger: asLogger(failingLogger), errorHandler }),
      ).not.toThrow();
    });

    it('should continue despite logger.warn failure in analyze()', () => {
      const failingLogger = createOrderbookImbalanceFailingLogger(logger, {
        warn: jest.fn(() => {
          throw new Error('Logger warn failed');
        }),
        debug: jest.fn(),
      });

      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createStandardOrderbookImbalanceService({ config, logger: asLogger(failingLogger), errorHandler });

      const orderbook = createOrderbookImbalanceScenario({
        bidQuantities: [NaN],
      });

      // Should not throw despite logger failure (SKIP strategy)
      expect(() => service.analyze(orderbook)).not.toThrow();
      // Should return neutral analysis
      const analysis = service.analyze(orderbook);
      expect(analysis.direction).toBe('NEUTRAL');
    });

    it('should handle null logger gracefully', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createStandardOrderbookImbalanceService({ config, logger: asLogger(null), errorHandler });

      const orderbook = createOrderbookImbalanceScenario();

      // Should not throw even with null logger
      expect(() => service.analyze(orderbook)).not.toThrow();
    });
  });

  // ============================================================================
  // INTEGRATION E2E TESTS (3)
  // ============================================================================

  describe('Integration - Cascading Failures', () => {
    it('should handle multiple invalid quantities gracefully', () => {
      const service = createService();

      const orderbook = createOrderbookImbalanceScenario({
        bidQuantities: [10, NaN, Infinity],
        askQuantities: [5, -Infinity],
      });

      const analysis = service.analyze(orderbook);

      // Should return neutral on first invalid (GRACEFUL_DEGRADE)
      expect(analysis.direction).toBe('NEUTRAL');
      expect(analysis.bidVolume).toBe(0);
      expect(analysis.strength).toBe(0);
    });

    it('should recover after calculation failure', () => {
      const service = createService();

      // First analysis with failure
      const failOrderbook = createOrderbookImbalanceScenario({
        bidQuantities: [NaN],
      });
      const analysis1 = service.analyze(failOrderbook);
      expect(analysis1.direction).toBe('NEUTRAL');

      // Second analysis should work fine (recovery)
      const successOrderbook = createOrderbookImbalanceScenario({
        bidQuantities: [100],
      });
      const analysis2 = service.analyze(successOrderbook);
      expect(analysis2.direction).toBe('BID');
      expect(analysis2.bidVolume).toBe(100);
      expect(analysis2.askVolume).toBe(10);
    });

    it('should handle service state consistency across failures', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createService({ config });

      // Verify config is preserved after error
      expect(service.getConfig()).toEqual(config);
      expect(service.isEnabled()).toBe(true);

      // Error should not affect service state
      const failOrderbook = createOrderbookImbalanceScenario({
        bidQuantities: [NaN],
      });
      service.analyze(failOrderbook);

      // Config should still be the same
      expect(service.getConfig()).toEqual(config);
      expect(service.isEnabled()).toBe(true);
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY TESTS (2)
  // ============================================================================

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler (optional DI)', () => {
      const service = createLegacyService({ logger });

      const orderbook = createOrderbookImbalanceScenario({
        bidQuantities: [100],
      });

      const analysis = service.analyze(orderbook);

      expect(analysis.direction).toBe('BID');
      expect(analysis.bidVolume).toBe(100);
      expect(analysis.askVolume).toBe(10);
    });

    it('should throw config validation errors even without ErrorHandler', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig({
        minImbalancePercent: 150,
      });

      // Should throw even without errorHandler
      expect(() => createLegacyService({ config, logger })).toThrow(
        'config.minImbalancePercent must be between 0 and 100',
      );
    });
  });

  // ============================================================================
  // EDGE CASES & ERROR CONTEXT TESTS (3)
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle all-NaN orderbook', () => {
      const service = createService();

      const orderbook = createOrderbookImbalanceScenario({
        bidQuantities: [NaN, NaN],
        askQuantities: [NaN, NaN],
      });

      const analysis = service.analyze(orderbook);

      expect(analysis.direction).toBe('NEUTRAL');
      expect(analysis.imbalance).toBe(0);
      expect(analysis.strength).toBe(0);
    });

    it('should handle ErrorHandler throw during execute', () => {
      const failingErrorHandler = {
        handle: jest.fn(() => {
          throw new Error('ErrorHandler failed');
        }),
        executeAsync: jest.fn(),
      } as unknown as ErrorHandler;

      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createStandardOrderbookImbalanceService({ config, logger, errorHandler: failingErrorHandler });

      const orderbook = createOrderbookImbalanceScenario({
        bidQuantities: [NaN],
      });

      // Should not throw even if ErrorHandler.handle throws
      expect(() => service.analyze(orderbook)).not.toThrow();
    });

    it('should validate level parameter boundaries', () => {
      // Test level = 1 (minimum valid)
      const config1: OrderbookImbalanceConfig = createOrderbookImbalanceConfig({
        levels: 1,
      });
      expect(() => createStandardOrderbookImbalanceService({ config: config1, logger, errorHandler })).not.toThrow();

      // Test large levels value
      const config2: OrderbookImbalanceConfig = createOrderbookImbalanceConfig({
        levels: 1000,
      });
      expect(() => createStandardOrderbookImbalanceService({ config: config2, logger, errorHandler })).not.toThrow();
    });
  });
});
