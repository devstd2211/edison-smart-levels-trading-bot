/**
 * WebSocket Server
 *
 * Handles real-time communication with frontend clients.
 * Broadcasts bot events and market data updates.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { BotBridgeService } from '../services/bot-bridge.service.js';
import { FileWatcherService } from '../services/file-watcher.service.js';
import type { WebSocketMessage } from '../types/api.types.js';

export class WebSocketService {
  private wss!: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private currentPort: number;
  private bridgeEventListener: ((event: any) => void) | null = null;
  private fileWatcherListeners: Map<string, (data: any) => void> = new Map();

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
      } catch (error: any) {
        if (error.code === 'EADDRINUSE' && attempts < maxAttempts - 1) {
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
    this.wss.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
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
        console.error(`[WS] Server error:`, error.message);
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
        // Send error message to client
        this.send(ws, {
          type: 'ERROR',
          payload: { error: 'Failed to get bot status', details: error instanceof Error ? error.message : String(error) },
          timestamp: Date.now(),
        });
      });

      ws.on('message', (message: string) => {
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
      const journalListener = (journal: any) => {
        this.broadcast({
          type: 'JOURNAL_UPDATE',
          payload: { journal },
          timestamp: Date.now(),
        });
      };

      const sessionListener = (sessions: any) => {
        this.broadcast({
          type: 'SESSION_UPDATE',
          payload: { sessions },
          timestamp: Date.now(),
        });
      };

      this.fileWatcherListeners.set('journal:updated', journalListener);
      this.fileWatcherListeners.set('session:updated', sessionListener);

      this.fileWatcher.on('journal:updated', journalListener);
      this.fileWatcher.on('session:updated', sessionListener);
    }
  }

  /**
   * Handle incoming messages from clients
   */
  private handleMessage(ws: WebSocket, message: string) {
    try {
      // Parse JSON
      let data: any;
      try {
        data = JSON.parse(message);
      } catch (parseError) {
        console.error('[WS] JSON parse error:', (parseError as Error).message);
        this.send(ws, {
          type: 'ERROR',
          payload: {
            error: 'Invalid JSON format',
            details: 'Message must be valid JSON'
          },
          timestamp: Date.now(),
        });
        return;
      }

      // Validate message structure
      if (!data.type || typeof data.type !== 'string') {
        console.error('[WS] Invalid message: missing or invalid "type" field');
        this.send(ws, {
          type: 'ERROR',
          payload: {
            error: 'Invalid message structure',
            details: 'Message must have "type" (string) field'
          },
          timestamp: Date.now(),
        });
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
            this.send(ws, {
              type: 'ERROR',
              payload: {
                error: 'Failed to get bot status',
                details: error instanceof Error ? error.message : String(error)
              },
              requestId,
              timestamp: Date.now(),
            });
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
            this.send(ws, {
              type: 'ERROR',
              payload: {
                error: 'Failed to get position',
                details: error instanceof Error ? error.message : String(error)
              },
              requestId,
              timestamp: Date.now(),
            });
          }
          break;

        default:
          console.warn(`[WS] Unknown message type: ${messageType}`);
          this.send(ws, {
            type: 'ERROR',
            payload: {
              error: 'Unknown message type',
              details: `Type "${messageType}" is not recognized`
            },
            requestId,
            timestamp: Date.now(),
          });
      }
    } catch (error) {
      console.error('[WS] Unexpected error handling message:', error);
      this.send(ws, {
        type: 'ERROR',
        payload: {
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Send message to single client
   */
  private send(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
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
