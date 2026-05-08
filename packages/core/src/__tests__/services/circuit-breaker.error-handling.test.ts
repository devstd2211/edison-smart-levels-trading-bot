/**
 * Phase 8.9.34: CircuitBreakerService ErrorHandler Integration Tests
 *
 * Tests SKIP and GRACEFUL_DEGRADE recovery strategies for logging and state operations
 */

import { CircuitState } from '../../services/circuit-breaker.service';
import { LoggerService } from '../../types/legacy';
import {
  createCircuitBreakerFailingLogger,
  createCircuitBreakerConfig,
  createCircuitBreakerMockLogger,
  type CircuitBreakerErrorHandlingState,
  createManagedCircuitBreakerContext,
} from '../helpers/circuit-breaker-test.utils';

describe('CircuitBreakerService - Error Handling (Phase 8.9.34)', () => {
  let service: CircuitBreakerErrorHandlingState['service'];
  let logger: CircuitBreakerErrorHandlingState['logger'];
  let errorHandler: CircuitBreakerErrorHandlingState['errorHandler'];
  let config: CircuitBreakerErrorHandlingState['config'];
  let createStandardService: CircuitBreakerErrorHandlingState['createStandardService'];
  let createLegacyService: CircuitBreakerErrorHandlingState['createLegacyService'];
  let cleanup: CircuitBreakerErrorHandlingState['cleanup'];

  beforeEach(() => {
    ({
      config,
      logger,
      errorHandler,
      service,
      createStandardService,
      createLegacyService,
      cleanup,
    } = createManagedCircuitBreakerContext({
      configOverrides: createCircuitBreakerConfig({ errorThreshold: 2, cooldownMs: 100 }),
      logger: createCircuitBreakerMockLogger() as unknown as LoggerService,
    }));
  });

  afterEach(() => {
    cleanup();
  });

  describe('SKIP Strategy - Logging Failures', () => {
    it('should skip logger errors in constructor', () => {
      const failingLogger = createCircuitBreakerFailingLogger({
        info: jest.fn().mockImplementationOnce(() => {
          throw new Error('Logger init failed');
        }),
      });

      expect(() => {
        createStandardService({
          configOverrides: config,
          logger: failingLogger as unknown as LoggerService,
        });
      }).not.toThrow();
    });

    it('should skip logger errors in state transitions (isOpen)', () => {
      const failingLogger = createCircuitBreakerFailingLogger({
        info: jest.fn().mockImplementationOnce(() => {
          throw new Error('State transition log failed');
        }),
      });

      const testService = createStandardService({
        configOverrides: config,
        logger: failingLogger as unknown as LoggerService,
      });
      testService.recordError('Test error 1');
      testService.recordError('Test error 2');

      jest.useFakeTimers();
      jest.advanceTimersByTime(150);

      expect(() => {
        testService.isOpen();
      }).not.toThrow();

      jest.useRealTimers();
    });

    it('should skip logger errors in recordSuccess', () => {
      const failingLogger = createCircuitBreakerFailingLogger({
        info: jest.fn().mockImplementationOnce(() => {
          throw new Error('Success log failed');
        }),
        debug: jest.fn().mockImplementationOnce(() => {
          throw new Error('Debug log failed');
        }),
      });

      const testService = createStandardService({
        configOverrides: config,
        logger: failingLogger as unknown as LoggerService,
      });

      expect(() => {
        testService.recordSuccess();
      }).not.toThrow();

      expect(testService.getStats().totalSuccesses).toBe(1);
    });

    it('should skip logger errors in recordError', () => {
      const failingLogger = createCircuitBreakerFailingLogger({
        warn: jest.fn().mockImplementationOnce(() => {
          throw new Error('Error log failed');
        }),
      });

      const testService = createStandardService({
        configOverrides: config,
        logger: failingLogger as unknown as LoggerService,
      });

      expect(() => {
        testService.recordError('Test error');
      }).not.toThrow();

      expect(testService.getStats().totalErrors).toBe(1);
    });

    it('should skip logger errors in trip', () => {
      const failingLogger = createCircuitBreakerFailingLogger({
        error: jest.fn().mockImplementationOnce(() => {
          throw new Error('Trip log failed');
        }),
      });

      const testService = createStandardService({
        configOverrides: config,
        logger: failingLogger as unknown as LoggerService,
      });
      testService.recordError('Error 1');

      expect(() => {
        testService.recordError('Error 2');
      }).not.toThrow();

      expect(testService.getStateSnapshot()).toBe(CircuitState.OPEN);
    });

    it('should skip logger errors in reset', () => {
      const failingLogger = createCircuitBreakerFailingLogger({
        info: jest.fn().mockImplementationOnce(() => {
          throw new Error('Reset log failed');
        }),
      });

      const testService = createStandardService({
        configOverrides: config,
        logger: failingLogger as unknown as LoggerService,
      });
      testService.recordError('Error 1');
      testService.recordError('Error 2');

      expect(() => {
        testService.reset();
      }).not.toThrow();

      expect(testService.getStateSnapshot()).toBe(CircuitState.CLOSED);
    });
  });

  describe('GRACEFUL_DEGRADE Strategy - State/Data Operations', () => {
    it('should handle error history push failures gracefully', () => {
      const testService = createStandardService();

      const originalPush = Array.prototype.push;
      let pushCallCount = 0;
      jest.spyOn(Array.prototype, 'push').mockImplementation(function (this: unknown, ...args: unknown[]) {
        pushCallCount++;
        if (pushCallCount === 1) {
          throw new Error('History push failed');
        }
        return Reflect.apply(originalPush, this as object, args) as number;
      });

      expect(() => {
        testService.recordError('Error with history failure');
      }).not.toThrow();

      expect(testService.getStats().totalErrors).toBe(1);
      jest.restoreAllMocks();
    });

    it('should return partial stats on getStats failure', () => {
      const testService = createStandardService();
      testService.recordSuccess();
      testService.recordSuccess();

      jest.spyOn(Object, 'assign').mockImplementationOnce(() => {
        throw new Error('Stats construction failed');
      });

      const stats = testService.getStats();
      expect(stats).toBeDefined();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.totalSuccesses).toBe(2);

      jest.restoreAllMocks();
    });

    it('should return error history when available', () => {
      const testService = createStandardService();
      testService.recordError('Test error 1');
      testService.recordError('Test error 2');

      const history = testService.getErrorHistory();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(2);
    });

    it('should correctly determine recovery eligibility', () => {
      const testService = createStandardService();
      testService.recordError('Error 1');
      testService.recordError('Error 2');

      expect(testService.canAttemptRecovery()).toBe(false);

      jest.useFakeTimers();
      jest.advanceTimersByTime(150);
      expect(testService.canAttemptRecovery()).toBe(true);
      jest.useRealTimers();
    });

    it('should continue circuit operation through multiple errors', () => {
      const testService = createStandardService();

      expect(() => {
        testService.recordError('Error 1');
        expect(testService.getStateSnapshot()).toBe(CircuitState.CLOSED);

        testService.recordError('Error 2');
        expect(testService.getStateSnapshot()).toBe(CircuitState.OPEN);
      }).not.toThrow();

      expect(testService.getStateSnapshot()).toBe(CircuitState.OPEN);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler parameter', () => {
      const testService = createLegacyService();

      testService.recordSuccess();
      testService.recordError('Test error');

      expect(testService.getStats().totalSuccesses).toBe(1);
      expect(testService.getStats().totalErrors).toBe(1);
    });

    it('should handle logger-only failures without ErrorHandler', () => {
      const failingLogger = createCircuitBreakerFailingLogger({
        info: jest.fn().mockImplementation(() => {
          throw new Error('Log failed');
        }),
        warn: jest.fn().mockImplementation(() => {
          throw new Error('Log failed');
        }),
      });

      const testService = createLegacyService({
        configOverrides: config,
        logger: failingLogger as unknown as LoggerService,
      });

      expect(() => {
        testService.recordError('Test error');
      }).not.toThrow();
    });

    it('should maintain state machine integrity with ErrorHandler', () => {
      const testService = createStandardService();

      expect(testService.getStateSnapshot()).toBe(CircuitState.CLOSED);

      testService.recordError('Error 1');
      expect(testService.getStateSnapshot()).toBe(CircuitState.CLOSED);
      expect(testService.getStats().consecutiveErrors).toBe(1);

      testService.recordError('Error 2');
      expect(testService.getStateSnapshot()).toBe(CircuitState.OPEN);

      testService.recordSuccess();
      expect(testService.getStateSnapshot()).toBe(CircuitState.OPEN);

      jest.useFakeTimers();
      jest.advanceTimersByTime(150);
      testService.isOpen();
      expect(testService.getStateSnapshot()).toBe(CircuitState.HALF_OPEN);

      testService.recordSuccess();
      expect(testService.getStateSnapshot()).toBe(CircuitState.CLOSED);

      jest.useRealTimers();
    });
  });

  describe('Integration Tests', () => {
    it('should handle multiple concurrent failures gracefully', () => {
      const failingLogger = createCircuitBreakerFailingLogger({
        info: jest.fn().mockImplementation(() => {
          throw new Error('Log failed');
        }),
        warn: jest.fn().mockImplementation(() => {
          throw new Error('Log failed');
        }),
        error: jest.fn().mockImplementation(() => {
          throw new Error('Log failed');
        }),
      });

      const testService = createStandardService({
        configOverrides: config,
        logger: failingLogger as unknown as LoggerService,
      });

      expect(() => {
        for (let i = 0; i < 5; i++) {
          testService.recordError(`Error ${i}`);
        }
      }).not.toThrow();

      expect(testService.getStats().totalErrors).toBeGreaterThan(0);
    });

    it('should recover from errors and continue functioning', () => {
      let logErrorCount = 0;
      const intermittentLogger = createCircuitBreakerFailingLogger({
        info: jest.fn().mockImplementation(() => {
          logErrorCount++;
          if (logErrorCount === 1) {
            throw new Error('Transient log failure');
          }
        }),
      });

      const testService = createStandardService({
        configOverrides: config,
        logger: intermittentLogger as unknown as LoggerService,
      });

      expect(() => {
        testService.recordError('First error');
      }).not.toThrow();

      expect(() => {
        testService.recordError('Second error');
      }).not.toThrow();

      expect(testService.getStats().totalErrors).toBe(2);
    });
  });
});
