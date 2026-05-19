import { EventEmitter } from 'events';
import { BotBridgeService, type IBotInstance } from '../src/services/bot-bridge.service';

class TestBot extends EventEmitter implements IBotInstance {
  public isRunning = false;
  public currentPosition: unknown = null;
  public balance = 0;

  getCurrentPosition() {
    return this.currentPosition as ReturnType<IBotInstance['getCurrentPosition']>;
  }

  async getBalance(): Promise<number> {
    return this.balance;
  }

  async start(): Promise<void> {
    this.isRunning = true;
  }

  stop(): void {
    this.isRunning = false;
  }
}

describe('BotBridgeService', () => {
  test('normalizes current position snapshots for status and direct reads', async () => {
    const bot = new TestBot();
    bot.isRunning = true;
    bot.balance = 1250;
    bot.currentPosition = {
      id: 'pos-1',
      symbol: 'BTCUSDT',
      side: 'LONG',
      quantity: 0.25,
      entryPrice: 100,
      leverage: 5,
      marginUsed: 20,
      unrealizedPnL: 4,
      stopLoss: 95,
      takeProfits: [{ price: 110, sizePercent: 50, hit: true }],
      openedAt: 123456,
    };

    const bridge = new BotBridgeService(bot);

    expect(bridge.getPosition()).toEqual({
      id: 'pos-1',
      symbol: 'BTCUSDT',
      side: 'LONG',
      quantity: 0.25,
      entryPrice: 100,
      currentPrice: 100,
      leverage: 5,
      marginUsed: 20,
      unrealizedPnL: 4,
      unrealizedPnLPercent: 20,
      stopLoss: { price: 95 },
      takeProfits: [{ price: 110, quantity: 50, hit: true }],
      openedAt: 123456,
      status: 'OPEN',
    });

    await expect(bridge.getStatus()).resolves.toEqual({
      isRunning: true,
      currentPosition: {
        id: 'pos-1',
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: 0.25,
        entryPrice: 100,
        currentPrice: 100,
        leverage: 5,
        marginUsed: 20,
        unrealizedPnL: 4,
        unrealizedPnLPercent: 20,
        stopLoss: { price: 95 },
        takeProfits: [{ price: 110, quantity: 50, hit: true }],
        openedAt: 123456,
        status: 'OPEN',
      },
      balance: 1250,
      unrealizedPnL: 4,
      timestamp: expect.any(Number),
    });
  });

  test('falls back to empty status payload when balance read fails', async () => {
    const bot = new TestBot();
    bot.isRunning = true;
    jest.spyOn(bot, 'getBalance').mockRejectedValue(new Error('balance failed'));

    const bridge = new BotBridgeService(bot);

    await expect(bridge.getStatus()).resolves.toEqual({
      isRunning: true,
      currentPosition: null,
      balance: 0,
      unrealizedPnL: 0,
      timestamp: expect.any(Number),
      error: 'balance failed',
    });
  });

  test('preserves the normalized position snapshot when status balance fallback is used', async () => {
    const bot = new TestBot();
    bot.isRunning = true;
    bot.currentPosition = {
      id: 'pos-2',
      symbol: 'ETHUSDT',
      side: 'SHORT',
      quantity: 1,
      entryPrice: 2500,
      leverage: 2,
      marginUsed: 1250,
      unrealizedPnL: -25,
      stopLoss: 2600,
      takeProfits: [{ price: 2400, quantity: 1 }],
      openedAt: 456789,
      status: 'OPEN',
    };
    jest.spyOn(bot, 'getBalance').mockRejectedValue(new Error('balance failed'));

    const bridge = new BotBridgeService(bot);

    await expect(bridge.getStatus()).resolves.toEqual({
      isRunning: true,
      currentPosition: {
        id: 'pos-2',
        symbol: 'ETHUSDT',
        side: 'SHORT',
        quantity: 1,
        entryPrice: 2500,
        currentPrice: 2500,
        leverage: 2,
        marginUsed: 1250,
        unrealizedPnL: -25,
        unrealizedPnLPercent: -2,
        stopLoss: { price: 2600 },
        takeProfits: [{ price: 2400, quantity: 1 }],
        openedAt: 456789,
        status: 'OPEN',
      },
      balance: 0,
      unrealizedPnL: -25,
      timestamp: expect.any(Number),
      error: 'balance failed',
    });
  });
});
