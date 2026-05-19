import net from 'net';
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type {
  Position,
  WebSocketMessage,
} from '@edison/contracts/runtime-api';
import type { WebApiJournalEntry, WebApiSessionStats } from '@edison/contracts/web-api';
import { BotBridgeService, type IBotInstance } from '../src/services/bot-bridge.service';
import { FileWatcherService } from '../src/services/file-watcher.service';
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

const reservePort = async (): Promise<number> => {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Failed to reserve port');
  }

  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
};

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

describe('WebSocketService functional boundary', () => {
  let service: WebSocketService | null = null;
  let client: WebSocket | null = null;

  afterEach(async () => {
    if (service) {
      const closePromise = client
        ? new Promise<void>((resolve) => client!.once('close', () => resolve()))
        : null;
      service.close();
      if (closePromise) {
        await closePromise;
      }
      service = null;
    }

    if (client) {
      if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
        await new Promise<void>((resolve) => {
          client!.once('close', () => resolve());
          client!.close();
        });
      }
      client = null;
    }
  });

  test('forwards typed journal and session payloads and preserves request ids', async () => {
    const bot = new TestBot();
    const bridge = new BotBridgeService(bot);
    const fileWatcher = new FileWatcherService();
    service = new WebSocketService(await reservePort(), bridge, fileWatcher);
    client = new WebSocket(`ws://127.0.0.1:${service.getPort()}`);

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

  test('returns typed websocket errors for invalid and unknown requests', async () => {
    const bridge = new BotBridgeService(new TestBot());
    service = new WebSocketService(await reservePort(), bridge);
    client = new WebSocket(`ws://127.0.0.1:${service.getPort()}`);

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

  test('reuses the bridge status-change message helper for explicit status requests', async () => {
    const bridge = new BotBridgeService(new TestBot());
    const statusMessageSpy = jest.spyOn(bridge, 'createStatusChangeMessage');
    service = new WebSocketService(await reservePort(), bridge);
    client = new WebSocket(`ws://127.0.0.1:${service.getPort()}`);

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
});
