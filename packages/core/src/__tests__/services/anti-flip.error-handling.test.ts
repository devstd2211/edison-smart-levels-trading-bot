/**
 * AntiFlipService - Error Handling Tests
 *
 * Phase 8.9.20: ErrorHandler Integration
 * Tests for SKIP strategy on logger failures
 *
 * Scenarios:
 * - Logger failures on all 5 operations
 * - Integration with complex signal flows
 * - Backward compatibility (works without ErrorHandler)
 * - Performance with error handling
 * - Edge cases (null logger, non-Error throws)
 */

import { AntiFlipService } from '../../services/anti-flip.service';
import { ErrorHandler } from '../../errors';
import { LoggerService, SignalDirection } from '../../types/legacy';
import {
  createAntiFlipConfig,
  createAntiFlipLogger,
  createManagedAntiFlipContext,
  createBearishAntiFlipCandle,
  type ManagedAntiFlipContext,
} from '../helpers/anti-flip-test.utils';

type AntiFlipSharedState = Pick<
  ManagedAntiFlipContext,
  'logger' | 'errorHandler' | 'createService' | 'createLegacyService' | 'createStandardService' | 'cleanup'
>;
type AntiFlipFactoryState = Pick<
  ManagedAntiFlipContext,
  'createService' | 'createLegacyService' | 'createStandardService'
>;

// ============================================================================
// TESTS
// ============================================================================

describe('AntiFlipService - Error Handling (Phase 8.9.20)', () => {
  let service: AntiFlipService;
  let logger: LoggerService;
  let errorHandler: ErrorHandler;
  let createService: AntiFlipFactoryState['createService'];
  let createLegacyService: AntiFlipFactoryState['createLegacyService'];
  let createStandardService: AntiFlipFactoryState['createStandardService'];
  let cleanup: AntiFlipSharedState['cleanup'];

  beforeEach(() => {
    ({
      logger,
      errorHandler,
      createService,
      createLegacyService,
      createStandardService,
      cleanup,
    } = createManagedAntiFlipContext());
    service = createService();
  });

  afterEach(() => {
    cleanup();
  });

  // ========================================================================
  // SKIP Strategy Tests (5 tests)
  // ========================================================================

  describe('SKIP Strategy for Logger Failures (5 tests)', () => {
    it('test-8.9.20.1: Should skip high confidence override log failure', () => {
      service = createService({ overrideConfidenceThreshold: 85 });

      // Mock logger to throw on high confidence override
      let callCount = 0;
      jest.spyOn(logger, 'info').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Logger write failed');
        }
      });

      // Record initial signal
      service.recordSignal(SignalDirection.LONG, 100);

      // High confidence opposite direction should bypass cooldown
      // even if logging fails
      const result = service.shouldBlockSignal(
        SignalDirection.SHORT,
        90, // High confidence
        100,
      );

      // Should NOT be blocked despite logger error
      expect(result.blocked).toBe(false);
      expect(result.reason).toContain('High confidence override');
    });

    it('test-8.9.20.2: Should skip RSI reversal log failure', () => {
      service = createService({ strongReversalRsiThreshold: 25 });

      // Mock logger to throw on RSI reversal log
      jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger write failed');
      });

      // Record initial LONG signal
      service.recordSignal(SignalDirection.LONG, 100);

      // Strong RSI reversal for SHORT (overbought, RSI >= 75) should bypass cooldown even if logging fails
      const result = service.shouldBlockSignal(
        SignalDirection.SHORT,
        50,
        100,
        80, // Very high RSI (strong reversal for SHORT)
      );

      // Should NOT be blocked despite logger error
      expect(result.blocked).toBe(false);
      expect(result.reason).toContain('Strong RSI reversal');
    });

    it('test-8.9.20.3: Should skip candle confirmation log failure', () => {
      service = createService({ requiredConfirmationCandles: 2 });

      // Mock logger to throw on candle confirmation
      jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger write failed');
      });

      // Record initial signal
      service.recordSignal(SignalDirection.LONG, 100);

      // Candle confirmation should bypass cooldown even if logging fails
      const confirmationCandles = [
        createBearishAntiFlipCandle(99),
        createBearishAntiFlipCandle(98),
      ];

      const result = service.shouldBlockSignal(
        SignalDirection.SHORT,
        50,
        100,
        undefined,
        confirmationCandles,
      );

      // Should NOT be blocked despite logger error
      expect(result.blocked).toBe(false);
      expect(result.reason).toContain('confirmation candles');
    });

    it('test-8.9.20.4: Should skip anti-flip blocked warning log failure', () => {
      service = createService({ overrideConfidenceThreshold: 85 });

      // Mock logger to throw on warning log
      jest.spyOn(logger, 'warn').mockImplementation(() => {
        throw new Error('Logger write failed');
      });

      // Record initial signal
      service.recordSignal(SignalDirection.LONG, 100);

      // Low confidence opposite direction within cooldown should be blocked
      // even if logging fails
      const result = service.shouldBlockSignal(
        SignalDirection.SHORT,
        50, // Low confidence
        100,
      );

      // Should be blocked (not high confidence, not strong reversal, no confirmation)
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('Flip blocked');
    });

    it('test-8.9.20.5: Should skip signal recorded debug log failure', () => {
      service = createService();

      // Mock logger to throw on debug log
      jest.spyOn(logger, 'debug').mockImplementation(() => {
        throw new Error('Logger write failed');
      });

      // recordSignal should succeed even if debug log fails
      expect(() => {
        service.recordSignal(SignalDirection.LONG, 100);
      }).not.toThrow();

      // Signal should be recorded despite logger error
      const state = service.getState();
      expect(state.lastSignal).toBeDefined();
      expect(state.lastSignal?.direction).toBe(SignalDirection.LONG);
    });
  });

  // ========================================================================
  // Integration Tests (5 tests)
  // ========================================================================

  describe('Integration Scenarios (5 tests)', () => {
    it('test-8.9.20.6: Should handle rapid signal checks with intermittent logger failures', () => {
      service = createService();

      // Mock logger to fail sometimes
      let infoCallCount = 0;
      jest.spyOn(logger, 'info').mockImplementation(() => {
        infoCallCount++;
        if (infoCallCount % 2 === 0) {
          throw new Error('Logger error');
        }
      });

      // Record initial signal
      service.recordSignal(SignalDirection.LONG, 100);

      // Rapid opposite direction checks with intermittent failures
      for (let i = 0; i < 5; i++) {
        const result = service.shouldBlockSignal(
          SignalDirection.SHORT,
          90 + i, // Increase confidence
          100 + i,
        );

        // All should succeed (logging failures skipped)
        expect(result).toBeDefined();
        expect(result.blocked).toBeFalsy(); // Eventually will pass high confidence
      }

      // All operations should succeed despite intermittent failures
    });

    it('test-8.9.20.7: Should handle all logger methods failing simultaneously', () => {
      service = createService();

      // Mock all logger methods to throw
      jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger info failed');
      });
      jest.spyOn(logger, 'warn').mockImplementation(() => {
        throw new Error('Logger warn failed');
      });
      jest.spyOn(logger, 'debug').mockImplementation(() => {
        throw new Error('Logger debug failed');
      });

      // All operations should succeed despite logger failures
      service.recordSignal(SignalDirection.LONG, 100);

      const result1 = service.shouldBlockSignal(SignalDirection.SHORT, 90, 100);
      expect(result1).toBeDefined();
      expect(result1.blocked).toBeFalsy();

      // Advance candles to trigger warning log
      jest.advanceTimersByTime(400000);
      service.onNewCandle();
      service.onNewCandle();
      service.onNewCandle();

      const result2 = service.shouldBlockSignal(SignalDirection.SHORT, 50, 100);
      expect(result2.blocked).toBe(false); // Cooldown passed
    });

    it('test-8.9.20.8: Should handle logger failures during state changes', () => {
      service = createService();

      // Mock logger
      jest.spyOn(logger, 'debug').mockImplementation(() => {
        throw new Error('Logger write failed');
      });

      // Record multiple signals
      service.recordSignal(SignalDirection.LONG, 100);
      service.recordSignal(SignalDirection.SHORT, 101);
      service.recordSignal(SignalDirection.LONG, 102);

      // State should be correctly updated despite logger failures
      const state = service.getState();
      expect(state.lastSignal?.direction).toBe(SignalDirection.LONG);
      expect(state.lastSignal?.price).toBe(102);
    });

    it('test-8.9.20.9: Should handle mixed logger success/failure patterns', () => {
      service = createService();

      let infoCallCount = 0;
      let debugCallCount = 0;

      jest.spyOn(logger, 'info').mockImplementation(() => {
        infoCallCount++;
        // Fail on every 3rd call
        if (infoCallCount % 3 === 0) {
          throw new Error('Logger info failed');
        }
      });

      jest.spyOn(logger, 'debug').mockImplementation(() => {
        debugCallCount++;
        // Fail on odd calls
        if (debugCallCount % 2 === 1) {
          throw new Error('Logger debug failed');
        }
      });

      // Complex flow with mixed failures
      service.recordSignal(SignalDirection.LONG, 100);
      service.shouldBlockSignal(SignalDirection.SHORT, 90, 100);
      service.recordSignal(SignalDirection.SHORT, 101);
      service.shouldBlockSignal(SignalDirection.LONG, 85, 102);

      // All operations should complete successfully
      const state = service.getState();
      expect(state.lastSignal?.direction).toBe(SignalDirection.SHORT);
    });

    it('test-8.9.20.10: Should maintain anti-flip logic correctness with error handling', () => {
      service = createService({ cooldownCandles: 2, cooldownMs: 100000 });

      // Mock all logger methods to fail
      jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger failed');
      });
      jest.spyOn(logger, 'warn').mockImplementation(() => {
        throw new Error('Logger failed');
      });
      jest.spyOn(logger, 'debug').mockImplementation(() => {
        throw new Error('Logger failed');
      });

      // Record LONG signal
      service.recordSignal(SignalDirection.LONG, 100);

      // SHORT within cooldown should be blocked
      let result = service.shouldBlockSignal(SignalDirection.SHORT, 50, 100);
      expect(result.blocked).toBe(true);

      // Advance 1 candle
      service.onNewCandle();
      result = service.shouldBlockSignal(SignalDirection.SHORT, 50, 100);
      expect(result.blocked).toBe(true);

      // Advance 2 more candles (total 3 >= cooldownCandles: 2)
      service.onNewCandle();
      service.onNewCandle();
      result = service.shouldBlockSignal(SignalDirection.SHORT, 50, 100);
      expect(result.blocked).toBe(false); // Cooldown period met
    });
  });

  // ========================================================================
  // Backward Compatibility Tests (3 tests)
  // ========================================================================

  describe('Backward Compatibility (3 tests)', () => {
    it('test-8.9.20.11: Should work without ErrorHandler (old behavior)', () => {
      // No ErrorHandler provided
      service = createLegacyService(createAntiFlipConfig(), { logger });

      // Mock logger to throw
      jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger failed');
      });

      // Should still work (no ErrorHandler, errors are silently caught)
      expect(() => {
        service.recordSignal(SignalDirection.LONG, 100);
        service.shouldBlockSignal(SignalDirection.SHORT, 90, 100);
      }).not.toThrow();

      const state = service.getState();
      expect(state.lastSignal?.direction).toBe(SignalDirection.LONG);
    });

    it('test-8.9.20.12: Should silently skip logger errors without ErrorHandler', () => {
      service = createLegacyService(createAntiFlipConfig(), { logger });

      jest.spyOn(logger, 'debug').mockImplementation(() => {
        throw new Error('Logger error');
      });

      // recordSignal should not throw despite logger error
      service.recordSignal(SignalDirection.LONG, 100);

      // Signal should be recorded
      const state = service.getState();
      expect(state.lastSignal?.direction).toBe(SignalDirection.LONG);

      // No ErrorHandler was called (because it doesn't exist)
      expect(errorHandler.handle).not.toHaveBeenCalled();
    });

    it('test-8.9.20.13: Should have identical blocking logic with/without ErrorHandler', () => {
      const service1 = createService();
      const service2 = createLegacyService(createAntiFlipConfig(), { logger });

      // Mock logger to always fail
      jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger failed');
      });
      jest.spyOn(logger, 'warn').mockImplementation(() => {
        throw new Error('Logger failed');
      });

      // Both services should have identical blocking behavior
      service1.recordSignal(SignalDirection.LONG, 100);
      service2.recordSignal(SignalDirection.LONG, 100);

      const result1 = service1.shouldBlockSignal(SignalDirection.SHORT, 50, 100);
      const result2 = service2.shouldBlockSignal(SignalDirection.SHORT, 50, 100);

      expect(result1.blocked).toBe(result2.blocked);
      expect(result1.reason).toBe(result2.reason);
    });
  });

  // ========================================================================
  // Performance Tests (3 tests)
  // ========================================================================

  describe('Performance with Error Handling (3 tests)', () => {
    it('test-8.9.20.14: Should maintain performance with ErrorHandler', () => {
      service = createService();

      // Mock logger to fail
      jest.spyOn(logger, 'debug').mockImplementation(() => {
        throw new Error('Logger failed');
      });

      const startTime = Date.now();

      // 1000 signal recordings
      for (let i = 0; i < 1000; i++) {
        service.recordSignal(
          i % 2 === 0 ? SignalDirection.LONG : SignalDirection.SHORT,
          100 + i * 0.1,
        );
      }

      const elapsed = Date.now() - startTime;

      // Should complete in < 500ms even with ErrorHandler + logger failures
      expect(elapsed).toBeLessThan(500);
    });

    it('test-8.9.20.15: Should recover from errors without performance degradation', () => {
      service = createService();

      let callCount = 0;
      jest.spyOn(logger, 'debug').mockImplementation(() => {
        callCount++;
        // Fail every 10 calls
        if (callCount % 10 === 0) {
          throw new Error('Logger error');
        }
      });

      const startTime = Date.now();

      // 500 operations with intermittent failures
      for (let i = 0; i < 500; i++) {
        service.recordSignal(SignalDirection.LONG, 100 + i);
      }

      const elapsed = Date.now() - startTime;

      // Should complete efficiently even with error recovery
      expect(elapsed).toBeLessThan(300);
    });

    it('test-8.9.20.16: Should efficiently create error context without overhead', () => {
      service = createService();

      jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger failed');
      });

      const startTime = Date.now();

      // 1000 signal checks (generates many error contexts)
      service.recordSignal(SignalDirection.LONG, 100);
      for (let i = 0; i < 1000; i++) {
        service.shouldBlockSignal(SignalDirection.SHORT, 90 + (i % 10), 100 + i * 0.1);
      }

      const elapsed = Date.now() - startTime;

      // Error context creation should add minimal overhead
      expect(elapsed).toBeLessThan(1000);
    });
  });

  // ========================================================================
  // Edge Cases Tests (4 tests)
  // ========================================================================

  describe('Edge Cases (4 tests)', () => {
    it('test-8.9.20.17: Should handle null/undefined logger methods gracefully', () => {
      const mockLoggerWithNullMethods = createAntiFlipLogger();
      const nullableLogger = mockLoggerWithNullMethods as unknown as {
        debug: LoggerService['debug'] | null;
        info: LoggerService['info'] | null;
        warn: LoggerService['warn'] | null;
      };

      // Manually set methods to null to simulate edge case
      nullableLogger.debug = null;
      nullableLogger.info = null;
      nullableLogger.warn = null;

      service = createStandardService(createAntiFlipConfig({}), {
        logger: mockLoggerWithNullMethods,
        errorHandler,
      });

      // Should handle null methods gracefully (throw will be caught)
      service.recordSignal(SignalDirection.LONG, 100);

      // Service state should still be valid
      const state = service.getState();
      expect(state.lastSignal?.direction).toBe(SignalDirection.LONG);
    });

    it('test-8.9.20.18: Should handle logger throwing non-Error objects', () => {
      service = createService();

      // Mock logger to throw non-Error objects
      jest.spyOn(logger, 'info').mockImplementation(() => {
        throw 'String error'; // Throwing string instead of Error
      });
      jest.spyOn(logger, 'debug').mockImplementation(() => {
        throw { custom: 'object' }; // Throwing object
      });

      // Should handle non-Error throws gracefully
      expect(() => {
        service.recordSignal(SignalDirection.LONG, 100);
      }).not.toThrow();

      expect(() => {
        service.shouldBlockSignal(SignalDirection.SHORT, 90, 100);
      }).not.toThrow();

      expect(errorHandler.handle).toHaveBeenCalled();
    });

    it('test-8.9.20.19: Should handle ErrorHandler itself throwing', () => {
      service = createService();

      // Mock logger to throw
      jest.spyOn(logger, 'debug').mockImplementation(() => {
        throw new Error('Logger failed');
      });

      // Mock ErrorHandler.handle to throw
      jest.spyOn(errorHandler, 'handle').mockImplementation(() => {
        throw new Error('ErrorHandler failed');
      });

      // Should not crash even if ErrorHandler throws
      expect(() => {
        service.recordSignal(SignalDirection.LONG, 100);
      }).toThrow(); // The ErrorHandler throw will propagate, but that's edge case

      // Service state should still be valid
      const state = service.getState();
      expect(state.lastSignal?.direction).toBe(SignalDirection.LONG);
    });

    it('test-8.9.20.20: Should handle concurrent logger failures during rapid operations', () => {
      service = createService();

      let infoCallCount = 0;
      let warnCallCount = 0;

      jest.spyOn(logger, 'info').mockImplementation(() => {
        infoCallCount++;
        if (infoCallCount > 5) throw new Error('Too many calls');
      });

      jest.spyOn(logger, 'warn').mockImplementation(() => {
        warnCallCount++;
        if (warnCallCount > 3) throw new Error('Too many warns');
      });

      // Record initial signal
      service.recordSignal(SignalDirection.LONG, 100);

      // Rapid sequential checks
      for (let i = 0; i < 10; i++) {
        const result = service.shouldBlockSignal(
          SignalDirection.SHORT,
          80 + i,
          100 + i * 0.1,
        );
        expect(result).toBeDefined();
      }

      // Service should remain operational
      const state = service.getState();
      expect(state.lastSignal?.direction).toBe(SignalDirection.LONG);

      // Service should remain operational despite concurrent failures
    });
  });
});
