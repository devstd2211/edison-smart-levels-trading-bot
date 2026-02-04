/**
 * Phase 8.9.34: StrategyCircuitBreakerService ErrorHandler Integration Tests
 *
 * Tests SKIP and GRACEFUL_DEGRADE recovery strategies for logging and state operations
 */

import { StrategyCircuitBreakerService } from '../../services/multi-strategy/strategy-circuit-breaker.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors';
import { CircuitBreakerStatus } from '../../types/circuit-breaker.types';
import { LoggerService } from '../../types';

describe('StrategyCircuitBreakerService - Error Handling (Phase 8.9.34)', () => {
  let service: StrategyCircuitBreakerService;
  let logger: Partial<LoggerService>;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    errorHandler = new ErrorHandler(logger as LoggerService);
    service = new StrategyCircuitBreakerService(logger as LoggerService, {}, errorHandler);
  });

  // =========================================================================
  // SKIP Strategy - Logging Failures
  // =========================================================================

  describe('SKIP Strategy - Logging Failures', () => {
    it('should skip logger errors in recordSuccess', () => {
      const failingLogger = {
        debug: jest.fn().mockImplementationOnce(() => {
          throw new Error('Success log failed');
        }),
      };

      const testService = new StrategyCircuitBreakerService(failingLogger as any, {}, errorHandler);
      testService.recordSuccess('strategy-1');

      // Should not throw and should record success
      const state = testService.getState('strategy-1');
      expect(state.successCount).toBe(1);
    });

    it('should skip logger errors in recordFailure', () => {
      const failingLogger = {
        warn: jest.fn().mockImplementationOnce(() => {
          throw new Error('Failure log failed');
        }),
      };

      const testService = new StrategyCircuitBreakerService(failingLogger as any, {}, errorHandler);
      testService.recordFailure('strategy-1', new Error('Test failure'));

      // Should not throw and should record failure
      const state = testService.getState('strategy-1');
      expect(state.failureCount).toBe(1);
    });

    it('should skip logger errors in reset', () => {
      const failingLogger = {
        ...logger,
        info: jest.fn().mockImplementationOnce(() => {
          throw new Error('Reset log failed');
        }),
      };

      const testService = new StrategyCircuitBreakerService(failingLogger as any, {}, errorHandler);
      testService.recordFailure('strategy-1', new Error('Test failure'));
      testService.recordFailure('strategy-1', new Error('Test failure'));

      // Should not throw despite logger failure
      expect(() => {
        testService.reset('strategy-1');
      }).not.toThrow();

      const state = testService.getState('strategy-1');
      expect(state.status).toBe(CircuitBreakerStatus.CLOSED);
    });

    it('should skip logger errors in setConfig', () => {
      const failingLogger = {
        info: jest.fn().mockImplementationOnce(() => {
          throw new Error('Config log failed');
        }),
      };

      const testService = new StrategyCircuitBreakerService(failingLogger as any, {}, errorHandler);

      // Should not throw despite logger failure
      expect(() => {
        testService.setConfig('strategy-1', { failureThreshold: 10 });
      }).not.toThrow();

      const config = testService.getConfig('strategy-1');
      expect(config.failureThreshold).toBe(10);
    });

    it('should skip logger errors in all logging operations', () => {
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
        debug: jest.fn().mockImplementation(() => {
          throw new Error('Log failed');
        }),
      };

      const testService = new StrategyCircuitBreakerService(failingLogger as any, {}, errorHandler);

      // All these should not throw despite logger failures
      expect(() => {
        testService.recordSuccess('s1');
        testService.recordFailure('s1', new Error('fail'));
        testService.reset('s1');
        testService.setConfig('s1', { failureThreshold: 3 });
        testService.resetAll();
        testService.clear();
      }).not.toThrow();
    });
  });

  // =========================================================================
  // GRACEFUL_DEGRADE Strategy - State/Data Operations
  // =========================================================================

  describe('GRACEFUL_DEGRADE Strategy - State/Data Operations', () => {
    it('should handle error storage failures gracefully', () => {
      const testService = new StrategyCircuitBreakerService(logger as LoggerService, {}, errorHandler);

      // Inject error into Map.set for errors storage
      const originalSet = Map.prototype.set;
      let setCallCount = 0;
      jest.spyOn(Map.prototype, 'set').mockImplementation(function (this: any, ...args: any[]) {
        setCallCount++;
        // Fail on errors map operations (later calls)
        if (setCallCount > 2) {
          throw new Error('Error storage failed');
        }
        return originalSet.apply(this, args as any);
      });

      // Should not throw despite storage failure
      expect(() => {
        testService.recordFailure('strategy-1', new Error('Test failure'));
      }).not.toThrow();

      // Circuit should still function
      const state = testService.getState('strategy-1');
      expect(state.failureCount).toBe(1);

      jest.restoreAllMocks();
    });

    it('should recalculate metrics when cache fails', () => {
      const testService = new StrategyCircuitBreakerService(logger as LoggerService, {}, errorHandler);

      testService.recordSuccess('strategy-1');
      testService.recordFailure('strategy-1', new Error('fail'));

      // Inject cache retrieval failure
      jest.spyOn(Map.prototype, 'has').mockImplementationOnce(function () {
        throw new Error('Cache check failed');
      });

      // Should return metrics anyway (recalculated)
      const metrics = testService.getMetrics('strategy-1');
      expect(metrics).toBeDefined();
      expect(metrics.totalSuccesses).toBe(1);
      expect(metrics.totalFailures).toBe(1);

      jest.restoreAllMocks();
    });

    it('should continue state transitions despite cache invalidation failures', () => {
      const testService = new StrategyCircuitBreakerService(logger as LoggerService, {}, errorHandler);

      testService.recordSuccess('strategy-1');
      testService.recordFailure('strategy-1', new Error('fail'));

      // Inject cache delete failure
      jest.spyOn(Map.prototype, 'delete').mockImplementation(() => {
        throw new Error('Cache delete failed');
      });

      // Should not throw despite cache failure
      expect(() => {
        testService.recordFailure('strategy-1', new Error('fail2'));
      }).not.toThrow();

      // State transition should still occur
      const state = testService.getState('strategy-1');
      expect(state.failureCount).toBe(2);

      jest.restoreAllMocks();
    });

    it('should handle breaker creation errors gracefully', () => {
      const testService = new StrategyCircuitBreakerService(logger as LoggerService, {}, errorHandler);

      // Inject Map.set failure
      const originalSet = Map.prototype.set;
      jest.spyOn(Map.prototype, 'set').mockImplementationOnce(function () {
        throw new Error('Breaker creation failed');
      });

      // Should not throw - should create partial breaker
      expect(() => {
        testService.recordSuccess('strategy-1');
      }).not.toThrow();

      // Service should still function for subsequent operations
      const state = testService.getState('strategy-1');
      expect(state).toBeDefined();

      jest.restoreAllMocks();
    });

    it('should fallback to DEFAULT_CONFIG on config storage failure', () => {
      const testService = new StrategyCircuitBreakerService(logger as LoggerService, {}, errorHandler);

      // Inject config storage failure
      jest.spyOn(Map.prototype, 'set').mockImplementationOnce(function () {
        throw new Error('Config storage failed');
      });

      // Should not throw despite storage failure
      expect(() => {
        testService.setConfig('strategy-1', { failureThreshold: 99 });
      }).not.toThrow();

      // Should still have default config
      const config = testService.getConfig('strategy-1');
      expect(config).toBeDefined();
      expect(config.failureThreshold).toBe(5); // Default

      jest.restoreAllMocks();
    });

    it('should continue event emission despite callback failures', () => {
      const testService = new StrategyCircuitBreakerService(logger as LoggerService, {}, errorHandler);

      const callbacks = [
        jest.fn().mockImplementationOnce(() => {
          throw new Error('Callback 1 failed');
        }),
        jest.fn(), // This should still be called
        jest.fn().mockImplementationOnce(() => {
          throw new Error('Callback 2 failed');
        }),
      ];

      callbacks.forEach(cb => testService.onStateChange(cb));

      // Trigger state change - should call all callbacks despite failures
      testService.recordFailure('strategy-1', new Error('fail'));
      testService.recordFailure('strategy-1', new Error('fail'));

      // All callbacks should be attempted
      expect(callbacks[0]).toHaveBeenCalled();
      expect(callbacks[1]).toHaveBeenCalled();
      expect(callbacks[2]).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Backward Compatibility
  // =========================================================================

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler parameter', () => {
      const testService = new StrategyCircuitBreakerService(logger as LoggerService);

      testService.recordSuccess('strategy-1');
      testService.recordFailure('strategy-1', new Error('fail'));

      const state = testService.getState('strategy-1');
      expect(state.successCount).toBe(1);
      expect(state.failureCount).toBe(1);
    });

    it('should work without logger parameter', () => {
      const testService = new StrategyCircuitBreakerService(undefined, {}, errorHandler);

      // Should not throw despite undefined logger
      expect(() => {
        testService.recordSuccess('strategy-1');
        testService.recordFailure('strategy-1', new Error('fail'));
      }).not.toThrow();
    });

    it('should maintain state machine integrity with ErrorHandler', () => {
      const testService = new StrategyCircuitBreakerService(logger as LoggerService, {}, errorHandler);

      expect(testService.canExecute('strategy-1')).toBe(true);

      // Trigger failures to open circuit
      for (let i = 0; i < 5; i++) {
        testService.recordFailure('strategy-1', new Error('fail'));
      }

      expect(testService.canExecute('strategy-1')).toBe(false);
      let state = testService.getState('strategy-1');
      expect(state.status).toBe(CircuitBreakerStatus.OPEN);

      // Wait for timeout
      jest.useFakeTimers();
      jest.advanceTimersByTime(35000);
      jest.useRealTimers();

      expect(testService.canExecute('strategy-1')).toBe(true);
      state = testService.getState('strategy-1');
      expect(state.status).toBe(CircuitBreakerStatus.HALF_OPEN);

      // Successful operation should close
      testService.recordSuccess('strategy-1');
      testService.recordSuccess('strategy-1');
      testService.recordSuccess('strategy-1');

      state = testService.getState('strategy-1');
      expect(state.status).toBe(CircuitBreakerStatus.CLOSED);
    });

    it('should isolate failures between strategies with ErrorHandler', () => {
      const testService = new StrategyCircuitBreakerService(logger as LoggerService, {}, errorHandler);

      // Fail strategy-1
      for (let i = 0; i < 5; i++) {
        testService.recordFailure('strategy-1', new Error('fail'));
      }

      // Strategy-2 should be unaffected
      expect(testService.canExecute('strategy-1')).toBe(false);
      expect(testService.canExecute('strategy-2')).toBe(true);

      // Fail strategy-2
      for (let i = 0; i < 5; i++) {
        testService.recordFailure('strategy-2', new Error('fail'));
      }

      expect(testService.canExecute('strategy-1')).toBe(false);
      expect(testService.canExecute('strategy-2')).toBe(false);

      // Reset only strategy-1
      testService.reset('strategy-1');
      expect(testService.canExecute('strategy-1')).toBe(true);
      expect(testService.canExecute('strategy-2')).toBe(false);
    });
  });

  // =========================================================================
  // Integration Tests
  // =========================================================================

  describe('Integration Tests', () => {
    it('should handle multiple concurrent failures across strategies', () => {
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

      const testService = new StrategyCircuitBreakerService(failingLogger as any, {}, errorHandler);

      // Multiple strategies with failures
      expect(() => {
        for (let i = 1; i <= 5; i++) {
          for (let j = 0; j < 6; j++) {
            testService.recordFailure(`strategy-${i}`, new Error('fail'));
          }
        }
      }).not.toThrow();

      // All should be OPEN despite logger failures
      for (let i = 1; i <= 5; i++) {
        const state = testService.getState(`strategy-${i}`);
        expect(state.status).toBe(CircuitBreakerStatus.OPEN);
      }
    });

    it('should recover multiple strategies independently', () => {
      const testService = new StrategyCircuitBreakerService(logger as LoggerService, {}, errorHandler);

      // Open multiple circuits
      ['s1', 's2', 's3'].forEach(sid => {
        for (let i = 0; i < 5; i++) {
          testService.recordFailure(sid, new Error('fail'));
        }
      });

      // Reset in different order
      testService.reset('s2');
      testService.reset('s1');

      expect(testService.canExecute('s1')).toBe(true);
      expect(testService.canExecute('s2')).toBe(true);
      expect(testService.canExecute('s3')).toBe(false);
    });

    it('should track metrics correctly despite error handling', () => {
      const testService = new StrategyCircuitBreakerService(logger as LoggerService, {}, errorHandler);

      testService.recordSuccess('strategy-1');
      testService.recordSuccess('strategy-1');
      testService.recordFailure('strategy-1', new Error('fail'));

      const metrics = testService.getMetrics('strategy-1');
      expect(metrics.totalSuccesses).toBe(2);
      expect(metrics.totalFailures).toBe(1);
      expect(metrics.failureRate).toBeCloseTo(1 / 3, 1);
    });

    it('should emit all events despite callback failures', () => {
      const testService = new StrategyCircuitBreakerService(logger as LoggerService, {}, errorHandler);

      const eventLog: string[] = [];

      testService.onStateChange((event) => {
        throw new Error('Callback 1 failed');
      });

      testService.onStateChange((event) => {
        eventLog.push(event.type);
      });

      testService.onStateChange((event) => {
        throw new Error('Callback 2 failed');
      });

      // Trigger state changes
      testService.recordFailure('strategy-1', new Error('fail'));

      // Second callback should still be called despite others throwing
      expect(eventLog).toContain('OPENED');
    });

    it('should maintain service-wide statistics correctly', () => {
      const testService = new StrategyCircuitBreakerService(logger as LoggerService, {}, errorHandler);

      testService.recordSuccess('s1');
      testService.recordSuccess('s2');
      testService.recordFailure('s1', new Error('fail'));
      testService.recordFailure('s3', new Error('fail'));

      const stats = testService.getStats();
      expect(stats.totalBreakers).toBe(3);
      expect(stats.totalSuccesses).toBe(2);
      expect(stats.totalFailures).toBe(2);
      expect(stats.breakersClosed).toBe(3);
    });
  });
});
