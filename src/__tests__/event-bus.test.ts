/**
 * BotEventBus Tests
 *
 * Tests the centralized event bus with:
 * - Event subscription and publishing
 * - Error handling and recovery
 * - Performance metrics tracking
 * - Listener management
 */

import { BotEventBus, BotEvent } from '../services/event-bus';
import { LoggerService } from '../types';

// Create a mock logger with required methods
const createMockLogger = (): Partial<LoggerService> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  getLogFilePath: jest.fn().mockReturnValue('/mock/log/path'),
});

describe('BotEventBus', () => {
  let eventBus: BotEventBus;
  let mockLogger: Partial<LoggerService>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    eventBus = new BotEventBus(mockLogger as LoggerService);
  });

  afterEach(() => {
    eventBus.clear();
  });

  describe('subscribe', () => {
    it('should subscribe to events and execute handler', async () => {
      const handler = jest.fn();

      eventBus.subscribe('testEvent', handler);
      eventBus.publishSync({
        type: 'testEvent',
        timestamp: Date.now(),
        data: { value: 'test' },
      });

      // Give async handler time to execute
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledWith({ value: 'test' });
    });

    it('should return unsubscribe function', async () => {
      const handler = jest.fn();

      const unsubscribe = eventBus.subscribe('testEvent', handler);
      unsubscribe();

      eventBus.publishSync({
        type: 'testEvent',
        timestamp: Date.now(),
        data: { value: 'test' },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle async event handlers', async () => {
      const handler = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      eventBus.subscribe('asyncEvent', handler);
      await eventBus.publish({
        type: 'asyncEvent',
        timestamp: Date.now(),
        data: { value: 'async' },
      });

      expect(handler).toHaveBeenCalledWith({ value: 'async' });
    });

    it('should handle sync event handlers', () => {
      const handler = jest.fn();

      eventBus.subscribe('syncEvent', handler);
      eventBus.publishSync({
        type: 'syncEvent',
        timestamp: Date.now(),
        data: { value: 'sync' },
      });

      expect(handler).toHaveBeenCalledWith({ value: 'sync' });
    });

    it('should record metrics for successful handler execution', async () => {
      const handler = jest.fn();
      eventBus.subscribe('metricsEvent', handler);

      eventBus.publishSync({
        type: 'metricsEvent',
        timestamp: Date.now(),
        data: { value: 'test' },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const metrics = eventBus.getMetrics();
      expect(metrics.metricsEvent).toBeDefined();
      expect(metrics.metricsEvent.successes).toBe(1);
      expect(metrics.metricsEvent.failures).toBe(0);
      expect(metrics.metricsEvent.total).toBe(1);
    });

    it('should record metrics for failed handler execution', async () => {
      const error = new Error('Test error');
      const handler = jest.fn(() => {
        throw error;
      });

      eventBus.subscribe('errorEvent', handler);

      eventBus.publishSync({
        type: 'errorEvent',
        timestamp: Date.now(),
        data: { value: 'test' },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const metrics = eventBus.getMetrics();
      expect(metrics.errorEvent).toBeDefined();
      expect(metrics.errorEvent.successes).toBe(0);
      expect(metrics.errorEvent.failures).toBe(1);
      expect(metrics.errorEvent.errorRate).toBe('100.00%');
    });

    it('should handle handler errors gracefully', async () => {
      const error = new Error('Handler failed');
      const handler = jest.fn(() => {
        throw error;
      });

      eventBus.subscribe('failEvent', handler);

      eventBus.publishSync({
        type: 'failEvent',
        timestamp: Date.now(),
        data: { value: 'test' },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should publish error event on handler failure', async () => {
      const errorHandler = jest.fn();
      const failingHandler = jest.fn(() => {
        throw new Error('Fail');
      });

      eventBus.subscribe('eventBusError', errorHandler); // Subscribe to actual error event type
      eventBus.subscribe('failingEvent', failingHandler);

      eventBus.publishSync({
        type: 'failingEvent',
        timestamp: Date.now(),
        data: { value: 'test' },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Error handler should be called with eventBusError
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should allow multiple subscribers to same event', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.subscribe('multiEvent', handler1);
      eventBus.subscribe('multiEvent', handler2);

      eventBus.publishSync({
        type: 'multiEvent',
        timestamp: Date.now(),
        data: { value: 'test' },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler1).toHaveBeenCalledWith({ value: 'test' });
      expect(handler2).toHaveBeenCalledWith({ value: 'test' });
    });
  });

  describe('publish', () => {
    it('should publish events asynchronously', async () => {
      const handler = jest.fn();
      eventBus.subscribe('asyncPub', handler);

      const event: BotEvent = {
        type: 'asyncPub',
        timestamp: Date.now(),
        data: { value: 'async' },
      };

      await eventBus.publish(event);

      expect(handler).toHaveBeenCalledWith({ value: 'async' });
    });

    it('should log published events', async () => {
      const event: BotEvent = {
        type: 'logEvent',
        timestamp: Date.now(),
        data: { value: 'test' },
      };

      await eventBus.publish(event);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Publishing event'),
        expect.any(Object)
      );
    });
  });

  describe('publishSync', () => {
    it('should publish events synchronously', () => {
      const handler = jest.fn();
      eventBus.subscribe('syncPub', handler);

      const event: BotEvent = {
        type: 'syncPub',
        timestamp: Date.now(),
        data: { value: 'sync' },
      };

      eventBus.publishSync(event);

      expect(handler).toHaveBeenCalledWith({ value: 'sync' });
    });

    it('should log published events', () => {
      const event: BotEvent = {
        type: 'syncLogEvent',
        timestamp: Date.now(),
        data: { value: 'test' },
      };

      eventBus.publishSync(event);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Publishing event'),
        expect.any(Object)
      );
    });
  });

  describe('getMetrics', () => {
    it('should track event metrics', async () => {
      const handler = jest.fn();
      eventBus.subscribe('metricTest', handler);

      for (let i = 0; i < 3; i++) {
        eventBus.publishSync({
          type: 'metricTest',
          timestamp: Date.now(),
          data: { id: i },
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      const metrics = eventBus.getMetrics();
      expect(metrics.metricTest.total).toBe(3);
      expect(metrics.metricTest.successes).toBe(3);
      expect(metrics.metricTest.failures).toBe(0);
    });

    it('should calculate average duration', async () => {
      const handler = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 15));
      });

      eventBus.subscribe('durationTest', handler);

      for (let i = 0; i < 3; i++) {
        await eventBus.publish({
          type: 'durationTest',
          timestamp: Date.now(),
          data: { id: i },
        });
      }

      // Wait for all async handlers to complete and metrics to be recorded
      await new Promise((resolve) => setTimeout(resolve, 100));

      const metrics = eventBus.getMetrics();
      expect(metrics.durationTest).toBeDefined();
      expect(metrics.durationTest.total).toBe(3);

      const avgDuration = parseFloat(metrics.durationTest.avgDuration);
      expect(avgDuration).toBeGreaterThan(10); // At least 10ms per handler (15ms sleep)
    });

    it('should track error rates', async () => {
      const errorHandler = jest.fn(() => {
        throw new Error('Test error');
      });
      const successHandler = jest.fn();

      eventBus.subscribe('mixedEvent', errorHandler);
      eventBus.subscribe('mixedEvent', successHandler);

      eventBus.publishSync({
        type: 'mixedEvent',
        timestamp: Date.now(),
        data: {},
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const metrics = eventBus.getMetrics();
      expect(metrics.mixedEvent.failures).toBeGreaterThan(0);
    });

    it('should limit metrics history to prevent memory leak', async () => {
      const handler = jest.fn();
      eventBus.subscribe('memoryTest', handler);

      // Publish more than MAX_METRICS_PER_EVENT events
      for (let i = 0; i < 150; i++) {
        eventBus.publishSync({
          type: 'memoryTest',
          timestamp: Date.now(),
          data: { id: i },
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      const metrics = eventBus.getMetrics();
      // Should keep only last 100 metrics
      expect(metrics.memoryTest.total).toBeLessThanOrEqual(100);
    });
  });

  describe('getListenerCount', () => {
    it('should return correct listener count', () => {
      expect(eventBus.getListenerCount('testEvent')).toBe(0);

      eventBus.subscribe('testEvent', jest.fn());
      expect(eventBus.getListenerCount('testEvent')).toBe(1);

      eventBus.subscribe('testEvent', jest.fn());
      expect(eventBus.getListenerCount('testEvent')).toBe(2);
    });
  });

  describe('clear', () => {
    it('should remove all listeners', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      eventBus.subscribe('event1', handler1);
      eventBus.subscribe('event2', handler2);

      expect(eventBus.getListenerCount('event1')).toBe(1);
      expect(eventBus.getListenerCount('event2')).toBe(1);

      eventBus.clear();

      expect(eventBus.getListenerCount('event1')).toBe(0);
      expect(eventBus.getListenerCount('event2')).toBe(0);

      eventBus.publishSync({
        type: 'event1',
        timestamp: Date.now(),
        data: {},
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(handler1).not.toHaveBeenCalled();
    });

    it('should clear metrics', () => {
      const handler = jest.fn();
      eventBus.subscribe('clearTest', handler);

      eventBus.publishSync({
        type: 'clearTest',
        timestamp: Date.now(),
        data: {},
      });

      let metrics = eventBus.getMetrics();
      expect(Object.keys(metrics).length).toBeGreaterThan(0);

      eventBus.clear();
      metrics = eventBus.getMetrics();
      expect(Object.keys(metrics).length).toBe(0);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle position update event flow', async () => {
      const positionUpdate = jest.fn();
      const orderFilled = jest.fn();

      eventBus.subscribe('positionUpdate', positionUpdate);
      eventBus.subscribe('orderFilled', orderFilled);

      eventBus.publishSync({
        type: 'positionUpdate',
        timestamp: Date.now(),
        data: { quantity: 100, price: 1.5 },
      });

      eventBus.publishSync({
        type: 'orderFilled',
        timestamp: Date.now(),
        data: { orderId: '123', fills: [{ price: 1.5, quantity: 100 }] },
      });

      expect(positionUpdate).toHaveBeenCalledWith({ quantity: 100, price: 1.5 });
      expect(orderFilled).toHaveBeenCalledWith({
        orderId: '123',
        fills: [{ price: 1.5, quantity: 100 }],
      });
    });

    it('should handle cascading events', async () => {
      const handler1 = jest.fn(() => {
        eventBus.publishSync({
          type: 'cascadeEvent2',
          timestamp: Date.now(),
          data: { stage: 2 },
        });
      });
      const handler2 = jest.fn();

      eventBus.subscribe('cascadeEvent1', handler1);
      eventBus.subscribe('cascadeEvent2', handler2);

      eventBus.publishSync({
        type: 'cascadeEvent1',
        timestamp: Date.now(),
        data: { stage: 1 },
      });

      expect(handler1).toHaveBeenCalledWith({ stage: 1 });
      expect(handler2).toHaveBeenCalledWith({ stage: 2 });
    });
  });
});
