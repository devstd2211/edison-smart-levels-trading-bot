import { EventEmitter } from 'events';
import request from 'supertest';
import type {
  WebApiCandle,
  WebApiFundingRateView,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiPositionHistoryEntry,
  WebApiVolumeProfileView,
  WebApiWallsView,
} from '@edison/contracts';
import { WebServer, type IBotInstance, type IWebApiAdapter } from '../src/index';
import { swaggerConfig } from '../src/swagger.config';

class TestBot extends EventEmitter implements IBotInstance {
  isRunning = true;

  getCurrentPosition() {
    return null;
  }

  async getBalance(): Promise<number> {
    return 1250;
  }

  async start(): Promise<void> {
    this.isRunning = true;
  }

  stop(): void {
    this.isRunning = false;
  }
}

function createWebApiAdapter(): jest.Mocked<IWebApiAdapter> {
  const marketData: WebApiMarketData = {
    currentPrice: 67890,
    priceChangePercent: 1.25,
  };
  const candles: WebApiCandle[] = [
    { timestamp: 1, open: 10, high: 12, low: 9, close: 11, volume: 100 },
  ];
  const positions: WebApiPositionHistoryEntry[] = [];
  const orderBook: WebApiOrderBookView = {
    symbol: 'BTCUSDT',
    bids: [{ price: 67880, quantity: 1, cumulative: 1 }],
    asks: [{ price: 67900, quantity: 2, cumulative: 2 }],
    timestamp: 123,
  };
  const walls: WebApiWallsView = { symbol: 'BTCUSDT', walls: [] };
  const fundingRate: WebApiFundingRateView = {
    symbol: 'BTCUSDT',
    current: 0.01,
    predicted: 0.02,
    nextFundingTime: 1000,
    lastFundingTime: 500,
  };
  const volumeProfile: WebApiVolumeProfileView = {
    symbol: 'BTCUSDT',
    levels: ['67000', '68000'],
    volumes: [10, 20],
    maxVolume: 20,
  };

  return {
    getMarketData: jest.fn().mockResolvedValue(marketData),
    getCandles: jest.fn().mockResolvedValue(candles),
    getPositionHistory: jest.fn().mockResolvedValue(positions),
    getOrderBook: jest.fn().mockResolvedValue(orderBook),
    getWalls: jest.fn().mockResolvedValue(walls),
    getFundingRate: jest.fn().mockResolvedValue(fundingRate),
    getVolumeProfile: jest.fn().mockResolvedValue(volumeProfile),
  };
}

describe('WebServer functional', () => {
  let server: WebServer;
  let webApiAdapter: jest.Mocked<IWebApiAdapter>;
  let bot: TestBot;

  beforeEach(() => {
    webApiAdapter = createWebApiAdapter();
    bot = new TestBot();
    server = new WebServer(bot, { apiPort: 4310, wsPort: 4311 }, webApiAdapter);
  });

  afterEach(() => {
    server.close();
  });

  it('returns health state from the bridge', async () => {
    const response = await request(server.getApp())
      .get('/health')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.botRunning).toBe(true);
  });

  it('serves the OpenAPI document', async () => {
    const response = await request(server.getApp())
      .get('/api/docs/openapi.json')
      .expect(200);

    expect(response.body.openapi).toBe(swaggerConfig.openapi);
    expect(response.body.paths).toEqual(swaggerConfig.paths);
    expect(response.body.components.schemas.StructuredApiErrorResponse).toBeDefined();
    expect(response.body.paths['/api/bot/start'].post.responses['200'].content['application/json'].schema.properties.data.$ref)
      .toBe('#/components/schemas/ApiMessageResponse');
    expect(response.body.paths['/api/config/server'].get.responses['200'].content['application/json'].schema.properties.data.$ref)
      .toBe('#/components/schemas/ServerRuntimeConfigPayload');
    expect(response.body.paths['/api/config/validate'].post.responses['400'].content['application/json'].schema.$ref)
      .toBe('#/components/schemas/StructuredApiErrorResponse');
  });

  it('reports configured runtime ports through the config boundary', async () => {
    const response = await request(server.getApp())
      .get('/api/config/server')
      .expect(200);

    expect(response.body.data.api.port).toBe(4310);
    expect(response.body.data.websocket.port).toBe(4311);
  });

  it('reads market data through the web API adapter', async () => {
    const response = await request(server.getApp())
      .get('/api/data/market')
      .expect(200);

    expect(webApiAdapter.getMarketData).toHaveBeenCalledTimes(1);
    expect(response.body.data).toEqual({
      currentPrice: 67890,
      priceChangePercent: 1.25,
    });
  });

  it('reads order book snapshots through the web API adapter', async () => {
    const response = await request(server.getApp())
      .get('/api/data/orderbook/BTCUSDT')
      .expect(200);

    expect(webApiAdapter.getOrderBook).toHaveBeenCalledWith('BTCUSDT');
    expect(response.body.data.symbol).toBe('BTCUSDT');
    expect(response.body.data.bids).toHaveLength(1);
    expect(response.body.timestamp).toEqual(expect.any(Number));
  });

  it('returns timestamped command responses for bot lifecycle routes', async () => {
    bot.isRunning = false;

    const startResponse = await request(server.getApp())
      .post('/api/bot/start')
      .expect(200);

    expect(startResponse.body).toEqual({
      success: true,
      data: { message: 'Bot started successfully' },
      timestamp: expect.any(Number),
    });

    const stopResponse = await request(server.getApp())
      .post('/api/bot/stop')
      .expect(200);

    expect(stopResponse.body).toEqual({
      success: true,
      data: { message: 'Bot stopped successfully' },
      timestamp: expect.any(Number),
    });
  });

  it('caps recent signals limits and keeps the shared api envelope', async () => {
    for (let index = 0; index < 120; index += 1) {
      bot.emit('signal', {
        id: `sig-${index}`,
        direction: 'LONG',
        type: 'breakout',
        confidence: 0.8,
        price: 100 + index,
        stopLoss: 90,
        takeProfits: [{ price: 110, quantity: 1 }],
        reason: 'setup',
        timestamp: index + 1,
      });
    }

    const response = await request(server.getApp())
      .get('/api/data/signals/recent?limit=999')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.timestamp).toEqual(expect.any(Number));
    expect(response.body.data.count).toBe(50);
    expect(response.body.data.signals).toHaveLength(50);
  });
});
