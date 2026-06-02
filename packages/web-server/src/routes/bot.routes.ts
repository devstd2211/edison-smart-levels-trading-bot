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
import { createStatusApiError } from '../errors/api-error-response.js';
import { sendAsyncRouteMutation, sendAsyncRouteRead } from './route-response.js';

type BotRouteReadApi = Pick<BotBridgeService, 'getStatus'>;
type BotRouteControlApi = Pick<BotBridgeService, 'startBot' | 'stopBot'>;
type BotRouteBridgeApi = BotRouteReadApi & BotRouteControlApi;

export type BotRouteApi = {
  getStatus(): Promise<BotStatus>;
  startBot(): Promise<ApiMessageResponse>;
  stopBot(): Promise<ApiMessageResponse>;
};

type BotLifecycleResult = Awaited<ReturnType<BotRouteControlApi['startBot']>> | ReturnType<BotRouteControlApi['stopBot']>;
type BotLifecycleRouteOptions = { successMessage: string; failureMessage: string };

function resolveBotLifecycleRouteMutation(
  result: BotLifecycleResult,
  options: BotLifecycleRouteOptions,
): ApiMessageResponse {
  if (result.success) {
    return { message: options.successMessage };
  }

  throw createStatusApiError(400, result.error || options.failureMessage);
}

export function createBotRouteApi(bridge: BotRouteBridgeApi): BotRouteApi {
  return {
    getStatus: () => bridge.getStatus(),
    startBot: async () => resolveBotLifecycleRouteMutation(await bridge.startBot(), {
      successMessage: 'Bot started successfully',
      failureMessage: 'Failed to start bot',
    }),
    stopBot: async () => resolveBotLifecycleRouteMutation(bridge.stopBot(), {
      successMessage: 'Bot stopped successfully',
      failureMessage: 'Failed to stop bot',
    }),
  };
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
    await sendAsyncRouteMutation(res, () => bridge.startBot());
  });

  /**
   * POST /api/bot/stop
   * Stop the trading bot
   */
  router.post('/stop', async (_req: Request, res: Response<ApiResponse<ApiMessageResponse>>) => {
    await sendAsyncRouteMutation(res, () => bridge.stopBot());
  });

  return router;
}
