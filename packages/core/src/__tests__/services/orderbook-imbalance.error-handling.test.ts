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
  createOrderbookImbalanceHarness,
  createOrderbookImbalanceOrderbook,
  createOrderbookImbalanceService,
} from '../helpers/orderbook-imbalance-test.utils';

describe('OrderbookImbalanceService - Error Handling (Phase 8.9.49)', () => {
  const asOrderbook = (
    value: unknown
  ): { bids: [number, number][]; asks: [number, number][] } =>
    value as { bids: [number, number][]; asks: [number, number][] };
  const asLogger = (value: unknown): LoggerService => value as LoggerService;

  let logger: LoggerService;
  let errorHandler: ErrorHandler | undefined;

  beforeEach(() => {
    ({ logger, errorHandler } = createOrderbookImbalanceHarness());
  });

  // ============================================================================
  // THROW VALIDATION TESTS (5)
  // ============================================================================

  describe('THROW - Config Validation', () => {
    it('should throw on invalid levels (< 1)', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig({
        levels: 0,
      });

      expect(() => createOrderbookImbalanceService({ config, logger, errorHandler })).toThrow(
        'config.levels must be >= 1',
      );
    });

    it('should throw on negative minImbalancePercent', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig({
        minImbalancePercent: -10,
      });

      expect(() => createOrderbookImbalanceService({ config, logger, errorHandler })).toThrow(
        'config.minImbalancePercent must be between 0 and 100',
      );
    });

    it('should throw on minImbalancePercent > 100', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig({
        minImbalancePercent: 150,
      });

      expect(() => createOrderbookImbalanceService({ config, logger, errorHandler })).toThrow(
        'config.minImbalancePercent must be between 0 and 100',
      );
    });

    it('should throw on non-boolean enabled', () => {
      const config = {
        enabled: 'true' as unknown as boolean, // Invalid: string instead of boolean
        minImbalancePercent: 30,
        levels: 10,
      };

      expect(() => createOrderbookImbalanceService({ config, logger, errorHandler })).toThrow(
        'config.enabled must be boolean',
      );
    });
  });

  describe('THROW - Input Validation', () => {
    it('should throw on null orderbook', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createOrderbookImbalanceService({ config, logger, errorHandler });

      expect(() => service.analyze(asOrderbook(null))).toThrow('orderbook is required');
    });

    it('should throw on undefined orderbook', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createOrderbookImbalanceService({ config, logger, errorHandler });

      expect(() => service.analyze(asOrderbook(undefined))).toThrow('orderbook is required');
    });

    it('should throw on non-array bids', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createOrderbookImbalanceService({ config, logger, errorHandler });

      const orderbook = createOrderbookImbalanceOrderbook({
        bids: 'not-an-array' as unknown as [number, number][],
      });

      expect(() => service.analyze(orderbook)).toThrow('bids and asks must be arrays');
    });

    it('should throw on non-array asks', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createOrderbookImbalanceService({ config, logger, errorHandler });

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
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createOrderbookImbalanceService({ config, logger, errorHandler });

      const orderbook = createOrderbookImbalanceOrderbook({
        bids: [[50000, NaN]],
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
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createOrderbookImbalanceService({ config, logger, errorHandler });

      const orderbook = createOrderbookImbalanceOrderbook({
        asks: [[50010, Infinity]],
      });

      const analysis = service.analyze(orderbook);

      // Should return neutral (GRACEFUL_DEGRADE)
      expect(analysis.direction).toBe('NEUTRAL');
      expect(analysis.bidVolume).toBe(0);
      expect(analysis.askVolume).toBe(0);
    });

    it('should return neutral analysis on negative infinity', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createOrderbookImbalanceService({ config, logger, errorHandler });

      const orderbook = createOrderbookImbalanceOrderbook({
        bids: [[50000, -Infinity]],
      });

      const analysis = service.analyze(orderbook);

      // Should return neutral (GRACEFUL_DEGRADE)
      expect(analysis.direction).toBe('NEUTRAL');
      expect(analysis.bidVolume).toBe(0);
      expect(analysis.askVolume).toBe(0);
    });

    it('should handle mixed valid and invalid quantities', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createOrderbookImbalanceService({ config, logger, errorHandler });

      const orderbook = createOrderbookImbalanceOrderbook({
        bids: [
          [50000, 10],
          [49990, NaN],
        ],
      });

      const analysis = service.analyze(orderbook);

      // Should return neutral on first invalid quantity (GRACEFUL_DEGRADE)
      expect(analysis.direction).toBe('NEUTRAL');
    });

    it('should handle calculation overflow gracefully', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createOrderbookImbalanceService({ config, logger, errorHandler });

      const orderbook = createOrderbookImbalanceOrderbook({
        bids: [[50000, Number.MAX_VALUE]],
        asks: [[50010, Number.MAX_VALUE]],
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
        () => createOrderbookImbalanceService({ config, logger: asLogger(failingLogger), errorHandler }),
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
      const service = createOrderbookImbalanceService({ config, logger: asLogger(failingLogger), errorHandler });

      const orderbook = createOrderbookImbalanceOrderbook({
        bids: [[50000, NaN]],
      });

      // Should not throw despite logger failure (SKIP strategy)
      expect(() => service.analyze(orderbook)).not.toThrow();
      // Should return neutral analysis
      const analysis = service.analyze(orderbook);
      expect(analysis.direction).toBe('NEUTRAL');
    });

    it('should handle null logger gracefully', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createOrderbookImbalanceService({ config, logger: asLogger(null), errorHandler });

      const orderbook = createOrderbookImbalanceOrderbook();

      // Should not throw even with null logger
      expect(() => service.analyze(orderbook)).not.toThrow();
    });
  });

  // ============================================================================
  // INTEGRATION E2E TESTS (3)
  // ============================================================================

  describe('Integration - Cascading Failures', () => {
    it('should handle multiple invalid quantities gracefully', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createOrderbookImbalanceService({ config, logger, errorHandler });

      const orderbook = createOrderbookImbalanceOrderbook({
        bids: [
          [50000, 10],
          [49990, NaN],
          [49980, Infinity],
        ],
        asks: [
          [50010, 5],
          [50020, -Infinity],
        ],
      });

      const analysis = service.analyze(orderbook);

      // Should return neutral on first invalid (GRACEFUL_DEGRADE)
      expect(analysis.direction).toBe('NEUTRAL');
      expect(analysis.bidVolume).toBe(0);
      expect(analysis.strength).toBe(0);
    });

    it('should recover after calculation failure', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createOrderbookImbalanceService({ config, logger, errorHandler });

      // First analysis with failure
      const failOrderbook = createOrderbookImbalanceOrderbook({
        bids: [[50000, NaN]],
      });
      const analysis1 = service.analyze(failOrderbook);
      expect(analysis1.direction).toBe('NEUTRAL');

      // Second analysis should work fine (recovery)
      const successOrderbook = createOrderbookImbalanceOrderbook({
        bids: [[50000, 100]],
      });
      const analysis2 = service.analyze(successOrderbook);
      expect(analysis2.direction).toBe('BID');
      expect(analysis2.bidVolume).toBe(100);
      expect(analysis2.askVolume).toBe(10);
    });

    it('should handle service state consistency across failures', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createOrderbookImbalanceService({ config, logger, errorHandler });

      // Verify config is preserved after error
      expect(service.getConfig()).toEqual(config);
      expect(service.isEnabled()).toBe(true);

      // Error should not affect service state
      const failOrderbook = createOrderbookImbalanceOrderbook({
        bids: [[50000, NaN]],
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
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();

      // Constructor without errorHandler
      const service = createOrderbookImbalanceService({ config, logger, withErrorHandler: false });

      const orderbook = createOrderbookImbalanceOrderbook({
        bids: [[50000, 100]],
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
      expect(() => createOrderbookImbalanceService({ config, logger, withErrorHandler: false })).toThrow(
        'config.minImbalancePercent must be between 0 and 100',
      );
    });
  });

  // ============================================================================
  // EDGE CASES & ERROR CONTEXT TESTS (3)
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle all-NaN orderbook', () => {
      const config: OrderbookImbalanceConfig = createOrderbookImbalanceConfig();
      const service = createOrderbookImbalanceService({ config, logger, errorHandler });

      const orderbook = createOrderbookImbalanceOrderbook({
        bids: [
          [50000, NaN],
          [49990, NaN],
        ],
        asks: [
          [50010, NaN],
          [50020, NaN],
        ],
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
      const service = createOrderbookImbalanceService({ config, logger, errorHandler: failingErrorHandler });

      const orderbook = createOrderbookImbalanceOrderbook({
        bids: [[50000, NaN]],
      });

      // Should not throw even if ErrorHandler.handle throws
      expect(() => service.analyze(orderbook)).not.toThrow();
    });

    it('should validate level parameter boundaries', () => {
      // Test level = 1 (minimum valid)
      const config1: OrderbookImbalanceConfig = createOrderbookImbalanceConfig({
        levels: 1,
      });
      expect(() => createOrderbookImbalanceService({ config: config1, logger, errorHandler })).not.toThrow();

      // Test large levels value
      const config2: OrderbookImbalanceConfig = createOrderbookImbalanceConfig({
        levels: 1000,
      });
      expect(() => createOrderbookImbalanceService({ config: config2, logger, errorHandler })).not.toThrow();
    });
  });
});
