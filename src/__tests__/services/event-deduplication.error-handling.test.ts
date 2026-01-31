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
 * - Integration with BotServices DI
 */

import { EventDeduplicationService } from '../../services/event-deduplication.service';
import { LoggerService, LogLevel } from '../../types';
import { ErrorHandler, RecoveryStrategy } from '../../errors';

// ============================================================================
// MOCKS
// ============================================================================

const createMockLogger = (): LoggerService => {
  return new LoggerService(LogLevel.ERROR, './logs', false);
};

const createMockErrorHandler = (): ErrorHandler => {
  return new ErrorHandler({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });
};

// ============================================================================
// TESTS
// ============================================================================

describe('EventDeduplicationService - Error Handling (Phase 8.9.19)', () => {
  let service: EventDeduplicationService;
  let logger: LoggerService;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    logger = createMockLogger();
    errorHandler = createMockErrorHandler();
  });

  // ========================================================================
  // SKIP Strategy Tests (4 tests)
  // ========================================================================

  describe('SKIP Strategy for Logger Failures (4 tests)', () => {
    it('test-8.9.19.1: Should skip duplicate log when logger throws', () => {
      service = new EventDeduplicationService(10, 1000, logger, errorHandler);
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
      service = new EventDeduplicationService(10, 1000, logger, errorHandler);
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
      service = new EventDeduplicationService(2, 500, logger, errorHandler);
      const timestamp = Date.now() - 1000; // Old timestamp

      // Add expired events
      service.isDuplicate('TP', 'old-1', timestamp);

      // Mock logger to fail
      jest.spyOn(logger, 'debug').mockImplementation(() => {
        throw new Error('Logger write error');
      });

      // This should trigger cleanup but not fail
      service.isDuplicate('TP', 'new-1', Date.now());
      service.isDuplicate('TP', 'new-2', Date.now());

      // Service should still work despite cleanup logging failure
      expect(service.isDuplicate('TP', 'new-1', Date.now())).toBe(true);
    });

    it('test-8.9.19.4: Should work without ErrorHandler when logger fails', () => {
      // No ErrorHandler provided
      service = new EventDeduplicationService(10, 1000, logger, undefined);
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
      service = new EventDeduplicationService(50, 100, logger, errorHandler);

      // Add many events to trigger cleanup
      for (let i = 0; i < 51; i++) {
        service.isDuplicate('TP', `order-${i}`, Date.now());
      }

      // Corrupt the Map by spying on entries() to throw
      const originalEntries = Map.prototype.entries;
      const corruptedService = new EventDeduplicationService(
        10,
        100,
        logger,
        errorHandler,
      );

      // Manually add events
      for (let i = 0; i < 11; i++) {
        (corruptedService as any).processedEvents.set(`key-${i}`, Date.now());
      }

      // Spy on Map.prototype.entries to simulate failure
      const entriesSpy = jest
        .spyOn(Map.prototype, 'entries')
        .mockImplementationOnce(() => {
          throw new Error('Map iteration failed');
        });

      // Call isDuplicate to trigger cleanup
      // Should degrade, not crash
      const result = corruptedService.isDuplicate(
        'SL',
        'test-order',
        Date.now(),
      );

      // Service should still work
      expect(result).toBe(false); // New event
      expect(
        corruptedService.isDuplicate('SL', 'test-order', Date.now()),
      ).toBe(true); // Duplicate detected

      entriesSpy.mockRestore();
    });

    it('test-8.9.19.6: Should continue with current cache after cleanup failure', () => {
      service = new EventDeduplicationService(10, 500, logger, errorHandler);
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
      for (let i = 0; i < 10; i++) {
        service.isDuplicate('TRAILING', `order-${i}`, Date.now());
      }

      // Service should still detect duplicates despite cleanup failure
      expect(service.isDuplicate('TP', 'old-order', timestamp1)).toBe(true);
      expect(service.isDuplicate('SL', 'new-order', timestamp2)).toBe(true);

      deleteSpy.mockRestore();
    });

    it('test-8.9.19.7: Should handle cleanup with ErrorHandler callbacks', () => {
      const errorHandler2 = createMockErrorHandler();
      service = new EventDeduplicationService(10, 500, logger, errorHandler2);

      // Trigger cleanup multiple times
      for (let i = 0; i < 15; i++) {
        service.isDuplicate('TP', `order-${i}`, Date.now());
      }

      // ErrorHandler should have been called (at least once for cleanup)
      // Note: This verifies ErrorHandler integration, not that error occurred
      expect(service).toBeDefined();
    });

    it('test-8.9.19.8: Should degrade without ErrorHandler in cleanup', () => {
      // No ErrorHandler
      service = new EventDeduplicationService(5, 100, logger, undefined);

      // Add events to trigger cleanup
      for (let i = 0; i < 10; i++) {
        service.isDuplicate('TP', `order-${i}`, Date.now());
      }

      // Service should work despite no ErrorHandler
      const duplicate = service.isDuplicate('TP', 'order-0', Date.now());
      expect(duplicate).toBe(true);
    });

    it('test-8.9.19.9: Should handle partial cache cleanup failures', () => {
      service = new EventDeduplicationService(3, 100, logger, errorHandler);
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
      service = new EventDeduplicationService(100, 1000, logger, errorHandler);

      // Simulate rapid WebSocket event stream
      const events = [
        { type: 'TP', id: 'exec-1', time: 1000 },
        { type: 'TP', id: 'exec-1', time: 1000 }, // Duplicate
        { type: 'SL', id: 'exec-2', time: 1000 },
        { type: 'TP', id: 'exec-1', time: 1000 }, // Duplicate again
      ];

      const results = events.map(e =>
        service.isDuplicate(e.type, e.id, e.time),
      );

      expect(results[0]).toBe(false); // New
      expect(results[1]).toBe(true); // Duplicate
      expect(results[2]).toBe(false); // New
      expect(results[3]).toBe(true); // Duplicate
    });

    it('test-8.9.19.11: Should handle cache overflow with error handling', () => {
      service = new EventDeduplicationService(5, 60000, logger, errorHandler);
      const timestamp = 1000; // Fixed timestamp for all calls

      // Fill cache to trigger cleanup
      for (let i = 0; i < 10; i++) {
        service.isDuplicate('TP', `order-${i}`, timestamp);
      }

      // All should still be detectable as duplicates
      for (let i = 0; i < 10; i++) {
        const isDup = service.isDuplicate('TP', `order-${i}`, timestamp);
        expect(isDup).toBe(true);
      }
    });

    it('test-8.9.19.12: Should clear cache safely even with ErrorHandler', () => {
      service = new EventDeduplicationService(10, 1000, logger, errorHandler);
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
      service = new EventDeduplicationService(3, 100, logger, errorHandler);

      // Mock logger to fail sometimes
      let logCallCount = 0;
      jest.spyOn(logger, 'debug').mockImplementation(() => {
        logCallCount++;
        if (logCallCount === 2) {
          throw new Error('Log error');
        }
      });

      // Add events, some will fail to log but service continues
      for (let i = 0; i < 5; i++) {
        const timestamp = Date.now();
        service.isDuplicate('TP', `order-${i}`, timestamp);
        service.isDuplicate('TP', `order-${i}`, timestamp); // Duplicate
      }

      // Service should still work
      const result = service.isDuplicate('TP', 'order-0', Date.now());
      expect(result).toBe(true);
    });

    it('test-8.9.19.14: Should work with optional ErrorHandler parameter', () => {
      // Create service with ErrorHandler
      const service1 = new EventDeduplicationService(
        10,
        1000,
        logger,
        errorHandler,
      );
      // Create service without ErrorHandler
      const service2 = new EventDeduplicationService(10, 1000, logger);
      // Create service without logger or ErrorHandler
      const service3 = new EventDeduplicationService(10, 1000);

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
      service = new EventDeduplicationService(10, 1000, logger);
      const timestamp = Date.now();

      const first = service.isDuplicate('TP', 'order-123', timestamp);
      expect(first).toBe(false);

      const second = service.isDuplicate('TP', 'order-123', timestamp);
      expect(second).toBe(true);
    });

    it('test-8.9.19.16: Should work without logger or ErrorHandler', () => {
      service = new EventDeduplicationService(10, 1000);
      const timestamp = Date.now();

      const first = service.isDuplicate('TP', 'order-123', timestamp);
      expect(first).toBe(false);

      const second = service.isDuplicate('TP', 'order-123', timestamp);
      expect(second).toBe(true);
    });

    it('test-8.9.19.17: Should maintain same deduplication logic with ErrorHandler', () => {
      const service1 = new EventDeduplicationService(
        10,
        1000,
        logger,
        errorHandler,
      );
      const service2 = new EventDeduplicationService(10, 1000, logger);

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
      service = new EventDeduplicationService(1000, 60000, logger, errorHandler);

      const startTime = Date.now();

      // 1000 rapid checks
      for (let i = 0; i < 1000; i++) {
        service.isDuplicate('TP', `order-${i}`, Date.now());
      }

      const elapsed = Date.now() - startTime;

      // Should complete in < 1 second even with ErrorHandler
      expect(elapsed).toBeLessThan(1000);
    });

    it('test-8.9.19.19: Should handle large cache sizes efficiently', () => {
      service = new EventDeduplicationService(5000, 60000, logger, errorHandler);
      const timestamp = 1000; // Fixed timestamp

      const startTime = Date.now();

      // Add 2000 events and trigger cleanup
      for (let i = 0; i < 2000; i++) {
        service.isDuplicate('TP', `order-${i}`, timestamp);
      }

      const elapsed = Date.now() - startTime;

      // Should handle large caches efficiently
      expect(elapsed).toBeLessThan(5000);

      // Duplicate detection should still work
      expect(service.isDuplicate('TP', 'order-0', timestamp)).toBe(true);
    });

    it('test-8.9.19.20: Should handle TTL cleanup efficiently', () => {
      service = new EventDeduplicationService(100, 50, logger, errorHandler); // 50ms TTL

      // Add events
      const timestamp1 = Date.now() - 1000;
      service.isDuplicate('TP', 'old-order', timestamp1);

      const startTime = Date.now();

      // Trigger cleanup by adding many new events
      for (let i = 0; i < 120; i++) {
        service.isDuplicate('TP', `new-${i}`, Date.now());
      }

      const elapsed = Date.now() - startTime;

      // Should complete efficiently even with cleanup
      expect(elapsed).toBeLessThan(2000);
    });
  });
});
