/**
 * Data Routes
 *
 * API endpoints for data retrieval:
 * - GET /api/data/position - Current position
 * - GET /api/data/balance - Current balance
 * - GET /api/data/market - Market data (indicators)
 * - GET /api/data/signals/recent - Recent signals
 */

import { Router, Request, Response } from 'express';
import { BotBridgeService } from '../services/bot-bridge.service.js';
import type { ApiResponse, Position } from '../types/api.types.js';

export function createDataRoutes(bridge: BotBridgeService): Router {
  const router = Router();

  /**
   * GET /api/data/position
   * Get current position
   */
  router.get('/position', (_req: Request, res: Response<ApiResponse<Position | null>>) => {
    try {
      const position = bridge.getPosition();
      res.json({
        success: true,
        data: position,
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
   * GET /api/data/balance
   * Get current balance
   */
  router.get('/balance', async (_req: Request, res: Response<ApiResponse>) => {
    try {
      const balance = await bridge.getBalance();
      res.json({
        success: true,
        data: { balance },
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
   * GET /api/data/market
   * Get market data (price, RSI, EMA, ATR, etc.)
   */
  router.get('/market', (_req: Request, res: Response<ApiResponse>) => {
    try {
      const marketData = bridge.getMarketData();
      res.json({
        success: true,
        data: marketData || {},
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
   * GET /api/data/signals/recent?limit=50
   * Get recent signals (cached from signal:generated events)
   */
  router.get('/signals/recent', (req: Request, res: Response<ApiResponse>) => {
    try {
      const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
      const signals = bridge.getRecentSignals(limit);
      res.json({
        success: true,
        data: { signals, count: signals.length },
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
   * GET /api/data/candles?timeframe=5m&limit=100
   * Get candlestick data for web chart
   */
  router.get('/candles', async (req: Request, res: Response<ApiResponse>) => {
    try {
      const timeframe = (req.query.timeframe as string) || '5m';
      const limit = parseInt((req.query.limit as string) || '100', 10);

      const candles = await bridge.getCandles(timeframe, Math.min(limit, 500)); // Cap at 500
      res.json({
        success: true,
        data: { candles },
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
   * GET /api/data/positions/history?limit=50
   * Get recent closed positions with entry/exit points
   */
  router.get('/positions/history', async (req: Request, res: Response<ApiResponse>) => {
    try {
      const limit = parseInt((req.query.limit as string) || '50', 10);
      const positions = await bridge.getPositionHistory(Math.min(limit, 500)); // Cap at 500
      res.json({
        success: true,
        data: { positions },
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
   * GET /api/data/orderbook/:symbol
   * Get orderbook snapshot for a trading pair
   */
  router.get('/orderbook/:symbol', async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { symbol } = req.params;
      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Symbol is required',
          timestamp: Date.now(),
        });
      }
      const orderbook = await bridge.getOrderBook(symbol);
      res.json({
        success: true,
        data: orderbook,
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
   * GET /api/data/walls/:symbol
   * Get detected walls (large orders)
   */
  router.get('/walls/:symbol', async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { symbol } = req.params;
      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Symbol is required',
          timestamp: Date.now(),
        });
      }
      const walls = await bridge.getWalls(symbol);
      res.json({
        success: true,
        data: walls,
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
   * GET /api/data/funding-rate/:symbol
   * Get current and predicted funding rate
   */
  router.get('/funding-rate/:symbol', async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { symbol } = req.params;
      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Symbol is required',
          timestamp: Date.now(),
        });
      }
      const fundingRate = await bridge.getFundingRate(symbol);
      res.json({
        success: true,
        data: fundingRate,
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
   * GET /api/data/volume-profile/:symbol?limit=20
   * Get volume profile (price levels vs volume)
   */
  router.get('/volume-profile/:symbol', async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { symbol } = req.params;
      const limit = parseInt((req.query.limit as string) || '20', 10);
      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Symbol is required',
          timestamp: Date.now(),
        });
      }
      const profile = await bridge.getVolumeProfile(symbol, Math.min(limit, 100));
      res.json({
        success: true,
        data: profile,
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

  return router;
}
