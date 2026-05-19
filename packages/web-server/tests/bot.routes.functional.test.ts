import express from 'express';
import request from 'supertest';
import { EventEmitter } from 'events';
import { BotBridgeService, type IBotInstance } from '../src/services/bot-bridge.service';
import { createBotRoutes } from '../src/routes/bot.routes';

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
  test('reuses the bridge status-change message helper for http status reads', async () => {
    const bridge = new BotBridgeService(new TestBot());
    const statusMessageSpy = jest.spyOn(bridge, 'createStatusChangeMessage');
    const app = express();

    app.use('/api/bot', createBotRoutes(bridge));

    const response = await request(app)
      .get('/api/bot/status')
      .expect(200);

    expect(statusMessageSpy).toHaveBeenCalledWith();
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
});
