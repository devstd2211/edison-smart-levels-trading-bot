/**
 * WebSocket Service (Client)
 *
 * Manages WebSocket connection to backend server
 * Handles reconnection with exponential backoff
 */

import type {
  WebSocketEventMap,
  WebSocketRequestMessage,
  WebSocketRequestPayloadMap,
  WebSocketRequestType,
} from '../types';
import { getCachedServerConfig, loadServerConfigFromUrl } from './server-runtime-config';

type MessageHandler<K extends keyof WebSocketEventMap> = (data: WebSocketEventMap[K]) => void;
type HandlerMap = { [K in keyof WebSocketEventMap]?: Set<MessageHandler<K>> };
type IncomingWebSocketMessage = {
  [K in keyof WebSocketEventMap]: {
    type: K;
    payload: WebSocketEventMap[K];
    timestamp: number;
    requestId?: string;
  };
}[keyof WebSocketEventMap];

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private handlers: HandlerMap = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isManuallyDisconnected = false;

  constructor(url?: string) {
    // Use provided URL, or fallback to runtime detection
    if (url) {
      this.url = url;
    } else {
      // URL will be set dynamically in connect() after fetching from API
      this.url = this.getFallbackWebSocketUrl();
    }
  }

  /**
   * Get WebSocket URL from API server config or use fallback
   * Tries multiple API ports: 4000 (default), 4002 (alt)
   */
  async getWebSocketUrlFromServer(): Promise<string> {
    const cachedConfig = getCachedServerConfig();
    if (cachedConfig?.websocket?.url) {
      return cachedConfig.websocket.url;
    }

    const apiHost = window.location.hostname;
    const apiPorts = ['4000', '4002']; // Try common API ports

    for (const apiPort of apiPorts) {
      try {
        const result = await Promise.race([
          loadServerConfigFromUrl(`http://${apiHost}:${apiPort}/api`),
          new Promise<Awaited<ReturnType<typeof loadServerConfigFromUrl>>>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 2000)
          ),
        ]);

        if (result.success && result.data?.websocket?.url) {
          console.log(`[WS] Got WebSocket URL from port ${apiPort}:`, result.data.websocket.url);
          return result.data.websocket.url;
        }
      } catch (error) {
        console.warn(`[WS] Failed to fetch from port ${apiPort}:`, this.getErrorMessage(error));
      }
    }

    console.warn('[WS] Could not fetch WebSocket URL from API, using fallback');
    return this.getFallbackWebSocketUrl();
  }

  /**
   * Fallback WebSocket URL if server is unreachable
   * Tries common ports in order: 4001 (default), 4003 (alt), 4101 (4001+100), 4103 (4003+100)
   */
  private getFallbackWebSocketUrl(): string {
    const hostname = window.location.hostname;
    // Primary default is 4001, secondary is 4003
    return `ws://${hostname}:4001`;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Fetch WebSocket URL from server config
        this.url = await this.getWebSocketUrlFromServer();
        console.log('[WS] Connecting to:', this.url);

        this.ws = new WebSocket(this.url);
        this.isManuallyDisconnected = false;

        this.ws.onopen = () => {
          console.log('[WS] Connected');
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = () => {
          console.log('[WS] Disconnected');
          if (!this.isManuallyDisconnected) {
            this.reconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WS] Error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    this.isManuallyDisconnected = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Subscribe to message type
   */
  on<K extends keyof WebSocketEventMap>(type: K, handler: MessageHandler<K>) {
    const existingHandlers = this.handlers[type] as Set<MessageHandler<K>> | undefined;
    if (existingHandlers) {
      existingHandlers.add(handler);
      return;
    }

    this.handlers[type] = new Set<MessageHandler<K>>([handler]) as HandlerMap[K];
  }

  /**
   * Unsubscribe from message type
   */
  off<K extends keyof WebSocketEventMap>(type: K, handler: MessageHandler<K>) {
    const handlers = this.handlers[type] as Set<MessageHandler<K>> | undefined;
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Send message to server
   */
  send<K extends WebSocketRequestType>(
    type: K,
    payload: WebSocketRequestPayloadMap[K] = {} as WebSocketRequestPayloadMap[K],
    requestId?: string,
  ) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message: WebSocketRequestMessage<K> = {
        type,
        payload,
        ...(requestId ? { requestId } : {}),
        timestamp: Date.now(),
      };
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[WS] Not connected, cannot send message');
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws ? this.ws.readyState === WebSocket.OPEN : false;
  }

  /**
   * Private: Handle incoming message
   */
  private handleMessage(data: string) {
    try {
      const message = this.parseMessage(data);
      if (!message) {
        return;
      }

      const handlers = this.handlers[message.type] as Set<MessageHandler<typeof message.type>> | undefined;
      handlers?.forEach((handler) => handler(message.payload));
    } catch (error) {
      console.error('[WS] Error parsing message:', error);
    }
  }

  private parseMessage(data: string): IncomingWebSocketMessage | null {
    const message: unknown = JSON.parse(data);

    if (
      typeof message !== 'object'
      || message === null
      || !('type' in message)
      || typeof message.type !== 'string'
      || !('payload' in message)
    ) {
      console.warn('[WS] Ignoring invalid message structure');
      return null;
    }

    return message as IncomingWebSocketMessage;
  }

  /**
   * Private: Reconnect with exponential backoff
   */
  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnect attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => {
      this.connect().catch(() => {
        if (!this.isManuallyDisconnected) {
          this.reconnect();
        }
      });
    }, delay);
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') {
      return error.message;
    }
    return 'Unknown error';
  }
}

// Singleton instance
export const wsClient = new WebSocketClient();
