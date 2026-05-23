/**
 * WebSocket Server
 *
 * Handles real-time communication with frontend clients.
 * Broadcasts bot events and market data updates.
 */

import { WebSocketServer, WebSocket, RawData } from 'ws';
import type { ErrorPayload, WebSocketMessage, WebSocketPayloadMap, WebSocketRequestType } from '@edison/contracts/runtime-api';
import { BotBridgeService } from '../services/bot-bridge.service.js';
import type {
  FileWatcherRealtimeApi,
  FileWatcherRealtimeEventMap,
} from '../services/file-watcher.service.js';
import {
  createStatusErrorDetail,
  createWebSocketStatusErrorPayload,
  createWebSocketStatusErrorPayloadFromError,
  getErrorCode,
  getErrorMessage,
} from '../errors/api-error-response.js';

type FileWatcherEventName = keyof FileWatcherRealtimeEventMap;
type FileWatcherListener<K extends FileWatcherEventName> = (payload: FileWatcherRealtimeEventMap[K]) => void;
type FileWatcherBroadcastType = 'JOURNAL_UPDATE' | 'SESSION_UPDATE';
type ParsedIncomingMessage = {
  type: string;
  requestId?: string;
};

type RequestValidationFailure = {
  logLevel?: 'warn' | 'error';
  logMessage: string;
  error: string;
  code: NonNullable<ErrorPayload['code']>;
  details: string;
  requestId?: string;
  requestType?: WebSocketRequestType | string;
};

type ReadFailureOptions = {
  requestId?: string;
  code: NonNullable<ErrorPayload['code']>;
  requestType?: WebSocketRequestType | string;
};

export class WebSocketService {
  private wss!: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private currentPort: number;
  private bridgeEventListener: ((event: WebSocketMessage) => void) | null = null;
  private fileWatcherListeners = new Map<FileWatcherEventName, (...args: unknown[]) => void>();

  constructor(port: number, private bridge: BotBridgeService, private fileWatcher?: FileWatcherRealtimeApi) {
    this.currentPort = port;
    this.wss = this.createServerWithPortFallback(port);
    this.bindServerHandlers(this.wss);
    this.setupEventForwarding();
    this.startHeartbeat();
  }

  private createServerWithPortFallback(startPort: number, maxAttempts: number = 3): WebSocketServer {
    let port = startPort;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const server = new WebSocketServer({ port });
        this.currentPort = port;
        console.log(`[WS] Server initialized on port ${port}`);
        return server;
      } catch (error: unknown) {
        if (getErrorCode(error) !== 'EADDRINUSE' || attempt >= maxAttempts - 1) {
          throw error;
        }

        const nextPort = port + 100;
        console.log(`[WS] Port already in use, trying port ${nextPort}...`);
        port = nextPort;
      }
    }

    throw new Error('[WS] Failed to initialize server');
  }

  private bindServerHandlers(server: WebSocketServer): void {
    server.on('error', (error: unknown) => {
      this.handleServerError(error);
    });

    server.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });
  }

  private handleServerError(error: unknown): void {
    const errorCode = getErrorCode(error);
    if (errorCode !== 'EADDRINUSE') {
      console.error('[WS] Server error:', getErrorMessage(error));
      return;
    }

    const alternatePort = this.currentPort + 100;
    console.error(`[WS] Port ${this.currentPort} is already in use`);
    console.log(`[WS] Attempting to listen on alternate port ${alternatePort}...`);

    this.wss.close();
    this.wss = this.createServerWithPortFallback(alternatePort, 1);
    this.bindServerHandlers(this.wss);
    console.log(`[WS] Successfully listening on alternate port ${this.currentPort}`);
  }

  private handleConnection(ws: WebSocket): void {
    console.log(`[WS] New client connected. Total: ${this.clients.size + 1}`);
    this.clients.add(ws);

    void this.sendStatusChange(ws, undefined, 'new client');

    ws.on('message', (message: RawData) => {
      this.handleMessage(ws, message);
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      console.log(`[WS] Client disconnected. Total: ${this.clients.size}`);
    });

    ws.on('error', (connectionError) => {
      console.error('[WS] Client error:', connectionError.message);
    });
  }

  /**
   * Setup error handling for WebSocket server
   */
  private setupEventForwarding() {
    // Forward bot bridge events
    this.bridgeEventListener = (event: WebSocketMessage) => {
      this.broadcast(event);
    };
    this.bridge.on('bot-event', this.bridgeEventListener);

    // Forward file watcher events (journal and session updates)
    if (this.fileWatcher) {
      const journalListener: FileWatcherListener<'journal:updated'> = (journal) =>
        this.broadcast(this.createFileWatcherBroadcastMessage('JOURNAL_UPDATE', { journal }));

      const sessionListener: FileWatcherListener<'session:updated'> = (sessions) =>
        this.broadcast(this.createFileWatcherBroadcastMessage('SESSION_UPDATE', { sessions }));

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
          this.send(ws, this.createPongMessage(requestId));
          break;

        case 'GET_STATUS':
          void this.sendStatusChange(ws, requestId, 'status request');
          break;

        case 'GET_POSITION':
          void this.sendPositionUpdate(ws, requestId);
          break;

        default:
          this.sendRequestValidationError(ws, {
            logLevel: 'warn',
            logMessage: `[WS] Unknown message type: ${messageType}`,
            error: 'Unknown message type',
            code: 'UNKNOWN_MESSAGE_TYPE',
            details: `Type "${messageType}" is not recognized`,
            requestId,
            requestType: messageType,
          });
      }
    } catch (error) {
      console.error('[WS] Unexpected error handling message:', error);
      this.sendReadFailure(ws, error, 'Internal server error', {
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  private sendRequestValidationError(ws: WebSocket, failure: RequestValidationFailure): void {
    const logger = failure.logLevel === 'warn' ? console.warn : console.error;
    const detail = createStatusErrorDetail(400, failure.error, {
      code: failure.code,
      details: failure.details,
    });
    logger(failure.logMessage, {
      code: detail.code,
      message: detail.message,
      details: detail.details,
      ...(failure.requestId ? { requestId: failure.requestId } : {}),
      ...(failure.requestType ? { requestType: failure.requestType } : {}),
    });
    this.sendError(
      ws,
      createWebSocketStatusErrorPayload(400, failure.error, {
        code: failure.code,
        details: failure.details,
        requestType: failure.requestType,
      }),
      failure.requestId,
    );
  }

  private sendReadFailure(
    ws: WebSocket,
    error: unknown,
    message: string,
    options: ReadFailureOptions,
  ): void {
    this.sendError(
      ws,
      createWebSocketStatusErrorPayloadFromError(error, 500, message, {
        code: options.code,
        requestType: options.requestType,
      }),
      options.requestId,
    );
  }

  private parseIncomingMessage(ws: WebSocket, message: string): ParsedIncomingMessage | null {
    let data: unknown;
    try {
      data = JSON.parse(message);
    } catch (parseError) {
      this.sendRequestValidationError(ws, {
        logMessage: `[WS] JSON parse error: ${getErrorMessage(parseError)}`,
        error: 'Invalid JSON format',
        code: 'INVALID_JSON',
        details: 'Message must be valid JSON',
      });
      return null;
    }

    if (!this.isRecord(data) || typeof data.type !== 'string') {
      this.sendRequestValidationError(ws, {
        logMessage: '[WS] Invalid message: missing or invalid "type" field',
        error: 'Invalid message structure',
        code: 'INVALID_MESSAGE',
        details: 'Message must have "type" (string) field',
      });
      return null;
    }

    return {
      type: data.type,
      requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
    };
  }

  private createMessage<TType extends keyof WebSocketPayloadMap>(
    type: TType,
    payload: WebSocketPayloadMap[TType],
    requestId?: string,
  ): WebSocketMessage<TType> {
    return {
      type,
      payload,
      ...(requestId ? { requestId } : {}),
      timestamp: Date.now(),
    };
  }

  private createPongMessage(requestId?: string): WebSocketMessage<'PONG'> {
    return this.createMessage('PONG', {}, requestId);
  }

  private createFileWatcherBroadcastMessage<TType extends FileWatcherBroadcastType>(
    type: TType,
    payload: WebSocketPayloadMap[TType],
  ): WebSocketMessage<TType> {
    return this.createMessage(type, payload);
  }

  private createErrorMessage(
    payload: ErrorPayload,
    requestId?: string,
  ): WebSocketMessage<'ERROR'> {
    return this.createMessage('ERROR', payload, requestId);
  }

  private sendError(
    ws: WebSocket,
    payload: ErrorPayload,
    requestId?: string,
  ) {
    this.send(ws, this.createErrorMessage(payload, requestId));
  }

  /**
   * Send message to single client
   */
  private send(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private logOutboundReadResponse(
    messageType: 'BOT_STATUS_CHANGE' | 'POSITION_UPDATE',
    details: Record<string, unknown>,
  ): void {
    console.log(`[WS] Sending ${messageType} to client`, details);
  }

  private logReadResponseFailure(target: 'bot status' | 'position', error: unknown, context?: string): void {
    const suffix = context ? ` for ${context}` : '';
    console.error(`[WS] Error getting ${target}${suffix}:`, getErrorMessage(error));
  }

  private async sendReadResponse<TMessageType extends 'BOT_STATUS_CHANGE' | 'POSITION_UPDATE'>(
    ws: WebSocket,
    options: {
      requestId?: string;
      context?: 'new client' | 'status request';
      messageType: TMessageType;
      target: 'bot status' | 'position';
      failure: {
        error: string;
        code: NonNullable<ErrorPayload['code']>;
      };
      createMessage: () => Promise<WebSocketMessage<TMessageType>> | WebSocketMessage<TMessageType>;
      createLogDetails: (message: WebSocketMessage<TMessageType>) => Record<string, unknown>;
    },
  ): Promise<void> {
    try {
      const message = await options.createMessage();
      this.logOutboundReadResponse(options.messageType, options.createLogDetails(message));
      this.send(ws, message);
    } catch (error) {
      this.logReadResponseFailure(options.target, error, options.context);
      this.sendReadFailure(ws, error, options.failure.error, {
        code: options.failure.code,
        requestId: options.requestId,
      });
    }
  }

  private async sendStatusChange(
    ws: WebSocket,
    requestId?: string,
    context: 'new client' | 'status request' = 'status request',
  ): Promise<void> {
    await this.sendReadResponse(ws, {
      requestId,
      context,
      messageType: 'BOT_STATUS_CHANGE',
      target: 'bot status',
      failure: {
        error: 'Failed to get bot status',
        code: 'STATUS_READ_FAILED',
      },
      createMessage: () => this.bridge.createStatusChangeMessage(requestId),
      createLogDetails: (message) => ({
        context,
        isRunning: message.payload.isRunning,
        ...(requestId ? { requestId } : {}),
      }),
    });
  }

  private async sendPositionUpdate(
    ws: WebSocket,
    requestId?: string,
  ): Promise<void> {
    await this.sendReadResponse(ws, {
      requestId,
      messageType: 'POSITION_UPDATE',
      target: 'position',
      failure: {
        error: 'Failed to get position',
        code: 'POSITION_READ_FAILED',
      },
      createMessage: () => this.bridge.createPositionUpdateMessage(requestId),
      createLogDetails: (message) => ({
        hasPosition: message.payload.position !== null,
        ...(requestId ? { requestId } : {}),
      }),
    });
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
