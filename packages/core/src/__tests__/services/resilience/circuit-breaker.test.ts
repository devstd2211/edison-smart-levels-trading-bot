/**
 * Circuit Breaker Service Tests
 * Phase 14.2.1 - 25 tests
 */

import {
  CircuitBreakerService,
  CircuitState,
  CircuitBreakerOpenError,
  type CircuitBreakerConfig,
} from '../../../services/resilience/circuit-breaker.service';
import { ErrorHandler } from '../../../errors/ErrorHandler';
import { LoggerService } from '../../../services/logger.service';
import {
  createManagedCircuitBreakerContext,
} from '../../helpers/resilience-test.utils';

describe('CircuitBreakerService', () => {
  type ResilienceCircuitBreakerManagedContext = ReturnType<typeof createManagedCircuitBreakerContext>;
  type ResilienceCircuitBreakerRuntime = Pick<
    ResilienceCircuitBreakerManagedContext,
    'logger' | 'errorHandler'
  >;
  type ResilienceCircuitBreakerFactories = Pick<
    ResilienceCircuitBreakerManagedContext,
    'createDefaultService' | 'createInvalidService'
  >;
  type ResilienceCircuitBreakerHarness = {
    createService: (
      config?: Partial<CircuitBreakerConfig>,
      serviceLogger?: LoggerService,
      handler?: ErrorHandler,
    ) => CircuitBreakerService;
  };
  type ResilienceCircuitBreakerFixtures = {
    runtime: ResilienceCircuitBreakerRuntime;
    factories: ResilienceCircuitBreakerFactories;
    harness: ResilienceCircuitBreakerHarness;
  };
  let logger: Partial<LoggerService>;
  let errorHandler: ErrorHandler;
  let createDefaultService: ResilienceCircuitBreakerFactories['createDefaultService'];
  let createInvalidService: ResilienceCircuitBreakerFactories['createInvalidService'];
  let createService: (
    config?: Partial<CircuitBreakerConfig>,
    serviceLogger?: LoggerService,
    handler?: ErrorHandler,
  ) => CircuitBreakerService;

  function bindCircuitBreakerFixtures() {
    let fixtures: ResilienceCircuitBreakerFixtures;
    let cleanup: ResilienceCircuitBreakerManagedContext['cleanup'];

    beforeEach(() => {
      const managedContext = createManagedCircuitBreakerContext();
      fixtures = {
        runtime: {
          logger: managedContext.logger,
          errorHandler: managedContext.errorHandler,
        },
        factories: {
          createDefaultService: managedContext.createDefaultService,
          createInvalidService: managedContext.createInvalidService,
        },
        harness: {
          createService: (
            config = {},
            serviceLogger = managedContext.logger as LoggerService,
            handler = managedContext.errorHandler,
          ) => managedContext.harness.createCircuitBreakerService(config, {
            logger: serviceLogger,
            errorHandler: handler,
          }),
        },
      };
      cleanup = managedContext.cleanup;
    });

    afterEach(() => {
      cleanup();
    });

    return () => fixtures;
  }

  const getFixtures = bindCircuitBreakerFixtures();

  beforeEach(() => {
    const { runtime, factories, harness } = getFixtures();
    ({ logger, errorHandler } = runtime);
    ({ createDefaultService, createInvalidService } = factories);
    ({ createService } = harness);
  });

  // ============================================================================
  // INITIALIZATION & VALIDATION (5 tests - THROW strategy)
  // ============================================================================

  describe('Initialization and Validation', () => {
    it('should initialize with default config', () => {
      const service = createDefaultService();
      expect(service).toBeDefined();
      expect(service.getCircuitNames()).toEqual([]);
    });

    it('should throw on invalid failureThreshold', () => {
      expect(() => createInvalidService({ failureThreshold: 0 }))
        .toThrow('failureThreshold must be positive');

      expect(() => createInvalidService({ failureThreshold: -1 }))
        .toThrow('failureThreshold must be positive');
    });

    it('should throw on invalid failureRateThreshold', () => {
      expect(() => createInvalidService({ failureRateThreshold: -0.1 }))
        .toThrow('failureRateThreshold must be between 0 and 1');

      expect(() => createInvalidService({ failureRateThreshold: 1.5 }))
        .toThrow('failureRateThreshold must be between 0 and 1');
    });

    it('should throw on invalid successThreshold', () => {
      expect(() => createInvalidService({ successThreshold: 0 }))
        .toThrow('successThreshold must be positive');
    });

    it('should throw on invalid timeout', () => {
      expect(() => createInvalidService({ timeout: 0 }))
        .toThrow('timeout must be positive');

      expect(() => createInvalidService({ timeout: -1000 }))
        .toThrow('timeout must be positive');
    });
  });

  // ============================================================================
  // STATE TRANSITIONS (5 tests)
  // ============================================================================

  describe('State Transitions', () => {
    it('should transition CLOSED → OPEN on failure threshold', async () => {
      const config: Partial<CircuitBreakerConfig> = {
        failureThreshold: 3,
        volumeThreshold: 3,
      };
      const service = createService(config);

      const failingOperation = async () => {
        throw new Error('Service unavailable');
      };

      // Initial state is CLOSED
      expect(service.getState('test')).toBe(CircuitState.CLOSED);

      // 3 failures should open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await service.execute(failingOperation, 'test');
        } catch (error) {
          // Expected
        }
      }

      expect(service.getState('test')).toBe(CircuitState.OPEN);
    });

    it('should transition CLOSED → OPEN on failure rate threshold', async () => {
      const config: Partial<CircuitBreakerConfig> = {
        failureRateThreshold: 0.5, // 50% failure rate
        volumeThreshold: 10,
      };
      const service = createService(config);

      const failingOperation = async () => {
        throw new Error('Service error');
      };
      const successOperation = async () => 'success';

      // 6 failures + 4 successes = 60% failure rate → OPEN
      for (let i = 0; i < 6; i++) {
        try {
          await service.execute(failingOperation, 'test');
        } catch (error) {
          // Expected
        }
      }

      for (let i = 0; i < 4; i++) {
        await service.execute(successOperation, 'test');
      }

      expect(service.getState('test')).toBe(CircuitState.OPEN);
    });

    it('should transition OPEN → HALF_OPEN after timeout', async () => {
      const config: Partial<CircuitBreakerConfig> = {
        failureThreshold: 2,
        volumeThreshold: 2,
        timeout: 100, // 100ms timeout
      };
      const service = createService(config);

      const failingOperation = async () => {
        throw new Error('Fail');
      };
      const successOperation = async () => 'success';

      // Open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await service.execute(failingOperation, 'test');
        } catch (error) {
          // Expected
        }
      }

      expect(service.getState('test')).toBe(CircuitState.OPEN);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next request should transition to HALF_OPEN
      await service.execute(successOperation, 'test');
      const stats = service.getStats('test');
      expect(stats?.state).toBe(CircuitState.HALF_OPEN);
    });

    it('should transition HALF_OPEN → CLOSED on success threshold', async () => {
      const config: Partial<CircuitBreakerConfig> = {
        failureThreshold: 2,
        successThreshold: 2,
        volumeThreshold: 2,
        timeout: 100,
      };
      const service = createService(config);

      const failingOperation = async () => {
        throw new Error('Fail');
      };
      const successOperation = async () => 'success';

      // Open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await service.execute(failingOperation, 'test');
        } catch (error) {
          // Expected
        }
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Transition to HALF_OPEN
      await service.execute(successOperation, 'test');

      // Second success should close circuit
      await service.execute(successOperation, 'test');
      expect(service.getState('test')).toBe(CircuitState.CLOSED);
    });

    it('should transition HALF_OPEN → OPEN on any failure', async () => {
      const config: Partial<CircuitBreakerConfig> = {
        failureThreshold: 2,
        successThreshold: 2,
        volumeThreshold: 2,
        timeout: 100,
      };
      const service = createService(config);

      const failingOperation = async () => {
        throw new Error('Fail');
      };
      const successOperation = async () => 'success';

      // Open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await service.execute(failingOperation, 'test');
        } catch (error) {
          // Expected
        }
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Transition to HALF_OPEN
      await service.execute(successOperation, 'test');
      expect(service.getStats('test')?.state).toBe(CircuitState.HALF_OPEN);

      // Failure in HALF_OPEN → back to OPEN
      try {
        await service.execute(failingOperation, 'test');
      } catch (error) {
        // Expected
      }

      expect(service.getState('test')).toBe(CircuitState.OPEN);
    });
  });

  // ============================================================================
  // THRESHOLD TESTS (5 tests)
  // ============================================================================

  describe('Threshold Tests', () => {
    it('should not open before volumeThreshold reached', async () => {
      const config: Partial<CircuitBreakerConfig> = {
        failureThreshold: 5,
        volumeThreshold: 10, // Need 10 requests before evaluating
      };
      const service = createService(config);

      const failingOperation = async () => {
        throw new Error('Fail');
      };

      // 5 failures, but only 5 total requests → should not open
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute(failingOperation, 'test');
        } catch (error) {
          // Expected
        }
      }

      expect(service.getState('test')).toBe(CircuitState.CLOSED);
    });

    it('should respect custom failureThreshold', async () => {
      const config: Partial<CircuitBreakerConfig> = {
        failureThreshold: 10,
        volumeThreshold: 10,
      };
      const service = createService(config);

      const failingOperation = async () => {
        throw new Error('Fail');
      };

      // 9 failures → should not open
      for (let i = 0; i < 9; i++) {
        try {
          await service.execute(failingOperation, 'test');
        } catch (error) {
          // Expected
        }
      }
      expect(service.getState('test')).toBe(CircuitState.CLOSED);

      // 10th failure → should open
      try {
        await service.execute(failingOperation, 'test');
      } catch (error) {
        // Expected
      }
      expect(service.getState('test')).toBe(CircuitState.OPEN);
    });

    it('should respect custom failureRateThreshold', async () => {
      const config: Partial<CircuitBreakerConfig> = {
        failureThreshold: 20, // High threshold to test rate-based opening
        failureRateThreshold: 0.8, // 80% failure rate
        volumeThreshold: 10,
      };
      const service = createService(config);

      const failingOperation = async () => {
        throw new Error('Fail');
      };
      const successOperation = async () => 'success';

      // 7 failures + 3 successes = 70% failure rate → should not open (< 80%)
      for (let i = 0; i < 7; i++) {
        try {
          await service.execute(failingOperation, 'test');
        } catch (error) {
          // Expected
        }
      }

      for (let i = 0; i < 3; i++) {
        await service.execute(successOperation, 'test');
      }

      expect(service.getState('test')).toBe(CircuitState.CLOSED);
    });

    it('should respect custom successThreshold in HALF_OPEN', async () => {
      const config: Partial<CircuitBreakerConfig> = {
        failureThreshold: 2,
        successThreshold: 3, // Need 3 successes to close
        volumeThreshold: 2,
        timeout: 100,
      };
      const service = createService(config);

      const failingOperation = async () => {
        throw new Error('Fail');
      };
      const successOperation = async () => 'success';

      // Open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await service.execute(failingOperation, 'test');
        } catch (error) {
          // Expected
        }
      }

      await new Promise(resolve => setTimeout(resolve, 150));

      // First success → HALF_OPEN
      await service.execute(successOperation, 'test');
      expect(service.getStats('test')?.state).toBe(CircuitState.HALF_OPEN);

      // Second success → still HALF_OPEN
      await service.execute(successOperation, 'test');
      expect(service.getStats('test')?.state).toBe(CircuitState.HALF_OPEN);

      // Third success → CLOSED
      await service.execute(successOperation, 'test');
      expect(service.getState('test')).toBe(CircuitState.CLOSED);
    });

    it('should respect custom timeout for HALF_OPEN transition', async () => {
      const config: Partial<CircuitBreakerConfig> = {
        failureThreshold: 2,
        volumeThreshold: 2,
        timeout: 500, // 500ms timeout
      };
      const service = createService(config);

      const failingOperation = async () => {
        throw new Error('Fail');
      };
      const successOperation = async () => 'success';

      // Open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await service.execute(failingOperation, 'test');
        } catch (error) {
          // Expected
        }
      }

      expect(service.getState('test')).toBe(CircuitState.OPEN);

      // Wait 300ms (less than timeout)
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should still be OPEN, throw CircuitBreakerOpenError
      await expect(service.execute(successOperation, 'test'))
        .rejects.toThrow(CircuitBreakerOpenError);

      // Wait another 300ms (total 600ms > timeout)
      await new Promise(resolve => setTimeout(resolve, 300));

      // Should transition to HALF_OPEN and succeed
      await service.execute(successOperation, 'test');
      expect(service.getStats('test')?.state).toBe(CircuitState.HALF_OPEN);
    });
  });

  // ============================================================================
  // MANUAL CONTROLS (3 tests)
  // ============================================================================

  describe('Manual Controls', () => {
    it('should reset circuit to CLOSED', async () => {
      const config: Partial<CircuitBreakerConfig> = {
        failureThreshold: 2,
        volumeThreshold: 2,
      };
      const service = createService(config);

      const failingOperation = async () => {
        throw new Error('Fail');
      };

      // Open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await service.execute(failingOperation, 'test');
        } catch (error) {
          // Expected
        }
      }

      expect(service.getState('test')).toBe(CircuitState.OPEN);

      // Reset
      service.reset('test');
      expect(service.getState('test')).toBe(CircuitState.CLOSED);

      const stats = service.getStats('test');
      expect(stats?.failureCount).toBe(0);
      expect(stats?.successCount).toBe(0);
      expect(stats?.totalRequests).toBe(0);
    });

    it('should force circuit to OPEN', () => {
      const service = createService();

      expect(service.getState('test')).toBe(CircuitState.CLOSED);

      service.forceOpen('test');
      expect(service.getState('test')).toBe(CircuitState.OPEN);
    });

    it('should force circuit to CLOSED', async () => {
      const config: Partial<CircuitBreakerConfig> = {
        failureThreshold: 2,
        volumeThreshold: 2,
      };
      const service = createService(config);

      const failingOperation = async () => {
        throw new Error('Fail');
      };

      // Open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await service.execute(failingOperation, 'test');
        } catch (error) {
          // Expected
        }
      }

      expect(service.getState('test')).toBe(CircuitState.OPEN);

      service.forceClose('test');
      expect(service.getState('test')).toBe(CircuitState.CLOSED);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS (4 tests)
  // ============================================================================

  describe('Integration Tests', () => {
    it('should handle real async operation failures', async () => {
      const config: Partial<CircuitBreakerConfig> = {
        failureThreshold: 3,
        volumeThreshold: 3,
      };
      const service = createService(config);

      let callCount = 0;
      const unreliableService = async () => {
        callCount++;
        if (callCount <= 3) {
          throw new Error('Network timeout');
        }
        return 'success';
      };

      // First 3 calls fail → circuit opens
      for (let i = 0; i < 3; i++) {
        try {
          await service.execute(unreliableService, 'api');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }

      expect(service.getState('api')).toBe(CircuitState.OPEN);

      // Next call should fail immediately without calling service
      const beforeCount = callCount;
      await expect(service.execute(unreliableService, 'api'))
        .rejects.toThrow(CircuitBreakerOpenError);
      expect(callCount).toBe(beforeCount); // Service not called
    });

    it('should track multiple independent circuits', async () => {
      const service = createService({
        failureThreshold: 2,
        volumeThreshold: 2,
      });

      const fail = async () => {
        throw new Error('Fail');
      };
      const success = async () => 'success';

      // Open circuit A
      for (let i = 0; i < 2; i++) {
        try {
          await service.execute(fail, 'circuitA');
        } catch (error) {
          // Expected
        }
      }

      // Circuit B succeeds
      await service.execute(success, 'circuitB');

      expect(service.getState('circuitA')).toBe(CircuitState.OPEN);
      expect(service.getState('circuitB')).toBe(CircuitState.CLOSED);
      expect(service.getCircuitNames()).toContain('circuitA');
      expect(service.getCircuitNames()).toContain('circuitB');
    });

    it('should provide detailed circuit statistics', async () => {
      const service = createService({
        failureThreshold: 5,
        volumeThreshold: 10,
      });

      const fail = async () => {
        throw new Error('Fail');
      };
      const success = async () => 'success';

      // 3 failures
      for (let i = 0; i < 3; i++) {
        try {
          await service.execute(fail, 'test');
        } catch (error) {
          // Expected
        }
      }

      // 2 successes
      for (let i = 0; i < 2; i++) {
        await service.execute(success, 'test');
      }

      const stats = service.getStats('test');
      expect(stats).toBeDefined();
      expect(stats?.failureCount).toBe(3);
      expect(stats?.totalRequests).toBe(5);
      expect(stats?.lastSuccessTime).toBeGreaterThan(0);
      expect(stats?.lastFailureTime).toBeGreaterThan(0);
    });

    it('should clear all circuits', async () => {
      const service = createService();

      const success = async () => 'success';
      await service.execute(success, 'circuit1');
      await service.execute(success, 'circuit2');
      await service.execute(success, 'circuit3');

      expect(service.getCircuitNames().length).toBe(3);

      service.clearAll();
      expect(service.getCircuitNames().length).toBe(0);
    });
  });

  // ============================================================================
  // EDGE CASES & ERROR HANDLING (3 tests)
  // ============================================================================

  describe('Edge Cases', () => {
    it('should throw on invalid operation input', async () => {
      const service = createService();

      await expect(service.execute(null as unknown as () => Promise<unknown>, 'test'))
        .rejects.toThrow('Operation must be a function');

      await expect(service.execute('not a function' as unknown as () => Promise<unknown>, 'test'))
        .rejects.toThrow('Operation must be a function');
    });

    it('should throw on invalid circuit name', async () => {
      const service = createService();

      const operation = async () => 'success';

      await expect(service.execute(operation, ''))
        .rejects.toThrow('Circuit name must be a non-empty string');

      await expect(service.execute(operation, null as unknown as string))
        .rejects.toThrow('Circuit name must be a non-empty string');
    });

    it('should handle logging errors with SKIP strategy', async () => {
      const faultyLogger = {
        info: jest.fn(() => {
          throw new Error('Logging system down');
        }),
        warn: jest.fn(() => {
          throw new Error('Logging system down');
        }),
        error: jest.fn(() => {
          throw new Error('Logging system down');
        }),
        debug: jest.fn(),
      };

      // Should not throw despite logging errors
      const service = createService({}, faultyLogger as unknown as LoggerService);
      const operation = async () => 'success';

      await expect(service.execute(operation, 'test')).resolves.toBe('success');
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY (2 tests)
  // ============================================================================

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler', async () => {
      const service = createInvalidService({
        failureThreshold: 2,
        volumeThreshold: 2,
      }, { logger: logger as LoggerService, errorHandler: undefined });

      const fail = async () => {
        throw new Error('Fail');
      };

      for (let i = 0; i < 2; i++) {
        try {
          await service.execute(fail, 'test');
        } catch (error) {
          // Expected
        }
      }

      expect(service.getState('test')).toBe(CircuitState.OPEN);
    });

    it('should work without Logger', async () => {
      const service = createInvalidService({
        failureThreshold: 2,
        volumeThreshold: 2,
      }, { logger: undefined, errorHandler: undefined });

      const fail = async () => {
        throw new Error('Fail');
      };

      for (let i = 0; i < 2; i++) {
        try {
          await service.execute(fail, 'test');
        } catch (error) {
          // Expected
        }
      }

      expect(service.getState('test')).toBe(CircuitState.OPEN);
    });
  });
});
