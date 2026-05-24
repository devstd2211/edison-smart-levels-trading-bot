import net from 'net';
import WebSocket, { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import type {
  Position,
  WebSocketMessage,
} from '@edison/contracts/runtime-api';
import type { WebApiJournalEntry, WebApiSessionStats } from '@edison/contracts/web-api';
import { BotBridgeService, type IBotInstance } from '../src/services/bot-bridge.service';
import {
  createWebSocketRequestValidationLogPayload,
  createWebSocketReadFailureLogPayload,
  createWebSocketServerErrorLogPayload,
  createWebSocketServerEventLogPayload,
} from '../src/logging/request-scoped-error-log';
import {
  createFileWatcherRealtimeApi,
  type FileWatcherRealtimeApi,
  FileWatcherService,
} from '../src/services/file-watcher.service';
import { WebSocketService } from '../src/websocket/ws-server';

class TestBot extends EventEmitter implements IBotInstance {
  public isRunning = true;
  public currentPosition: Position | null = {
    id: 'pos-1',
    symbol: 'BTCUSDT',
    side: 'LONG',
    quantity: 0.2,
    entryPrice: 100,
    currentPrice: 101,
    leverage: 5,
    marginUsed: 20,
    unrealizedPnL: 2,
    unrealizedPnLPercent: 10,
    stopLoss: { price: 95 },
    takeProfits: [{ price: 105, quantity: 100 }],
    openedAt: 123,
    status: 'OPEN',
  };

  getCurrentPosition(): Position | null {
    return this.currentPosition;
  }

  async getBalance(): Promise<number> {
    return 1000;
  }

  async start(): Promise<void> {}

  stop(): void {}
}

type WebSocketHarness = {
  service: WebSocketService;
  client: WebSocket;
};

const reservePort = async (): Promise<number> => {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Failed to reserve port');
  }

  const port = address.port;
  await closeNetServer(server);
  return port;
};

const closeNetServer = (server: net.Server): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const waitForOpen = (client: WebSocket): Promise<void> =>
  new Promise((resolve, reject) => {
    client.once('open', () => resolve());
    client.once('error', reject);
  });

const waitForMessage = <T extends WebSocketMessage = WebSocketMessage>(client: WebSocket): Promise<T> =>
  new Promise((resolve, reject) => {
    const cleanup = () => {
      client.off('message', onMessage);
      client.off('error', onError);
    };

    const onMessage = (data: WebSocket.RawData) => {
      cleanup();
      resolve(JSON.parse(data.toString('utf-8')) as T);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    client.on('message', onMessage);
    client.on('error', onError);
  });

const waitForClose = (client: WebSocket): Promise<void> =>
  new Promise((resolve) => {
    client.once('close', () => resolve());
  });

const waitForPortChange = async (
  service: WebSocketService,
  initialPort: number,
  timeoutMs: number = 5000,
): Promise<number> =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const currentPort = service.getPort();
      if (currentPort !== initialPort) {
        clearInterval(timer);
        resolve(currentPort);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(timer);
        reject(new Error('Timed out waiting for websocket port fallback'));
      }
    }, 25);
  });

const createWebSocketHarness = async (
  bridge: BotBridgeService,
  fileWatcher?: FileWatcherRealtimeApi,
): Promise<WebSocketHarness> => {
  const service = new WebSocketService(await reservePort(), bridge, fileWatcher);
  const client = new WebSocket(`ws://127.0.0.1:${service.getPort()}`);
  return { service, client };
};

const closeWebSocketClient = async (client: WebSocket | null): Promise<void> => {
  if (!client) {
    return;
  }

  if (client.readyState === WebSocket.CONNECTING || client.readyState === WebSocket.OPEN) {
    const closePromise = waitForClose(client);
    client.close();
    await closePromise;
  }
};

const closeWebSocketHarness = async (harness: WebSocketHarness | null): Promise<void> => {
  if (!harness) {
    return;
  }

  const closePromise =
    harness.client.readyState === WebSocket.CONNECTING || harness.client.readyState === WebSocket.OPEN
      ? waitForClose(harness.client)
      : null;
  harness.service.close();
  await closePromise;
};

describe('WebSocketService functional boundary', () => {
  let service: WebSocketService | null = null;
  let client: WebSocket | null = null;

  afterEach(async () => {
    await closeWebSocketHarness(service && client ? { service, client } : null);
    await closeWebSocketClient(client);
    service = null;
    client = null;
  });

  test('forwards typed journal and session payloads and preserves request ids', async () => {
    const bot = new TestBot();
    const bridge = new BotBridgeService(bot);
    const fileWatcher = new FileWatcherService();
    ({ service, client } = await createWebSocketHarness(bridge, createFileWatcherRealtimeApi(fileWatcher)));

    const initialMessagePromise = waitForMessage(client);
    await waitForOpen(client);
    await expect(initialMessagePromise).resolves.toEqual({
      type: 'BOT_STATUS_CHANGE',
      payload: {
        isRunning: true,
        currentPosition: {
          ...bot.currentPosition!,
          stopLoss: {
            ...bot.currentPosition!.stopLoss,
            trailing: false,
          },
        },
        balance: 1000,
        unrealizedPnL: 2,
        timestamp: expect.any(Number),
      },
      timestamp: expect.any(Number),
    });

    const positionMessagePromise = waitForMessage<WebSocketMessage<'POSITION_UPDATE'>>(client);
    client.send(JSON.stringify({ type: 'GET_POSITION', requestId: 'req-42' }));
    const positionMessage = await positionMessagePromise;

    expect(positionMessage).toEqual({
      type: 'POSITION_UPDATE',
      payload: {
        position: {
          ...bot.currentPosition!,
          stopLoss: {
            ...bot.currentPosition!.stopLoss,
            trailing: false,
          },
        },
      },
      requestId: 'req-42',
      timestamp: expect.any(Number),
    });

    const journal: WebApiJournalEntry[] = [
      {
        id: 'trade-1',
        timestamp: 1000,
        direction: 'LONG',
        entryPrice: 100,
        exitPrice: 103,
        quantity: 1,
        pnl: 3,
        pnlPercent: 3,
        strategy: 'breakout',
        exitReason: 'tp',
      },
    ];
    const sessions: WebApiSessionStats[] = [
      {
        sessionId: 'session-1',
        startTime: 900,
        trades: journal,
        totalPnL: 3,
        winRate: 100,
        winCount: 1,
        lossCount: 0,
        totalTrades: 1,
      },
    ];

    const journalMessagePromise = waitForMessage<WebSocketMessage<'JOURNAL_UPDATE'>>(client);
    fileWatcher.emit('journal:updated', journal);
    const journalMessage = await journalMessagePromise;
    expect(journalMessage).toEqual({
      type: 'JOURNAL_UPDATE',
      payload: { journal },
      timestamp: expect.any(Number),
    });

    const sessionMessagePromise = waitForMessage<WebSocketMessage<'SESSION_UPDATE'>>(client);
    fileWatcher.emit('session:updated', sessions);
    const sessionMessage = await sessionMessagePromise;
    expect(sessionMessage).toEqual({
      type: 'SESSION_UPDATE',
      payload: { sessions },
      timestamp: expect.any(Number),
    });
  });

  test('falls forward to the next websocket port when the requested port is already occupied', async () => {
    const blockedPort = await reservePort();
    const blocker = new WebSocketServer({ port: blockedPort });

    const bridge = new BotBridgeService(new TestBot());
    service = new WebSocketService(blockedPort, bridge);
    const fallbackPort = await waitForPortChange(service, blockedPort);
    client = new WebSocket(`ws://127.0.0.1:${fallbackPort}`);

    await waitForOpen(client);

    expect(fallbackPort).toBe(blockedPort + 100);

    await new Promise<void>((resolve, reject) => {
      blocker.close((error) => (error ? reject(error) : resolve()));
    });
  }, 10000);

  test('returns typed websocket errors for invalid and unknown requests', async () => {
    const bridge = new BotBridgeService(new TestBot());
    ({ service, client } = await createWebSocketHarness(bridge));

    const initialMessagePromise = waitForMessage(client);
    await waitForOpen(client);
    await initialMessagePromise;

    const invalidJsonMessagePromise = waitForMessage<WebSocketMessage<'ERROR'>>(client);
    client.send('not json');
    const invalidJsonMessage = await invalidJsonMessagePromise;
    expect(invalidJsonMessage).toEqual({
      type: 'ERROR',
      payload: {
        error: 'Invalid JSON format',
        code: 'INVALID_JSON',
        details: 'Message must be valid JSON',
      },
      timestamp: expect.any(Number),
    });

    const invalidStructureMessagePromise = waitForMessage<WebSocketMessage<'ERROR'>>(client);
    client.send(JSON.stringify({ requestId: 'missing-type' }));
    const invalidStructureMessage = await invalidStructureMessagePromise;
    expect(invalidStructureMessage).toEqual({
      type: 'ERROR',
      payload: {
        error: 'Invalid message structure',
        code: 'INVALID_MESSAGE',
        details: 'Message must have "type" (string) field',
      },
      timestamp: expect.any(Number),
    });

    const unknownTypeMessagePromise = waitForMessage<WebSocketMessage<'ERROR'>>(client);
    client.send(JSON.stringify({ type: 'unknown_command', requestId: 'req-77' }));
    const unknownTypeMessage = await unknownTypeMessagePromise;
    expect(unknownTypeMessage).toEqual({
      type: 'ERROR',
      payload: {
        error: 'Unknown message type',
        code: 'UNKNOWN_MESSAGE_TYPE',
        details: 'Type "UNKNOWN_COMMAND" is not recognized',
        requestType: 'UNKNOWN_COMMAND',
      },
      requestId: 'req-77',
      timestamp: expect.any(Number),
    });
  });

  test('builds request-validation log payloads through the shared websocket helper boundary', () => {
    expect(createWebSocketRequestValidationLogPayload({
      code: 'UNKNOWN_MESSAGE_TYPE',
      error: 'Unknown message type',
      details: 'Type "UNKNOWN_COMMAND" is not recognized',
      requestId: 'req-77',
      requestType: 'UNKNOWN_COMMAND',
    })).toEqual({
      requestId: 'req-77',
      requestType: 'UNKNOWN_COMMAND',
      statusCode: 400,
      code: 'UNKNOWN_MESSAGE_TYPE',
      message: 'Unknown message type',
      details: 'Type "UNKNOWN_COMMAND" is not recognized',
      suggestion: 'Check your request parameters and try again',
    });
  });

  test('builds read-failure log payloads through the shared websocket helper boundary', () => {
    expect(createWebSocketReadFailureLogPayload({
      error: {
        message: 'status unavailable',
        details: 'bridge status snapshot unavailable',
      },
      requestId: 'req-status-error',
      requestType: 'GET_STATUS',
      context: 'status request',
      code: 'STATUS_READ_FAILED',
    })).toEqual({
      context: 'status request',
      requestId: 'req-status-error',
      requestType: 'GET_STATUS',
      statusCode: 500,
      code: 'STATUS_READ_FAILED',
      message: 'status unavailable',
      details: 'bridge status snapshot unavailable',
      suggestion: 'Please try again or contact support',
    });
  });

  test('builds websocket server-event log payloads through the shared helper boundary', () => {
    expect(createWebSocketServerEventLogPayload({
      event: 'outbound-message',
      messageType: 'BOT_STATUS_CHANGE',
      requestId: 'req-status-log',
      requestType: 'GET_STATUS',
      context: 'status request',
      details: {
        isRunning: true,
      },
    })).toEqual({
      event: 'outbound-message',
      requestId: 'req-status-log',
      requestType: 'GET_STATUS',
      context: 'status request',
      messageType: 'BOT_STATUS_CHANGE',
      isRunning: true,
    });
  });

  test('builds websocket client/server error log payloads through the shared helper boundary', () => {
    expect(createWebSocketServerErrorLogPayload({
      event: 'client-error',
      error: {
        message: 'socket failed',
        details: 'peer closed connection',
      },
      clientCount: 1,
    })).toEqual({
      event: 'client-error',
      clientCount: 1,
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'socket failed',
      details: 'peer closed connection',
      suggestion: 'Please try again or contact support',
    });
  });

  test('reuses the shared request-scoped reply path for ping/pong responses', async () => {
    const bridge = new BotBridgeService(new TestBot());
    ({ service, client } = await createWebSocketHarness(bridge));

    const initialMessagePromise = waitForMessage(client);
    await waitForOpen(client);
    await initialMessagePromise;

    const pongMessagePromise = waitForMessage<WebSocketMessage<'PONG'>>(client);
    client.send(JSON.stringify({ type: 'PING', requestId: 'req-ping' }));

    await expect(pongMessagePromise).resolves.toEqual({
      type: 'PONG',
      payload: {},
      requestId: 'req-ping',
      timestamp: expect.any(Number),
    });
  });

  test('reuses the bridge status-change message helper for explicit status requests', async () => {
    const bridge = new BotBridgeService(new TestBot());
    const statusMessageSpy = jest.spyOn(bridge, 'createStatusChangeMessage');
    ({ service, client } = await createWebSocketHarness(bridge));

    const initialMessagePromise = waitForMessage(client);
    await waitForOpen(client);
    await initialMessagePromise;

    const statusMessagePromise = waitForMessage<WebSocketMessage<'BOT_STATUS_CHANGE'>>(client);
    client.send(JSON.stringify({ type: 'GET_STATUS', requestId: 'req-status' }));
    const statusMessage = await statusMessagePromise;

    expect(statusMessageSpy).toHaveBeenNthCalledWith(1, undefined);
    expect(statusMessageSpy).toHaveBeenNthCalledWith(2, 'req-status');
    expect(statusMessage).toEqual({
      type: 'BOT_STATUS_CHANGE',
      payload: {
        isRunning: true,
        currentPosition: {
          id: 'pos-1',
          symbol: 'BTCUSDT',
          side: 'LONG',
          quantity: 0.2,
          entryPrice: 100,
          currentPrice: 101,
          leverage: 5,
          marginUsed: 20,
          unrealizedPnL: 2,
          unrealizedPnLPercent: 10,
          stopLoss: { price: 95, trailing: false },
          takeProfits: [{ price: 105, quantity: 100 }],
          openedAt: 123,
          status: 'OPEN',
        },
        balance: 1000,
        unrealizedPnL: 2,
        timestamp: expect.any(Number),
      },
      requestId: 'req-status',
      timestamp: expect.any(Number),
    });
  });

  test('reuses the bridge position-update message helper for explicit position requests', async () => {
    const bridge = new BotBridgeService(new TestBot());
    const positionMessageSpy = jest.spyOn(bridge, 'createPositionUpdateMessage');
    ({ service, client } = await createWebSocketHarness(bridge));

    const initialMessagePromise = waitForMessage(client);
    await waitForOpen(client);
    await initialMessagePromise;

    const positionMessagePromise = waitForMessage<WebSocketMessage<'POSITION_UPDATE'>>(client);
    client.send(JSON.stringify({ type: 'GET_POSITION', requestId: 'req-position' }));
    const positionMessage = await positionMessagePromise;

    expect(positionMessageSpy).toHaveBeenCalledWith('req-position');
    expect(positionMessage).toEqual({
      type: 'POSITION_UPDATE',
      payload: {
        position: {
          id: 'pos-1',
          symbol: 'BTCUSDT',
          side: 'LONG',
          quantity: 0.2,
          entryPrice: 100,
          currentPrice: 101,
          leverage: 5,
          marginUsed: 20,
          unrealizedPnL: 2,
          unrealizedPnLPercent: 10,
          stopLoss: { price: 95, trailing: false },
          takeProfits: [{ price: 105, quantity: 100 }],
          openedAt: 123,
          status: 'OPEN',
        },
      },
      requestId: 'req-position',
      timestamp: expect.any(Number),
    });
  });

  test('logs explicit status and position reads through the shared outbound helper path', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const bridge = new BotBridgeService(new TestBot());
    ({ service, client } = await createWebSocketHarness(bridge));

    const initialMessagePromise = waitForMessage<WebSocketMessage<'BOT_STATUS_CHANGE'>>(client);
    await waitForOpen(client);
    await initialMessagePromise;

    const statusMessagePromise = waitForMessage<WebSocketMessage<'BOT_STATUS_CHANGE'>>(client);
    client.send(JSON.stringify({ type: 'GET_STATUS', requestId: 'req-status-log' }));
    await statusMessagePromise;

    const positionMessagePromise = waitForMessage<WebSocketMessage<'POSITION_UPDATE'>>(client);
    client.send(JSON.stringify({ type: 'GET_POSITION', requestId: 'req-position-log' }));
    await positionMessagePromise;

    expect(consoleLogSpy).toHaveBeenCalledWith('[WS] Sending websocket message to client', {
      event: 'outbound-message',
      context: 'new client',
      requestType: 'GET_STATUS',
      messageType: 'BOT_STATUS_CHANGE',
      isRunning: true,
    });
    expect(consoleLogSpy).toHaveBeenCalledWith('[WS] Sending websocket message to client', {
      event: 'outbound-message',
      requestId: 'req-status-log',
      requestType: 'GET_STATUS',
      context: 'status request',
      messageType: 'BOT_STATUS_CHANGE',
      isRunning: true,
    });
    expect(consoleLogSpy).toHaveBeenCalledWith('[WS] Sending websocket message to client', {
      event: 'outbound-message',
      requestId: 'req-position-log',
      requestType: 'GET_POSITION',
      messageType: 'POSITION_UPDATE',
      hasPosition: true,
    });

    consoleLogSpy.mockRestore();
  });

  test('returns the shared typed status-read error envelope when status assembly fails', async () => {
    const bridge = new BotBridgeService(new TestBot());
    jest.spyOn(bridge, 'createStatusChangeMessage').mockRejectedValue(new Error('status unavailable'));
    ({ service, client } = await createWebSocketHarness(bridge));

    const initialErrorPromise = waitForMessage<WebSocketMessage<'ERROR'>>(client);
    await waitForOpen(client);

    await expect(initialErrorPromise).resolves.toEqual({
      type: 'ERROR',
      payload: {
        error: 'Failed to get bot status',
        code: 'STATUS_READ_FAILED',
        details: 'status unavailable',
      },
      timestamp: expect.any(Number),
    });
  });

  test('preserves request ids when the shared status-read error helper handles explicit status requests', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const bridge = new BotBridgeService(new TestBot());
    jest.spyOn(bridge, 'createStatusChangeMessage')
      .mockResolvedValueOnce({
        type: 'BOT_STATUS_CHANGE',
        payload: {
          isRunning: true,
          currentPosition: null,
          balance: 1000,
          unrealizedPnL: 0,
          timestamp: 1,
        },
        timestamp: 1,
      })
      .mockRejectedValueOnce({
        message: 'status unavailable',
        details: 'bridge status snapshot unavailable',
      });
    ({ service, client } = await createWebSocketHarness(bridge));

    const initialMessagePromise = waitForMessage<WebSocketMessage<'BOT_STATUS_CHANGE'>>(client);
    await waitForOpen(client);
    await initialMessagePromise;

    const statusErrorPromise = waitForMessage<WebSocketMessage<'ERROR'>>(client);
    client.send(JSON.stringify({ type: 'GET_STATUS', requestId: 'req-status-error' }));

    await expect(statusErrorPromise).resolves.toEqual({
      type: 'ERROR',
      payload: {
        error: 'Failed to get bot status',
        code: 'STATUS_READ_FAILED',
        details: 'bridge status snapshot unavailable',
      },
      requestId: 'req-status-error',
      timestamp: expect.any(Number),
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('[WS] Error getting bot status', {
      context: 'status request',
      requestId: 'req-status-error',
      requestType: 'GET_STATUS',
      statusCode: 500,
      code: 'STATUS_READ_FAILED',
      message: 'status unavailable',
      details: 'bridge status snapshot unavailable',
      suggestion: 'Please try again or contact support',
    });

    consoleErrorSpy.mockRestore();
  });

  test('returns the shared typed position-read error envelope when position assembly fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const bridge = new BotBridgeService(new TestBot());
    jest.spyOn(bridge, 'createPositionUpdateMessage').mockImplementation(() => {
      throw {
        message: 'position unavailable',
        details: 'bridge snapshot unavailable',
      };
    });
    ({ service, client } = await createWebSocketHarness(bridge));

    const initialMessagePromise = waitForMessage(client);
    await waitForOpen(client);
    await initialMessagePromise;

    const positionErrorPromise = waitForMessage<WebSocketMessage<'ERROR'>>(client);
    client.send(JSON.stringify({ type: 'GET_POSITION', requestId: 'req-position-error' }));

    await expect(positionErrorPromise).resolves.toEqual({
      type: 'ERROR',
      payload: {
        error: 'Failed to get position',
        code: 'POSITION_READ_FAILED',
        details: 'bridge snapshot unavailable',
      },
      requestId: 'req-position-error',
      timestamp: expect.any(Number),
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('[WS] Error getting position', {
      requestId: 'req-position-error',
      requestType: 'GET_POSITION',
      statusCode: 500,
      code: 'POSITION_READ_FAILED',
      message: 'position unavailable',
      details: 'bridge snapshot unavailable',
      suggestion: 'Please try again or contact support',
    });

    consoleErrorSpy.mockRestore();
  });

  test('uses the shared position fallback message when the position read failure exposes only status metadata', async () => {
    const bridge = new BotBridgeService(new TestBot());
    jest.spyOn(bridge, 'createPositionUpdateMessage').mockImplementation(() => {
      throw { status: '503' };
    });
    ({ service, client } = await createWebSocketHarness(bridge));

    const initialMessagePromise = waitForMessage(client);
    await waitForOpen(client);
    await initialMessagePromise;

    const positionErrorPromise = waitForMessage<WebSocketMessage<'ERROR'>>(client);
    client.send(JSON.stringify({ type: 'GET_POSITION', requestId: 'req-position-status-only' }));

    await expect(positionErrorPromise).resolves.toEqual({
      type: 'ERROR',
      payload: {
        error: 'Failed to get position',
        code: 'POSITION_READ_FAILED',
      },
      requestId: 'req-position-status-only',
      timestamp: expect.any(Number),
    });
  });

  test('logs websocket client and server errors through the shared error helper path', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const bridge = new BotBridgeService(new TestBot());
    ({ service, client } = await createWebSocketHarness(bridge));

    const initialMessagePromise = waitForMessage(client);
    await waitForOpen(client);
    await initialMessagePromise;

    const serverSideClient = [...((service as unknown as { wss: WebSocketServer }).wss.clients)][0];
    serverSideClient.emit('error', {
      message: 'socket failed',
      details: 'peer closed connection',
    });
    ((service as unknown as { wss: WebSocketServer }).wss).emit('error', {
      message: 'bind failed',
      details: 'permission denied',
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('[WS] Client error', {
      event: 'client-error',
      clientCount: 1,
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'socket failed',
      details: 'peer closed connection',
      suggestion: 'Please try again or contact support',
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('[WS] Server error', {
      event: 'server-error',
      port: service!.getPort(),
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'bind failed',
      details: 'permission denied',
      suggestion: 'Please try again or contact support',
    });

    consoleErrorSpy.mockRestore();
  });

  test('unsubscribes watcher listeners through the explicit realtime delegate boundary on close', async () => {
    const bridge = new BotBridgeService(new TestBot());
    const fileWatcher = new FileWatcherService();
    const watcherApi = createFileWatcherRealtimeApi(fileWatcher);
    const onSpy = jest.spyOn(fileWatcher, 'on');
    const offSpy = jest.spyOn(fileWatcher, 'off');

    ({ service, client } = await createWebSocketHarness(bridge, watcherApi));

    const initialMessagePromise = waitForMessage(client);
    await waitForOpen(client);
    await initialMessagePromise;

    service.close();
    service = null;

    expect(onSpy).toHaveBeenCalledWith('journal:updated', expect.any(Function));
    expect(onSpy).toHaveBeenCalledWith('session:updated', expect.any(Function));
    expect(offSpy).toHaveBeenCalledWith('journal:updated', expect.any(Function));
    expect(offSpy).toHaveBeenCalledWith('session:updated', expect.any(Function));

    onSpy.mockRestore();
    offSpy.mockRestore();
  });
});
