import express from 'express';
import request from 'supertest';
import { EventEmitter } from 'events';
import type { Position } from '@edison/contracts/runtime-api';
import { BotBridgeService, type IBotInstance } from '../src/services/bot-bridge.service';
import { createDataRouteReadApi, createDataRoutes } from '../src/routes/data.routes';

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
  test('createDataRouteReadApi shapes bridge reads into stable route payloads', async () => {
    const routeApi = createDataRouteReadApi({
      getPosition: () => null,
      getBalance: async () => 1000,
      getMarketData: async () => ({ currentPrice: 101, priceChangePercent: -0.5 }),
      getRecentSignals: (limit = 0) => Array.from({ length: limit }, (_, index) => ({
        id: `signal-${index + 1}`,
        direction: 'LONG' as const,
        type: 'trend',
        confidence: 80,
        price: 100 + index,
        stopLoss: 90,
        takeProfits: [],
        timestamp: index + 1,
      })),
      getCandles: async () => [{ open: 1, high: 2, low: 0.5, close: 1.5, timestamp: 1 }],
      getPositionHistory: async () => [{ side: 'LONG', entryPrice: 100, entryTime: 1, pnl: 5, quantity: 1 }],
      getOrderBook: async (symbol) => ({ symbol, bids: [], asks: [], timestamp: 1 }),
      getWalls: async (symbol) => ({ symbol, walls: [] }),
      getFundingRate: async (symbol) => ({ symbol, current: 0.1, predicted: 0.2, nextFundingTime: 1, lastFundingTime: 0 }),
      getVolumeProfile: async (symbol) => ({ symbol, levels: [], volumes: [], maxVolume: 0 }),
    });

    await expect(routeApi.getBalance()).resolves.toEqual({ balance: 1000 });
    expect(routeApi.getRecentSignals(2)).toEqual({
      signals: [
        {
          id: 'signal-1',
          direction: 'LONG',
          type: 'trend',
          confidence: 80,
          price: 100,
          stopLoss: 90,
          takeProfits: [],
          timestamp: 1,
        },
        {
          id: 'signal-2',
          direction: 'LONG',
          type: 'trend',
          confidence: 80,
          price: 101,
          stopLoss: 90,
          takeProfits: [],
          timestamp: 2,
        },
      ],
      count: 2,
    });
    await expect(routeApi.getCandles('5m', 10)).resolves.toEqual({
      candles: [{ open: 1, high: 2, low: 0.5, close: 1.5, timestamp: 1 }],
    });
    await expect(routeApi.getPositionHistory(10)).resolves.toEqual({
      positions: [{ side: 'LONG', entryPrice: 100, entryTime: 1, pnl: 5, quantity: 1 }],
    });
  });

  test('reuses the bridge position read helper for http position reads', async () => {
    const bridge = new BotBridgeService(new TestBot());
    const positionSpy = jest.spyOn(bridge, 'getPosition');
    const app = express();

    app.use('/api/data', createDataRoutes(createDataRouteReadApi(bridge)));

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

    app.use('/api/data', createDataRoutes(createDataRouteReadApi(bridge)));

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

  test('reuses route payload shaping for balance, candles, and position history reads', async () => {
    const bridge = new BotBridgeService(new TestBot());
    jest.spyOn(bridge, 'getCandles').mockResolvedValue([
      { open: 1, high: 2, low: 0.5, close: 1.5, timestamp: 1 },
    ]);
    jest.spyOn(bridge, 'getPositionHistory').mockResolvedValue([
      { side: 'LONG', entryPrice: 100, entryTime: 1, pnl: 5, quantity: 1 },
    ]);
    const app = express();

    app.use('/api/data', createDataRoutes(createDataRouteReadApi(bridge)));

    await expect(request(app).get('/api/data/balance')).resolves.toMatchObject({
      body: {
        success: true,
        data: { balance: 1000 },
        timestamp: expect.any(Number),
      },
    });

    await expect(request(app).get('/api/data/candles?timeframe=5m&limit=10')).resolves.toMatchObject({
      body: {
        success: true,
        data: {
          candles: [{ open: 1, high: 2, low: 0.5, close: 1.5, timestamp: 1 }],
        },
        timestamp: expect.any(Number),
      },
    });

    await expect(request(app).get('/api/data/positions/history?limit=10')).resolves.toMatchObject({
      body: {
        success: true,
        data: {
          positions: [{ side: 'LONG', entryPrice: 100, entryTime: 1, pnl: 5, quantity: 1 }],
        },
        timestamp: expect.any(Number),
      },
    });
  });
});
