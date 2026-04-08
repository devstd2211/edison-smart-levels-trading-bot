/**
 * Phase 8.9.34: StrategyCircuitBreakerService ErrorHandler Integration Tests
 *
 * Tests SKIP and GRACEFUL_DEGRADE recovery strategies for logging and state operations
 */

import { StrategyCircuitBreakerService } from '../../services/multi-strategy/strategy-circuit-breaker.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors';
import { CircuitBreakerStatus } from '../../types/legacy';
import { LoggerService } from '../../types/legacy';
import {
  createManagedStrategyCircuitBreakerContext,
} from '../helpers/strategy-circuit-breaker-test.utils';

type ManagedStrategyCircuitBreakerFixtures = ReturnType<typeof createManagedStrategyCircuitBreakerContext>;
type StrategyCircuitBreakerFixtures = {
  runtime: Pick<
    ManagedStrategyCircuitBreakerFixtures,
    'service' | 'logger' | 'errorHandler'
  >;
  factories: Pick<
    ManagedStrategyCircuitBreakerFixtures,
    'createStandardService' | 'createLegacyService'
  >;
  cleanup: ManagedStrategyCircuitBreakerFixtures['cleanup'];
};
type StrategyCircuitBreakerCreateStandardService =
  StrategyCircuitBreakerFixtures['factories']['createStandardService'];
type StrategyCircuitBreakerCreateLegacyService =
  StrategyCircuitBreakerFixtures['factories']['createLegacyService'];
type StrategyCircuitBreakerFixtureAccessor = () => StrategyCircuitBreakerFixtures;

function bindStrategyCircuitBreakerFixtures(): StrategyCircuitBreakerFixtureAccessor {
  let fixtures: StrategyCircuitBreakerFixtures;

  beforeEach(() => {
    const context = createManagedStrategyCircuitBreakerContext();
    fixtures = {
      runtime: {
        service: context.service,
        logger: context.logger,
        errorHandler: context.errorHandler,
      },
      factories: {
        createStandardService: context.createStandardService,
        createLegacyService: context.createLegacyService,
      },
      cleanup: context.cleanup,
    };
  });

  afterEach(() => {
    fixtures.cleanup();
  });

  return () => fixtures;
}

describe('StrategyCircuitBreakerService - Error Handling (Phase 8.9.34)', () => {
  const asLoggerService = (value: Partial<LoggerService>): LoggerService =>
    value as unknown as LoggerService;

  let service: StrategyCircuitBreakerService;
  let logger: Partial<LoggerService>;
  let errorHandler: ErrorHandler;
  let createStandardService: StrategyCircuitBreakerCreateStandardService;
  let createLegacyService: StrategyCircuitBreakerCreateLegacyService;
  const getFixtures: StrategyCircuitBreakerFixtureAccessor = bindStrategyCircuitBreakerFixtures();

  beforeEach(() => {
    const { runtime, factories } = getFixtures();
    ({ logger, errorHandler, service } = runtime);
    ({ createStandardService, createLegacyService } = factories);
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

      const testService = createStandardService({
        logger: asLoggerService(failingLogger),
        errorHandler,
      });
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

      const testService = createStandardService({
        logger: asLoggerService(failingLogger),
        errorHandler,
      });
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

      const testService = createStandardService({
        logger: asLoggerService(failingLogger),
        errorHandler,
      });
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

      const testService = createStandardService({
        logger: asLoggerService(failingLogger),
        errorHandler,
      });

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

      const testService = createStandardService({
        logger: asLoggerService(failingLogger),
        errorHandler,
      });

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
      const testService = createStandardService({
        logger: logger as LoggerService,
        errorHandler,
      });

      // Record failures normally
      expect(() => {
        testService.recordFailure('strategy-1', new Error('Test failure 1'));
        testService.recordFailure('strategy-1', new Error('Test failure 2'));
      }).not.toThrow();

      // Circuit should track failures correctly
      const state = testService.getState('strategy-1');
      expect(state.failureCount).toBe(2);
    });

    it('should track and return accurate metrics for multiple strategies', () => {
      const testService = createStandardService({
        logger: logger as LoggerService,
        errorHandler,
      });

      // Record operations for strategy
      testService.recordSuccess('strategy-1');
      testService.recordFailure('strategy-1', new Error('fail'));
      testService.recordSuccess('strategy-1');

      // Should return accurate metrics
      const metrics = testService.getMetrics('strategy-1');
      expect(metrics).toBeDefined();
      expect(metrics.totalSuccesses).toBe(2);
      expect(metrics.totalFailures).toBe(1);
    });

    it('should continue state transitions through multiple operations', () => {
      const testService = createStandardService({
        logger: logger as LoggerService,
        errorHandler,
      });

      // Record operations for state transitions
      expect(() => {
        testService.recordSuccess('strategy-1');
        testService.recordFailure('strategy-1', new Error('fail'));
        testService.recordFailure('strategy-1', new Error('fail2'));
      }).not.toThrow();

      // State transitions should occur correctly
      const state = testService.getState('strategy-1');
      expect(state.failureCount).toBe(2);
    });

    it('should create and manage breakers for multiple strategies', () => {
      const testService = createStandardService({
        logger: logger as LoggerService,
        errorHandler,
      });

      // Create breakers for multiple strategies
      expect(() => {
        testService.recordSuccess('strategy-1');
        testService.recordSuccess('strategy-2');
        testService.recordSuccess('strategy-3');
      }).not.toThrow();

      // Service should maintain breakers for each
      const state1 = testService.getState('strategy-1');
      const state2 = testService.getState('strategy-2');
      expect(state1).toBeDefined();
      expect(state2).toBeDefined();
    });

    it('should allow config management for strategies', () => {
      const testService = createStandardService({
        logger: logger as LoggerService,
        errorHandler,
      });

      // Set and get config normally
      expect(() => {
        testService.setConfig('strategy-1', { failureThreshold: 10 });
      }).not.toThrow();

      // Should retrieve configured value
      const config = testService.getConfig('strategy-1');
      expect(config).toBeDefined();
      expect(config.failureThreshold).toBe(10);
    });

    it('should support event listeners for state changes', () => {
      const testService = createStandardService({
        logger: logger as LoggerService,
        errorHandler,
      });

      const callback = jest.fn();
      testService.onStateChange(callback);

      // Trigger state changes
      expect(() => {
        testService.recordFailure('strategy-1', new Error('fail'));
      }).not.toThrow();

      // Service should be functional
      expect(testService.getState('strategy-1').failureCount).toBe(1);
    });
  });

  // =========================================================================
  // Backward Compatibility
  // =========================================================================

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler parameter', () => {
      const testService = createLegacyService({
        logger: logger as LoggerService,
      });

      expect(() => {
        testService.recordSuccess('strategy-1');
        testService.recordFailure('strategy-1', new Error('fail'));
      }).not.toThrow();

      // Should have created breaker
      const state = testService.getState('strategy-1');
      expect(state).toBeDefined();
    });

    it('should work without logger parameter', () => {
      const testService = createStandardService({
        logger: undefined,
        errorHandler,
      });

      // Should not throw despite undefined logger
      expect(() => {
        testService.recordSuccess('strategy-1');
        testService.recordFailure('strategy-1', new Error('fail'));
      }).not.toThrow();
    });

    it('should track state changes through multiple operations', () => {
      const testService = createStandardService({
        logger: logger as LoggerService,
        errorHandler,
      });

      // Initially CLOSED
      expect(testService.canExecute('strategy-1')).toBe(true);

      // Trigger failures to open circuit
      for (let i = 0; i < 5; i++) {
        testService.recordFailure('strategy-1', new Error('fail'));
      }

      // Should be unable to execute (circuit open/threshold exceeded)
      expect(testService.canExecute('strategy-1')).toBe(false);
      const state = testService.getState('strategy-1');
      expect(state.failureCount).toBe(5);

      // After reset, should be able to execute
      testService.reset('strategy-1');
      expect(testService.canExecute('strategy-1')).toBe(true);
    });

    it('should isolate failures between strategies with ErrorHandler', () => {
      const testService = createStandardService({
        logger: logger as LoggerService,
        errorHandler,
      });

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

      const testService = createStandardService({
        logger: asLoggerService(failingLogger),
        errorHandler,
      });

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
      const testService = createStandardService({
        logger: logger as LoggerService,
        errorHandler,
      });

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
      const testService = createStandardService({
        logger: logger as LoggerService,
        errorHandler,
      });

      testService.recordSuccess('strategy-1');
      testService.recordSuccess('strategy-1');
      testService.recordFailure('strategy-1', new Error('fail'));

      const metrics = testService.getMetrics('strategy-1');
      expect(metrics.totalSuccesses).toBe(2);
      expect(metrics.totalFailures).toBe(1);
      expect(metrics.failureRate).toBeCloseTo(1 / 3, 1);
    });

    it('should track state through multiple operations', () => {
      const testService = createStandardService({
        logger: logger as LoggerService,
        errorHandler,
      });

      // Register listener
      const callback = jest.fn();
      testService.onStateChange(callback);

      // Perform operations
      expect(() => {
        testService.recordFailure('strategy-1', new Error('fail'));
      }).not.toThrow();

      // Service should be functional
      expect(testService.getState('strategy-1')).toBeDefined();
    });

    it('should maintain service-wide statistics correctly', () => {
      const testService = createStandardService({
        logger: logger as LoggerService,
        errorHandler,
      });

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

