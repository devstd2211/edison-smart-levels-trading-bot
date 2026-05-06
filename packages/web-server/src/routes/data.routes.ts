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
import type {
  ApiResponse,
  Position,
} from '../types/api.types.js';
import type {
  BalanceResponsePayload,
  WebApiCandle,
  WebApiCandlesResponse,
  WebApiFundingRateView,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiPositionHistoryEntry,
  WebApiPositionsResponse,
  RecentSignalsResponsePayload,
  WebApiVolumeProfileView,
  WebApiWallsView,
} from '@edison/contracts';
import {
  handleRouteError,
  parseLimitQuery,
  requireNonEmptyParam,
  sendSuccess,
} from './route-response.js';

export function createDataRoutes(bridge: BotBridgeService): Router {
  const router = Router();

  /**
   * GET /api/data/position
   * Get current position
   */
  router.get('/position', (_req: Request, res: Response<ApiResponse<Position | null>>) => {
    try {
      sendSuccess(res, bridge.getPosition());
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  /**
   * GET /api/data/balance
   * Get current balance
   */
  router.get('/balance', async (_req: Request, res: Response<ApiResponse<BalanceResponsePayload>>) => {
    try {
      sendSuccess(res, { balance: await bridge.getBalance() });
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  /**
   * GET /api/data/market
   * Get market data (price, RSI, EMA, ATR, etc.)
   */
  router.get('/market', async (_req: Request, res: Response<ApiResponse<WebApiMarketData>>) => {
    try {
      sendSuccess(res, await bridge.getMarketData());
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  /**
   * GET /api/data/signals/recent?limit=50
   * Get recent signals (cached from signal:generated events)
   */
  router.get('/signals/recent', (req: Request, res: Response<ApiResponse<RecentSignalsResponsePayload>>) => {
    try {
      const limit = parseLimitQuery(req.query.limit, 50, 100);
      const signals = bridge.getRecentSignals(limit);
      sendSuccess(res, { signals, count: signals.length });
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  /**
   * GET /api/data/candles?timeframe=5m&limit=100
   * Get candlestick data for web chart
   */
  router.get('/candles', async (req: Request, res: Response<ApiResponse<WebApiCandlesResponse>>) => {
    try {
      const timeframe = (req.query.timeframe as string) || '5m';
      const limit = parseLimitQuery(req.query.limit, 100, 500);

      sendSuccess(res, { candles: await bridge.getCandles(timeframe, limit) });
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  /**
   * GET /api/data/positions/history?limit=50
   * Get recent closed positions with entry/exit points
   */
  router.get('/positions/history', async (req: Request, res: Response<ApiResponse<WebApiPositionsResponse>>) => {
    try {
      const limit = parseLimitQuery(req.query.limit, 50, 500);
      sendSuccess(res, { positions: await bridge.getPositionHistory(limit) });
    } catch (error) {
      handleRouteError(res, error);
    }
  });


  /**
   * GET /api/data/orderbook/:symbol
   * Get orderbook snapshot for a trading pair
   */
  router.get('/orderbook/:symbol', async (req: Request, res: Response<ApiResponse<WebApiOrderBookView>>) => {
    try {
      const { symbol } = req.params;
      if (!requireNonEmptyParam(res, symbol, 'Symbol')) {
        return;
      }
      sendSuccess(res, await bridge.getOrderBook(symbol));
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  /**
   * GET /api/data/walls/:symbol
   * Get detected walls (large orders)
   */
  router.get('/walls/:symbol', async (req: Request, res: Response<ApiResponse<WebApiWallsView>>) => {
    try {
      const { symbol } = req.params;
      if (!requireNonEmptyParam(res, symbol, 'Symbol')) {
        return;
      }
      sendSuccess(res, await bridge.getWalls(symbol));
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  /**
   * GET /api/data/funding-rate/:symbol
   * Get current and predicted funding rate
   */
  router.get('/funding-rate/:symbol', async (req: Request, res: Response<ApiResponse<WebApiFundingRateView>>) => {
    try {
      const { symbol } = req.params;
      if (!requireNonEmptyParam(res, symbol, 'Symbol')) {
        return;
      }
      sendSuccess(res, await bridge.getFundingRate(symbol));
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  /**
   * GET /api/data/volume-profile/:symbol?limit=20
   * Get volume profile (price levels vs volume)
   */
  router.get('/volume-profile/:symbol', async (req: Request, res: Response<ApiResponse<WebApiVolumeProfileView>>) => {
    try {
      const { symbol } = req.params;
      const limit = parseLimitQuery(req.query.limit, 20, 100);
      if (!requireNonEmptyParam(res, symbol, 'Symbol')) {
        return;
      }
      sendSuccess(res, await bridge.getVolumeProfile(symbol, limit));
    } catch (error) {
      handleRouteError(res, error);
    }
  });

  return router;
}
