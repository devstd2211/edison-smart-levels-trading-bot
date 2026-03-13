/**
 * Retry Policy Service Tests
 * Phase 14.2.3 - 20 tests
 */

import {
  RetryPolicyService,
  RetryBudgetExceededError,
  MaxRetriesExceededError,
  type RetryPolicyConfig,
} from '../../../services/resilience/retry-policy.service';
import { ErrorHandler } from '../../../errors/ErrorHandler';
import { LoggerService } from '../../../services/logger.service';
import { createResilienceTestHarness, type ResilienceTestHarness } from '../../helpers/resilience-test.utils';

type ErrorWithCode = Error & { code?: string };
type ErrorWithStatus = Error & { status?: number };

describe('RetryPolicyService', () => {
  let logger: Partial<LoggerService>;
  let errorHandler: ErrorHandler;
  let harness: ResilienceTestHarness;

  let service: RetryPolicyService | undefined;

  beforeEach(() => {
    harness = createResilienceTestHarness();
    logger = harness.logger;
    errorHandler = harness.errorHandler;
  });

  afterEach(() => {
    harness.stopTrackedServices();
    service = undefined;
    // Always restore real timers
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  // ============================================================================
  // INITIALIZATION & VALIDATION (5 tests - THROW strategy)
  // ============================================================================

  describe('Initialization and Validation', () => {
    it('should initialize with default config', () => {
      service = harness.trackLifecycle(new RetryPolicyService());
      expect(service).toBeDefined();

      const stats = service.getStats();
      expect(stats.totalOperations).toBe(0);
      expect(stats.totalRetries).toBe(0);
    });

    it('should throw on invalid maxAttempts', () => {
      expect(() => new RetryPolicyService({ maxAttempts: -1 }))
        .toThrow('maxAttempts must be non-negative');
    });

    it('should throw on invalid baseDelayMs', () => {
      expect(() => new RetryPolicyService({ baseDelayMs: -100 }))
        .toThrow('baseDelayMs must be non-negative');
    });

    it('should throw on invalid exponentialBase', () => {
      expect(() => new RetryPolicyService({ exponentialBase: 0 }))
        .toThrow('exponentialBase must be positive');

      expect(() => new RetryPolicyService({ exponentialBase: -2 }))
        .toThrow('exponentialBase must be positive');
    });

    it('should throw on invalid retryBudgetPercent', () => {
      expect(() => new RetryPolicyService({ retryBudgetPercent: -0.1 }))
        .toThrow('retryBudgetPercent must be between 0 and 1');

      expect(() => new RetryPolicyService({ retryBudgetPercent: 1.5 }))
        .toThrow('retryBudgetPercent must be between 0 and 1');
    });
  });

  // ============================================================================
  // BACKOFF TESTS (5 tests)
  // ============================================================================

  describe('Exponential Backoff', () => {
    it('should calculate exponential backoff correctly', () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        baseDelayMs: 100,
        exponentialBase: 2,
        jitterEnabled: false,
      }, logger as LoggerService, errorHandler));

      // Attempt 1: 100 * 2^0 = 100ms
      expect(service.getBackoffDelay(1, 100, { jitterEnabled: false })).toBe(100);

      // Attempt 2: 100 * 2^1 = 200ms
      expect(service.getBackoffDelay(2, 100, { jitterEnabled: false })).toBe(200);

      // Attempt 3: 100 * 2^2 = 400ms
      expect(service.getBackoffDelay(3, 100, { jitterEnabled: false })).toBe(400);
    });

    it('should add jitter when enabled', () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        baseDelayMs: 100,
        exponentialBase: 2,
        jitterEnabled: true,
      }, logger as LoggerService, errorHandler));

      const delays = [];
      for (let i = 0; i < 10; i++) {
        delays.push(service.getBackoffDelay(2, 100));
      }

      // Should have variation (jitter)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);

      // All delays should be around 200ms ± jitter
      delays.forEach(delay => {
        expect(delay).toBeGreaterThan(150);
        expect(delay).toBeLessThan(250);
      });
    });

    it('should respect maximum delay', () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        baseDelayMs: 100,
        exponentialBase: 10,
        maxDelayMs: 500,
        jitterEnabled: false,
      }, logger as LoggerService, errorHandler));

      // Attempt 5: 100 * 10^4 = 100000ms, but should cap at 500ms
      const delay = service.getBackoffDelay(5, 100, { maxDelayMs: 500, jitterEnabled: false });
      expect(delay).toBe(500);
    });

    it('should respect minimum delay', () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        baseDelayMs: 1,
        exponentialBase: 1,
        jitterEnabled: false,
      }, logger as LoggerService, errorHandler));

      // Should never go below MIN_RETRY_DELAY_MS (10ms)
      const delay = service.getBackoffDelay(1, 1, { jitterEnabled: false });
      expect(delay).toBeGreaterThanOrEqual(10);
    });

    it('should handle custom exponential base', () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        baseDelayMs: 100,
        exponentialBase: 3,
        jitterEnabled: false,
      }, logger as LoggerService, errorHandler));

      // Attempt 1: 100 * 3^0 = 100ms
      expect(service.getBackoffDelay(1, 100, { exponentialBase: 3, jitterEnabled: false })).toBe(100);

      // Attempt 2: 100 * 3^1 = 300ms
      expect(service.getBackoffDelay(2, 100, { exponentialBase: 3, jitterEnabled: false })).toBe(300);

      // Attempt 3: 100 * 3^2 = 900ms
      expect(service.getBackoffDelay(3, 100, { exponentialBase: 3, jitterEnabled: false })).toBe(900);
    });
  });

  // ============================================================================
  // RETRY BUDGET TESTS (5 tests)
  // ============================================================================

  describe('Retry Budget', () => {
    it('should track retry budget correctly', async () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        maxAttempts: 3,
        retryBudgetPercent: 0.5, // 50% of operations can retry
        baseDelayMs: 10,
      }, logger as LoggerService, errorHandler));

      let callCount = 0;
      const failTwice = async () => {
        callCount++;
        if (callCount <= 2) throw new Error('Fail');
        return 'success';
      };

      // First operation: 2 retries
      await service.executeWithRetry(failTwice);

      const stats = service.getStats();
      expect(stats.totalOperations).toBe(1);
      expect(stats.totalRetries).toBe(2);
      expect(stats.budgetUsage).toBe(2);
      expect(stats.budgetLimit).toBe(0); // 50% of 1 = 0.5 → 0
    }, 10000);

    it('should throw RetryBudgetExceededError when budget exhausted', async () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        maxAttempts: 5,
        retryBudgetPercent: 0.1, // 10% budget
        baseDelayMs: 10,
      }, logger as LoggerService, errorHandler));

      // Run 10 operations to establish budget
      for (let i = 0; i < 10; i++) {
        await service.executeWithRetry(async () => 'success');
      }

      // Budget limit = 10 * 0.1 = 1 retry allowed
      const alwaysFail = async () => {
        throw new Error('Always fails');
      };

      // First retry should work (budget = 1)
      let callCount = 0;
      const failOnce = async () => {
        callCount++;
        if (callCount === 1) throw new Error('Fail once');
        return 'success';
      };

      await service.executeWithRetry(failOnce);

      // Second retry should exceed budget
      await expect(service.executeWithRetry(alwaysFail))
        .rejects.toThrow(RetryBudgetExceededError);
    }, 10000);

    it('should reset budget periodically', () => {
      jest.useFakeTimers();

      service = harness.trackLifecycle(new RetryPolicyService({
        maxAttempts: 3,
        retryBudgetPercent: 0.1,
        baseDelayMs: 10,
      }, logger as LoggerService, errorHandler));

      // Manually set budget usage
      service['stats'].budgetUsage = 5;
      service['stats'].totalOperations = 10;

      expect(service.getBudgetUsage()).toBe(5);

      // Fast-forward budget reset interval (60 seconds)
      jest.advanceTimersByTime(60000);

      expect(service.getBudgetUsage()).toBe(0);

      jest.useRealTimers();
    });

    it('should manually reset budget', async () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        maxAttempts: 3,
        retryBudgetPercent: 0.5,
        baseDelayMs: 10,
      }, logger as LoggerService, errorHandler));

      let callCount = 0;
      const failTwice = async () => {
        callCount++;
        if (callCount <= 2) throw new Error('Fail');
        return 'success';
      };

      await service.executeWithRetry(failTwice);

      expect(service.getBudgetUsage()).toBeGreaterThan(0);

      service.resetBudget();

      expect(service.getBudgetUsage()).toBe(0);
    }, 10000);

    it('should calculate budget limit correctly', async () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        maxAttempts: 5,
        retryBudgetPercent: 0.1, // 10%
        baseDelayMs: 10,
      }, logger as LoggerService, errorHandler));

      // 0 operations → budget limit = 0
      expect(service.getStats().budgetLimit).toBe(0);

      // 10 operations → budget limit = 1
      for (let i = 0; i < 10; i++) {
        await service.executeWithRetry(async () => 'success');
      }
      expect(service.getStats().budgetLimit).toBe(1);

      // 100 operations → budget limit = 10
      for (let i = 0; i < 90; i++) {
        await service.executeWithRetry(async () => 'success');
      }
      expect(service.getStats().budgetLimit).toBe(10);
    }, 15000);
  });

  // ============================================================================
  // CONDITIONAL RETRY TESTS (3 tests)
  // ============================================================================

  describe('Conditional Retry', () => {
    it('should retry on transient errors (network errors)', async () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        maxAttempts: 3,
        baseDelayMs: 10,
      }, logger as LoggerService, errorHandler));

      let callCount = 0;
      const transientError = async () => {
        callCount++;
        if (callCount <= 2) {
          const error = new Error('ECONNRESET');
          (error as ErrorWithCode).code = 'ECONNRESET';
          throw error;
        }
        return 'success';
      };

      const result = await service.executeWithRetry(transientError);
      expect(result).toBe('success');
      expect(callCount).toBe(3); // Original + 2 retries
    });

    it('should retry on retryable HTTP errors (429, 5xx)', async () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        maxAttempts: 3,
        baseDelayMs: 10,
      }, logger as LoggerService, errorHandler));

      let callCount = 0;
      const http429Error = async () => {
        callCount++;
        if (callCount <= 2) {
          const error = new Error('Too Many Requests');
          (error as ErrorWithStatus).status = 429;
          throw error;
        }
        return 'success';
      };

      const result = await service.executeWithRetry(http429Error);
      expect(result).toBe('success');
      expect(callCount).toBe(3);
    });

    it('should not retry on non-retryable HTTP errors (4xx)', async () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        maxAttempts: 3,
        baseDelayMs: 10,
      }, logger as LoggerService, errorHandler));

      let callCount = 0;
      const http404Error = async () => {
        callCount++;
        const error = new Error('Not Found');
        (error as ErrorWithStatus).status = 404;
        throw error;
      };

      await expect(service.executeWithRetry(http404Error))
        .rejects.toThrow('Not Found');

      expect(callCount).toBe(1); // No retries
    });
  });

  // ============================================================================
  // INTEGRATION TESTS (5 tests)
  // ============================================================================

  describe('Integration Tests', () => {
    it('should succeed after retries', async () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        maxAttempts: 3,
        baseDelayMs: 10,
      }, logger as LoggerService, errorHandler));

      let callCount = 0;
      const failTwice = async () => {
        callCount++;
        if (callCount <= 2) throw new Error('Temporary failure');
        return 'success';
      };

      const result = await service.executeWithRetry(failTwice);
      expect(result).toBe('success');
      expect(callCount).toBe(3);

      const stats = service.getStats();
      expect(stats.successfulOperations).toBe(1);
      expect(stats.totalRetries).toBe(2);
    });

    it('should throw MaxRetriesExceededError when all retries fail', async () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        maxAttempts: 3,
        baseDelayMs: 10,
      }, logger as LoggerService, errorHandler));

      let callCount = 0;
      const alwaysFail = async () => {
        callCount++;
        throw new Error('Always fails');
      };

      await expect(service.executeWithRetry(alwaysFail))
        .rejects.toThrow(MaxRetriesExceededError);

      expect(callCount).toBe(4); // Original + 3 retries

      const stats = service.getStats();
      expect(stats.failedOperations).toBe(1);
    }, 10000);

    it('should handle immediate success (no retries)', async () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        maxAttempts: 3,
        baseDelayMs: 10,
      }, logger as LoggerService, errorHandler));

      const immediateSuccess = async () => 'success';

      const result = await service.executeWithRetry(immediateSuccess);
      expect(result).toBe('success');

      const stats = service.getStats();
      expect(stats.totalRetries).toBe(0);
      expect(stats.successfulOperations).toBe(1);
    });

    it('should track statistics correctly', async () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        maxAttempts: 2,
        baseDelayMs: 10,
        retryBudgetPercent: 1.0, // No budget limit
      }, logger as LoggerService, errorHandler));

      // 3 successful operations
      for (let i = 0; i < 3; i++) {
        await service.executeWithRetry(async () => 'success');
      }

      // 2 operations with 1 retry each
      for (let i = 0; i < 2; i++) {
        let count = 0;
        await service.executeWithRetry(async () => {
          count++;
          if (count === 1) throw new Error('Fail once');
          return 'success';
        });
      }

      const stats = service.getStats();
      expect(stats.totalOperations).toBe(5);
      expect(stats.successfulOperations).toBe(5);
      expect(stats.totalRetries).toBe(2);
    }, 10000);

    it('should work with custom config per operation', async () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        maxAttempts: 1,
        baseDelayMs: 100,
      }, logger as LoggerService, errorHandler));

      let callCount = 0;
      const failTwice = async () => {
        callCount++;
        if (callCount <= 2) throw new Error('Fail');
        return 'success';
      };

      // Override config for this operation (allow 3 retries)
      const result = await service.executeWithRetry(failTwice, { maxAttempts: 3 });
      expect(result).toBe('success');
      expect(callCount).toBe(3);
    }, 10000);
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY (2 tests)
  // ============================================================================

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler', async () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        maxAttempts: 2,
        baseDelayMs: 10,
        retryBudgetPercent: 1.0, // No budget limit
      }, logger as LoggerService));

      let callCount = 0;
      const failOnce = async () => {
        callCount++;
        if (callCount === 1) throw new Error('Fail');
        return 'success';
      };

      const result = await service.executeWithRetry(failOnce);

      expect(result).toBe('success');
    }, 10000);

    it('should work without Logger', async () => {
      service = harness.trackLifecycle(new RetryPolicyService({
        maxAttempts: 2,
        baseDelayMs: 10,
        retryBudgetPercent: 1.0, // No budget limit
      }));

      let callCount = 0;
      const failOnce = async () => {
        callCount++;
        if (callCount === 1) throw new Error('Fail');
        return 'success';
      };

      const result = await service.executeWithRetry(failOnce);

      expect(result).toBe('success');
    }, 10000);
  });
});
