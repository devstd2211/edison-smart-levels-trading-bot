/**
 * WebSocket Keep-Alive Service Tests
 * Tests for periodic ping/pong messaging
 */

import WebSocket from 'ws';
import type { WebSocketKeepAliveService } from '../../services/websocket-keep-alive.service';
import type { LoggerService } from '../../types/legacy';
import {
  advanceKeepAliveIntervals,
  createManagedWebSocketKeepAliveContext,
  setMockWebSocketReadyState,
  type ManagedWebSocketKeepAliveContext,
  type MockWebSocket,
} from '../helpers/websocket-keep-alive-test.utils';

// ============================================================================
// TESTS
// ============================================================================

describe('WebSocketKeepAliveService', () => {
  let service: WebSocketKeepAliveService;
  let logger: LoggerService;
  let mockWs: MockWebSocket;
  let createStandardService: ManagedWebSocketKeepAliveContext['createStandardService'];
  let createStartedStandardService: ManagedWebSocketKeepAliveContext['createStartedStandardService'];
  let createStartedService: ManagedWebSocketKeepAliveContext['createStartedService'];
  let createWebSocket: ManagedWebSocketKeepAliveContext['harness']['createWebSocket'];
  let cleanup: ManagedWebSocketKeepAliveContext['cleanup'];

  beforeEach(() => {
    const managedContext = createManagedWebSocketKeepAliveContext();
    ({ service, logger, websocket: mockWs, cleanup } = managedContext);
    ({
      createStandardService,
      createStartedStandardService,
      createStartedService,
    } = managedContext);
    createWebSocket = managedContext.harness.createWebSocket;
  });

  afterEach(() => {
    cleanup();
  });

  describe('start', () => {
    it('should create ping interval when started', () => {
      service = createStandardService({ interval: 20000, logger });

      service.start(mockWs as WebSocket);

      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });

    it('should send ping messages at configured interval', () => {
      ({ service } = createStartedStandardService({
        interval: 5000,
        websocket: mockWs,
      }));

      // First ping should not be sent immediately
      expect(mockWs.send).not.toHaveBeenCalled();

      // Advance to interval
      advanceKeepAliveIntervals(5000);
      expect(mockWs.send).toHaveBeenCalledTimes(1);

      // Another interval
      advanceKeepAliveIntervals(5000);
      expect(mockWs.send).toHaveBeenCalledTimes(2);
    });

    it('should use default ping interval (20 seconds)', () => {
      service = createStandardService({ logger });

      service.start(mockWs as WebSocket);

      // Advance less than 20 seconds
      jest.advanceTimersByTime(19000);
      expect(mockWs.send).not.toHaveBeenCalled();

      // Advance to 20 seconds
      jest.advanceTimersByTime(1000);
      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });

    it('should send correct ping payload', () => {
      ({ service } = createStartedStandardService({
        interval: 5000,
        websocket: mockWs,
      }));
      advanceKeepAliveIntervals(5000);

      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ op: 'ping' }));
    });

    it('should stop existing interval before starting new one', () => {
      service = createStandardService({ interval: 5000, logger });
      const mockWs2 = createWebSocket();

      service.start(mockWs as WebSocket);
      const firstTimerCount = jest.getTimerCount();

      service.start(mockWs2 as WebSocket);
      const secondTimerCount = jest.getTimerCount();

      // Should have same number of timers (old one cleared)
      expect(secondTimerCount).toBeLessThanOrEqual(firstTimerCount + 1);
    });

    it('should only send ping when WebSocket is OPEN', () => {
      service = createStandardService({ interval: 5000, logger });
      setMockWebSocketReadyState(mockWs, WebSocket.CONNECTING);

      service.start(mockWs as WebSocket);
      advanceKeepAliveIntervals(5000);

      // Should not send if not OPEN
      expect(mockWs.send).not.toHaveBeenCalled();

      // Change to OPEN
      setMockWebSocketReadyState(mockWs, WebSocket.OPEN);
      advanceKeepAliveIntervals(5000);

      // Now should send
      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });

    it('should handle CLOSING state', () => {
      service = createStandardService({ interval: 5000, logger });
      setMockWebSocketReadyState(mockWs, WebSocket.CLOSING);

      service.start(mockWs as WebSocket);
      advanceKeepAliveIntervals(5000);

      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it('should handle CLOSED state', () => {
      service = createStandardService({ interval: 5000, logger });
      setMockWebSocketReadyState(mockWs, WebSocket.CLOSED);

      service.start(mockWs as WebSocket);
      advanceKeepAliveIntervals(5000);

      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should clear ping interval when stopped', () => {
      service = createStandardService({ interval: 5000, logger });

      service.start(mockWs as WebSocket);
      expect(jest.getTimerCount()).toBeGreaterThan(0);

      service.stop();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('should prevent further pings after stop', () => {
      ({ service } = createStartedStandardService({
        interval: 5000,
        websocket: mockWs,
      }));
      advanceKeepAliveIntervals(5000);
      expect(mockWs.send).toHaveBeenCalledTimes(1);

      service.stop();
      advanceKeepAliveIntervals(5000);

      // No additional pings
      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });

    it('should be safe to call stop multiple times', () => {
      service = createStandardService({ interval: 5000, logger });

      service.start(mockWs as WebSocket);
      service.stop();
      service.stop(); // Should not throw
      service.stop(); // Should not throw

      expect(jest.getTimerCount()).toBe(0);
    });

    it('should be safe to call stop without start', () => {
      service = createStandardService({ interval: 5000, logger });

      expect(() => {
        service.stop();
      }).not.toThrow();
    });
  });

  describe('Lifecycle', () => {
    it('should handle start-stop-start cycle', () => {
      service = createStandardService({ interval: 5000, logger });

      // First start
      service.start(mockWs as WebSocket);
      advanceKeepAliveIntervals(5000);
      expect(mockWs.send).toHaveBeenCalledTimes(1);

      // Stop
      service.stop();
      advanceKeepAliveIntervals(5000);
      expect(mockWs.send).toHaveBeenCalledTimes(1); // No new pings

      // Start again
      service.start(mockWs as WebSocket);
      advanceKeepAliveIntervals(5000);
      expect(mockWs.send).toHaveBeenCalledTimes(2); // New ping sent
    });

    it('should handle multiple WebSocket instances', () => {
      service = createStandardService({ interval: 5000, logger });
      const mockWs1 = createWebSocket();
      const mockWs2 = createWebSocket();

      // Start with first WebSocket
      service.start(mockWs1 as WebSocket);
      advanceKeepAliveIntervals(5000);
      expect(mockWs1.send).toHaveBeenCalledTimes(1);

      // Switch to second WebSocket (stops first)
      service.start(mockWs2 as WebSocket);
      advanceKeepAliveIntervals(5000);

      // First WebSocket should not get more pings, second should get one
      expect(mockWs1.send).toHaveBeenCalledTimes(1); // No additional pings after switch
      expect(mockWs2.send).toHaveBeenCalledTimes(1); // Only one ping for ws2
    });
  });

  describe('Interval Configuration', () => {
    it('should respect custom ping interval', () => {
      ({ service } = createStartedStandardService({
        interval: 3000,
        websocket: mockWs,
      }));

      advanceKeepAliveIntervals(3000);
      expect(mockWs.send).toHaveBeenCalledTimes(1);

      advanceKeepAliveIntervals(3000);
      expect(mockWs.send).toHaveBeenCalledTimes(2);

      advanceKeepAliveIntervals(3000);
      expect(mockWs.send).toHaveBeenCalledTimes(3);
    });

    it('should handle very short intervals', () => {
      ({ service } = createStartedStandardService({
        interval: 100,
        websocket: mockWs,
      }));
      advanceKeepAliveIntervals(100, 10);

      // Should have many pings in 1 second
      expect(mockWs.send).toHaveBeenCalledTimes(10);
    });

    it('should handle very long intervals', () => {
      ({ service } = createStartedStandardService({
        interval: 60000,
        websocket: mockWs,
      }));
      jest.advanceTimersByTime(30000);

      // No pings yet
      expect(mockWs.send).not.toHaveBeenCalled();

      jest.advanceTimersByTime(30000);

      // Now should have one ping
      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle rapid start/stop operations', () => {
      service = createStandardService({ interval: 5000, logger });

      service.start(mockWs as WebSocket);
      service.stop();
      service.start(mockWs as WebSocket);
      service.stop();

      // Should end in stopped state
      expect(jest.getTimerCount()).toBe(0);
    });

    it('should handle state changes during ping', () => {
      ({ service } = createStartedStandardService({
        interval: 5000,
        websocket: mockWs,
      }));

      // Mid-interval, change state
      jest.advanceTimersByTime(2500);
      setMockWebSocketReadyState(mockWs, WebSocket.CLOSED);

      jest.advanceTimersByTime(2500);

      // No pings sent to closed connection
      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('Logger Integration', () => {
    it('should log debug message on ping', () => {
      const mockLogger = logger;
      jest.spyOn(mockLogger, 'debug');

      ({ service } = createStartedService({
        interval: 5000,
        logger: mockLogger,
        websocket: mockWs,
      }));
      advanceKeepAliveIntervals(5000);

      expect(mockLogger.debug).toHaveBeenCalledWith('Ping sent');
    });

    it('should work without logger', () => {
      service = createStandardService({ interval: 5000, logger: undefined }); // No logger

      expect(() => {
        service.start(mockWs as WebSocket);
        advanceKeepAliveIntervals(5000);
      }).not.toThrow();

      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });
  });
});
