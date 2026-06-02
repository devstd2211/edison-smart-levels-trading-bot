import { EventEmitter } from 'events';
import type {
  WebApiFundingRateView,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiVolumeProfileView,
  WebApiWallsView,
} from '@edison/contracts/web-api';
import { BotBridgeService, type IBotInstance } from '../src/services/bot-bridge.service';

class TestBot extends EventEmitter implements IBotInstance {
  public isRunning = false;

  getCurrentPosition() {
    return null;
  }

  async getBalance(): Promise<number> {
    return 1000;
  }

  async start(): Promise<void> {}

  stop(): void {}
}

describe('BotBridgeService functional boundary', () => {
  test('returns stable read-only fallbacks when no web adapter is available', async () => {
    const bridge = new BotBridgeService(new TestBot());

    await expect(bridge.getMarketData()).resolves.toEqual<WebApiMarketData>({
      currentPrice: 0,
      priceChangePercent: 0,
    });
    await expect(bridge.getCandles('5m', 10)).resolves.toEqual([]);
    await expect(bridge.getPositionHistory(10)).resolves.toEqual([]);
    await expect(bridge.getOrderBook('BTCUSDT')).resolves.toEqual<WebApiOrderBookView>({
      symbol: 'BTCUSDT',
      bids: [],
      asks: [],
      timestamp: expect.any(Number),
    });
    await expect(bridge.getWalls('BTCUSDT')).resolves.toEqual<WebApiWallsView>({
      symbol: 'BTCUSDT',
      walls: [],
    });
    await expect(bridge.getFundingRate('BTCUSDT')).resolves.toEqual<WebApiFundingRateView>({
      symbol: 'BTCUSDT',
      current: 0,
      predicted: 0,
      nextFundingTime: 0,
      lastFundingTime: 0,
    });
    await expect(bridge.getVolumeProfile('BTCUSDT', 20)).resolves.toEqual<WebApiVolumeProfileView>({
      symbol: 'BTCUSDT',
      levels: [],
      volumes: [],
      maxVolume: 0,
    });
  });

  test('normalizes malformed adapter read models back to stable web contracts', async () => {
    const bridge = new BotBridgeService(new TestBot(), {
      getMarketData: jest.fn().mockResolvedValue({
        currentPrice: 67890,
      }),
      getCandles: jest.fn().mockResolvedValue([]),
      getPositionHistory: jest.fn().mockResolvedValue([]),
      getOrderBook: jest.fn().mockResolvedValue({
        symbol: 'BTCUSDT',
        bids: null,
        asks: [{ price: 1, quantity: 2, cumulative: 2 }],
      }),
      getWalls: jest.fn().mockResolvedValue({
        symbol: 'BTCUSDT',
        walls: null,
      }),
      getFundingRate: jest.fn().mockResolvedValue({
        symbol: 'BTCUSDT',
        current: 0.01,
        predicted: Number.NaN,
      }),
      getVolumeProfile: jest.fn().mockResolvedValue({
        symbol: 'BTCUSDT',
        levels: ['100'],
        volumes: null,
      }),
    });

    await expect(bridge.getMarketData()).resolves.toEqual<WebApiMarketData>({
      currentPrice: 67890,
      priceChangePercent: 0,
    });
    await expect(bridge.getOrderBook('BTCUSDT')).resolves.toEqual<WebApiOrderBookView>({
      symbol: 'BTCUSDT',
      bids: [],
      asks: [{ price: 1, quantity: 2, cumulative: 2 }],
      timestamp: expect.any(Number),
    });
    await expect(bridge.getWalls('BTCUSDT')).resolves.toEqual<WebApiWallsView>({
      symbol: 'BTCUSDT',
      walls: [],
    });
    await expect(bridge.getFundingRate('BTCUSDT')).resolves.toEqual<WebApiFundingRateView>({
      symbol: 'BTCUSDT',
      current: 0.01,
      predicted: 0,
      nextFundingTime: 0,
      lastFundingTime: 0,
    });
    await expect(bridge.getVolumeProfile('BTCUSDT', 20)).resolves.toEqual<WebApiVolumeProfileView>({
      symbol: 'BTCUSDT',
      levels: ['100'],
      volumes: [],
      maxVolume: 0,
    });
  });

  test('forwards normalized bot events and caches recent signals', () => {
    const bot = new TestBot();
    const bridge = new BotBridgeService(bot);
    const messages: Array<{ type: string; payload: unknown }> = [];

    bridge.on('bot-event', (message) => {
      messages.push({ type: message.type, payload: message.payload });
    });

    bot.emit('signal', {
      id: 'sig-1',
      direction: 'LONG',
      type: 'breakout',
      confidence: 0.88,
      price: 101,
      stopLoss: 99,
      takeProfits: [{ price: 105, quantity: 0.5 }],
      reason: 'setup',
      timestamp: 111,
      marketData: { rsi: 55, ema20: 100 },
    });

    bot.emit('position-opened', {
      position: {
        id: 'pos-2',
        symbol: 'BTCUSDT',
        side: 'SHORT',
        quantity: 0.1,
        entryPrice: 100,
        leverage: 3,
        marginUsed: 10,
        unrealizedPnL: -1,
        stopLoss: { price: 103, isTrailing: true },
        takeProfits: [{ price: 95, percent: 100 }],
        openedAt: 222,
        status: 'OPEN',
      },
    });

    expect(messages).toEqual([
      {
        type: 'SIGNAL_NEW',
        payload: expect.objectContaining({
          id: 'sig-1',
          direction: 'LONG',
          type: 'breakout',
          marketData: { rsi: 55, ema20: 100 },
        }),
      },
      {
        type: 'SIGNAL_GENERATED',
        payload: {
          strategy: 'breakout',
          direction: 'LONG',
          confidence: 0.88,
        },
      },
      {
        type: 'POSITION_OPENED',
        payload: {
          position: {
            id: 'pos-2',
            symbol: 'BTCUSDT',
            side: 'SHORT',
            quantity: 0.1,
            entryPrice: 100,
            currentPrice: 100,
            leverage: 3,
            marginUsed: 10,
            unrealizedPnL: -1,
            unrealizedPnLPercent: -10,
            stopLoss: { price: 103, trailing: true },
            takeProfits: [{ price: 95, quantity: 100 }],
            openedAt: 222,
            status: 'OPEN',
          },
        },
      },
    ]);

    expect(bridge.getRecentSignals(10)).toEqual([
      expect.objectContaining({
        id: 'sig-1',
        direction: 'LONG',
        type: 'breakout',
      }),
    ]);
  });

  test('reuses the same position event normalization path for closed position payloads', () => {
    const bot = new TestBot();
    const bridge = new BotBridgeService(bot);
    const messages: Array<{ type: string; payload: unknown }> = [];

    bridge.on('bot-event', (message) => {
      messages.push({ type: message.type, payload: message.payload });
    });

    bot.emit('position-closed', {
      closedPosition: {
        id: 'pos-3',
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: 0.1,
        entryPrice: 100,
        leverage: 2,
        marginUsed: 10,
        unrealizedPnL: 3,
        stopLoss: { price: 98, isTrailing: false },
        takeProfits: [{ price: 104, percent: 100 }],
        openedAt: 333,
        status: 'CLOSED',
      },
    });

    expect(messages).toEqual([
      {
        type: 'POSITION_CLOSED',
        payload: {
          pnl: 3,
          exitType: undefined,
        },
      },
    ]);
  });

  test('logs a converged fallback message and returns stable read models when the adapter throws', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const bridge = new BotBridgeService(new TestBot(), {
      getMarketData: jest.fn().mockRejectedValue(new Error('market down')),
      getCandles: jest.fn().mockResolvedValue([]),
      getPositionHistory: jest.fn().mockResolvedValue([]),
      getOrderBook: jest.fn().mockResolvedValue({
        symbol: 'BTCUSDT',
        bids: [],
        asks: [],
        timestamp: 1,
      }),
      getWalls: jest.fn().mockResolvedValue({
        symbol: 'BTCUSDT',
        walls: [],
      }),
      getFundingRate: jest.fn().mockResolvedValue({
        symbol: 'BTCUSDT',
        current: 0,
        predicted: 0,
        nextFundingTime: 0,
        lastFundingTime: 0,
      }),
      getVolumeProfile: jest.fn().mockResolvedValue({
        symbol: 'BTCUSDT',
        levels: [],
        volumes: [],
        maxVolume: 0,
      }),
    });

    await expect(bridge.getMarketData()).resolves.toEqual<WebApiMarketData>({
      currentPrice: 0,
      priceChangePercent: 0,
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('[BotBridge] Read fallback', {
      operation: 'getMarketData',
      fallbackUsed: true,
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'market down',
      suggestion: 'Please try again or contact support',
    });

    consoleErrorSpy.mockRestore();
  });

  test('uses the same fallback log shape for status and direct balance reads', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const bot = new TestBot();
    jest.spyOn(bot, 'getBalance').mockRejectedValue(new Error('balance down'));
    const bridge = new BotBridgeService(bot);

    await bridge.getStatus();
    await bridge.getBalance();

    expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, '[BotBridge] Read fallback', {
      operation: 'getBalance',
      fallbackUsed: true,
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'balance down',
      suggestion: 'Please try again or contact support',
    });
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, '[BotBridge] Read fallback', {
      operation: 'getBalance',
      fallbackUsed: true,
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'balance down',
      suggestion: 'Please try again or contact support',
    });

    consoleErrorSpy.mockRestore();
  });

  test('emits the same fallback-backed status shape for bot status change events', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const bot = new TestBot();
    bot.isRunning = true;
    jest.spyOn(bot, 'getBalance').mockRejectedValue(new Error('balance down'));
    const bridge = new BotBridgeService(bot);
    const botEvents: Array<{ type: string; payload: unknown }> = [];

    bridge.on('bot-event', (message) => {
      botEvents.push({ type: message.type, payload: message.payload });
    });

    bot.emit('bot-started', true);
    await new Promise((resolve) => setImmediate(resolve));

    expect(botEvents).toEqual([
      {
        type: 'BOT_STATUS_CHANGE',
        payload: {
          isRunning: true,
          currentPosition: null,
          balance: 0,
          unrealizedPnL: 0,
          timestamp: expect.any(Number),
          error: 'balance down',
        },
      },
    ]);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[BotBridge] Read fallback', {
      operation: 'getBalance',
      fallbackUsed: true,
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'balance down',
      suggestion: 'Please try again or contact support',
    });

    consoleErrorSpy.mockRestore();
  });

  test('reuses the shared error normalization path for forwarded bot errors and start/stop failures', async () => {
    const bot = new TestBot();
    const bridge = new BotBridgeService(bot);
    const botEvents: Array<{ type: string; payload: unknown }> = [];

    bridge.on('bot-event', (message) => {
      botEvents.push({ type: message.type, payload: message.payload });
    });

    bot.emit('error', new Error('forwarded failure'));
    bot.emit('error', {
      code: 'POSITION_READ_FAILED',
      message: 'structured forwarded failure',
      details: 'bridge snapshot unavailable',
    });

    jest.spyOn(bot, 'start').mockRejectedValue(new Error('start failed'));
    await bridge.startBot();

    bot.isRunning = true;
    jest.spyOn(bot, 'stop').mockImplementation(() => {
      throw new Error('stop failed');
    });
    bridge.stopBot();

    expect(botEvents).toEqual([
      {
        type: 'ERROR',
        payload: {
          error: 'forwarded failure',
          details: expect.stringContaining('forwarded failure'),
        },
      },
      {
        type: 'ERROR',
        payload: {
          error: 'structured forwarded failure',
          code: 'POSITION_READ_FAILED',
          details: 'bridge snapshot unavailable',
        },
      },
      {
        type: 'ERROR',
        payload: {
          error: 'start failed',
        },
      },
      {
        type: 'ERROR',
        payload: {
          error: 'stop failed',
        },
      },
    ]);
  });

  test('preserves structured action failure payloads that expose only an error field', async () => {
    const bot = new TestBot();
    bot.isRunning = false;
    const bridge = new BotBridgeService(bot);
    const botEvents: Array<{ type: string; payload: unknown }> = [];

    bridge.on('bot-event', (message) => {
      botEvents.push({ type: message.type, payload: message.payload });
    });

    jest.spyOn(bot, 'start').mockRejectedValue({
      code: 'BOT_START_FAILED',
      error: 'Start blocked by exchange',
      details: 'Exchange credentials missing',
    });
    await bridge.startBot();

    bot.isRunning = true;
    jest.spyOn(bot, 'stop').mockImplementation(() => {
      throw {
        code: 'BOT_STOP_FAILED',
        error: 'Stop blocked by exchange',
        details: 'Open orders must be cancelled first',
      };
    });
    bridge.stopBot();

    expect(botEvents).toEqual([
      {
        type: 'ERROR',
        payload: {
          error: 'Start blocked by exchange',
          details: 'Exchange credentials missing',
        },
      },
      {
        type: 'ERROR',
        payload: {
          error: 'Stop blocked by exchange',
          details: 'Open orders must be cancelled first',
        },
      },
    ]);
  });
});
