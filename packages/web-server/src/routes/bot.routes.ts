/**
 * Bot Control Routes
 *
 * API endpoints for bot management:
 * - GET /api/bot/status - Get bot status
 * - POST /api/bot/start - Start bot
 * - POST /api/bot/stop - Stop bot
 */

import { Router, Request, Response } from 'express';
import { BotBridgeService } from '../services/bot-bridge.service.js';
import type { ApiMessageResponse, ApiResponse, BotStatus } from '@edison/contracts/runtime-api';
import { handleRouteError, sendError, sendSuccess } from './route-response.js';

export function createBotRoutes(bridge: BotBridgeService): Router {
  const router = Router();

  /**
   * GET /api/bot/status
   * Get current bot status
   */
  router.get('/status', async (_req: Request, res: Response<ApiResponse<BotStatus>>) => {
    try {
      sendSuccess(res, await bridge.getStatus());
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  /**
   * POST /api/bot/start
   * Start the trading bot
   */
  router.post('/start', async (_req: Request, res: Response<ApiResponse<ApiMessageResponse>>) => {
    try {
      const result = await bridge.startBot();
      if (result.success) {
        sendSuccess(res, { message: 'Bot started successfully' });
        return;
      }
      sendError(res, 400, result.error || 'Failed to start bot');
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  /**
   * POST /api/bot/stop
   * Stop the trading bot
   */
  router.post('/stop', (_req: Request, res: Response<ApiResponse<ApiMessageResponse>>) => {
    try {
      const result = bridge.stopBot();
      if (result.success) {
        sendSuccess(res, { message: 'Bot stopped successfully' });
        return;
      }
      sendError(res, 400, result.error || 'Failed to stop bot');
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  return router;
}
