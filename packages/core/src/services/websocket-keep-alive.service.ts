/**
 * WebSocket Keep-Alive Service
 * Manages WebSocket ping/pong messaging to keep connection alive
 *
 * Responsibilities:
 * - Send periodic ping messages
 * - Stop ping when disconnected
 * - Handle WebSocket lifecycle
 */

import WebSocket from 'ws';
import { LoggerService } from './logger.service';

export const DEFAULT_WEBSOCKET_KEEP_ALIVE_INTERVAL_MS = 20000;
export const WEBSOCKET_KEEP_ALIVE_PING_MESSAGE = JSON.stringify({ op: 'ping' });

export interface WebSocketKeepAliveSocket {
  readyState: number;
  send(data: string): void;
}

export type WebSocketKeepAliveLogger = Pick<LoggerService, 'debug'>;

/**
 * WebSocket Keep-Alive Service
 * Sends periodic ping messages to keep WebSocket connection alive
 */
export class WebSocketKeepAliveService {
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly pingIntervalMs: number;

  constructor(
    pingIntervalMs: number = DEFAULT_WEBSOCKET_KEEP_ALIVE_INTERVAL_MS,
    private readonly logger?: WebSocketKeepAliveLogger,
  ) {
    this.pingIntervalMs = pingIntervalMs;
  }

  /**
   * Start sending periodic ping messages
   * @param ws - WebSocket instance to ping
   */
  public start(ws: WebSocketKeepAliveSocket): void {
    // Stop any existing ping interval first
    this.stop();

    this.pingInterval = setInterval(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
          this.stop();
        }
        return;
      }

      ws.send(WEBSOCKET_KEEP_ALIVE_PING_MESSAGE);
      this.logger?.debug('Ping sent');
    }, this.pingIntervalMs);
  }

  /**
   * Stop sending ping messages
   */
  public stop(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
