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
import { LoggerService } from '../types';

/**
 * WebSocket Keep-Alive Service
 * Sends periodic ping messages to keep WebSocket connection alive
 */
export class WebSocketKeepAliveService {
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly pingIntervalMs: number;

  constructor(
    pingIntervalMs: number = 20000, // Default 20 seconds
    private readonly logger?: LoggerService,
  ) {
    this.pingIntervalMs = pingIntervalMs;
  }

  /**
   * Start sending periodic ping messages
   * @param ws - WebSocket instance to ping
   */
  public start(ws: WebSocket): void {
    // Stop any existing ping interval first
    this.stop();

    this.pingInterval = setInterval(() => {
      // Only send ping if connection is open
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ op: 'ping' }));
        this.logger?.debug('Ping sent');
      }
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
