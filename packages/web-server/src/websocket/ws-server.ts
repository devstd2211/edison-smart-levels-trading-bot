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
import {
  createWebSocketReadFailureLogPayload,
  createWebSocketRequestValidationLogPayload,
  createWebSocketServerErrorLogPayload,
  createWebSocketServerEventLogPayload,
} from '../logging/request-scoped-error-log.js';

type FileWatcherEventName = keyof FileWatcherRealtimeEventMap;
type FileWatcherListener<K extends FileWatcherEventName> = (payload: FileWatcherRealtimeEventMap[K]) => void;
type FileWatcherBroadcastType = 'JOURNAL_UPDATE' | 'SESSION_UPDATE';
type WebSocketBridgeEventName = 'bot-event';
type WebSocketBridgeListener = (event: WebSocketMessage) => void;
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
  context?: 'new client' | 'status request';
};
type WebSocketRealtimeBroadcast = (message: WebSocketMessage<'JOURNAL_UPDATE' | 'SESSION_UPDATE'>) => void;
type WebSocketRealtimeDelegates = {
  subscribe(): void;
  unsubscribe(): void;
};

export type WebSocketBridgeApi = {
  createStatusChangeMessage(requestId?: string): Promise<WebSocketMessage<'BOT_STATUS_CHANGE'>>;
  createPositionUpdateMessage(requestId?: string): WebSocketMessage<'POSITION_UPDATE'>;
  on(event: WebSocketBridgeEventName, listener: WebSocketBridgeListener): void;
  off(event: WebSocketBridgeEventName, listener: WebSocketBridgeListener): void;
};

export function createWebSocketBridgeApi(bridge: BotBridgeService): WebSocketBridgeApi {
  return {
    createStatusChangeMessage: (requestId) => bridge.createStatusChangeMessage(requestId),
    createPositionUpdateMessage: (requestId) => bridge.createPositionUpdateMessage(requestId),
    on: (event, listener) => {
      bridge.on(event, listener);
    },
    off: (event, listener) => {
      bridge.off(event, listener);
    },
  };
}

export function createWebSocketRealtimeDelegates(
  fileWatcher: FileWatcherRealtimeApi,
  broadcast: WebSocketRealtimeBroadcast,
): WebSocketRealtimeDelegates {
  const listeners = new Map<FileWatcherEventName, (...args: unknown[]) => void>();
  const createMessage = <TType extends FileWatcherBroadcastType>(
    type: TType,
    payload: WebSocketPayloadMap[TType],
  ): WebSocketMessage<TType> => ({
    type,
    payload,
    timestamp: Date.now(),
  });

  return {
    subscribe(): void {
      if (listeners.size > 0) {
        return;
      }

      const journalListener: FileWatcherListener<'journal:updated'> = (journal) =>
        broadcast(createMessage('JOURNAL_UPDATE', { journal }));
      const sessionListener: FileWatcherListener<'session:updated'> = (sessions) =>
        broadcast(createMessage('SESSION_UPDATE', { sessions }));

      listeners.set('journal:updated', journalListener as (...args: unknown[]) => void);
      listeners.set('session:updated', sessionListener as (...args: unknown[]) => void);

      fileWatcher.on('journal:updated', journalListener);
      fileWatcher.on('session:updated', sessionListener);
    },
    unsubscribe(): void {
      for (const [eventName, listener] of listeners.entries()) {
        fileWatcher.off(eventName, listener);
      }
      listeners.clear();
    },
  };
}

export class WebSocketService {
  private wss!: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private currentPort: number;
  private bridgeEventListener: ((event: WebSocketMessage) => void) | null = null;
  private realtimeDelegates: WebSocketRealtimeDelegates | null = null;

  constructor(port: number, private bridge: WebSocketBridgeApi, private fileWatcher?: FileWatcherRealtimeApi) {
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
        this.logServerEvent('[WS] Server initialized', {
          event: 'server-initialized',
          port,
        });
        return server;
      } catch (error: unknown) {
        if (getErrorCode(error) !== 'EADDRINUSE' || attempt >= maxAttempts - 1) {
          throw error;
        }

        const nextPort = port + 100;
        this.logServerEvent('[WS] Port already in use, retrying websocket bind', {
          event: 'port-retry',
          port,
          nextPort,
          error,
        });
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
      console.error('[WS] Server error', createWebSocketServerErrorLogPayload({
        event: 'server-error',
        error,
        port: this.currentPort,
      }));
      return;
    }

    const alternatePort = this.currentPort + 100;
    console.error('[WS] Port already in use', createWebSocketServerEventLogPayload({
      event: 'port-retry',
      port: this.currentPort,
      nextPort: alternatePort,
      error,
    }));
    this.logServerEvent('[WS] Attempting to listen on alternate port', {
      event: 'alternate-port-attempt',
      port: this.currentPort,
      nextPort: alternatePort,
    });

    this.wss.close();
    this.wss = this.createServerWithPortFallback(alternatePort, 1);
    this.bindServerHandlers(this.wss);
    this.logServerEvent('[WS] Successfully listening on alternate port', {
      event: 'alternate-port-active',
      port: this.currentPort,
    });
  }

  private handleConnection(ws: WebSocket): void {
    this.clients.add(ws);
    this.logServerEvent('[WS] New client connected', {
      event: 'client-connected',
      clientCount: this.clients.size,
    });

    void this.sendStatusChange(ws, undefined, 'new client');

    ws.on('message', (message: RawData) => {
      this.handleMessage(ws, message);
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      this.logServerEvent('[WS] Client disconnected', {
        event: 'client-disconnected',
        clientCount: this.clients.size,
      });
    });

    ws.on('error', (connectionError) => {
      console.error('[WS] Client error', createWebSocketServerErrorLogPayload({
        event: 'client-error',
        error: connectionError,
        clientCount: this.clients.size,
      }));
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
      this.realtimeDelegates = createWebSocketRealtimeDelegates(
        this.fileWatcher,
        (message) => this.broadcast(message),
      );
      this.realtimeDelegates.subscribe();
    }
  }

  /**
   * Handle incoming messages from clients
   */
  private handleMessage(ws: WebSocket, message: RawData) {
    let messageType: string | undefined;
    let requestId: string | undefined;

    try {
      const data = this.parseIncomingMessage(ws, this.toMessageText(message));
      if (!data) {
        return;
      }

      messageType = data.type.toUpperCase();
      requestId = data.requestId;
      this.logServerEvent('[WS] Received client message', {
        event: 'message-received',
        messageType,
        requestId,
        requestType: messageType,
      });

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
      console.error('[WS] Unexpected error handling message', createWebSocketServerErrorLogPayload({
        event: 'message-handler-error',
        error,
        requestId,
        requestType: messageType,
        code: 'INTERNAL_SERVER_ERROR',
        details: messageType
          ? `Failed to handle websocket message "${messageType}"`
          : 'Failed to handle websocket message',
      }));
      this.sendReadFailure(ws, error, 'Internal server error', {
        code: 'INTERNAL_SERVER_ERROR',
        requestId,
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
      ...createWebSocketRequestValidationLogPayload({
        code: detail.code,
        error: detail.message,
        details: detail.details ?? failure.details,
        requestId: failure.requestId,
        requestType: failure.requestType,
      }),
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
    options: {
      requestId?: string;
      requestType?: WebSocketRequestType | string;
      context?: 'new client' | 'status request';
    } = {},
  ): void {
    this.logServerEvent('[WS] Sending websocket message to client', {
      event: 'outbound-message',
      messageType,
      requestId: options.requestId,
      requestType: options.requestType,
      context: options.context,
      details,
    });
  }

  private logReadResponseFailure(
    target: 'bot status' | 'position',
    error: unknown,
    options: ReadFailureOptions,
  ): void {
    console.error(`[WS] Error getting ${target}`, createWebSocketReadFailureLogPayload({
      error,
      context: options.context,
      requestId: options.requestId,
      requestType: options.requestType,
      code: options.code,
    }));
  }

  private async sendReadResponse<TMessageType extends 'BOT_STATUS_CHANGE' | 'POSITION_UPDATE'>(
    ws: WebSocket,
    options: {
      requestId?: string;
      context?: 'new client' | 'status request';
      requestType?: WebSocketRequestType | string;
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
      this.logOutboundReadResponse(options.messageType, options.createLogDetails(message), {
        context: options.context,
        requestId: options.requestId,
        requestType: options.requestType,
      });
      this.send(ws, message);
    } catch (error) {
      this.logReadResponseFailure(options.target, error, {
        context: options.context,
        requestId: options.requestId,
        requestType: options.requestType,
        code: options.failure.code,
      });
      this.sendReadFailure(ws, error, options.failure.error, {
        code: options.failure.code,
        requestId: options.requestId,
        context: options.context,
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
      requestType: 'GET_STATUS',
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
      requestType: 'GET_POSITION',
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

  private logServerEvent(
    message: string,
    payload: Parameters<typeof createWebSocketServerEventLogPayload>[0],
  ): void {
    console.log(message, createWebSocketServerEventLogPayload(payload));
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
    this.realtimeDelegates?.unsubscribe();
    this.realtimeDelegates = null;
    this.clients.forEach((client) => client.close());
    this.wss.close();
    this.logServerEvent('[WS] Server closed', {
      event: 'server-closed',
      clientCount: this.clients.size,
      port: this.currentPort,
    });
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}
