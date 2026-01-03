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
import type { ApiResponse, BotStatus } from '../types/api.types.js';

export function createBotRoutes(bridge: BotBridgeService): Router {
  const router = Router();

  /**
   * GET /api/bot/status
   * Get current bot status
   */
  router.get('/status', async (_req: Request, res: Response<ApiResponse<BotStatus>>) => {
    try {
      const status = await bridge.getStatus();
      res.json({
        success: true,
        data: status,
        timestamp: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: message,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /api/bot/start
   * Start the trading bot
   */
  router.post('/start', async (_req: Request, res: Response<ApiResponse>) => {
    try {
      const result = await bridge.startBot();
      if (result.success) {
        res.json({
          success: true,
          data: { message: 'Bot started successfully' },
          timestamp: Date.now(),
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || 'Failed to start bot',
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: message,
        timestamp: Date.now(),
      });
    }
  });

  /**
   * POST /api/bot/stop
   * Stop the trading bot
   */
  router.post('/stop', (_req: Request, res: Response<ApiResponse>) => {
    try {
      const result = bridge.stopBot();
      if (result.success) {
        res.json({
          success: true,
          data: { message: 'Bot stopped successfully' },
          timestamp: Date.now(),
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || 'Failed to stop bot',
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        success: false,
        error: message,
        timestamp: Date.now(),
      });
    }
  });

  return router;
}
