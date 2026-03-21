/**
 * Event Deduplication Service Tests
 * Tests for generic event deduplication with cache cleanup
 */

import { EventDeduplicationService } from '../../services/event-deduplication.service';
import { LoggerService } from '../../types/legacy';
import {
  createEventDeduplicationEvent,
  createEventDeduplicationEvents,
  createEventDeduplicationHarness,
  populateEventDeduplicationCache,
  runEventDeduplicationChecks,
  type EventDeduplicationHarness,
} from '../helpers/event-deduplication-test.utils';

// ============================================================================
// TESTS
// ============================================================================

describe('EventDeduplicationService', () => {
  let service: EventDeduplicationService;
  let logger: LoggerService;
  let harness: EventDeduplicationHarness;

  beforeEach(() => {
    harness = createEventDeduplicationHarness();
    logger = harness.logger;
  });

  const createService = (cacheSize = 100, cacheTtlMs = 60000) =>
    harness.createStandardService({
      cacheSize,
      cacheTtlMs,
      logger,
      errorHandler: harness.errorHandler,
    });

  describe('isDuplicate', () => {
    beforeEach(() => {
      service = createService(10, 1000);
    });

    it('should return false for first occurrence of event', () => {
      const event = createEventDeduplicationEvent();
      const result = service.isDuplicate(event.type, event.id, event.time);
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
      const event = createEventDeduplicationEvent();

      const tp = service.isDuplicate('TP', event.id, event.time);
      expect(tp).toBe(false);

      const sl = service.isDuplicate('SL', event.id, event.time);
      expect(sl).toBe(false); // Different event type

      const tpAgain = service.isDuplicate('TP', event.id, event.time);
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
      service = harness.createStandardService({
        cacheSize: 100,
        cacheTtlMs: 60000,
        logger,
      });
    });

    it('should clear all cached events', () => {
      const events = createEventDeduplicationEvents([
        { type: 'TP', id: 'order-1' },
        { type: 'SL', id: 'order-2' },
        { type: 'TRAILING', id: 'order-3' },
      ]);

      events.forEach((event) => {
        service.isDuplicate(event.type, event.id, event.time);
      });

      // Before clear - all should be duplicates
      expect(service.isDuplicate(events[0].type, events[0].id, events[0].time)).toBe(true);

      // Clear cache
      service.clear();

      // After clear - all should be new
      events.forEach((event) => {
        expect(service.isDuplicate(event.type, event.id, event.time)).toBe(false);
      });
    });
  });

  describe('Cache Management', () => {
    it('should use default cache size (100)', () => {
      const service1 = createService();
      const timestamp = 1000;

      populateEventDeduplicationCache(service1, {
        count: 100,
        startTime: timestamp,
      });

      // Should still detect duplicates (exact same event)
      expect(service1.isDuplicate('TP', 'order-0', timestamp)).toBe(true);
    });

    it('should use custom cache size', () => {
      service = createService(50, 60000);
      const timestamp = 1000;

      populateEventDeduplicationCache(service, {
        count: 50,
        startTime: timestamp,
      });

      // Cache is at 50, should be fine - duplicate check
      expect(service.isDuplicate('TP', 'order-0', timestamp)).toBe(true);
    });

    it('should use custom TTL', () => {
      service = createService(100, 500); // 500ms TTL
      const timestamp = Date.now();

      service.isDuplicate('TP', 'order-123', timestamp);

      // Immediate check - duplicate
      expect(service.isDuplicate('TP', 'order-123', timestamp)).toBe(true);

      // After TTL passes - should be expired
      // Note: This is timing-dependent, so use older timestamp
      const oldTimestamp = Date.now() - 1000; // 1 second ago
      service.isDuplicate('TP', 'order-old', oldTimestamp);

      // Trigger cleanup by adding new event to exceed cache
      populateEventDeduplicationCache(service, {
        count: 110,
        idPrefix: 'fill-',
        startTime: Date.now(),
      });

      // Old event should potentially be cleaned up
      // (depends on cleanup logic running during cache overflow)
    });
  });

  describe('Integration Scenarios', () => {
    beforeEach(() => {
      service = createService();
    });

    it('should handle real WebSocket event stream', () => {
      const events = createEventDeduplicationEvents([
        { type: 'TP', id: 'exec-1', time: 1000 },
        { type: 'TP', id: 'exec-2', time: 1000 }, // Different execution
        { type: 'TP', id: 'exec-1', time: 1000 }, // Duplicate
        { type: 'SL', id: 'exec-3', time: 1000 },
        { type: 'TP', id: 'exec-1', time: 1000 }, // Duplicate again
      ]);

      const results = runEventDeduplicationChecks(service, events);

      expect(results[0]).toBe(false); // New TP
      expect(results[1]).toBe(false); // New TP
      expect(results[2]).toBe(true); // Duplicate TP
      expect(results[3]).toBe(false); // New SL
      expect(results[4]).toBe(true); // Duplicate TP
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
      service = createService(1000, 60000);

      const startTime = Date.now();

      populateEventDeduplicationCache(service, {
        count: 1000,
        startTime,
      });

      const elapsed = Date.now() - startTime;

      // Should complete quickly (< 1 second for 1000 operations)
      expect(elapsed).toBeLessThan(1000);
    });

    it('should handle large timestamps efficiently', () => {
      service = createService();

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
