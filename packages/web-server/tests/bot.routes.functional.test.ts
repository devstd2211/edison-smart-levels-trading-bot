import express from 'express';
import request from 'supertest';
import { EventEmitter } from 'events';
import { BotBridgeService, type IBotInstance } from '../src/services/bot-bridge.service';
import { createBotRouteApi, createBotRoutes } from '../src/routes/bot.routes';

class TestBot extends EventEmitter implements IBotInstance {
  isRunning = true;

  getCurrentPosition() {
    return null;
  }

  async getBalance(): Promise<number> {
    return 750;
  }

  async start(): Promise<void> {}

  stop(): void {}
}

describe('bot routes functional boundary', () => {
  test('createBotRouteApi maps bridge lifecycle results into stable route mutations', async () => {
    const routeApi = createBotRouteApi({
      getStatus: async () => ({
        isRunning: false,
        currentPosition: null,
        balance: 0,
        unrealizedPnL: 0,
        timestamp: 1,
      }),
      startBot: async () => ({ success: false, error: 'Bot is already running' }),
      stopBot: () => ({ success: true }),
    });

    await expect(routeApi.getStatus()).resolves.toEqual({
      isRunning: false,
      currentPosition: null,
      balance: 0,
      unrealizedPnL: 0,
      timestamp: 1,
    });
    await expect(routeApi.startBot()).rejects.toMatchObject({
      statusCode: 400,
      message: 'Bot is already running',
    });
    await expect(routeApi.stopBot()).resolves.toEqual({
      message: 'Bot stopped successfully',
    });
  });

  test('reuses the bridge status read helper for http status reads', async () => {
    const bridge = new BotBridgeService(new TestBot());
    const statusSpy = jest.spyOn(bridge, 'getStatus');
    const app = express();

    app.use('/api/bot', createBotRoutes(createBotRouteApi(bridge)));

    const response = await request(app)
      .get('/api/bot/status')
      .expect(200);

    expect(statusSpy).toHaveBeenCalledWith();
    expect(response.body).toEqual({
      success: true,
      data: {
        isRunning: true,
        currentPosition: null,
        balance: 750,
        unrealizedPnL: 0,
        timestamp: expect.any(Number),
      },
      timestamp: expect.any(Number),
    });
  });

  test('reuses the shared lifecycle route response helper for start and stop commands', async () => {
    const bridge = new BotBridgeService(new TestBot());
    const startSpy = jest.spyOn(bridge, 'startBot').mockResolvedValue({ success: true });
    const stopSpy = jest.spyOn(bridge, 'stopBot').mockReturnValue({ success: true });
    const app = express();

    app.use('/api/bot', createBotRoutes(createBotRouteApi(bridge)));

    await expect(request(app).post('/api/bot/start')).resolves.toMatchObject({
      body: {
        success: true,
        data: { message: 'Bot started successfully' },
        timestamp: expect.any(Number),
      },
    });

    await expect(request(app).post('/api/bot/stop')).resolves.toMatchObject({
      body: {
        success: true,
        data: { message: 'Bot stopped successfully' },
        timestamp: expect.any(Number),
      },
    });

    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  test('preserves structured lifecycle failures after route adapter mapping', async () => {
    const bridge = new BotBridgeService(new TestBot());
    jest.spyOn(bridge, 'startBot').mockResolvedValue({
      success: false,
      error: 'Bot is already running',
    });
    const app = express();

    app.use('/api/bot', createBotRoutes(createBotRouteApi(bridge)));

    const response = await request(app)
      .post('/api/bot/start')
      .set('x-request-id', 'req-bot-start')
      .expect(400);

    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Bot is already running',
        suggestion: 'Check your request parameters and try again',
      },
      timestamp: expect.any(Number),
      requestId: 'req-bot-start',
    });
  });
});
