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
  };
}

export function createWebSocketKeepAliveService(
  interval?: number,
  logger?: LoggerService,
): WebSocketKeepAliveService {
  return new WebSocketKeepAliveService(interval, logger);
}
