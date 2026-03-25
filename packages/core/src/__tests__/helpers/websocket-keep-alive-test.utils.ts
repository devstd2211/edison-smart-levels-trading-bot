import WebSocket from 'ws';
import { WebSocketKeepAliveService } from '../../services/websocket-keep-alive.service';
import { LoggerService, LogLevel } from '../../types/legacy';

export interface MockWebSocket extends Partial<WebSocket> {
  readyState: WebSocket['readyState'];
  send: jest.Mock;
}

export interface WebSocketKeepAliveHarness {
  logger: LoggerService;
  createWebSocket: (readyState?: WebSocket['readyState']) => MockWebSocket;
  createService: (interval?: number, logger?: LoggerService) => WebSocketKeepAliveService;
  createStandardService: (options?: {
    interval?: number;
    logger?: LoggerService;
  }) => WebSocketKeepAliveService;
  createStartedService: (options?: {
    interval?: number;
    logger?: LoggerService;
    websocket?: MockWebSocket;
  }) => { service: WebSocketKeepAliveService; websocket: MockWebSocket; interval: number };
  createStartedStandardService: (options?: {
    interval?: number;
    websocket?: MockWebSocket;
  }) => { service: WebSocketKeepAliveService; websocket: MockWebSocket; interval: number };
}

export interface ManagedWebSocketKeepAliveContext {
  harness: WebSocketKeepAliveHarness;
  logger: LoggerService;
  websocket: MockWebSocket;
  cleanup: (service?: WebSocketKeepAliveService) => void;
}

export function createWebSocketKeepAliveLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createMockKeepAliveWebSocket(
  readyState: WebSocket['readyState'] = WebSocket.OPEN,
): MockWebSocket {
  return {
    readyState,
    send: jest.fn(),
  };
}

export function createWebSocketKeepAliveHarness(): WebSocketKeepAliveHarness {
  const logger = createWebSocketKeepAliveLogger();

  return {
    logger,
    createWebSocket: (readyState?: WebSocket['readyState']) => createMockKeepAliveWebSocket(readyState),
    createService: (interval?: number, customLogger: LoggerService | undefined = logger) =>
      createWebSocketKeepAliveService(interval, customLogger),
    createStandardService: (options = {}) =>
      createWebSocketKeepAliveService(options.interval ?? 20000, options.logger ?? logger),
    createStartedService: (options = {}) => {
      const websocket = options.websocket ?? createMockKeepAliveWebSocket();
      const interval = options.interval ?? 20000;
      const service = createWebSocketKeepAliveService(interval, options.logger ?? logger);
      service.start(websocket as WebSocket);

      return { service, websocket, interval };
    },
    createStartedStandardService: (options = {}) => {
      const websocket = options.websocket ?? createMockKeepAliveWebSocket();
      const interval = options.interval ?? 20000;
      const service = createWebSocketKeepAliveService(interval, logger);
      service.start(websocket as WebSocket);

      return { service, websocket, interval };
    },
  };
}

export function createWebSocketKeepAliveService(
  interval?: number,
  logger?: LoggerService,
): WebSocketKeepAliveService {
  return new WebSocketKeepAliveService(interval, logger);
}

export function setMockWebSocketReadyState(
  websocket: MockWebSocket,
  readyState: WebSocket['readyState'],
): void {
  Object.defineProperty(websocket, 'readyState', {
    value: readyState,
    writable: true,
    configurable: true,
  });
}

export function startWebSocketKeepAlive(
  harness: WebSocketKeepAliveHarness,
  options: {
    interval?: number;
    logger?: LoggerService;
    websocket?: MockWebSocket;
  } = {},
): { service: WebSocketKeepAliveService; websocket: MockWebSocket; interval: number } {
  const websocket = options.websocket ?? harness.createWebSocket();
  const interval = options.interval ?? 20000;
  const service = harness.createService(interval, options.logger);
  service.start(websocket as WebSocket);

  return { service, websocket, interval };
}

export function advanceKeepAliveIntervals(interval: number, ticks: number = 1): void {
  jest.advanceTimersByTime(interval * ticks);
}

export function createManagedWebSocketKeepAliveContext(): ManagedWebSocketKeepAliveContext {
  jest.clearAllTimers();
  jest.useFakeTimers();

  const harness = createWebSocketKeepAliveHarness();

  return {
    harness,
    logger: harness.logger,
    websocket: harness.createWebSocket(),
    cleanup(service) {
      service?.stop();
      jest.restoreAllMocks();
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    },
  };
}
