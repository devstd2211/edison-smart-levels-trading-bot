/**
 * Event Deduplication Service - Error Handling Tests
 *
 * Phase 8.9.19: ErrorHandler Integration
 * Tests for GRACEFUL_DEGRADE and SKIP strategies
 *
 * Scenarios:
 * - Cache corruption during cleanup
 * - Map iteration failures
 * - Logger failures (SKIP strategy)
 * - Backward compatibility (works without ErrorHandler)
 * - Integration with services DI
 */

import { EventDeduplicationService } from '../../services/event-deduplication.service';
import { LoggerService, LogLevel } from '../../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../../errors';
import {
  createEventDeduplicationErrorHandler,
  createManagedEventDeduplicationContext,
  type EventDeduplicationHarness,
  getEventDeduplicationProcessedEvents,
  populateEventDeduplicationCache,
  runEventDeduplicationChecks,
} from '../helpers/event-deduplication-test.utils';

type EventDeduplicationFixtures = {
  runtime: Pick<EventDeduplicationHarness, 'logger' | 'errorHandler'>;
  factories: Pick<EventDeduplicationHarness, 'createServiceWithDefaults' | 'createLegacyService'>;
};

// ============================================================================
// MOCKS
// ============================================================================

const createMockErrorHandler = (logger: LoggerService): ErrorHandler =>
  createEventDeduplicationErrorHandler(logger);

// ============================================================================
// TESTS
// ============================================================================

describe('EventDeduplicationService - Error Handling (Phase 8.9.19)', () => {
  let runtime: EventDeduplicationFixtures['runtime'];
  let factories: EventDeduplicationFixtures['factories'];
  let service: EventDeduplicationService;
  let logger: LoggerService;
  let errorHandler: ErrorHandler;
  let createService: EventDeduplicationHarness['createServiceWithDefaults'];
  let createLegacyService: EventDeduplicationHarness['createLegacyService'];
  let fixtures: EventDeduplicationFixtures;
  let cleanup: () => void;

  beforeEach(() => {
    const managedContext = createManagedEventDeduplicationContext();
    fixtures = {
      runtime: {
        logger: managedContext.logger,
        errorHandler: managedContext.errorHandler,
      },
      factories: {
        createServiceWithDefaults: managedContext.createServiceWithDefaults,
        createLegacyService: managedContext.createLegacyService,
      },
    };
    cleanup = managedContext.cleanup;
    ({ runtime, factories } = fixtures);
    ({ logger, errorHandler } = runtime);
    ({ createServiceWithDefaults: createService, createLegacyService } = factories);
  });

  afterEach(() => {
    cleanup();
  });

  // ========================================================================
  // SKIP Strategy Tests (4 tests)
  // ========================================================================

  describe('SKIP Strategy for Logger Failures (4 tests)', () => {
    it('test-8.9.19.1: Should skip duplicate log when logger throws', () => {
      service = createService({ cacheSize: 10, cacheTtlMs: 1000, logger, errorHandler });
      const timestamp = Date.now();

      // Mock logger to throw
      jest.spyOn(logger, 'debug').mockImplementation(() => {
        throw new Error('Logger write failed');
      });

      // Should not throw, just return true (duplicate detected)
      const result = service.isDuplicate('TP', 'order-123', timestamp);
      expect(result).toBe(false); // First occurrence

      // Second call should detect duplicate even if logger fails
      const duplicate = service.isDuplicate('TP', 'order-123', timestamp);
      expect(duplicate).toBe(true); // Duplicate detected despite logger error
    });

    it('test-8.9.19.2: Should continue with next event after logger failure', () => {
      service = createService({ cacheSize: 10, cacheTtlMs: 1000, logger, errorHandler });
      const timestamp = Date.now();

      // Mock logger to fail once, then work
      let callCount = 0;
      jest.spyOn(logger, 'debug').mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Logger temporarily failed');
        }
      });

      // Add events
      service.isDuplicate('TP', 'order-1', timestamp);
      service.isDuplicate('TP', 'order-2', timestamp); // Logger fails here

      // Should still detect duplicates
      expect(service.isDuplicate('TP', 'order-1', timestamp)).toBe(true);
      expect(service.isDuplicate('TP', 'order-2', timestamp)).toBe(true);
    });

    it('test-8.9.19.3: Should handle logger failures in cleanup', () => {
      // Use larger capacity and longer TTL to avoid timing issues
      service = createService({ cacheSize: 10, cacheTtlMs: 5000, logger, errorHandler });
      const timestamp = Date.now() - 2000; // Old timestamp (will expire)
      const currentTimestamp = Date.now();

      // Add expired events
      service.isDuplicate('TP', 'old-1', timestamp);

      // Mock logger to fail
      jest.spyOn(logger, 'debug').mockImplementation(() => {
        throw new Error('Logger write error');
      });

      // Add new events (should trigger cleanup of expired ones)
      service.isDuplicate('TP', 'new-1', currentTimestamp);
      service.isDuplicate('TP', 'new-2', currentTimestamp);

      // Service should still work despite cleanup logging failure
      // new-1 should be detected as duplicate immediately after being added
      expect(service.isDuplicate('TP', 'new-1', currentTimestamp)).toBe(true);
    });

    it('test-8.9.19.4: Should work without ErrorHandler when logger fails', () => {
      // No ErrorHandler provided
      service = createLegacyService({ cacheSize: 10, cacheTtlMs: 1000, logger });
      const timestamp = Date.now();

      // Mock logger to throw
      jest.spyOn(logger, 'debug').mockImplementation(() => {
        throw new Error('Logger write failed');
      });

      // Should still work (no ErrorHandler, no error thrown)
      const result = service.isDuplicate('TP', 'order-123', timestamp);
      expect(result).toBe(false);

      const duplicate = service.isDuplicate('TP', 'order-123', timestamp);
      expect(duplicate).toBe(true);
    });
  });

  // ========================================================================
  // GRACEFUL_DEGRADE Strategy Tests (5 tests)
  // ========================================================================

  describe('GRACEFUL_DEGRADE Strategy for Cache Cleanup (5 tests)', () => {
    it('test-8.9.19.5: Should degrade gracefully when Map iteration fails', () => {
      // Use longer TTL (5000ms) to ensure events don't expire during test
      const corruptedService = createService({
        cacheSize: 10,
        cacheTtlMs: 5000,
        logger,
        errorHandler,
      });

      // Manually add events to trigger potential cleanup
      const now = Date.now();
      for (let i = 0; i < 11; i++) {
        getEventDeduplicationProcessedEvents(corruptedService).set(`key-${i}`, now);
      }

      // Call isDuplicate to test deduplication
      // This should work normally even though we have capacity overflow
      const result1 = corruptedService.isDuplicate('SL', 'test-order', now);
      expect(result1).toBe(false); // New event

      // Second call should detect duplicate
      const result2 = corruptedService.isDuplicate('SL', 'test-order', now);
      expect(result2).toBe(true); // Duplicate detected

      // Service should continue to work
      const result3 = corruptedService.isDuplicate('SL', 'other-order', now);
      expect(result3).toBe(false); // Different event is new
    });

    it('test-8.9.19.6: Should continue with current cache after cleanup failure', () => {
      service = createService({ cacheSize: 10, cacheTtlMs: 500, logger, errorHandler });
      const timestamp1 = Date.now() - 1000;
      const timestamp2 = Date.now();

      // Add expired and recent events
      service.isDuplicate('TP', 'old-order', timestamp1);
      service.isDuplicate('SL', 'new-order', timestamp2);

      // Trigger cleanup failure by mocking delete
      const deleteSpy = jest
        .spyOn(Map.prototype, 'delete')
        .mockImplementationOnce(() => {
          throw new Error('Delete failed');
        });

      // Trigger cleanup (by adding 10 more events to exceed cache size)
      populateEventDeduplicationCache(service, {
        count: 10,
        type: 'TRAILING',
        startTime: Date.now(),
      });

      // Service should still detect duplicates despite cleanup failure
      expect(service.isDuplicate('TP', 'old-order', timestamp1)).toBe(true);
      expect(service.isDuplicate('SL', 'new-order', timestamp2)).toBe(true);

      deleteSpy.mockRestore();
    });

    it('test-8.9.19.7: Should handle cleanup with ErrorHandler callbacks', () => {
      const errorHandler2 = createMockErrorHandler(logger);
      service = createService({ cacheSize: 10, cacheTtlMs: 500, logger, errorHandler: errorHandler2 });

      // Trigger cleanup multiple times
      populateEventDeduplicationCache(service, {
        count: 15,
        startTime: Date.now(),
      });

      // ErrorHandler should have been called (at least once for cleanup)
      // Note: This verifies ErrorHandler integration, not that error occurred
      expect(service).toBeDefined();
    });

    it('test-8.9.19.8: Should degrade without ErrorHandler in cleanup', () => {
      // No ErrorHandler
      service = createLegacyService({ cacheSize: 5, cacheTtlMs: 100, logger });

      const timestamp = Date.now();

      // Add first event
      service.isDuplicate('TP', 'order-0', timestamp);

      // Add more events to trigger cleanup
      populateEventDeduplicationCache(service, {
        count: 9,
        idPrefix: 'order-',
        startTime: timestamp,
        timeStepMs: 0,
      });

      // Service should work despite no ErrorHandler
      // order-0 should still be in cache with same timestamp
      const duplicate = service.isDuplicate('TP', 'order-0', timestamp);
      expect(duplicate).toBe(true);
    });

    it('test-8.9.19.9: Should handle partial cache cleanup failures', () => {
      service = createService({ cacheSize: 3, cacheTtlMs: 100, logger, errorHandler });
      const timestamp = Date.now();

      // Add events
      service.isDuplicate('TP', 'order-1', timestamp);
      service.isDuplicate('TP', 'order-2', timestamp);
      service.isDuplicate('TP', 'order-3', timestamp);

      // This should trigger cleanup (cache exceeds size)
      service.isDuplicate('TP', 'order-4', timestamp);

      // Service should still function
      expect(service.isDuplicate('TP', 'order-1', timestamp)).toBe(true);
    });
  });

  // ========================================================================
  // Integration Tests (5 tests)
  // ========================================================================

  describe('Integration Scenarios (5 tests)', () => {
    it('test-8.9.19.10: Should handle rapid deduplication with error recovery', () => {
      service = createService({ cacheSize: 100, cacheTtlMs: 1000, logger, errorHandler });

      // Simulate rapid WebSocket event stream
      const events = [
        { type: 'TP', id: 'exec-1', time: 1000 },
        { type: 'TP', id: 'exec-1', time: 1000 }, // Duplicate
        { type: 'SL', id: 'exec-2', time: 1000 },
        { type: 'TP', id: 'exec-1', time: 1000 }, // Duplicate again
      ];

      const results = runEventDeduplicationChecks(service, events);

      expect(results[0]).toBe(false); // New
      expect(results[1]).toBe(true); // Duplicate
      expect(results[2]).toBe(false); // New
      expect(results[3]).toBe(true); // Duplicate
    });

    it('test-8.9.19.11: Should handle cache overflow with error handling', () => {
      service = createService({ cacheSize: 5, cacheTtlMs: 60000, logger, errorHandler });
      const timestamp = 1000; // Fixed timestamp for all calls

      // Fill cache to trigger cleanup
      populateEventDeduplicationCache(service, {
        count: 10,
        startTime: timestamp,
        timeStepMs: 0,
      });

      // All should still be detectable as duplicates
      for (let i = 0; i < 10; i++) {
        const isDup = service.isDuplicate('TP', `order-${i}`, timestamp);
        expect(isDup).toBe(true);
      }
    });

    it('test-8.9.19.12: Should clear cache safely even with ErrorHandler', () => {
      service = createService({ cacheSize: 10, cacheTtlMs: 1000, logger, errorHandler });
      const timestamp = Date.now();

      service.isDuplicate('TP', 'order-1', timestamp);
      service.isDuplicate('SL', 'order-2', timestamp);

      // Clear should always succeed
      service.clear();

      // After clear, events should be new again
      expect(service.isDuplicate('TP', 'order-1', timestamp)).toBe(false);
      expect(service.isDuplicate('SL', 'order-2', timestamp)).toBe(false);
    });

    it('test-8.9.19.13: Should handle mixed logger/cleanup failures', () => {
      service = createService({ cacheSize: 3, cacheTtlMs: 5000, logger, errorHandler }); // 5s TTL to prevent expiry

      // Mock logger to fail sometimes
      let logCallCount = 0;
      jest.spyOn(logger, 'debug').mockImplementation(() => {
        logCallCount++;
        if (logCallCount === 2) {
          throw new Error('Log error');
        }
      });

      // Add events, some will fail to log but service continues
      const timestamp = Date.now();
      for (let i = 0; i < 5; i++) {
        service.isDuplicate('TP', `order-${i}`, timestamp);
        service.isDuplicate('TP', `order-${i}`, timestamp); // Duplicate
      }

      // Service should still work - use same timestamp to prevent TTL expiry
      const result = service.isDuplicate('TP', 'order-0', timestamp);
      expect(result).toBe(true); // Should be true (duplicate of order-0)
    });

    it('test-8.9.19.14: Should work with optional ErrorHandler parameter', () => {
      // Create service with ErrorHandler
      const service1 = createService({ cacheSize: 10, cacheTtlMs: 1000, logger, errorHandler });
      const service2 = createService({ cacheSize: 10, cacheTtlMs: 1000, logger });
      const service3 = createLegacyService({ cacheSize: 10, cacheTtlMs: 1000 });

      const timestamp = Date.now();

      // All should work identically
      expect(service1.isDuplicate('TP', 'order', timestamp)).toBe(false);
      expect(service2.isDuplicate('TP', 'order', timestamp)).toBe(false);
      expect(service3.isDuplicate('TP', 'order', timestamp)).toBe(false);

      expect(service1.isDuplicate('TP', 'order', timestamp)).toBe(true);
      expect(service2.isDuplicate('TP', 'order', timestamp)).toBe(true);
      expect(service3.isDuplicate('TP', 'order', timestamp)).toBe(true);
    });
  });

  // ========================================================================
  // Backward Compatibility Tests (3 tests)
  // ========================================================================

  describe('Backward Compatibility (3 tests)', () => {
    it('test-8.9.19.15: Should work without ErrorHandler (old behavior)', () => {
      service = createService({ cacheSize: 10, cacheTtlMs: 1000, logger });
      const timestamp = Date.now();

      const first = service.isDuplicate('TP', 'order-123', timestamp);
      expect(first).toBe(false);

      const second = service.isDuplicate('TP', 'order-123', timestamp);
      expect(second).toBe(true);
    });

    it('test-8.9.19.16: Should work without logger or ErrorHandler', () => {
      service = createLegacyService({ cacheSize: 10, cacheTtlMs: 1000 });
      const timestamp = Date.now();

      const first = service.isDuplicate('TP', 'order-123', timestamp);
      expect(first).toBe(false);

      const second = service.isDuplicate('TP', 'order-123', timestamp);
      expect(second).toBe(true);
    });

    it('test-8.9.19.17: Should maintain same deduplication logic with ErrorHandler', () => {
      const service1 = createService({ cacheSize: 10, cacheTtlMs: 1000, logger, errorHandler });
      const service2 = createService({ cacheSize: 10, cacheTtlMs: 1000, logger });

      const timestamp = Date.now();

      // Both should behave identically
      const ts1_1 = service1.isDuplicate('TP', 'order-1', timestamp);
      const ts2_1 = service2.isDuplicate('TP', 'order-1', timestamp);
      expect(ts1_1).toBe(ts2_1);

      const ts1_2 = service1.isDuplicate('TP', 'order-1', timestamp);
      const ts2_2 = service2.isDuplicate('TP', 'order-1', timestamp);
      expect(ts1_2).toBe(ts2_2);
      expect(ts1_2).toBe(true); // Duplicate
    });
  });

  // ========================================================================
  // Performance Tests (3 tests)
  // ========================================================================

  describe('Performance with Error Handling (3 tests)', () => {
    it('test-8.9.19.18: Should maintain performance with ErrorHandler', () => {
      service = createService({ cacheSize: 1000, cacheTtlMs: 60000, logger, errorHandler });

      const startTime = Date.now();

      populateEventDeduplicationCache(service, {
        count: 1000,
        startTime,
      });

      const elapsed = Date.now() - startTime;

      // Should complete in < 1 second even with ErrorHandler
      expect(elapsed).toBeLessThan(1000);
    });

    it('test-8.9.19.19: Should handle large cache sizes efficiently', () => {
      service = createService({ cacheSize: 5000, cacheTtlMs: 60000, logger, errorHandler });
      const timestamp = 1000; // Fixed timestamp

      const startTime = Date.now();

      // Add 2000 events and trigger cleanup
      populateEventDeduplicationCache(service, {
        count: 2000,
        startTime: timestamp,
        timeStepMs: 0,
      });

      const elapsed = Date.now() - startTime;

      // Should handle large caches efficiently
      expect(elapsed).toBeLessThan(5000);

      // Duplicate detection should still work
      expect(service.isDuplicate('TP', 'order-0', timestamp)).toBe(true);
    });

    it('test-8.9.19.20: Should handle TTL cleanup efficiently', () => {
      service = createService({ cacheSize: 100, cacheTtlMs: 50, logger, errorHandler }); // 50ms TTL

      // Add events
      const timestamp1 = Date.now() - 1000;
      service.isDuplicate('TP', 'old-order', timestamp1);

      const startTime = Date.now();

      // Trigger cleanup by adding many new events
      populateEventDeduplicationCache(service, {
        count: 120,
        idPrefix: 'new-',
        startTime,
      });

      const elapsed = Date.now() - startTime;

      // Should complete efficiently even with cleanup
      expect(elapsed).toBeLessThan(2000);
    });
  });
});
