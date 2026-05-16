/**
 * WebSocket Server
 *
 * Handles real-time communication with frontend clients.
 * Broadcasts bot events and market data updates.
 */

import { WebSocketServer, WebSocket, RawData } from 'ws';
import { BotBridgeService } from '../services/bot-bridge.service.js';
import { FileWatcherService } from '../services/file-watcher.service.js';
import type {
  ErrorPayload,
  WebSocketMessage,
  WebSocketRequestMessage,
  WebSocketRequestType,
} from '../types/api.types.js';
import type { WebApiJournalEntry, WebApiSessionStats } from '@edison/contracts/web-api';

type FileWatcherEventMap = {
  'journal:updated': WebApiJournalEntry[];
  'session:updated': WebApiSessionStats[];
};

type FileWatcherEventName = keyof FileWatcherEventMap;
type FileWatcherListener<K extends FileWatcherEventName> = (payload: FileWatcherEventMap[K]) => void;
type ParsedIncomingMessage = {
  type: string;
  requestId?: string;
};

export class WebSocketService {
  private wss!: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private currentPort: number;
  private bridgeEventListener: ((event: WebSocketMessage) => void) | null = null;
  private fileWatcherListeners = new Map<FileWatcherEventName, (...args: unknown[]) => void>();

  constructor(port: number, private bridge: BotBridgeService, private fileWatcher?: FileWatcherService) {
    this.currentPort = port;

    // Try to create WebSocket server with fallback ports
    let wsCreated = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!wsCreated && attempts < maxAttempts) {
      try {
        this.wss = new WebSocketServer({ port: this.currentPort });
        wsCreated = true;
        console.log(`[WS] Server initialized on port ${this.currentPort}`);
      } catch (error: unknown) {
        const errorCode = this.getErrorCode(error);
        if (errorCode === 'EADDRINUSE' && attempts < maxAttempts - 1) {
          this.currentPort += 100;
          attempts++;
          console.log(`[WS] Port already in use, trying port ${this.currentPort}...`);
        } else {
          throw error;
        }
      }
    }

    this.setupErrorHandling();
    this.setupConnectionHandling();
    this.setupEventForwarding();
    this.startHeartbeat();
  }

  /**
   * Setup error handling for WebSocket server
   */
  private setupErrorHandling() {
    this.wss.on('error', (error: unknown) => {
      const errorCode = this.getErrorCode(error);
      if (errorCode === 'EADDRINUSE') {
        console.error(`[WS] Port ${this.currentPort} is already in use`);
        // Try to recover by listening on alternate port
        const alternatePort = this.currentPort + 100;
        console.log(`[WS] Attempting to listen on alternate port ${alternatePort}...`);

        // Close existing server
        this.wss.close();

        // Create new server on alternate port
        this.wss = new WebSocketServer({ port: alternatePort });
        this.currentPort = alternatePort;
        console.log(`[WS] Successfully listening on alternate port ${alternatePort}`);

        // Reattach handlers
        this.setupErrorHandling();
        this.setupConnectionHandling();
      } else {
        console.error(`[WS] Server error:`, this.getErrorMessage(error));
      }
    });
  }

  /**
   * Setup new client connections
   */
  private setupConnectionHandling() {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log(`[WS] New client connected. Total: ${this.clients.size + 1}`);
      this.clients.add(ws);

      // Send initial bot status
      this.bridge.getStatus().then((status) => {
        console.log('[WS] Sending initial BOT_STATUS_CHANGE to client', { isRunning: status.isRunning });
        this.send(ws, {
          type: 'BOT_STATUS_CHANGE',
          payload: status,
          timestamp: Date.now(),
        });
      }).catch((error) => {
        console.error('[WS] Error getting bot status for new client:', error instanceof Error ? error.message : error);
        this.sendError(ws, 'Failed to get bot status', 'STATUS_READ_FAILED', this.getErrorMessage(error));
      });

      ws.on('message', (message: RawData) => {
        this.handleMessage(ws, message);
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[WS] Client disconnected. Total: ${this.clients.size}`);
      });

      ws.on('error', (error) => {
        console.error('[WS] Client error:', error.message);
      });
    });
  }

  /**
   * Forward bot events to WebSocket clients
   */
  private setupEventForwarding() {
    // Forward bot bridge events
    this.bridgeEventListener = (event: WebSocketMessage) => {
      this.broadcast(event);
    };
    this.bridge.on('bot-event', this.bridgeEventListener);

    // Forward file watcher events (journal and session updates)
    if (this.fileWatcher) {
      const journalListener: FileWatcherListener<'journal:updated'> = (journal) => {
        this.broadcast({
          type: 'JOURNAL_UPDATE',
          payload: { journal },
          timestamp: Date.now(),
        });
      };

      const sessionListener: FileWatcherListener<'session:updated'> = (sessions) => {
        this.broadcast({
          type: 'SESSION_UPDATE',
          payload: { sessions },
          timestamp: Date.now(),
        });
      };

      this.fileWatcherListeners.set('journal:updated', journalListener as (...args: unknown[]) => void);
      this.fileWatcherListeners.set('session:updated', sessionListener as (...args: unknown[]) => void);

      this.fileWatcher.on('journal:updated', journalListener);
      this.fileWatcher.on('session:updated', sessionListener);
    }
  }

  /**
   * Handle incoming messages from clients
   */
  private handleMessage(ws: WebSocket, message: RawData) {
    try {
      const data = this.parseIncomingMessage(ws, this.toMessageText(message));
      if (!data) {
        return;
      }

      const messageType = data.type.toUpperCase();
      const requestId = data.requestId; // Optional request ID for tracking
      console.log(`[WS] Received: ${messageType}${requestId ? ` (ID: ${requestId})` : ''}`);

      // Handle message types
      switch (messageType) {
        case 'PING':
          this.send(ws, {
            type: 'PONG',
            payload: {},
            requestId,
            timestamp: Date.now(),
          });
          break;

        case 'GET_STATUS':
          this.bridge.getStatus().then((status) => {
            this.send(ws, {
              type: 'BOT_STATUS_CHANGE',
              payload: status,
              requestId,
              timestamp: Date.now(),
            });
          }).catch((error) => {
            console.error('[WS] Error getting bot status:', error);
            this.sendError(ws, 'Failed to get bot status', 'STATUS_READ_FAILED', this.getErrorMessage(error), requestId);
          });
          break;

        case 'GET_POSITION':
          try {
            const position = this.bridge.getPosition();
            this.send(ws, {
              type: 'POSITION_UPDATE',
              payload: { position },
              requestId,
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error('[WS] Error getting position:', error);
            this.sendError(ws, 'Failed to get position', 'POSITION_READ_FAILED', this.getErrorMessage(error), requestId);
          }
          break;

        default:
          console.warn(`[WS] Unknown message type: ${messageType}`);
          this.sendError(
            ws,
            'Unknown message type',
            'UNKNOWN_MESSAGE_TYPE',
            `Type "${messageType}" is not recognized`,
            requestId,
            messageType,
          );
      }
    } catch (error) {
      console.error('[WS] Unexpected error handling message:', error);
      this.sendError(ws, 'Internal server error', 'INTERNAL_SERVER_ERROR', this.getErrorMessage(error));
    }
  }

  private parseIncomingMessage(ws: WebSocket, message: string): ParsedIncomingMessage | null {
    let data: unknown;
    try {
      data = JSON.parse(message);
    } catch (parseError) {
      console.error('[WS] JSON parse error:', (parseError as Error).message);
      this.sendError(ws, 'Invalid JSON format', 'INVALID_JSON', 'Message must be valid JSON');
      return null;
    }

    if (!this.isRecord(data) || typeof data.type !== 'string') {
      console.error('[WS] Invalid message: missing or invalid "type" field');
      this.sendError(
        ws,
        'Invalid message structure',
        'INVALID_MESSAGE',
        'Message must have "type" (string) field',
      );
      return null;
    }

    return {
      type: data.type,
      requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
    };
  }

  private sendError(
    ws: WebSocket,
    error: string,
    code: ErrorPayload['code'],
    details?: string,
    requestId?: string,
    requestType?: WebSocketRequestType | string,
  ) {
    const payload: ErrorPayload = {
      error,
      ...(code ? { code } : {}),
      ...(details ? { details } : {}),
      ...(requestType ? { requestType } : {}),
    };

    this.send(ws, {
      type: 'ERROR',
      payload,
      ...(requestId ? { requestId } : {}),
      timestamp: Date.now(),
    });
  }

  /**
   * Send message to single client
   */
  private send(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private toMessageText(message: RawData): string {
    if (typeof message === 'string') {
      return message;
    }

    if (message instanceof ArrayBuffer) {
      return Buffer.from(message).toString('utf-8');
    }

    if (Array.isArray(message)) {
      return Buffer.concat(message).toString('utf-8');
    }

    return message.toString('utf-8');
  }

  private getErrorCode(error: unknown): string | undefined {
    if (!this.isRecord(error)) {
      return undefined;
    }
    const code = error.code;
    return typeof code === 'string' ? code : undefined;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (this.isRecord(error)) {
      const message = error.message;
      if (typeof message === 'string') {
        return message;
      }
    }
    return 'Unknown error';
  }

  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: WebSocketMessage) {
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  /**
   * Send heartbeat to keep connections alive
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping(() => {});
        }
      });
    }, 30000); // 30 seconds
  }

  /**
   * Get current WebSocket port
   */
  getPort(): number {
    return this.currentPort;
  }

  /**
   * Close WebSocket server
   */
  close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.bridgeEventListener) {
      this.bridge.off('bot-event', this.bridgeEventListener);
    }
    // Cleanup file watcher listeners
    if (this.fileWatcher) {
      for (const [eventName, listener] of this.fileWatcherListeners.entries()) {
        this.fileWatcher.off(eventName, listener);
      }
      this.fileWatcherListeners.clear();
    }
    this.clients.forEach((client) => client.close());
    this.wss.close();
    console.log('[WS] Server closed');
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}
