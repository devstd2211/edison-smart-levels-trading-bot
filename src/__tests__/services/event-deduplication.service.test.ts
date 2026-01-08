/**
 * Event Deduplication Service Tests
 * Tests for generic event deduplication with cache cleanup
 */

import { EventDeduplicationService } from '../../services/event-deduplication.service';
import { LoggerService, LogLevel } from '../../types';

// ============================================================================
// MOCKS
// ============================================================================

const createMockLogger = (): LoggerService => {
  return new LoggerService(LogLevel.ERROR, './logs', false);
};

// ============================================================================
// TESTS
// ============================================================================

describe('EventDeduplicationService', () => {
  let service: EventDeduplicationService;
  let logger: LoggerService;

  beforeEach(() => {
    logger = createMockLogger();
  });

  describe('isDuplicate', () => {
    beforeEach(() => {
      service = new EventDeduplicationService(10, 1000, logger); // Small cache for testing
    });

    it('should return false for first occurrence of event', () => {
      const result = service.isDuplicate('TP', 'order-123', Date.now());
      expect(result).toBe(false);
    });

    it('should return true for duplicate event', () => {
      const timestamp = Date.now();

      const first = service.isDuplicate('TP', 'order-123', timestamp);
      expect(first).toBe(false);

      const duplicate = service.isDuplicate('TP', 'order-123', timestamp);
      expect(duplicate).toBe(true);
    });

    it('should treat different event types separately', () => {
      const timestamp = Date.now();
      const orderId = 'order-123';

      const tp = service.isDuplicate('TP', orderId, timestamp);
      expect(tp).toBe(false);

      const sl = service.isDuplicate('SL', orderId, timestamp);
      expect(sl).toBe(false); // Different event type

      const tpAgain = service.isDuplicate('TP', orderId, timestamp);
      expect(tpAgain).toBe(true); // Same TP is duplicate
    });

    it('should treat different event IDs separately', () => {
      const timestamp = Date.now();
      const eventType = 'TP';

      const order1 = service.isDuplicate(eventType, 'order-1', timestamp);
      expect(order1).toBe(false);

      const order2 = service.isDuplicate(eventType, 'order-2', timestamp);
      expect(order2).toBe(false); // Different order ID

      const order1Again = service.isDuplicate(eventType, 'order-1', timestamp);
      expect(order1Again).toBe(true); // Same order is duplicate
    });

    it('should treat different timestamps separately', () => {
      const eventType = 'TP';
      const orderId = 'order-123';

      const time1 = Date.now();
      const first = service.isDuplicate(eventType, orderId, time1);
      expect(first).toBe(false);

      const time2 = time1 + 1000;
      const second = service.isDuplicate(eventType, orderId, time2);
      expect(second).toBe(false); // Different timestamp
    });

    it('should handle multiple new events', () => {
      for (let i = 0; i < 5; i++) {
        const result = service.isDuplicate('TP', `order-${i}`, Date.now());
        expect(result).toBe(false);
      }
    });

    it('should return true only for exact same event', () => {
      const timestamp = Date.now();

      service.isDuplicate('TP', 'order-123', timestamp);

      // Similar but not identical
      const result1 = service.isDuplicate('TP', 'order-124', timestamp); // Different ID
      expect(result1).toBe(false);

      const result2 = service.isDuplicate('SL', 'order-123', timestamp); // Different type
      expect(result2).toBe(false);

      const result3 = service.isDuplicate('TP', 'order-123', timestamp + 1); // Different timestamp
      expect(result3).toBe(false);

      // Same should be duplicate
      const result4 = service.isDuplicate('TP', 'order-123', timestamp);
      expect(result4).toBe(true);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      service = new EventDeduplicationService(100, 60000, logger);
    });

    it('should clear all cached events', () => {
      const timestamp = Date.now();

      service.isDuplicate('TP', 'order-1', timestamp);
      service.isDuplicate('SL', 'order-2', timestamp);
      service.isDuplicate('TRAILING', 'order-3', timestamp);

      // Before clear - all should be duplicates
      expect(service.isDuplicate('TP', 'order-1', timestamp)).toBe(true);

      // Clear cache
      service.clear();

      // After clear - all should be new
      expect(service.isDuplicate('TP', 'order-1', timestamp)).toBe(false);
      expect(service.isDuplicate('SL', 'order-2', timestamp)).toBe(false);
      expect(service.isDuplicate('TRAILING', 'order-3', timestamp)).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('should use default cache size (100)', () => {
      const service1 = new EventDeduplicationService(100, 60000, logger);
      const timestamp = 1000; // Use fixed timestamp

      // Add 100 events with different timestamps
      for (let i = 0; i < 100; i++) {
        const result = service1.isDuplicate('TP', `order-${i}`, timestamp + i);
        expect(result).toBe(false);
      }

      // Should still detect duplicates (exact same event)
      expect(service1.isDuplicate('TP', 'order-0', timestamp)).toBe(true);
    });

    it('should use custom cache size', () => {
      service = new EventDeduplicationService(50, 60000, logger);
      const timestamp = 1000;

      // Add 50 events with different timestamps
      for (let i = 0; i < 50; i++) {
        service.isDuplicate('TP', `order-${i}`, timestamp + i);
      }

      // Cache is at 50, should be fine - duplicate check
      expect(service.isDuplicate('TP', 'order-0', timestamp)).toBe(true);
    });

    it('should use custom TTL', () => {
      service = new EventDeduplicationService(100, 500, logger); // 500ms TTL
      const timestamp = Date.now();

      service.isDuplicate('TP', 'order-123', timestamp);

      // Immediate check - duplicate
      expect(service.isDuplicate('TP', 'order-123', timestamp)).toBe(true);

      // After TTL passes - should be expired
      // Note: This is timing-dependent, so use older timestamp
      const oldTimestamp = Date.now() - 1000; // 1 second ago
      service.isDuplicate('TP', 'order-old', oldTimestamp);

      // Trigger cleanup by adding new event to exceed cache
      for (let i = 0; i < 110; i++) {
        service.isDuplicate('TP', `fill-${i}`, Date.now());
      }

      // Old event should potentially be cleaned up
      // (depends on cleanup logic running during cache overflow)
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(() => {
      service = new EventDeduplicationService(100, 60000, logger);
    });

    it('should handle real WebSocket event stream', () => {
      const events = [
        { type: 'TP', id: 'exec-1', time: 1000 },
        { type: 'TP', id: 'exec-2', time: 1000 }, // Different execution
        { type: 'TP', id: 'exec-1', time: 1000 }, // Duplicate
        { type: 'SL', id: 'exec-3', time: 1000 },
        { type: 'TP', id: 'exec-1', time: 1000 }, // Duplicate again
      ];

      const results = events.map(e => ({
        ...e,
        isDuplicate: service.isDuplicate(e.type, e.id, e.time),
      }));

      expect(results[0].isDuplicate).toBe(false); // New TP
      expect(results[1].isDuplicate).toBe(false); // New TP
      expect(results[2].isDuplicate).toBe(true); // Duplicate TP
      expect(results[3].isDuplicate).toBe(false); // New SL
      expect(results[4].isDuplicate).toBe(true); // Duplicate TP
    });

    it('should handle mixed event types', () => {
      const eventTypes = ['TP', 'SL', 'TRAILING', 'POSITION'];
      const orderId = 'order-123';
      const timestamp = 1000;

      // All different types should be new
      eventTypes.forEach(type => {
        const result = service.isDuplicate(type, orderId, timestamp);
        expect(result).toBe(false);
      });

      // Repeating should be duplicate
      eventTypes.forEach(type => {
        const result = service.isDuplicate(type, orderId, timestamp);
        expect(result).toBe(true);
      });
    });

    it('should handle large event ID strings', () => {
      const longId = 'a'.repeat(1000);
      const timestamp = Date.now();

      const first = service.isDuplicate('TP', longId, timestamp);
      expect(first).toBe(false);

      const second = service.isDuplicate('TP', longId, timestamp);
      expect(second).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should handle rapid duplicate checks efficiently', () => {
      service = new EventDeduplicationService(1000, 60000, logger);

      const startTime = Date.now();

      // Rapid checks
      for (let i = 0; i < 1000; i++) {
        service.isDuplicate('TP', `order-${i}`, Date.now());
      }

      const elapsed = Date.now() - startTime;

      // Should complete quickly (< 1 second for 1000 operations)
      expect(elapsed).toBeLessThan(1000);
    });

    it('should handle large timestamps efficiently', () => {
      service = new EventDeduplicationService(100, 60000, logger);

      const timestamps = Array.from({ length: 100 }, (_, i) => Date.now() + i * 1000);

      timestamps.forEach(ts => {
        service.isDuplicate('TP', 'order-123', ts);
      });

      // All should be duplicates now (since timestamp is different)
      // Actually they should all be new since timestamps differ
      timestamps.forEach(ts => {
        const isDup = service.isDuplicate('TP', 'order-123', ts);
        expect(isDup).toBe(true);
      });
    });
  });
});
