/**
 * Rate Limiter Service Tests
 * Phase 14.2.2 - 20 tests
 */

import {
  RateLimiterService,
  RateLimitExceededError,
  type RateLimiterConfig,
} from '../../../services/resilience/rate-limiter.service';
import { ErrorHandler, RecoveryStrategy } from '../../../errors/ErrorHandler';
import { LoggerService } from '../../../services/logger.service';

describe('RateLimiterService', () => {
  let logger: Partial<LoggerService>;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    errorHandler = new ErrorHandler(logger as LoggerService);
  });

  afterEach(() => {
    // Clean up any running services
    jest.clearAllTimers();
  });

  // ============================================================================
  // INITIALIZATION & VALIDATION (5 tests - THROW strategy)
  // ============================================================================

  describe('Initialization and Validation', () => {
    it('should initialize with default config', () => {
      const service = new RateLimiterService();
      service.start();
      expect(service).toBeDefined();
      expect(service.getKeys()).toEqual([]);
      service.stop();
    });

    it('should throw on invalid maxRequests', () => {
      expect(() => new RateLimiterService({ maxRequests: 0 }))
        .toThrow('maxRequests must be positive');

      expect(() => new RateLimiterService({ maxRequests: -5 }))
        .toThrow('maxRequests must be positive');
    });

    it('should throw on invalid windowMs', () => {
      expect(() => new RateLimiterService({ windowMs: 0 }))
        .toThrow('windowMs must be positive');

      expect(() => new RateLimiterService({ windowMs: -1000 }))
        .toThrow('windowMs must be positive');
    });

    it('should throw on invalid burstSize', () => {
      expect(() => new RateLimiterService({ burstSize: 0 }))
        .toThrow('burstSize must be positive');

      expect(() => new RateLimiterService({ burstSize: -10 }))
        .toThrow('burstSize must be positive');
    });

    it('should throw on invalid queueSize', () => {
      expect(() => new RateLimiterService({ queueSize: -1 }))
        .toThrow('queueSize must be non-negative');
    });
  });

  // ============================================================================
  // TOKEN BUCKET TESTS (5 tests)
  // ============================================================================

  describe('Token Bucket Mechanics', () => {
    it('should acquire tokens successfully', async () => {
      const service = new RateLimiterService({
        maxRequests: 10,
        windowMs: 1000,
        burstSize: 10,
      }, logger as LoggerService, errorHandler);
      service.start();

      const acquired = await service.acquire('test', 3);
      expect(acquired).toBe(true);
      expect(service.getRemainingTokens('test')).toBe(7);

      service.stop();
    });

    it('should refill tokens over time', async () => {
      const service = new RateLimiterService({
        maxRequests: 10, // 10 tokens per second
        windowMs: 1000,
        burstSize: 10,
      }, logger as LoggerService, errorHandler);
      service.start();

      // Consume all tokens
      await service.acquire('test', 10);
      expect(service.getRemainingTokens('test')).toBe(0);

      // Wait 500ms → should refill ~5 tokens
      await new Promise(resolve => setTimeout(resolve, 500));
      const remaining = service.getRemainingTokens('test');
      expect(remaining).toBeGreaterThanOrEqual(4);
      expect(remaining).toBeLessThanOrEqual(6);

      service.stop();
    });

    it('should respect burst capacity', async () => {
      const service = new RateLimiterService({
        maxRequests: 5,
        windowMs: 1000,
        burstSize: 15, // Allow burst of 15
      }, logger as LoggerService, errorHandler);
      service.start();

      // Should allow burst up to 15 tokens
      const acquired = await service.acquire('test', 15);
      expect(acquired).toBe(true);
      expect(service.getRemainingTokens('test')).toBe(0);

      service.stop();
    });

    it('should not exceed max tokens on refill', async () => {
      const service = new RateLimiterService({
        maxRequests: 10,
        windowMs: 1000,
        burstSize: 10,
      }, logger as LoggerService, errorHandler);
      service.start();

      // Don't consume tokens, just wait
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should not exceed burst size
      expect(service.getRemainingTokens('test')).toBeLessThanOrEqual(10);

      service.stop();
    });

    it('should track multiple independent rate limiters', async () => {
      const service = new RateLimiterService({
        maxRequests: 10,
        windowMs: 1000,
        burstSize: 10,
      }, logger as LoggerService, errorHandler);
      service.start();

      await service.acquire('endpoint1', 3);
      await service.acquire('endpoint2', 5);

      expect(service.getRemainingTokens('endpoint1')).toBe(7);
      expect(service.getRemainingTokens('endpoint2')).toBe(5);
      expect(service.getKeys()).toContain('endpoint1');
      expect(service.getKeys()).toContain('endpoint2');

      service.stop();
    });
  });

  // ============================================================================
  // RATE LIMITING TESTS (5 tests)
  // ============================================================================

  describe('Rate Limiting', () => {
    it('should reject when tokens exhausted', async () => {
      const service = new RateLimiterService({
        maxRequests: 5,
        windowMs: 1000,
        burstSize: 5,
        queueSize: 0, // Disable queue
      }, logger as LoggerService, errorHandler);
      service.start();

      // Consume all tokens
      await service.acquire('test', 5);

      // Should reject next request
      const acquired = await service.acquire('test', 1);
      expect(acquired).toBe(false);

      service.stop();
    });

    it('should throw RateLimitExceededError in execute', async () => {
      const service = new RateLimiterService({
        maxRequests: 2,
        windowMs: 1000,
        burstSize: 2,
        queueSize: 0,
      }, logger as LoggerService, errorHandler);
      service.start();

      const operation = jest.fn(async () => 'success');

      // First 2 calls succeed
      await service.execute('test', operation);
      await service.execute('test', operation);

      // Third call should throw
      await expect(service.execute('test', operation))
        .rejects.toThrow(RateLimitExceededError);

      expect(operation).toHaveBeenCalledTimes(2);

      service.stop();
    });

    it('should queue requests when queue enabled', async () => {
      const service = new RateLimiterService({
        maxRequests: 5,
        windowMs: 1000,
        burstSize: 5,
        queueSize: 10,
      }, logger as LoggerService, errorHandler);
      service.start();

      // Consume all tokens
      await service.acquire('test', 5);

      // Queue next request (will be pending)
      const queuedPromise = service.acquire('test', 1);
      expect(service.getQueueSize('test')).toBe(1);

      // Wait for refill
      await new Promise(resolve => setTimeout(resolve, 300));

      // Queued request should be processed
      const acquired = await queuedPromise;
      expect(acquired).toBe(true);

      service.stop();
    });

    it('should reject when queue is full', async () => {
      const service = new RateLimiterService({
        maxRequests: 2,
        windowMs: 1000,
        burstSize: 2,
        queueSize: 2, // Small queue
      }, logger as LoggerService, errorHandler);
      service.start();

      // Consume all tokens
      await service.acquire('test', 2);

      // Fill queue
      const queued1 = service.acquire('test', 1);
      const queued2 = service.acquire('test', 1);
      expect(service.getQueueSize('test')).toBe(2);

      // Next request should be rejected (queue full)
      const rejected = await service.acquire('test', 1);
      expect(rejected).toBe(false);

      service.stop();

      // Clean up promises
      await Promise.race([queued1, Promise.resolve(false)]);
      await Promise.race([queued2, Promise.resolve(false)]);
    });

    it('should provide accurate statistics', async () => {
      const service = new RateLimiterService({
        maxRequests: 10,
        windowMs: 1000,
        burstSize: 10,
        queueSize: 0,
      }, logger as LoggerService, errorHandler);
      service.start();

      // 5 successful acquires
      for (let i = 0; i < 5; i++) {
        await service.acquire('test', 1);
      }

      // 3 rejected acquires
      await service.acquire('test', 10); // Not enough tokens
      await service.acquire('test', 10);
      await service.acquire('test', 10);

      const stats = service.getStats('test');
      expect(stats).toBeDefined();
      expect(stats!.totalRequests).toBe(8);
      expect(stats!.rejectedRequests).toBe(3);
      expect(stats!.tokens).toBeLessThanOrEqual(10);

      service.stop();
    });
  });

  // ============================================================================
  // ADAPTIVE RATE LIMITING (5 tests)
  // ============================================================================

  describe('Adaptive Rate Limiting', () => {
    it('should reduce rate on 429 error', async () => {
      const service = new RateLimiterService({
        maxRequests: 10,
        windowMs: 1000,
        burstSize: 10,
        adaptiveEnabled: true,
      }, logger as LoggerService, errorHandler);
      service.start();

      const error429 = new Error('Too Many Requests');
      (error429 as any).status = 429;

      const operation = jest.fn(async () => {
        throw error429;
      });

      const statsBefore = service.getStats('test');
      const rateBefor = statsBefore?.refillRate ?? 10;

      try {
        await service.execute('test', operation);
      } catch (error) {
        // Expected
      }

      const statsAfter = service.getStats('test');
      expect(statsAfter!.refillRate).toBeLessThan(rateBefor);

      service.stop();
    });

    it('should increase rate on success when adaptive enabled', async () => {
      const service = new RateLimiterService({
        maxRequests: 10,
        windowMs: 1000,
        burstSize: 10,
        adaptiveEnabled: true,
      }, logger as LoggerService, errorHandler);
      service.start();

      // First reduce rate
      const error429 = new Error('Rate limited');
      (error429 as any).status = 429;
      try {
        await service.execute('test', async () => { throw error429; });
      } catch (error) {
        // Expected
      }

      const statsAfterReduction = service.getStats('test');
      const rateAfterReduction = statsAfterReduction!.refillRate;

      // Then succeed to trigger recovery
      await service.execute('test', async () => 'success');

      const statsAfterRecovery = service.getStats('test');
      expect(statsAfterRecovery!.refillRate).toBeGreaterThan(rateAfterReduction);

      service.stop();
    });

    it('should not adjust rate when adaptive disabled', async () => {
      const service = new RateLimiterService({
        maxRequests: 10,
        windowMs: 1000,
        burstSize: 10,
        adaptiveEnabled: false,
      }, logger as LoggerService, errorHandler);
      service.start();

      const error429 = new Error('Too Many Requests');
      (error429 as any).status = 429;

      const statsBefore = service.getStats('test');
      const rateBefore = statsBefore?.refillRate ?? 10;

      try {
        await service.execute('test', async () => { throw error429; });
      } catch (error) {
        // Expected
      }

      const statsAfter = service.getStats('test');
      expect(statsAfter!.refillRate).toBe(rateBefore);

      service.stop();
    });

    it('should manually adjust rate with adjustRate', async () => {
      const service = new RateLimiterService({
        maxRequests: 10,
        windowMs: 1000,
        burstSize: 10,
      }, logger as LoggerService, errorHandler);
      service.start();

      // Initialize bucket and stats
      await service.acquire('test', 1);

      const statsBefore = service.getStats('test');
      const rateBefore = statsBefore!.refillRate;

      // Reduce rate to 50%
      service.adjustRate('test', 0.5);

      const statsAfter = service.getStats('test');
      expect(statsAfter!.refillRate).toBe(rateBefore * 0.5);

      service.stop();
    });

    it('should respect minimum rate limit', async () => {
      const service = new RateLimiterService({
        maxRequests: 10,
        windowMs: 1000,
        burstSize: 10,
      }, logger as LoggerService, errorHandler);
      service.start();

      // Initialize bucket and stats
      await service.acquire('test', 1);

      // Try to reduce rate to near zero
      service.adjustRate('test', 0.0001);

      const stats = service.getStats('test');
      expect(stats!.refillRate).toBeGreaterThan(0);

      service.stop();
    });
  });

  // ============================================================================
  // EDGE CASES & ERROR HANDLING (3 tests)
  // ============================================================================

  describe('Edge Cases', () => {
    it('should throw on invalid key', async () => {
      const service = new RateLimiterService({}, logger as LoggerService, errorHandler);
      service.start();

      await expect(service.acquire('', 1))
        .rejects.toThrow('Rate limiter key must be a non-empty string');

      await expect(service.acquire(null as any, 1))
        .rejects.toThrow('Rate limiter key must be a non-empty string');

      service.stop();
    });

    it('should throw on invalid token count', async () => {
      const service = new RateLimiterService({}, logger as LoggerService, errorHandler);
      service.start();

      await expect(service.acquire('test', 0))
        .rejects.toThrow('Token count must be positive');

      await expect(service.acquire('test', -5))
        .rejects.toThrow('Token count must be positive');

      service.stop();
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
        debug: jest.fn(() => {
          throw new Error('Logging system down');
        }),
      };

      // Should not throw despite logging errors
      const service = new RateLimiterService({}, faultyLogger as any, errorHandler);
      service.start();
      await expect(service.acquire('test', 1)).resolves.toBe(true);

      service.stop();
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY (2 tests)
  // ============================================================================

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler', async () => {
      const service = new RateLimiterService({
        maxRequests: 5,
        windowMs: 1000,
        burstSize: 5,
      }, logger as LoggerService);
      service.start();

      const acquired = await service.acquire('test', 3);
      expect(acquired).toBe(true);
      expect(service.getRemainingTokens('test')).toBe(2);

      service.stop();
    });

    it('should work without Logger', async () => {
      const service = new RateLimiterService({
        maxRequests: 5,
        windowMs: 1000,
        burstSize: 5,
      });
      service.start();

      const acquired = await service.acquire('test', 3);
      expect(acquired).toBe(true);
      expect(service.getRemainingTokens('test')).toBe(2);

      service.stop();
    });
  });
});
