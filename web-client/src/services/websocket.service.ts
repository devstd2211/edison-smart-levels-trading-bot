/**
 * WebSocket Service (Client)
 *
 * Manages WebSocket connection to backend server
 * Handles reconnection with exponential backoff
 */

type MessageHandler = (data: any) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private handlers: Map<string, Set<MessageHandler>> = new Map();
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
    const apiHost = window.location.hostname;
    const apiPorts = ['4000', '4002']; // Try common API ports

    for (const apiPort of apiPorts) {
      try {
        const response = await Promise.race([
          fetch(`http://${apiHost}:${apiPort}/api/config/server`),
          new Promise<Response>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 2000)
          ),
        ]);

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.websocket?.url) {
            console.log(`[WS] Got WebSocket URL from port ${apiPort}:`, data.data.websocket.url);
            return data.data.websocket.url;
          }
        }
      } catch (error) {
        console.warn(`[WS] Failed to fetch from port ${apiPort}:`, (error as any).message);
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
  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  /**
   * Unsubscribe from message type
   */
  off(type: string, handler: MessageHandler) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Send message to server
   */
  send(type: string, payload: any = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
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
      const message = JSON.parse(data);
      const handlers = this.handlers.get(message.type);
      if (handlers) {
        handlers.forEach((handler) => handler(message.payload));
      }
    } catch (error) {
      console.error('[WS] Error parsing message:', error);
    }
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
}

// Singleton instance
export const wsClient = new WebSocketClient();
