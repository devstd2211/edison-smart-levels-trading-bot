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
} from '@edison/contracts/runtime-api';
import type {
  WebApiCandle,
  WebApiFundingRateView,
  WebApiJournalEntry,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiPositionHistoryEntry,
  WebApiSessionStats,
  WebApiVolumeProfileView,
  WebApiWallsView,
} from '@edison/contracts/web-api';
import { WebServer, type IBotInstance, type IWebApiAdapter } from '../src/index';
import { createErrorHandlerMiddleware } from '../src/middleware/error-handler.middleware';
import { createRateLimitMiddleware } from '../src/middleware/rate-limit.middleware';
import {
  createAnalyticsRouteReadApi,
  createAnalyticsRoutes,
  type AnalyticsRouteReadApi,
} from '../src/routes/analytics.routes';
import {
  createConfigRouteApi,
  createConfigRoutes,
  type ConfigRouteApi,
} from '../src/routes/config.routes';
import { ConfigManagementService } from '../src/services/config-management.service';
import { FileWatcherService } from '../src/services/file-watcher.service';
import { swaggerConfig } from '../src/swagger.config';
import { WebSocketService } from '../src/websocket/ws-server';

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

function createConfigRouteApiMock(): jest.Mocked<ConfigRouteApi> {
  return {
    read: jest.fn().mockResolvedValue({ exchange: { symbol: 'BTCUSDT' } }),
    write: jest.fn().mockResolvedValue({
      message: 'updated',
      backupPath: 'backup.json',
      requiresRestart: true,
      config: { exchange: { symbol: 'ETHUSDT' } },
      validation: {
        valid: true,
        errors: [],
        warnings: [],
        summary: { errorCount: 0, warningCount: 0, issueCount: 0 },
      },
      preview: {
        changes: [],
        summary: { addedCount: 0, updatedCount: 0, removedCount: 0, totalChanges: 0 },
      },
    }),
    getStrategySummaries: jest.fn().mockResolvedValue({ strategies: [], total: 0, active: 0 }),
    updateStrategyToggle: jest.fn().mockResolvedValue({
      strategy: 'breakout',
      enabled: false,
      message: 'Strategy breakout disabled',
    }),
    updateRiskSettings: jest.fn().mockResolvedValue({
      message: 'Risk settings updated successfully',
      risk: { maxLeverage: 2 },
    }),
    preview: jest.fn().mockResolvedValue({
      changes: [],
      summary: { addedCount: 0, updatedCount: 0, removedCount: 0, totalChanges: 0 },
      validation: {
        valid: true,
        errors: [],
        warnings: [],
        summary: { errorCount: 0, warningCount: 0, issueCount: 0 },
      },
    }),
    validate: jest.fn().mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
      summary: { errorCount: 0, warningCount: 0, issueCount: 0 },
    }),
    getBackupCollection: jest.fn().mockResolvedValue({ backups: [], count: 0 }),
    restore: jest.fn().mockResolvedValue({
      success: true,
      restoredBackup: { id: 'backup-1', filename: 'config.json.backup.1', path: 'backup-1', createdAt: Date.now() },
      preRestoreBackupPath: 'backup-before-restore',
      requiresRestart: true,
    }),
    cleanupOldBackups: jest.fn().mockResolvedValue({
      deleted: 0,
      remainingBackups: 0,
      totalBackups: 0,
      message: 'Deleted 0 old backup(s)',
    }),
    getSchema: jest.fn().mockReturnValue({ sections: {} }),
    getHistory: jest.fn().mockResolvedValue({ backups: [], count: 0 }),
  };
}

function createAnalyticsRouteReadApiMock(): jest.Mocked<AnalyticsRouteReadApi> {
  return {
    getJournalPaginated: jest.fn().mockResolvedValue({
      entries: [],
      total: 0,
      page: 2,
      limit: 20,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    }),
    getJournalFromLastHours: jest.fn().mockResolvedValue([]),
    getJournalStats: jest.fn().mockResolvedValue({
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnL: 0,
      averagePnL: 0,
      bestTrade: 0,
      worstTrade: 0,
      currentStreak: 0,
      longestWinStreak: 0,
      longestLossStreak: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
    }),
    readSessions: jest.fn().mockResolvedValue([]),
    compareSessions: jest.fn().mockResolvedValue({
      session1: { sessionId: 'a', totalPnL: 10, totalTrades: 1, winRate: 100, duration: 60 * 1000 },
      session2: { sessionId: 'b', totalPnL: 5, totalTrades: 1, winRate: 0, duration: 60 * 1000 },
      comparison: { pnlDiff: -5, tradeCountDiff: 0, winRateDiff: -100, durationDiff: 0 },
    }),
    getStrategyPerformance: jest.fn().mockResolvedValue([]),
    getPnlHistory: jest.fn().mockResolvedValue([
      {
        time: new Date(1000).toISOString(),
        timestamp: 1000,
        pnl: 10,
        cumulativePnL: 10,
        tradeNumber: 1,
      },
    ]),
    getEquityCurve: jest.fn().mockResolvedValue([
      {
        time: new Date(1000).toISOString(),
        timestamp: 1000,
        equity: 1010,
        pnl: 10,
        tradeNumber: 1,
        drawdown: 1,
      },
    ]),
    readJournal: jest.fn().mockResolvedValue([
      {
        id: 'trade-1',
        timestamp: 1000,
        direction: 'LONG',
        entryPrice: 100,
        exitPrice: 110,
        quantity: 1,
        pnl: 10,
        pnlPercent: 10,
        strategy: 'Breakout',
        exitReason: 'TP1',
      },
    ]),
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
    expect(response.body.servers).toEqual(swaggerConfig.servers);
    expect(response.body.paths).toEqual(swaggerConfig.paths);
    expect(response.body.components.schemas.StructuredApiErrorResponse).toBeDefined();
    expect(response.body.paths['/api/bot/start'].post.responses['200'].content['application/json'].schema.properties.data.$ref)
      .toBe('#/components/schemas/ApiMessageResponse');
    expect(response.body.paths['/api/config'].get.responses['200'].content['application/json'].schema.properties.data.$ref)
      .toBe('#/components/schemas/ConfigReadResponsePayload');
    expect(response.body.paths['/api/config'].put.requestBody.content['application/json'].schema.$ref)
      .toBe('#/components/schemas/ConfigUpdateRequestPayload');
    expect(response.body.paths['/api/config/server'].get.responses['200'].content['application/json'].schema.properties.data.$ref)
      .toBe('#/components/schemas/ConfigServerRuntimeResponsePayload');
    expect(response.body.paths['/api/config/validate'].post.responses['400'].content['application/json'].schema.$ref)
      .toBe('#/components/schemas/StructuredApiErrorResponse');
    expect(response.body.paths['/api/data/orderbook/{symbol}'].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'symbol', in: 'path', required: true }),
      ]),
    );
    expect(response.body.paths['/api/data/volume-profile/{symbol}'].get.responses['200'].content['application/json'].schema.properties.data.$ref)
      .toBe('#/components/schemas/WebApiVolumeProfileView');
    expect(response.body.paths['/api/config/strategies/{id}'].patch.requestBody.content['application/json'].schema.$ref)
      .toBe('#/components/schemas/StrategyToggleRequestPayload');
    expect(response.body.paths['/api/config/validate'].post.requestBody.content['application/json'].schema.$ref)
      .toBe('#/components/schemas/ConfigValidationRequestPayload');
    expect(response.body.paths['/api/config/preview'].post.requestBody.content['application/json'].schema.$ref)
      .toBe('#/components/schemas/ConfigMutationPreviewRequestPayload');
    expect(response.body.paths['/api/config/preview'].post.responses['200'].content['application/json'].schema.properties.data.$ref)
      .toBe('#/components/schemas/ConfigMutationPreviewPayload');
    expect(response.body.paths['/api/config/risk'].patch.responses['200'].content['application/json'].schema.properties.data.$ref)
      .toBe('#/components/schemas/RiskUpdateResponsePayload');
    expect(response.body.paths['/api/config/schema'].get.responses['200'].content['application/json'].schema.properties.data.$ref)
      .toBe('#/components/schemas/ConfigSchemaPayload');
    expect(response.body.paths['/api/config/history'].get.responses['200'].content['application/json'].schema.properties.data.$ref)
      .toBe('#/components/schemas/ConfigHistoryResponsePayload');
    expect(response.body.paths['/api/config/cleanup'].post.requestBody.content['application/json'].schema.$ref)
      .toBe('#/components/schemas/ConfigCleanupRequestPayload');
    expect(response.body.paths['/api/analytics/journal/last24h'].get.responses['200'].content['application/json'].schema.properties.data.$ref)
      .toBe('#/components/schemas/JournalEntriesPayload');
    expect(response.body.components.schemas.WebApiWallsView).toBeDefined();
    expect(response.body.components.schemas.ConfigCleanupResponsePayload).toBeDefined();
    expect(response.body.components.schemas.ConfigCleanupRequestPayload).toBeDefined();
    expect(response.body.components.schemas.BotConfigPayload).toBeDefined();
    expect(response.body.components.schemas.ConfigBackupPayload).toBeDefined();
    expect(response.body.components.schemas.ConfigRestoreResponsePayload).toBeDefined();
    expect(response.body.components.schemas.ConfigValidationIssuePayload).toBeDefined();
    expect(response.body.components.schemas.ConfigMutationPreviewEntryPayload).toBeDefined();
    expect(response.body.components.schemas.ConfigMutationRequestPayload).toBeDefined();
    expect(response.body.components.schemas.ConfigMutationPreviewSummaryPayload).toBeDefined();
    expect(response.body.components.schemas.ConfigValidationSummaryPayload).toBeDefined();
    expect(response.body.components.schemas.StrategyConfigEntryPayload).toBeDefined();
    expect(response.body.components.schemas.ConfigBackupCollectionPayload.properties.backups.items.$ref)
      .toBe('#/components/schemas/ConfigBackupPayload');
    expect(response.body.components.schemas.ConfigBackupsResponsePayload.allOf[0].$ref)
      .toBe('#/components/schemas/ConfigBackupCollectionPayload');
    expect(response.body.components.schemas.ConfigHistoryResponsePayload.allOf[0].$ref)
      .toBe('#/components/schemas/ConfigBackupCollectionPayload');
    expect(response.body.components.schemas.ConfigServerRuntimeResponsePayload.allOf[0].$ref)
      .toBe('#/components/schemas/ServerRuntimeConfigPayload');
    expect(response.body.paths['/api/config/server'].get.responses['200'].content['application/json'].example.data).toEqual({
      api: { port: 4000, url: 'http://localhost:4000' },
      websocket: { port: 4001, url: 'ws://localhost:4001' },
    });
    expect(response.body.components.schemas.ServerRuntimeEndpointPayload.example).toEqual({
      port: 4000,
      url: 'http://localhost:4000',
    });
    expect(response.body.components.schemas.ServerRuntimeConfigPayload.example).toEqual({
      api: { port: 4000, url: 'http://localhost:4000' },
      websocket: { port: 4001, url: 'ws://localhost:4001' },
    });
    expect(response.body.components.schemas.ServerRuntimeConfigPayload.properties.api.$ref)
      .toBe('#/components/schemas/ServerRuntimeEndpointPayload');
    expect(response.body.components.schemas.ServerRuntimeConfigPayload.properties.websocket.$ref)
      .toBe('#/components/schemas/ServerRuntimeEndpointPayload');
    expect(response.body.components.schemas.ConfigUpdateResponsePayload.properties.validation.$ref)
      .toBe('#/components/schemas/ConfigValidationResponsePayload');
    expect(response.body.components.schemas.ConfigUpdateResponsePayload.properties.preview.$ref)
      .toBe('#/components/schemas/ConfigMutationPreviewPayload');
    expect(response.body.components.schemas.ConfigMutationPreviewPayload.properties.summary.$ref)
      .toBe('#/components/schemas/ConfigMutationPreviewSummaryPayload');
    expect(response.body.components.schemas.ConfigUpdateRequestPayload.allOf[0].$ref)
      .toBe('#/components/schemas/ConfigMutationRequestPayload');
    expect(response.body.components.schemas.ConfigValidationRequestPayload.allOf[0].$ref)
      .toBe('#/components/schemas/ConfigMutationRequestPayload');
    expect(response.body.components.schemas.ConfigMutationPreviewRequestPayload.allOf[0].$ref)
      .toBe('#/components/schemas/ConfigMutationRequestPayload');
    expect(response.body.components.schemas.ConfigValidationResponsePayload.properties.errors.items.$ref)
      .toBe('#/components/schemas/ConfigValidationIssuePayload');
    expect(response.body.paths['/api/config/restore/{backupId}'].post.responses['200'].content['application/json'].schema.properties.data.$ref)
      .toBe('#/components/schemas/ConfigRestoreResponsePayload');
  });

  it('serves runtime discovery guidance on the docs html page', async () => {
    const response = await request(server.getApp())
      .get('/api/docs')
      .expect(200);

    expect(response.text).toContain('/api/docs/openapi.json');
    expect(response.text).toContain('/api/config/server');
    expect(response.text).toContain('current origin first');
    expect(response.text).toContain('active browser protocol');
    expect(response.text).toContain('legacy compatibility config endpoint');
    expect(response.text).toContain('OpenAPI JSON');
  });

  it('publishes the same runtime discovery guidance in the OpenAPI description', async () => {
    const response = await request(server.getApp())
      .get('/api/docs/openapi.json')
      .expect(200);

    expect(response.body.paths['/api/config/server'].get.description).toContain('current origin first');
    expect(response.body.paths['/api/config/server'].get.description).toContain('active browser protocol');
    expect(response.body.paths['/api/config/server'].get.description).toContain('legacy compatibility config endpoint');
  });

  it('reports configured runtime ports through the config boundary', async () => {
    const response = await request(server.getApp())
      .get('/api/config/server')
      .expect(200);

    expect(response.body.data.api.port).toBe(4310);
    expect(response.body.data.websocket.port).toBe(4311);
  });

  it('keeps config routes on explicit delegate boundaries', async () => {
    const app = express();
    const configApi = createConfigRouteApiMock();
    const getRuntimePorts = jest.fn(() => ({ apiPort: 4900, wsPort: 4901 }));

    app.use(express.json());
    app.use('/api/config', createConfigRoutes(configApi, getRuntimePorts));

    await request(app)
      .get('/api/config/server')
      .expect(200);
    expect(getRuntimePorts).toHaveBeenCalledTimes(1);
    expect(configApi.read).not.toHaveBeenCalled();
    expect(configApi.getStrategySummaries).not.toHaveBeenCalled();
    expect(configApi.validate).not.toHaveBeenCalled();

    await request(app)
      .get('/api/config')
      .expect(200);
    expect(configApi.read).toHaveBeenCalledTimes(1);
    expect(getRuntimePorts).toHaveBeenCalledTimes(1);

    await request(app)
      .patch('/api/config/strategies/breakout')
      .send({ enabled: false })
      .expect(200);
    expect(configApi.updateStrategyToggle).toHaveBeenCalledWith('breakout', false);
    expect(configApi.updateRiskSettings).not.toHaveBeenCalled();

    await request(app)
      .post('/api/config/validate')
      .send({ config: { trading: { leverage: 2 } } })
      .expect(200);
    expect(configApi.validate).toHaveBeenCalledTimes(1);
    expect(configApi.write).not.toHaveBeenCalled();
  });

  it('rolls back websocket and file-watcher runtime services when api startup fails after runtime boot', async () => {
    const fileWatcherStopSpy = jest.spyOn(FileWatcherService.prototype, 'stop');
    const webSocketCloseSpy = jest.spyOn(WebSocketService.prototype, 'close');
    jest.spyOn(server as unknown as { startApiServer: () => Promise<void> }, 'startApiServer')
      .mockRejectedValue(new Error('api startup failed'));

    await expect(server.start()).rejects.toThrow('api startup failed');

    expect(fileWatcherStopSpy).toHaveBeenCalledTimes(1);
    expect(webSocketCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('does not emit shutdown logs or stop hooks when close is called before runtime services start', () => {
    const localServer = new WebServer(new TestBot(), { apiPort: 5310, wsPort: 5311 }, createWebApiAdapter());
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const stopRuntimeServicesSpy = jest.spyOn(
      localServer as unknown as { stopRuntimeServices: () => boolean },
      'stopRuntimeServices',
    );

    localServer.close();

    expect(stopRuntimeServicesSpy).toHaveReturnedWith(false);
    expect(consoleLogSpy).not.toHaveBeenCalledWith('[API] Server closed');
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

  it('reads walls, funding rate, and volume profile through the web API adapter', async () => {
    const wallsResponse = await request(server.getApp())
      .get('/api/data/walls/BTCUSDT')
      .expect(200);
    expect(webApiAdapter.getWalls).toHaveBeenCalledWith('BTCUSDT');
    expect(wallsResponse.body.data).toEqual({
      symbol: 'BTCUSDT',
      walls: [],
    });

    const fundingRateResponse = await request(server.getApp())
      .get('/api/data/funding-rate/BTCUSDT')
      .expect(200);
    expect(webApiAdapter.getFundingRate).toHaveBeenCalledWith('BTCUSDT');
    expect(fundingRateResponse.body.data.current).toBe(0.01);

    const volumeProfileResponse = await request(server.getApp())
      .get('/api/data/volume-profile/BTCUSDT?limit=15')
      .expect(200);
    expect(webApiAdapter.getVolumeProfile).toHaveBeenCalledWith('BTCUSDT', 15);
    expect(volumeProfileResponse.body.data.maxVolume).toBe(20);
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

  it('keeps bot lifecycle routes on the control boundary without touching the read-only adapter', async () => {
    bot.isRunning = false;

    await request(server.getApp())
      .post('/api/bot/start')
      .expect(200);

    await request(server.getApp())
      .post('/api/bot/stop')
      .expect(200);

    expect(webApiAdapter.getMarketData).not.toHaveBeenCalled();
    expect(webApiAdapter.getCandles).not.toHaveBeenCalled();
    expect(webApiAdapter.getPositionHistory).not.toHaveBeenCalled();
    expect(webApiAdapter.getOrderBook).not.toHaveBeenCalled();
    expect(webApiAdapter.getWalls).not.toHaveBeenCalled();
    expect(webApiAdapter.getFundingRate).not.toHaveBeenCalled();
    expect(webApiAdapter.getVolumeProfile).not.toHaveBeenCalled();
  });

  it('keeps read-only data routes off the bot lifecycle surface', async () => {
    const startSpy = jest.spyOn(bot, 'start');
    const stopSpy = jest.spyOn(bot, 'stop');

    await request(server.getApp())
      .get('/api/data/market')
      .expect(200);
    await request(server.getApp())
      .get('/api/data/candles?timeframe=5m&limit=1')
      .expect(200);
    await request(server.getApp())
      .get('/api/data/positions/history?limit=1')
      .expect(200);
    await request(server.getApp())
      .get('/api/data/orderbook/BTCUSDT')
      .expect(200);
    await request(server.getApp())
      .get('/api/data/walls/BTCUSDT')
      .expect(200);
    await request(server.getApp())
      .get('/api/data/funding-rate/BTCUSDT')
      .expect(200);
    await request(server.getApp())
      .get('/api/data/volume-profile/BTCUSDT?limit=5')
      .expect(200);

    expect(startSpy).not.toHaveBeenCalled();
    expect(stopSpy).not.toHaveBeenCalled();
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

  it('serves config schema, mutations, backups, and history through the shared typed config boundary', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edison-config-routes-'));
    const configPath = path.join(tempDir, 'config.json');
    await fs.writeFile(
      configPath,
      JSON.stringify({
        exchange: { symbol: 'BTCUSDT' },
        trading: { leverage: 5 },
        risk: { maxLeverage: 5, stopLossPercent: 1.5 },
        strategies: {
          enabled: true,
          default: 'breakoutStrategy',
          breakout: { enabled: true, minConfidence: 0.7 },
          breakoutStrategy: { enabled: true, minConfidence: 0.8 },
        },
      }, null, 2),
      'utf-8',
    );

    const app = express();
    app.use(express.json());
    app.use('/api/config', createConfigRoutes(createConfigRouteApi(new ConfigManagementService(configPath))));

    const invalidPreviewResponse = await request(app)
      .post('/api/config/preview')
      .send([]);

    expect(invalidPreviewResponse.status).toBe(400);

    const previewResponse = await request(app)
      .post('/api/config/preview')
      .send({
        config: {
          exchange: { symbol: 'ETHUSDT' },
          trading: { leverage: 3 },
          risk: { maxLeverage: 3, takeProfitPercent: 2.5 },
          strategies: {
            enabled: true,
            default: 'breakoutStrategy',
            breakout: { enabled: true, minConfidence: 0.65 },
            breakoutStrategy: { enabled: true, minConfidence: 0.9 },
          },
        },
      })
      .expect(200);

    expect(previewResponse.body.data.summary).toEqual({
      addedCount: 1,
      updatedCount: 5,
      removedCount: 1,
      totalChanges: 7,
    });
    expect(previewResponse.body.data.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'exchange.symbol',
        kind: 'updated',
        previousValue: '"BTCUSDT"',
        nextValue: '"ETHUSDT"',
      }),
      expect.objectContaining({
        path: 'risk.takeProfitPercent',
        kind: 'added',
        previousValue: null,
        nextValue: '2.5',
      }),
      expect.objectContaining({
        path: 'risk.stopLossPercent',
        kind: 'removed',
        previousValue: '1.5',
        nextValue: null,
      }),
    ]));

    const updateMutationResponse = await request(app)
      .put('/api/config')
      .send({
        config: {
          exchange: { symbol: 'ETHUSDT' },
          trading: { leverage: 3 },
          risk: { maxLeverage: 3, takeProfitPercent: 2.5 },
          strategies: {
            enabled: true,
            default: 'breakoutStrategy',
            breakout: { enabled: true, minConfidence: 0.65 },
            breakoutStrategy: { enabled: true, minConfidence: 0.9 },
          },
        },
      })
      .expect(200);

    expect(updateMutationResponse.body.data.requiresRestart).toBe(true);
    expect(updateMutationResponse.body.data.backupPath).toContain('config.json.backup.');
    expect(updateMutationResponse.body.data.preview.summary).toEqual({
      addedCount: 1,
      updatedCount: 5,
      removedCount: 1,
      totalChanges: 7,
    });
    expect(updateMutationResponse.body.data.validation).toEqual({
      valid: true,
      errors: [],
      warnings: [],
      summary: {
        errorCount: 0,
        warningCount: 0,
        issueCount: 0,
      },
    });

    await request(app)
      .put('/api/config')
      .send({
        exchange: { symbol: 'SOLUSDT' },
        trading: { leverage: 2 },
        risk: { maxLeverage: 2, takeProfitPercent: 1.5 },
        strategies: {
          enabled: true,
          default: 'breakoutStrategy',
          breakout: { enabled: true, minConfidence: 0.55 },
          breakoutStrategy: { enabled: true, minConfidence: 0.85 },
        },
      })
      .expect(200);

    const schemaResponse = await request(app)
      .get('/api/config/schema')
      .expect(200);

    expect(schemaResponse.body.data.sections.risk.fields[0]).toEqual({
      name: 'maxLeverage',
      type: 'number',
      label: 'Max Leverage',
    });
    expect(schemaResponse.body.data.sections.risk.fields[4]).toEqual({
      name: 'takeProfitPercent',
      type: 'number',
      label: 'Take Profit %',
    });

    const strategiesResponse = await request(app)
      .get('/api/config/strategies')
      .expect(200);
    expect(strategiesResponse.body.data).toEqual({
      strategies: [
        expect.objectContaining({ id: 'breakout', name: 'Breakout', enabled: true }),
        expect.objectContaining({ id: 'breakoutStrategy', name: 'Breakout Strategy', enabled: true }),
      ],
      total: 2,
      active: 2,
    });

    const toggleResponse = await request(app)
      .patch('/api/config/strategies/breakout')
      .send({ enabled: false })
      .expect(200);
    expect(toggleResponse.body.data).toEqual({
      strategy: 'breakout',
      enabled: false,
      message: 'Strategy breakout disabled',
    });

    const riskResponse = await request(app)
      .patch('/api/config/risk')
      .send({ maxLeverage: 2, stopLossPercent: 1.2 })
      .expect(200);
    expect(riskResponse.body.data.message).toBe('Risk settings updated successfully');
    expect(riskResponse.body.data.risk.stopLossPercent).toBe(1.2);

    const validationResponse = await request(app)
      .post('/api/config/validate')
      .send({
        config: {
          trading: { leverage: 2 },
          risk: { maxLeverage: 'oops' },
        },
      })
      .expect(200);
    expect(validationResponse.body.data).toEqual({
      valid: false,
      errors: [{ path: 'risk.maxLeverage', message: 'Must be a number' }],
      warnings: [],
      summary: {
        errorCount: 1,
        warningCount: 0,
        issueCount: 1,
      },
    });

    const compatibilityValidationResponse = await request(app)
      .post('/api/config/validate')
      .send({
        trading: { leverage: 2 },
        risk: { maxLeverage: 'oops' },
      })
      .expect(200);
    expect(compatibilityValidationResponse.body.data).toEqual(validationResponse.body.data);

    const persistedConfig = JSON.parse(await fs.readFile(configPath, 'utf-8')) as {
      risk?: { maxLeverage?: number; stopLossPercent?: number };
      strategies?: { breakout?: { enabled?: boolean } };
    };
    expect(persistedConfig.risk?.maxLeverage).toBe(2);
    expect(persistedConfig.risk?.stopLossPercent).toBe(1.2);
    expect(persistedConfig.strategies?.breakout?.enabled).toBe(false);

    const backupsResponse = await request(app)
      .get('/api/config/backups')
      .expect(200);

    expect(backupsResponse.body.data.count).toBe(4);
    expect(backupsResponse.body.data.backups[0].filename).toContain('config.json.backup.');

    const historyResponse = await request(app)
      .get('/api/config/history')
      .expect(200);

    expect(historyResponse.body.data.count).toBe(4);
    expect(historyResponse.body.data.backups[0].filename).toContain('config.json.backup.');
    expect(historyResponse.body.data.backups[0]).toEqual(expect.objectContaining({
      filePath: expect.stringContaining('config.json.backup.'),
      path: expect.stringContaining('config.json.backup.'),
      size: expect.any(Number),
    }));
    expect(historyResponse.body.data).toEqual(backupsResponse.body.data);

    const restoreResponse = await request(app)
      .post(`/api/config/restore/${backupsResponse.body.data.backups[0].id}`)
      .expect(200);
    expect(restoreResponse.body.data).toEqual(expect.objectContaining({
      success: true,
      restoredBackup: expect.objectContaining({
        id: backupsResponse.body.data.backups[0].id,
        filename: expect.stringContaining('config.json.backup.'),
      }),
      preRestoreBackupPath: expect.any(String),
      requiresRestart: true,
    }));

    const cleanupResponse = await request(app)
      .post('/api/config/cleanup')
      .send({ keepCount: 1 })
      .expect(200);
    expect(cleanupResponse.body.data).toEqual({
      deleted: 3,
      remainingBackups: 1,
      totalBackups: 4,
      message: 'Deleted 3 old backup(s)',
    });
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

  it('returns typed validation payloads for empty config objects', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edison-config-errors-'));
    const configPath = path.join(tempDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify({ exchange: { symbol: 'BTCUSDT' } }, null, 2), 'utf-8');

    const app = express();
    app.use(express.json());
    app.use('/api/config', createConfigRoutes(createConfigRouteApi(new ConfigManagementService(configPath))));
    app.use(createErrorHandlerMiddleware());

    const validationResponse = await request(app)
      .post('/api/config/validate')
      .send({})
      .expect(200);

    expect(validationResponse.body.data).toEqual({
      valid: false,
      errors: [{ path: 'root', message: 'Config must have trading or strategies section' }],
      warnings: [],
      summary: {
        errorCount: 1,
        warningCount: 0,
        issueCount: 1,
      },
    });

  });

  it('returns structured config mutation parse errors without calling the write delegate', async () => {
    const app = express();
    const configApi = createConfigRouteApiMock();

    app.use(express.json());
    app.use('/api/config', createConfigRoutes(configApi));

    const response = await request(app)
      .put('/api/config')
      .send({ config: [] })
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid configuration payload',
        details: 'Request body must contain a config object or be a config object',
        suggestion: 'Provide a JSON object in the request body',
      },
      timestamp: expect.any(Number),
      requestId: undefined,
    });
    expect(configApi.write).not.toHaveBeenCalled();
  });

  it('returns a structured error when the persisted config root is not a JSON object', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edison-config-invalid-root-'));
    const configPath = path.join(tempDir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(['not-an-object'], null, 2), 'utf-8');

    const app = express();
    app.use(express.json());
    app.use('/api/config', createConfigRoutes(createConfigRouteApi(new ConfigManagementService(configPath))));
    app.use(createErrorHandlerMiddleware());

    const response = await request(app)
      .get('/api/config')
      .expect(500);

    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(response.body.error.message).toBe('Failed to read configuration: Configuration file must contain a JSON object');
  });

  it('surfaces readable validation issues when restoring an invalid config backup', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edison-config-restore-error-'));
    const configPath = path.join(tempDir, 'config.json');
    const backupId = '2026-05-22T20-00-00-000Z';

    await fs.writeFile(
      configPath,
      JSON.stringify({
        trading: { leverage: 5 },
        risk: { maxLeverage: 5 },
      }, null, 2),
      'utf-8',
    );
    await fs.writeFile(
      `${configPath}.backup.${backupId}.json`,
      JSON.stringify({
        trading: { leverage: 2 },
        risk: { maxLeverage: 'oops' },
      }, null, 2),
      'utf-8',
    );

    const app = express();
    app.use(express.json());
    app.use('/api/config', createConfigRoutes(createConfigRouteApi(new ConfigManagementService(configPath))));
    app.use(createErrorHandlerMiddleware());

    const response = await request(app)
      .post(`/api/config/restore/${backupId}`)
      .expect(400);

    expect(response.body.error.message).toContain('risk.maxLeverage: Must be a number');
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

  it('uses the first request id header when the middleware receives multiple values', () => {
    const middleware = createErrorHandlerMiddleware();
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const res = { status, json } as unknown as express.Response;
    const req = {
      headers: {
        'x-request-id': ['req-a', 'req-b'],
      },
    } as unknown as express.Request;

    middleware(new Error('boom'), req, res, jest.fn());

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 'req-a',
    }));
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
    const now = Date.now();
    const journal: WebApiJournalEntry[] = [
      {
        id: 'trade-1',
        timestamp: now - 60 * 60 * 1000,
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
        timestamp: now - 30 * 60 * 1000,
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
        startTime: now - 3 * 60 * 60 * 1000,
        endTime: now - 2 * 60 * 60 * 1000,
        trades: [journal[0]],
        totalPnL: 10,
        winRate: 100,
        winCount: 1,
        lossCount: 0,
        totalTrades: 1,
      },
      {
        sessionId: 'session-b',
        startTime: now - 90 * 60 * 1000,
        endTime: now - 20 * 60 * 1000,
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
    app.use(
      '/api/analytics',
      createAnalyticsRoutes(createAnalyticsRouteReadApi(new FileWatcherService(journalPath, sessionsPath))),
    );

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

    const last24hResponse = await request(app)
      .get('/api/analytics/journal/last24h')
      .expect(200);
    expect(last24hResponse.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'trade-1' }),
        expect.objectContaining({ id: 'trade-2' }),
      ]),
    );

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

  it('returns a structured analytics error when session stats payload shape is invalid', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edison-analytics-invalid-shape-'));
    const journalPath = path.join(tempDir, 'trade-journal.json');
    const sessionsPath = path.join(tempDir, 'session-stats.json');

    await fs.writeFile(journalPath, JSON.stringify([], null, 2), 'utf-8');
    await fs.writeFile(sessionsPath, JSON.stringify({ invalid: true }, null, 2), 'utf-8');

    const app = express();
    app.use(
      '/api/analytics',
      createAnalyticsRoutes(createAnalyticsRouteReadApi(new FileWatcherService(journalPath, sessionsPath))),
    );
    app.use(createErrorHandlerMiddleware());

    const response = await request(app)
      .get('/api/analytics/sessions')
      .expect(500);

    expect(response.body.error.message).toBe(
      'Session stats file must contain an array or an object with a sessions array',
    );
  });

  it('keeps analytics routes on explicit read delegates', async () => {
    const app = express();
    const analyticsApi = createAnalyticsRouteReadApiMock();

    app.use('/api/analytics', createAnalyticsRoutes(analyticsApi));

    await request(app)
      .get('/api/analytics/journal?page=2&limit=20')
      .expect(200);
    expect(analyticsApi.getJournalPaginated).toHaveBeenCalledWith(2, 20);
    expect(analyticsApi.readJournal).not.toHaveBeenCalled();

    await request(app)
      .get('/api/analytics/sessions/compare?id1=session-a&id2=session-b')
      .expect(200);
    expect(analyticsApi.compareSessions).toHaveBeenCalledWith('session-a', 'session-b');
    expect(analyticsApi.readSessions).not.toHaveBeenCalled();

    await request(app)
      .get('/api/analytics/pnl-history')
      .expect(200);
    await request(app)
      .get('/api/analytics/equity-curve')
      .expect(200);

    expect(analyticsApi.getPnlHistory).toHaveBeenCalledTimes(1);
    expect(analyticsApi.getEquityCurve).toHaveBeenCalledTimes(1);
    expect(analyticsApi.readJournal).not.toHaveBeenCalled();
    expect(analyticsApi.getStrategyPerformance).not.toHaveBeenCalled();
  });
});
