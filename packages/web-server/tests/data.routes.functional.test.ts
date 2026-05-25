import express from 'express';
import request from 'supertest';
import { EventEmitter } from 'events';
import type { Position } from '@edison/contracts/runtime-api';
import { BotBridgeService, type IBotInstance } from '../src/services/bot-bridge.service';
import { createDataRoutes } from '../src/routes/data.routes';

class TestBot extends EventEmitter implements IBotInstance {
  isRunning = true;
  currentPosition: Position | null = {
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

describe('data routes functional boundary', () => {
  test('reuses the bridge position read helper for http position reads', async () => {
    const bridge = new BotBridgeService(new TestBot());
    const positionSpy = jest.spyOn(bridge, 'getPosition');
    const app = express();

    app.use('/api/data', createDataRoutes(bridge));

    const response = await request(app)
      .get('/api/data/position')
      .expect(200);

    expect(positionSpy).toHaveBeenCalledWith();
    expect(response.body).toEqual({
      success: true,
      data: {
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
      timestamp: expect.any(Number),
    });
  });

  test('preserves the normalized request id in successful data route envelopes', async () => {
    const bridge = new BotBridgeService(new TestBot());
    const marketDataSpy = jest.spyOn(bridge, 'getMarketData').mockResolvedValue({
      currentPrice: 67890,
      priceChangePercent: 1.25,
    });
    const app = express();

    app.use('/api/data', createDataRoutes(bridge));

    const response = await request(app)
      .get('/api/data/market')
      .set('x-request-id', 'req-market')
      .expect(200);

    expect(marketDataSpy).toHaveBeenCalledTimes(1);
    expect(response.body).toEqual({
      success: true,
      data: {
        currentPrice: 67890,
        priceChangePercent: 1.25,
      },
      timestamp: expect.any(Number),
      requestId: 'req-market',
    });
  });
});
