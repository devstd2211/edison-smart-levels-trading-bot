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
import { handleRouteError, sendAsyncRouteRead, sendError, sendSuccess } from './route-response.js';

type BotLifecycleResult = Awaited<ReturnType<BotBridgeService['startBot']>> | ReturnType<BotBridgeService['stopBot']>;

function sendLifecycleRouteResponse(
  res: Response<ApiResponse<ApiMessageResponse>>,
  result: BotLifecycleResult,
  options: { successMessage: string; failureMessage: string },
): void {
  if (result.success) {
    sendSuccess(res, { message: options.successMessage });
    return;
  }

  sendError(res, 400, result.error || options.failureMessage);
}

export function createBotRoutes(bridge: BotBridgeService): Router {
  const router = Router();

  /**
   * GET /api/bot/status
   * Get current bot status
   */
  router.get('/status', async (_req: Request, res: Response<ApiResponse<BotStatus>>) => {
    await sendAsyncRouteRead(res, () => bridge.getStatus());
  });

  /**
   * POST /api/bot/start
   * Start the trading bot
   */
  router.post('/start', async (_req: Request, res: Response<ApiResponse<ApiMessageResponse>>) => {
    try {
      sendLifecycleRouteResponse(res, await bridge.startBot(), {
        successMessage: 'Bot started successfully',
        failureMessage: 'Failed to start bot',
      });
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
      sendLifecycleRouteResponse(res, bridge.stopBot(), {
        successMessage: 'Bot stopped successfully',
        failureMessage: 'Failed to stop bot',
      });
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  return router;
}
