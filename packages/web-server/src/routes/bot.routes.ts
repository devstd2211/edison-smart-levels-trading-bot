/**
 * Bot Control Routes
 *
 * API endpoints for bot management:
 * - GET /api/bot/status - Get bot status
 * - POST /api/bot/start - Start bot
 * - POST /api/bot/stop - Stop bot
 */

import { Router, Request, Response } from 'express';
import type { BotBridgeService } from '../services/bot-bridge.service.js';
import type { ApiMessageResponse, ApiResponse, BotStatus } from '@edison/contracts/runtime-api';
import { handleRouteError, sendAsyncRouteRead, sendError, sendSuccess } from './route-response.js';

type BotRouteReadApi = Pick<BotBridgeService, 'getStatus'>;
type BotRouteControlApi = Pick<BotBridgeService, 'startBot' | 'stopBot'>;

export type BotRouteApi = BotRouteReadApi & BotRouteControlApi;

type BotLifecycleResult = Awaited<ReturnType<BotRouteControlApi['startBot']>> | ReturnType<BotRouteControlApi['stopBot']>;
type BotLifecycleRouteOptions = { successMessage: string; failureMessage: string };

export function createBotRouteApi(bridge: BotRouteApi): BotRouteApi {
  return {
    getStatus: () => bridge.getStatus(),
    startBot: () => bridge.startBot(),
    stopBot: () => bridge.stopBot(),
  };
}

function sendLifecycleRouteResponse(
  res: Response<ApiResponse<ApiMessageResponse>>,
  result: BotLifecycleResult,
  options: BotLifecycleRouteOptions,
): void {
  if (result.success) {
    sendSuccess(res, { message: options.successMessage });
    return;
  }

  sendError(res, 400, result.error || options.failureMessage);
}

async function runLifecycleRoute(
  res: Response<ApiResponse<ApiMessageResponse>>,
  execute: () => BotLifecycleResult | Promise<BotLifecycleResult>,
  options: BotLifecycleRouteOptions,
): Promise<void> {
  try {
    sendLifecycleRouteResponse(res, await execute(), options);
  } catch (error) {
    handleRouteError(res, error);
  }
}

export function createBotRoutes(bridge: BotRouteApi): Router {
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
    await runLifecycleRoute(res, () => bridge.startBot(), {
      successMessage: 'Bot started successfully',
      failureMessage: 'Failed to start bot',
    });
  });

  /**
   * POST /api/bot/stop
   * Stop the trading bot
   */
  router.post('/stop', (_req: Request, res: Response<ApiResponse<ApiMessageResponse>>) => {
    void runLifecycleRoute(res, () => bridge.stopBot(), {
      successMessage: 'Bot stopped successfully',
      failureMessage: 'Failed to stop bot',
    });
  });

  return router;
}
