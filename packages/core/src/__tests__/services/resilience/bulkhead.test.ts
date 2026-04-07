/**
 * Bulkhead Service Tests
 * Phase 14.2.4 - 15 tests
 */

import {
  BulkheadService,
  BulkheadRejectedException,
  BulkheadTimeoutError,
} from '../../../services/resilience/bulkhead.service';
import {
  createManagedBulkheadContext,
} from '../../helpers/resilience-test.utils';

describe('BulkheadService', () => {
  type ManagedBulkheadFactory = ReturnType<typeof createManagedBulkheadContext>;
  type BulkheadFixtures = Pick<
    ManagedBulkheadFactory,
    'createDefaultService' | 'createInvalidService' | 'createService'
  >;
  let service: BulkheadService | undefined;
  let createDefaultService: BulkheadFixtures['createDefaultService'];
  let createInvalidService: BulkheadFixtures['createInvalidService'];
  let createService: BulkheadFixtures['createService'];

  function bindBulkheadFixtures() {
    let fixtures: BulkheadFixtures;
    let cleanup: ManagedBulkheadFactory['cleanup'];

    beforeEach(() => {
      const managedContext = createManagedBulkheadContext();
      fixtures = {
        createDefaultService: managedContext.createDefaultService,
        createInvalidService: managedContext.createInvalidService,
        createService: managedContext.createService,
      };
      cleanup = managedContext.cleanup;
    });

    afterEach(() => {
      cleanup();
      service = undefined;
      jest.clearAllTimers();
    });

    return () => fixtures;
  }

  const getFixtures = bindBulkheadFixtures();

  beforeEach(() => {
    ({
      createDefaultService,
      createInvalidService,
      createService,
    } = getFixtures());
  });

  // ============================================================================
  // INITIALIZATION & VALIDATION (3 tests - THROW strategy)
  // ============================================================================

  describe('Initialization and Validation', () => {
    it('should initialize with default config', () => {
      service = createDefaultService();
      expect(service).toBeDefined();

      const stats = service.getStats('test-pool');
      expect(stats).toBeNull(); // No pools created yet
    });

    it('should throw on invalid maxConcurrent', () => {
      expect(() => createInvalidService({ maxConcurrent: 0 }))
        .toThrow('maxConcurrent must be positive');

      expect(() => createInvalidService({ maxConcurrent: -5 }))
        .toThrow('maxConcurrent must be positive');
    });

    it('should throw on invalid queueSize', () => {
      expect(() => createInvalidService({ queueSize: -1 }))
        .toThrow('queueSize must be non-negative');
    });
  });

  // ============================================================================
  // POOL MANAGEMENT (2 tests)
  // ============================================================================

  describe('Pool Management', () => {
    it('should create pool on first use', async () => {
      service = createService({ maxConcurrent: 2, queueSize: 5 });

      await service.execute('api-pool', async () => 'success');

      const stats = service.getStats('api-pool');
      expect(stats).toBeDefined();
      expect(stats?.totalCompleted).toBe(1);
    });

    it('should throw when max pools exceeded', async () => {
      service = createService({ maxConcurrent: 1 });

      // Create 50 pools (MAX_BULKHEADS)
      for (let i = 0; i < 50; i++) {
        await service.execute(`pool-${i}`, async () => 'success');
      }

      // 51st pool should fail
      await expect(service.execute('pool-51', async () => 'success'))
        .rejects.toThrow('max bulkheads');
    });
  });

  // ============================================================================
  // EXECUTION TESTS (5 tests)
  // ============================================================================

  describe('Execution', () => {
    it('should execute immediately when pool not full', async () => {
      service = createService({ maxConcurrent: 2 });

      const result = await service.execute('test-pool', async () => 'success');
      expect(result).toBe('success');

      const stats = service.getStats('test-pool');
      expect(stats?.totalCompleted).toBe(1);
      expect(stats?.activeWorkers).toBe(0); // Completed
    });

    it('should track active workers correctly', async () => {
      service = createService({ maxConcurrent: 2 });

      let resolve1: () => void;
      let resolve2: () => void;

      const promise1 = service.execute('test-pool', async () => {
        return new Promise<string>(resolve => { resolve1 = () => resolve('1'); });
      });

      const promise2 = service.execute('test-pool', async () => {
        return new Promise<string>(resolve => { resolve2 = () => resolve('2'); });
      });

      // Wait for both to start
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(service.getActiveWorkers('test-pool')).toBe(2);

      // Complete first operation
      resolve1!();
      await promise1;

      expect(service.getActiveWorkers('test-pool')).toBe(1);

      // Complete second operation
      resolve2!();
      await promise2;

      expect(service.getActiveWorkers('test-pool')).toBe(0);
    });

    it('should handle operation errors correctly', async () => {
      service = createService({ maxConcurrent: 1 });

      await expect(service.execute('test-pool', async () => {
        throw new Error('Operation failed');
      })).rejects.toThrow('Operation failed');

      // Worker should be released
      expect(service.getActiveWorkers('test-pool')).toBe(0);

      // Pool should still work
      const result = await service.execute('test-pool', async () => 'success');
      expect(result).toBe('success');
    });

    it('should execute operations in FIFO order from queue', async () => {
      service = createService({ maxConcurrent: 1, queueSize: 5 });

      const results: number[] = [];
      let resolveFirst: () => void;

      // First operation blocks
      const firstPromise = service!.execute('test-pool', async () => {
        return new Promise<void>(resolve => { resolveFirst = resolve; });
      });

      // Queue 3 operations
      const promises = [1, 2, 3].map(num =>
        service!.execute('test-pool', async () => {
          results.push(num);
          return num;
        })
      );

      expect(service!.getQueueSize('test-pool')).toBe(3);

      // Release first operation
      resolveFirst!();
      await firstPromise;

      // Wait for queued operations to complete
      await Promise.all(promises);

      expect(results).toEqual([1, 2, 3]); // FIFO order
    });

    it('should use custom config per pool', async () => {
      service = createService({ maxConcurrent: 1 });

      // Create pool with custom config
      await service.execute('custom-pool', async () => 'success', {
        maxConcurrent: 5,
      });

      const stats = service.getStats('custom-pool');
      expect(stats?.totalCompleted).toBe(1);
    });
  });

  // ============================================================================
  // REJECTION POLICY TESTS (3 tests)
  // ============================================================================

  describe('Rejection Policies', () => {
    it('should reject immediately with FAIL_FAST policy', async () => {
      service = createService({
        maxConcurrent: 1,
        queueSize: 0,
        rejectPolicy: 'FAIL_FAST',
      });

      let resolveFirst: () => void;

      // Block first operation
      const firstPromise = service.execute('test-pool', async () => {
        return new Promise<void>(resolve => { resolveFirst = resolve; });
      });

      // Second operation should be rejected immediately
      await expect(service!.execute('test-pool', async () => 'success'))
        .rejects.toThrow(BulkheadRejectedException);

      const stats = service.getStats('test-pool');
      expect(stats?.totalRejected).toBe(1);

      resolveFirst!();
      await firstPromise;
    });

    it('should queue operations with QUEUE policy', async () => {
      service = createService({
        maxConcurrent: 1,
        queueSize: 5,
        rejectPolicy: 'QUEUE',
      });

      let resolveFirst: () => void;

      // Block first operation
      const firstPromise = service.execute('test-pool', async () => {
        return new Promise<void>(resolve => { resolveFirst = resolve; });
      });

      // Queue second operation
      const secondPromise = service.execute('test-pool', async () => 'queued');

      expect(service.getQueueSize('test-pool')).toBe(1);

      // Release first
      resolveFirst!();
      await firstPromise;

      // Second should complete
      const result = await secondPromise;
      expect(result).toBe('queued');
      expect(service.getQueueSize('test-pool')).toBe(0);
    });

    it('should timeout queued operations with TIMEOUT policy', async () => {
      service = createService({
        maxConcurrent: 1,
        queueSize: 5,
        rejectPolicy: 'TIMEOUT',
        timeoutMs: 50,
      });

      let resolveFirst: () => void;

      // Block first operation
      const firstPromise = service.execute('test-pool', async () => {
        return new Promise<void>(resolve => { resolveFirst = resolve; });
      });

      // Queue second operation
      const secondPromise = service.execute('test-pool', async () => 'success');

      expect(service.getQueueSize('test-pool')).toBe(1);

      // Wait for timeout
      await expect(secondPromise).rejects.toThrow(BulkheadTimeoutError);

      const stats = service.getStats('test-pool');
      expect(stats?.totalTimedOut).toBe(1);
      expect(service.getQueueSize('test-pool')).toBe(0);

      resolveFirst!();
      await firstPromise;
    }, 10000);
  });

  // ============================================================================
  // INTEGRATION TESTS (2 tests)
  // ============================================================================

  describe('Integration Tests', () => {
    it('should handle multiple pools independently', async () => {
      service = createService({ maxConcurrent: 1, queueSize: 5 });

      let resolveApi: () => void;
      let resolveWs: () => void;

      // Block both pools
      const apiPromise = service.execute('api-pool', async () => {
        return new Promise<void>(resolve => { resolveApi = resolve; });
      });

      const wsPromise = service.execute('ws-pool', async () => {
        return new Promise<void>(resolve => { resolveWs = resolve; });
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Both pools should have 1 active worker
      expect(service.getActiveWorkers('api-pool')).toBe(1);
      expect(service.getActiveWorkers('ws-pool')).toBe(1);

      // Release API pool
      resolveApi!();
      await apiPromise;

      expect(service.getActiveWorkers('api-pool')).toBe(0);
      expect(service.getActiveWorkers('ws-pool')).toBe(1); // Still blocked

      resolveWs!();
      await wsPromise;
    });

    it('should reset pool correctly', async () => {
      service = createService({ maxConcurrent: 1, queueSize: 5 });

      let resolveFirst: () => void;

      // Block pool
      const firstPromise = service.execute('test-pool', async () => {
        return new Promise<void>(resolve => { resolveFirst = resolve; });
      });

      // Queue operations
      const queuedPromises = [1, 2, 3].map(num =>
        service!.execute('test-pool', async () => num)
      );

      expect(service.getQueueSize('test-pool')).toBe(3);

      // Reset pool
      service.reset('test-pool');

      expect(service.getQueueSize('test-pool')).toBe(0);
      expect(service.getActiveWorkers('test-pool')).toBe(0);

      // Queued operations should be rejected
      for (const promise of queuedPromises) {
        await expect(promise).rejects.toThrow(BulkheadRejectedException);
      }

      resolveFirst!();
      await firstPromise;
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY (No ErrorHandler/Logger)
  // ============================================================================

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler and Logger', async () => {
      service = createService(
        { maxConcurrent: 2 },
        { logger: undefined, errorHandler: undefined },
      );

      const result = await service.execute('test-pool', async () => 'success');
      expect(result).toBe('success');

      const stats = service.getStats('test-pool');
      expect(stats?.totalCompleted).toBe(1);
    });
  });
});
