import { TIME_UNITS } from '../../constants';
/**
 * PingPongHandler
 *
 * Handles WebSocket ping/pong to keep connection alive.
 * Separate component to avoid blocking main message processing.
 */

import WebSocket from 'ws';
import { LoggerService } from '../../types';
import { BybitWebSocketMessage } from '../../types/events.types';
import { TIMING_CONSTANTS } from '../../constants/technical.constants';

// ============================================================================
// CONSTANTS
// ============================================================================

const PING_INTERVAL_MS = TIMING_CONSTANTS.PING_INTERVAL_MS;

// ============================================================================
// HANDLER
// ============================================================================

export class PingPongHandler {
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPongTime: number = Date.now();

  constructor(private logger: LoggerService) {}

  /**
   * Start ping interval
   */
  start(ws: WebSocket): void {
    this.lastPongTime = Date.now();

    this.pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        // Bybit V5 requires JSON ping: {"op": "ping"}
        ws.send(JSON.stringify({ op: 'ping' }));
        this.logger.info('🏓 Sent ping to server');
      } else {
        this.logger.debug('Ping skipped - WebSocket not open', {
          readyState: ws?.readyState,
          wsExists: !!ws,
        });
      }
    }, PING_INTERVAL_MS);

    this.logger.info('Ping interval started', { intervalMs: PING_INTERVAL_MS });
  }

  /**
   * Stop ping interval
   */
  stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
      this.logger.info('Ping interval stopped');
    }
  }

  /**
   * Handle server-initiated ping (Bybit V5 format)
   * Server sends: {"op": "ping", "args": ["timestamp"]}
   * We must respond: {"op": "pong", "args": ["timestamp"]}
   */
  handleServerPing(ws: WebSocket, message: BybitWebSocketMessage): void {
    if (message.op === 'ping' && Array.isArray(message.args)) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ op: 'pong', args: message.args }));
        this.logger.info('↩️ Server ping received, sent pong', { args: message.args });
      }
    }
  }

  /**
   * Handle pong from server (response to our client-initiated ping)
   * Linear/Inverse: {"success": true, "ret_msg": "pong", "op": "ping"}
   * Private: {"op": "pong", "args": [...]}
   */
  handlePong(message: BybitWebSocketMessage): void {
    if (message.op === 'pong' || (message.op === 'ping' && message.ret_msg === 'pong')) {
      this.lastPongTime = Date.now();
      this.logger.info('✅ Pong received from server', { op: message.op });
    }
  }

  /**
   * Check if connection is alive (received pong recently)
   */
  isConnectionAlive(maxSilenceMs: number = TIME_UNITS.MINUTE): boolean {
    const silenceMs = Date.now() - this.lastPongTime;
    return silenceMs < maxSilenceMs;
  }

  /**
   * Get last pong time
   */
  getLastPongTime(): number {
    return this.lastPongTime;
  }
}
