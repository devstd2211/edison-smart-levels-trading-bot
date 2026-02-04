/**
 * Phase 8.9.34: CircuitBreakerService ErrorHandler Integration Tests
 *
 * Tests SKIP and GRACEFUL_DEGRADE recovery strategies for logging and state operations
 */

import { CircuitBreakerService, CircuitBreakerConfig, CircuitState } from '../../services/circuit-breaker.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors';
import { LoggerService } from '../../types';

describe('CircuitBreakerService - Error Handling (Phase 8.9.34)', () => {
  let service: CircuitBreakerService;
  let logger: Partial<LoggerService>;
  let errorHandler: ErrorHandler;

  const config: CircuitBreakerConfig = {
    errorThreshold: 2,
    cooldownMs: 100,
    autoReset: true,
  };

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    errorHandler = new ErrorHandler(logger as LoggerService);
    service = new CircuitBreakerService(config, logger as LoggerService, errorHandler);
  });

  // =========================================================================
  // SKIP Strategy - Logging Failures
  // =========================================================================

  describe('SKIP Strategy - Logging Failures', () => {
    it('should skip logger errors in constructor', () => {
      const failingLogger = {
        info: jest.fn().mockImplementationOnce(() => {
          throw new Error('Logger init failed');
        }),
      };

      // Should not throw despite logger failure
      expect(() => {
        new CircuitBreakerService(config, failingLogger as any, errorHandler);
      }).not.toThrow();
    });

    it('should skip logger errors in state transitions (isOpen)', () => {
      const failingLogger = {
        info: jest.fn().mockImplementationOnce(() => {
          throw new Error('State transition log failed');
        }),
      };

      const testService = new CircuitBreakerService(config, failingLogger as any, errorHandler);
      testService.recordError('Test error 1');
      testService.recordError('Test error 2'); // Trigger trip

      // Fast forward past cooldown
      jest.useFakeTimers();
      jest.advanceTimersByTime(150);

      // Should not throw despite logger failure
      expect(() => {
        testService.isOpen(); // This should log state transition but fail
      }).not.toThrow();

      jest.useRealTimers();
    });

    it('should skip logger errors in recordSuccess', () => {
      const failingLogger = {
        ...logger,
        info: jest.fn().mockImplementationOnce(() => {
          throw new Error('Success log failed');
        }),
        debug: jest.fn().mockImplementationOnce(() => {
          throw new Error('Debug log failed');
        }),
      };

      const testService = new CircuitBreakerService(config, failingLogger as any, errorHandler);

      // Should not throw despite logger failures
      expect(() => {
        testService.recordSuccess();
      }).not.toThrow();

      expect(testService.getStats().totalSuccesses).toBe(1);
    });

    it('should skip logger errors in recordError', () => {
      const failingLogger = {
        ...logger,
        warn: jest.fn().mockImplementationOnce(() => {
          throw new Error('Error log failed');
        }),
      };

      const testService = new CircuitBreakerService(config, failingLogger as any, errorHandler);

      // Should not throw despite logger failure
      expect(() => {
        testService.recordError('Test error');
      }).not.toThrow();

      expect(testService.getStats().totalErrors).toBe(1);
    });

    it('should skip logger errors in trip', () => {
      const failingLogger = {
        ...logger,
        error: jest.fn().mockImplementationOnce(() => {
          throw new Error('Trip log failed');
        }),
      };

      const testService = new CircuitBreakerService(config, failingLogger as any, errorHandler);
      testService.recordError('Error 1');

      // Should not throw despite logger failure
      expect(() => {
        testService.recordError('Error 2'); // Triggers trip
      }).not.toThrow();

      expect(testService.getState()).toBe(CircuitState.OPEN);
    });

    it('should skip logger errors in reset', () => {
      const failingLogger = {
        ...logger,
        info: jest.fn().mockImplementationOnce(() => {
          throw new Error('Reset log failed');
        }),
      };

      const testService = new CircuitBreakerService(config, failingLogger as any, errorHandler);
      testService.recordError('Error 1');
      testService.recordError('Error 2'); // Trip circuit

      // Should not throw despite logger failure
      expect(() => {
        testService.reset();
      }).not.toThrow();

      expect(testService.getState()).toBe(CircuitState.CLOSED);
    });
  });

  // =========================================================================
  // GRACEFUL_DEGRADE Strategy - State/Data Operations
  // =========================================================================

  describe('GRACEFUL_DEGRADE Strategy - State/Data Operations', () => {
    it('should handle error history push failures gracefully', () => {
      const testService = new CircuitBreakerService(config, logger as LoggerService, errorHandler);

      // Spy on internal errorHistory to simulate push failure
      const originalPush = Array.prototype.push;
      let pushCallCount = 0;
      jest.spyOn(Array.prototype, 'push').mockImplementation(function (this: any, ...args: any[]) {
        pushCallCount++;
        if (pushCallCount === 1) {
          throw new Error('History push failed');
        }
        return originalPush.apply(this, args as any);
      });

      // Should not throw despite history error
      expect(() => {
        testService.recordError('Error with history failure');
      }).not.toThrow();

      // Circuit should still function
      expect(testService.getStats().totalErrors).toBe(1);

      jest.restoreAllMocks();
    });

    it('should return partial stats on getStats failure', () => {
      const testService = new CircuitBreakerService(config, logger as LoggerService, errorHandler);
      testService.recordSuccess();
      testService.recordSuccess();

      // Inject error by mocking Object.assign to fail
      const originalAssign = Object.assign;
      jest.spyOn(Object, 'assign').mockImplementationOnce(() => {
        throw new Error('Stats construction failed');
      });

      // Should not throw - should return partial stats
      const stats = testService.getStats();
      expect(stats).toBeDefined();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.totalSuccesses).toBe(2);

      // Restore
      jest.restoreAllMocks();
    });

    it('should return error history when available', () => {
      const testService = new CircuitBreakerService(config, logger as LoggerService, errorHandler);
      testService.recordError('Test error 1');
      testService.recordError('Test error 2');

      // Should return recorded errors
      const history = testService.getErrorHistory();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(2);
    });

    it('should correctly determine recovery eligibility', () => {
      const testService = new CircuitBreakerService(config, logger as LoggerService, errorHandler);
      testService.recordError('Error 1');
      testService.recordError('Error 2'); // Trip circuit

      // Immediately after tripping, should not be able to recover
      expect(testService.canAttemptRecovery()).toBe(false);

      // After cooldown, should be able to recover
      jest.useFakeTimers();
      jest.advanceTimersByTime(150); // Past cooldown
      expect(testService.canAttemptRecovery()).toBe(true);
      jest.useRealTimers();
    });

    it('should continue circuit operation through multiple errors', () => {
      const testService = new CircuitBreakerService(config, logger as LoggerService, errorHandler);

      // Record errors until circuit trips
      expect(() => {
        testService.recordError('Error 1');
        expect(testService.getState()).toBe(CircuitState.CLOSED);

        testService.recordError('Error 2'); // Trips circuit
        expect(testService.getState()).toBe(CircuitState.OPEN);
      }).not.toThrow();

      // Circuit should be in OPEN state
      expect(testService.getState()).toBe(CircuitState.OPEN);
    });
  });

  // =========================================================================
  // Backward Compatibility
  // =========================================================================

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler parameter', () => {
      const testService = new CircuitBreakerService(config, logger as LoggerService);

      // Should function normally
      testService.recordSuccess();
      testService.recordError('Test error');

      expect(testService.getStats().totalSuccesses).toBe(1);
      expect(testService.getStats().totalErrors).toBe(1);
    });

    it('should handle logger-only failures without ErrorHandler', () => {
      const failingLogger = {
        info: jest.fn().mockImplementation(() => {
          throw new Error('Log failed');
        }),
        warn: jest.fn().mockImplementation(() => {
          throw new Error('Log failed');
        }),
      };

      // Service without ErrorHandler should still work
      const testService = new CircuitBreakerService(config, failingLogger as any);

      // Should handle error despite failing logger (degraded mode)
      expect(() => {
        testService.recordError('Test error');
      }).not.toThrow();
    });

    it('should maintain state machine integrity with ErrorHandler', () => {
      const testService = new CircuitBreakerService(config, logger as LoggerService, errorHandler);

      expect(testService.getState()).toBe(CircuitState.CLOSED);

      testService.recordError('Error 1');
      expect(testService.getState()).toBe(CircuitState.CLOSED);
      expect(testService.getStats().consecutiveErrors).toBe(1);

      testService.recordError('Error 2');
      expect(testService.getState()).toBe(CircuitState.OPEN);

      testService.recordSuccess();
      // Should stay OPEN until cooldown
      expect(testService.getState()).toBe(CircuitState.OPEN);

      // Move to HALF_OPEN
      jest.useFakeTimers();
      jest.advanceTimersByTime(150);
      testService.isOpen();
      expect(testService.getState()).toBe(CircuitState.HALF_OPEN);

      testService.recordSuccess();
      expect(testService.getState()).toBe(CircuitState.CLOSED);

      jest.useRealTimers();
    });
  });

  // =========================================================================
  // Integration Tests
  // =========================================================================

  describe('Integration Tests', () => {
    it('should handle multiple concurrent failures gracefully', () => {
      const failingLogger = {
        info: jest.fn().mockImplementation(() => {
          throw new Error('Log failed');
        }),
        warn: jest.fn().mockImplementation(() => {
          throw new Error('Log failed');
        }),
        error: jest.fn().mockImplementation(() => {
          throw new Error('Log failed');
        }),
      };

      const testService = new CircuitBreakerService(config, failingLogger as any, errorHandler);

      // All operations should succeed despite logger failures
      expect(() => {
        for (let i = 0; i < 5; i++) {
          testService.recordError(`Error ${i}`);
        }
      }).not.toThrow();

      expect(testService.getStats().totalErrors).toBeGreaterThan(0);
    });

    it('should recover from errors and continue functioning', () => {
      let logErrorCount = 0;
      const intermittentLogger = {
        info: jest.fn().mockImplementation(() => {
          logErrorCount++;
          if (logErrorCount === 1) {
            throw new Error('Transient log failure');
          }
        }),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const testService = new CircuitBreakerService(config, intermittentLogger as any, errorHandler);

      // First operation fails in logger
      expect(() => {
        testService.recordError('First error');
      }).not.toThrow();

      // Second operation should succeed
      expect(() => {
        testService.recordError('Second error');
      }).not.toThrow();

      expect(testService.getStats().totalErrors).toBe(2);
    });
  });
});
