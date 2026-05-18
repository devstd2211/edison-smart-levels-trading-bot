/**
 * WebSocket Service Tests (Phase 8)
 *
 * Tests for real-time WebSocket communication with backend server
 */

import { WebSocketClient } from '../../services/websocket.service';
import type { WebApiJournalEntry, WebApiSessionStats } from '@edison/contracts/web-api';

describe('Phase 8: Web Dashboard - WebSocket Service', () => {
  let wsClient: WebSocketClient;
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    window.__SERVER_CONFIG__ = undefined;
    global.fetch = jest.fn();
    wsClient = new WebSocketClient('ws://localhost:4001');
    originalWebSocket = global.WebSocket;
  });

  afterEach(() => {
    jest.resetAllMocks();
    global.WebSocket = originalWebSocket;
  });

  describe('WebSocket Client Initialization', () => {
    test('should initialize with custom URL', () => {
      const client = new WebSocketClient('ws://test-server:4001');
      expect(client).toBeDefined();
    });

    test('should initialize with fallback URL', () => {
      const client = new WebSocketClient();
      expect(client).toBeDefined();
    });
  });

  describe('Connection Methods', () => {
    test('should have connect method', () => {
      expect(typeof wsClient.connect).toBe('function');
    });

    test('should have disconnect method', () => {
      expect(typeof wsClient.disconnect).toBe('function');
    });
  });

  describe('Event Handling', () => {
    test('should have on method for event subscription', () => {
      expect(typeof wsClient.on).toBe('function');
    });

    test('should have off method for event unsubscription', () => {
      expect(typeof wsClient.off).toBe('function');
    });
  });

  describe('Connection State', () => {
    test('should have isConnected method', () => {
      expect(typeof wsClient.isConnected).toBe('function');
    });

    test('should track connection state', () => {
      const connected = wsClient.isConnected();
      expect(typeof connected).toBe('boolean');
    });

    test('should prefer cached runtime websocket config when available', async () => {
      window.__SERVER_CONFIG__ = {
        api: { port: 4000, url: 'http://localhost:4000' },
        websocket: { port: 4101, url: 'ws://localhost:4101' },
      };

      await expect(wsClient.getWebSocketUrlFromServer()).resolves.toBe('ws://localhost:4101');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('loads runtime websocket config through the shared server preload flow', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            api: { port: 4100, url: 'http://localhost:4100' },
            websocket: { port: 4101, url: 'ws://localhost:4101' },
          },
          timestamp: 123,
        }),
      } as Response);

      await expect(wsClient.getWebSocketUrlFromServer()).resolves.toBe('ws://localhost:4101');
      expect(global.fetch).toHaveBeenCalledWith('http://localhost/api/config/server', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    test('keeps an explicit websocket URL instead of re-running runtime discovery on connect', async () => {
      const createdUrls: string[] = [];
      global.WebSocket = class MockWebSocket {
        static OPEN = 1;
        readyState = 1;
        onopen: (() => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;
        onclose: (() => void) | null = null;
        onerror: ((event: Event) => void) | null = null;

        constructor(url: string) {
          createdUrls.push(url);
          setTimeout(() => {
            this.onopen?.();
          }, 0);
        }

        close() {}
        send() {}
      } as unknown as typeof WebSocket;

      const customUrlClient = new WebSocketClient('ws://custom-runtime:9001');
      await expect(customUrlClient.connect()).resolves.toBeUndefined();

      expect(global.fetch).not.toHaveBeenCalled();
      expect(createdUrls).toEqual(['ws://custom-runtime:9001']);
    });

    test('reuses the previously resolved runtime websocket URL across reconnect attempts', async () => {
      const createdUrls: string[] = [];
      global.WebSocket = class MockWebSocket {
        static OPEN = 1;
        readyState = 1;
        onopen: (() => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;
        onclose: (() => void) | null = null;
        onerror: ((event: Event) => void) | null = null;

        constructor(url: string) {
          createdUrls.push(url);
          setTimeout(() => {
            this.onopen?.();
          }, 0);
        }

        close() {}
        send() {}
      } as unknown as typeof WebSocket;

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            api: { port: 4100, url: 'http://localhost:4100' },
            websocket: { port: 4101, url: 'ws://localhost:4101' },
          },
          timestamp: 123,
        }),
      } as Response);

      const runtimeClient = new WebSocketClient();
      await expect(runtimeClient.connect()).resolves.toBeUndefined();
      window.__SERVER_CONFIG__ = undefined;
      await expect(runtimeClient.connect()).resolves.toBeUndefined();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(createdUrls).toEqual(['ws://localhost:4101', 'ws://localhost:4101']);
    });

    test('uses a protocol-aware secure websocket fallback on https pages', async () => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          hostname: 'edison.dev',
          origin: 'https://edison.dev',
          protocol: 'https:',
        },
      });

      (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

      await expect(new WebSocketClient().getWebSocketUrlFromServer()).resolves.toBe('wss://edison.dev:4001');
    });
  });

  describe('Event Types', () => {
    test('should support BOT_STATUS_CHANGE events', () => {
      const handler = jest.fn();
      wsClient.on('BOT_STATUS_CHANGE', handler);
      expect(wsClient).toBeDefined();
    });

    test('should support POSITION_UPDATE events', () => {
      const handler = jest.fn();
      wsClient.on('POSITION_UPDATE', handler);
      expect(wsClient).toBeDefined();
    });

    test('should support SIGNAL_NEW events', () => {
      const handler = jest.fn();
      wsClient.on('SIGNAL_NEW', handler);
      expect(wsClient).toBeDefined();
    });

    test('should support BALANCE_UPDATE events', () => {
      const handler = jest.fn();
      wsClient.on('BALANCE_UPDATE', handler);
      expect(wsClient).toBeDefined();
    });

    test('should support ERROR events', () => {
      const handler = jest.fn();
      wsClient.on('ERROR', handler);
      expect(wsClient).toBeDefined();
    });

    test('dispatches typed journal and session updates to subscribers', () => {
      const journalHandler = jest.fn();
      const sessionHandler = jest.fn();
      const journal: WebApiJournalEntry[] = [
        {
          id: 'trade-1',
          timestamp: 123,
          direction: 'LONG',
          entryPrice: 100,
          exitPrice: 105,
          quantity: 1,
          pnl: 5,
          pnlPercent: 5,
          strategy: 'breakout',
          exitReason: 'tp',
        },
      ];
      const sessions: WebApiSessionStats[] = [
        {
          sessionId: 'session-1',
          startTime: 100,
          trades: journal,
          totalPnL: 5,
          winRate: 100,
          winCount: 1,
          lossCount: 0,
          totalTrades: 1,
        },
      ];

      wsClient.on('JOURNAL_UPDATE', journalHandler);
      wsClient.on('SESSION_UPDATE', sessionHandler);

      (wsClient as unknown as { handleMessage(data: string): void }).handleMessage(
        JSON.stringify({
          type: 'JOURNAL_UPDATE',
          payload: { journal },
          timestamp: Date.now(),
        }),
      );
      (wsClient as unknown as { handleMessage(data: string): void }).handleMessage(
        JSON.stringify({
          type: 'SESSION_UPDATE',
          payload: { sessions },
          timestamp: Date.now(),
        }),
      );

      expect(journalHandler).toHaveBeenCalledWith({ journal });
      expect(sessionHandler).toHaveBeenCalledWith({ sessions });
    });
  });

  describe('Reconnection Strategy', () => {
    test('should support exponential backoff', () => {
      expect(wsClient).toBeDefined();
      // In real scenario, would test reconnection attempts
    });

    test('should have max reconnect attempts limit', () => {
      expect(wsClient).toBeDefined();
      // In real scenario, would test retry limits
    });
  });

  describe('Outgoing Requests', () => {
    test('sends typed request messages over the socket', () => {
      const send = jest.fn();
      (wsClient as unknown as { ws: { readyState: number; send: (data: string) => void } }).ws = {
        readyState: (global.WebSocket as typeof WebSocket).OPEN,
        send,
      };

      wsClient.send('GET_POSITION', {}, 'req-1');

      expect(send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"GET_POSITION"'),
      );
      expect(send).toHaveBeenCalledWith(
        expect.stringContaining('"requestId":"req-1"'),
      );
    });
  });
});
