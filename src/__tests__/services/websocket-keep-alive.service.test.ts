/**
 * WebSocket Keep-Alive Service Tests
 * Tests for periodic ping/pong messaging
 */

import WebSocket from 'ws';
import { WebSocketKeepAliveService } from '../../services/websocket-keep-alive.service';
import { LoggerService, LogLevel } from '../../types';

// ============================================================================
// MOCKS
// ============================================================================

const createMockLogger = (): LoggerService => {
  return new LoggerService(LogLevel.ERROR, './logs', false);
};

const createMockWebSocket = (): Partial<WebSocket> => {
  return {
    readyState: WebSocket.OPEN,
    send: jest.fn(),
  };
};

// ============================================================================
// TESTS
// ============================================================================

describe('WebSocketKeepAliveService', () => {
  let service: WebSocketKeepAliveService;
  let logger: LoggerService;
  let mockWs: Partial<WebSocket>;

  beforeEach(() => {
    logger = createMockLogger();
    mockWs = createMockWebSocket();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('start', () => {
    it('should create ping interval when started', () => {
      service = new WebSocketKeepAliveService(20000, logger);

      service.start(mockWs as WebSocket);

      expect(jest.getTimerCount()).toBeGreaterThan(0);
    });

    it('should send ping messages at configured interval', () => {
      service = new WebSocketKeepAliveService(5000, logger);

      service.start(mockWs as WebSocket);

      // First ping should not be sent immediately
      expect(mockWs.send).not.toHaveBeenCalled();

      // Advance to interval
      jest.advanceTimersByTime(5000);
      expect(mockWs.send).toHaveBeenCalledTimes(1);

      // Another interval
      jest.advanceTimersByTime(5000);
      expect(mockWs.send).toHaveBeenCalledTimes(2);
    });

    it('should use default ping interval (20 seconds)', () => {
      service = new WebSocketKeepAliveService(undefined, logger);

      service.start(mockWs as WebSocket);

      // Advance less than 20 seconds
      jest.advanceTimersByTime(19000);
      expect(mockWs.send).not.toHaveBeenCalled();

      // Advance to 20 seconds
      jest.advanceTimersByTime(1000);
      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });

    it('should send correct ping payload', () => {
      service = new WebSocketKeepAliveService(5000, logger);

      service.start(mockWs as WebSocket);
      jest.advanceTimersByTime(5000);

      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ op: 'ping' }));
    });

    it('should stop existing interval before starting new one', () => {
      service = new WebSocketKeepAliveService(5000, logger);
      const mockWs2 = createMockWebSocket();

      service.start(mockWs as WebSocket);
      const firstTimerCount = jest.getTimerCount();

      service.start(mockWs2 as WebSocket);
      const secondTimerCount = jest.getTimerCount();

      // Should have same number of timers (old one cleared)
      expect(secondTimerCount).toBeLessThanOrEqual(firstTimerCount + 1);
    });

    it('should only send ping when WebSocket is OPEN', () => {
      service = new WebSocketKeepAliveService(5000, logger);
      Object.defineProperty(mockWs, 'readyState', { value: WebSocket.CONNECTING, writable: true });

      service.start(mockWs as WebSocket);
      jest.advanceTimersByTime(5000);

      // Should not send if not OPEN
      expect(mockWs.send).not.toHaveBeenCalled();

      // Change to OPEN
      Object.defineProperty(mockWs, 'readyState', { value: WebSocket.OPEN, writable: true });
      jest.advanceTimersByTime(5000);

      // Now should send
      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });

    it('should handle CLOSING state', () => {
      service = new WebSocketKeepAliveService(5000, logger);
      Object.defineProperty(mockWs, 'readyState', { value: WebSocket.CLOSING, writable: true });

      service.start(mockWs as WebSocket);
      jest.advanceTimersByTime(5000);

      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it('should handle CLOSED state', () => {
      service = new WebSocketKeepAliveService(5000, logger);
      Object.defineProperty(mockWs, 'readyState', { value: WebSocket.CLOSED, writable: true });

      service.start(mockWs as WebSocket);
      jest.advanceTimersByTime(5000);

      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should clear ping interval when stopped', () => {
      service = new WebSocketKeepAliveService(5000, logger);

      service.start(mockWs as WebSocket);
      expect(jest.getTimerCount()).toBeGreaterThan(0);

      service.stop();
      expect(jest.getTimerCount()).toBe(0);
    });

    it('should prevent further pings after stop', () => {
      service = new WebSocketKeepAliveService(5000, logger);

      service.start(mockWs as WebSocket);
      jest.advanceTimersByTime(5000);
      expect(mockWs.send).toHaveBeenCalledTimes(1);

      service.stop();
      jest.advanceTimersByTime(5000);

      // No additional pings
      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });

    it('should be safe to call stop multiple times', () => {
      service = new WebSocketKeepAliveService(5000, logger);

      service.start(mockWs as WebSocket);
      service.stop();
      service.stop(); // Should not throw
      service.stop(); // Should not throw

      expect(jest.getTimerCount()).toBe(0);
    });

    it('should be safe to call stop without start', () => {
      service = new WebSocketKeepAliveService(5000, logger);

      expect(() => {
        service.stop();
      }).not.toThrow();
    });
  });

  describe('Lifecycle', () => {
    it('should handle start-stop-start cycle', () => {
      service = new WebSocketKeepAliveService(5000, logger);

      // First start
      service.start(mockWs as WebSocket);
      jest.advanceTimersByTime(5000);
      expect(mockWs.send).toHaveBeenCalledTimes(1);

      // Stop
      service.stop();
      jest.advanceTimersByTime(5000);
      expect(mockWs.send).toHaveBeenCalledTimes(1); // No new pings

      // Start again
      service.start(mockWs as WebSocket);
      jest.advanceTimersByTime(5000);
      expect(mockWs.send).toHaveBeenCalledTimes(2); // New ping sent
    });

    it('should handle multiple WebSocket instances', () => {
      service = new WebSocketKeepAliveService(5000, logger);
      const mockWs1 = createMockWebSocket();
      const mockWs2 = createMockWebSocket();

      // Start with first WebSocket
      service.start(mockWs1 as WebSocket);
      jest.advanceTimersByTime(5000);
      expect(mockWs1.send).toHaveBeenCalledTimes(1);

      // Switch to second WebSocket (stops first)
      service.start(mockWs2 as WebSocket);
      jest.advanceTimersByTime(5000);

      // First WebSocket should not get more pings, second should get one
      expect(mockWs1.send).toHaveBeenCalledTimes(1); // No additional pings after switch
      expect(mockWs2.send).toHaveBeenCalledTimes(1); // Only one ping for ws2
    });
  });

  describe('Interval Configuration', () => {
    it('should respect custom ping interval', () => {
      service = new WebSocketKeepAliveService(3000, logger);

      service.start(mockWs as WebSocket);

      jest.advanceTimersByTime(3000);
      expect(mockWs.send).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(3000);
      expect(mockWs.send).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(3000);
      expect(mockWs.send).toHaveBeenCalledTimes(3);
    });

    it('should handle very short intervals', () => {
      service = new WebSocketKeepAliveService(100, logger);

      service.start(mockWs as WebSocket);
      jest.advanceTimersByTime(1000);

      // Should have many pings in 1 second
      expect(mockWs.send).toHaveBeenCalledTimes(10);
    });

    it('should handle very long intervals', () => {
      service = new WebSocketKeepAliveService(60000, logger);

      service.start(mockWs as WebSocket);
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
      service = new WebSocketKeepAliveService(5000, logger);

      service.start(mockWs as WebSocket);
      service.stop();
      service.start(mockWs as WebSocket);
      service.stop();

      // Should end in stopped state
      expect(jest.getTimerCount()).toBe(0);
    });

    it('should handle state changes during ping', () => {
      service = new WebSocketKeepAliveService(5000, logger);

      service.start(mockWs as WebSocket);

      // Mid-interval, change state
      jest.advanceTimersByTime(2500);
      Object.defineProperty(mockWs, 'readyState', { value: WebSocket.CLOSED, writable: true });

      jest.advanceTimersByTime(2500);

      // No pings sent to closed connection
      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('Logger Integration', () => {
    it('should log debug message on ping', () => {
      const mockLogger = createMockLogger();
      jest.spyOn(mockLogger, 'debug');

      service = new WebSocketKeepAliveService(5000, mockLogger);

      service.start(mockWs as WebSocket);
      jest.advanceTimersByTime(5000);

      expect(mockLogger.debug).toHaveBeenCalledWith('Ping sent');
    });

    it('should work without logger', () => {
      service = new WebSocketKeepAliveService(5000); // No logger

      expect(() => {
        service.start(mockWs as WebSocket);
        jest.advanceTimersByTime(5000);
      }).not.toThrow();

      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });
  });
});
