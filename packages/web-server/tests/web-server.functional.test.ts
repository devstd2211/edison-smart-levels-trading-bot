import { EventEmitter } from 'events';
import express from 'express';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import request from 'supertest';
import type {
  EquityCurvePoint,
  JournalPagePayload,
  JournalStatsPayload,
  SessionComparisonPayload,
  StrategyPerformancePayload,
  WebApiCandle,
  WebApiFundingRateView,
  WebApiJournalEntry,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiPositionHistoryEntry,
  WebApiSessionStats,
  WebApiVolumeProfileView,
  WebApiWallsView,
} from '@edison/contracts';
import { WebServer, type IBotInstance, type IWebApiAdapter } from '../src/index';
import { createErrorHandlerMiddleware } from '../src/middleware/error-handler.middleware';
import { createRateLimitMiddleware } from '../src/middleware/rate-limit.middleware';
import { createAnalyticsRoutes } from '../src/routes/analytics.routes';
import { createConfigRoutes } from '../src/routes/config.routes';
import { FileWatcherService } from '../src/services/file-watcher.service';
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

  it('serves config schema and history through the shared typed config boundary', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edison-config-routes-'));
    const configPath = path.join(tempDir, 'config.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({
        exchange: { symbol: 'BTCUSDT' },
        trading: { leverage: 5 },
        risk: { maxLeverage: 5, stopLossPercent: 1.5 },
      }, null, 2),
      'utf-8',
    );

    const app = express();
    app.use(express.json());
    app.use('/api/config', createConfigRoutes(configPath));

    const updateResponse = await request(app)
      .put('/api/config')
      .send({
        exchange: { symbol: 'ETHUSDT' },
        trading: { leverage: 3 },
        risk: { maxLeverage: 3, takeProfitPercent: 2.5 },
      })
      .expect(200);

    expect(updateResponse.body.data.requiresRestart).toBe(true);
    expect(updateResponse.body.data.backupPath).toContain('config.json.backup.');

    const schemaResponse = await request(app)
      .get('/api/config/schema')
      .expect(200);

    expect(schemaResponse.body.data.sections.risk.fields[0]).toEqual({
      name: 'maxLeverage',
      type: 'number',
      label: 'Max Leverage',
    });

    const historyResponse = await request(app)
      .get('/api/config/history')
      .expect(200);

    expect(historyResponse.body.data.count).toBe(1);
    expect(historyResponse.body.data.backups[0].filename).toContain('config.json.backup.');
  });

  it('returns structured route-level errors for bot lifecycle conflicts', async () => {
    const response = await request(server.getApp())
      .post('/api/bot/start')
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Bot is already running',
        details: undefined,
        suggestion: undefined,
      },
      timestamp: expect.any(Number),
      requestId: undefined,
    });
  });

  it('returns structured validation errors from config routes', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edison-config-errors-'));
    const configPath = path.join(tempDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify({ exchange: { symbol: 'BTCUSDT' } }, null, 2), 'utf-8');

    const app = express();
    app.use(express.json());
    app.use('/api/config', createConfigRoutes(configPath));
    app.use(createErrorHandlerMiddleware());

    const response = await request(app)
      .post('/api/config/validate')
      .send({})
      .expect(400);

    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(response.body.error.message).toBe('No config provided for validation');
    expect(response.body.error.suggestion).toBeUndefined();
  });

  it('returns structured parse errors for invalid JSON bodies', async () => {
    const response = await request(server.getApp())
      .post('/api/config/validate')
      .set('Content-Type', 'application/json')
      .send('{"config":')
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_JSON');
    expect(response.body.error.message).toBe('Invalid JSON in request body');
    expect(response.body.error.suggestion).toBe('Ensure request body contains valid JSON');
  });

  it('returns structured rate-limit errors with retry metadata', async () => {
    const app = express();
    app.use(createRateLimitMiddleware({
      whitelist: [],
      maxRequests: 0,
      windowMs: 1000,
      message: 'Slow down',
    }));
    app.get('/limited', (_req, res) => {
      res.json({ ok: true });
    });

    const response = await request(app)
      .get('/limited')
      .set('x-request-id', 'req-429')
      .expect(429);

    expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(response.body.error.message).toBe('Slow down');
    expect(response.body.error.details).toContain('Exceeded 0 requests in 1000ms');
    expect(response.body.requestId).toBe('req-429');
    expect(response.body.retryAfter).toBe(1000);
  });

  it('serves typed analytics payloads across journal, sessions, strategy, and curve endpoints', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edison-analytics-routes-'));
    const journalPath = path.join(tempDir, 'trade-journal.json');
    const sessionsPath = path.join(tempDir, 'session-stats.json');
    const journal: WebApiJournalEntry[] = [
      {
        id: 'trade-1',
        timestamp: 1715000000000,
        direction: 'LONG',
        entryPrice: 100,
        exitPrice: 110,
        quantity: 1,
        pnl: 10,
        pnlPercent: 10,
        strategy: 'Breakout',
        exitReason: 'TP1',
      },
      {
        id: 'trade-2',
        timestamp: 1715003600000,
        direction: 'SHORT',
        entryPrice: 110,
        exitPrice: 115,
        quantity: 1,
        pnl: -5,
        pnlPercent: -4.54,
        strategy: 'Fade',
        exitReason: 'SL',
      },
    ];
    const sessions: WebApiSessionStats[] = [
      {
        sessionId: 'session-a',
        startTime: 1714990000000,
        endTime: 1714997200000,
        trades: [journal[0]],
        totalPnL: 10,
        winRate: 100,
        winCount: 1,
        lossCount: 0,
        totalTrades: 1,
      },
      {
        sessionId: 'session-b',
        startTime: 1715000000000,
        endTime: 1715007200000,
        trades: [journal[1]],
        totalPnL: -5,
        winRate: 0,
        winCount: 0,
        lossCount: 1,
        totalTrades: 1,
      },
    ];

    await fs.writeFile(journalPath, JSON.stringify(journal, null, 2), 'utf-8');
    await fs.writeFile(sessionsPath, JSON.stringify({ sessions }, null, 2), 'utf-8');

    const app = express();
    app.use('/api/analytics', createAnalyticsRoutes(new FileWatcherService(journalPath, sessionsPath)));

    const journalResponse = await request(app)
      .get('/api/analytics/journal?page=1&limit=1')
      .expect(200);
    const journalPayload = journalResponse.body.data as JournalPagePayload;
    expect(journalPayload.total).toBe(2);
    expect(journalPayload.entries[0].id).toBe('trade-1');

    const statsResponse = await request(app)
      .get('/api/analytics/journal/stats')
      .expect(200);
    const statsPayload = statsResponse.body.data as JournalStatsPayload;
    expect(statsPayload.totalPnL).toBe(5);
    expect(statsPayload.winRate).toBe(50);

    const sessionsResponse = await request(app)
      .get('/api/analytics/sessions')
      .expect(200);
    expect((sessionsResponse.body.data as WebApiSessionStats[])).toHaveLength(2);

    const compareResponse = await request(app)
      .get('/api/analytics/sessions/compare?id1=session-a&id2=session-b')
      .expect(200);
    const comparePayload = compareResponse.body.data as SessionComparisonPayload;
    expect(comparePayload.comparison.pnlDiff).toBe(-15);

    const strategyResponse = await request(app)
      .get('/api/analytics/strategy-performance')
      .expect(200);
    const strategyPayload = strategyResponse.body.data as StrategyPerformancePayload[];
    expect(strategyPayload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ strategy: 'Breakout', totalPnL: 10 }),
        expect.objectContaining({ strategy: 'Fade', totalPnL: -5 }),
      ]),
    );

    const pnlHistoryResponse = await request(app)
      .get('/api/analytics/pnl-history')
      .expect(200);
    expect(pnlHistoryResponse.body.data).toEqual([
      expect.objectContaining({ timestamp: journal[0].timestamp, cumulativePnL: 10, tradeNumber: 1 }),
      expect.objectContaining({ timestamp: journal[1].timestamp, cumulativePnL: 5, tradeNumber: 2 }),
    ]);

    const equityCurveResponse = await request(app)
      .get('/api/analytics/equity-curve')
      .expect(200);
    const equityCurvePayload = equityCurveResponse.body.data as EquityCurvePoint[];
    expect(equityCurvePayload[0].equity).toBe(1010);
    expect(equityCurvePayload[1].drawdown).toBeCloseTo(0.5);
  });
});
