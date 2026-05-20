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
  BalanceResponsePayload,
  RecentSignalsResponsePayload,
} from '@edison/contracts/runtime-api';
import type {
  WebApiCandlesResponse,
  WebApiFundingRateView,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiPositionsResponse,
  WebApiVolumeProfileView,
  WebApiWallsView,
} from '@edison/contracts/web-api';
import {
  parseLimitQuery,
  requireNonEmptyParam,
  sendAsyncRouteRead,
  sendRouteRead,
} from './route-response.js';

export function createDataRoutes(bridge: BotBridgeService): Router {
  const router = Router();

  /**
   * GET /api/data/position
   * Get current position
   */
  router.get('/position', (_req: Request, res: Response<ApiResponse<Position | null>>) =>
    sendRouteRead(res, () => bridge.getPosition()));

  /**
   * GET /api/data/balance
   * Get current balance
   */
  router.get('/balance', async (_req: Request, res: Response<ApiResponse<BalanceResponsePayload>>) =>
    sendAsyncRouteRead(res, async () => ({ balance: await bridge.getBalance() })));

  /**
   * GET /api/data/market
   * Get market data (price, RSI, EMA, ATR, etc.)
   */
  router.get('/market', async (_req: Request, res: Response<ApiResponse<WebApiMarketData>>) =>
    sendAsyncRouteRead(res, () => bridge.getMarketData()));

  /**
   * GET /api/data/signals/recent?limit=50
   * Get recent signals (cached from signal:generated events)
   */
  router.get('/signals/recent', (req: Request, res: Response<ApiResponse<RecentSignalsResponsePayload>>) =>
    sendRouteRead(res, () => {
      const limit = parseLimitQuery(req.query.limit, 50, 100);
      const signals = bridge.getRecentSignals(limit);
      return { signals, count: signals.length };
    }));

  /**
   * GET /api/data/candles?timeframe=5m&limit=100
   * Get candlestick data for web chart
   */
  router.get('/candles', async (req: Request, res: Response<ApiResponse<WebApiCandlesResponse>>) =>
    sendAsyncRouteRead(res, async () => {
      const timeframe = (req.query.timeframe as string) || '5m';
      const limit = parseLimitQuery(req.query.limit, 100, 500);
      return { candles: await bridge.getCandles(timeframe, limit) };
    }));

  /**
   * GET /api/data/positions/history?limit=50
   * Get recent closed positions with entry/exit points
   */
  router.get('/positions/history', async (req: Request, res: Response<ApiResponse<WebApiPositionsResponse>>) =>
    sendAsyncRouteRead(res, async () => {
      const limit = parseLimitQuery(req.query.limit, 50, 500);
      return { positions: await bridge.getPositionHistory(limit) };
    }));


  /**
   * GET /api/data/orderbook/:symbol
   * Get orderbook snapshot for a trading pair
   */
  router.get('/orderbook/:symbol', async (req: Request, res: Response<ApiResponse<WebApiOrderBookView>>) => {
    const { symbol } = req.params;
    if (!requireNonEmptyParam(res, symbol, 'Symbol')) {
      return;
    }

    await sendAsyncRouteRead(res, () => bridge.getOrderBook(symbol));
  });

  /**
   * GET /api/data/walls/:symbol
   * Get detected walls (large orders)
   */
  router.get('/walls/:symbol', async (req: Request, res: Response<ApiResponse<WebApiWallsView>>) => {
    const { symbol } = req.params;
    if (!requireNonEmptyParam(res, symbol, 'Symbol')) {
      return;
    }

    await sendAsyncRouteRead(res, () => bridge.getWalls(symbol));
  });

  /**
   * GET /api/data/funding-rate/:symbol
   * Get current and predicted funding rate
   */
  router.get('/funding-rate/:symbol', async (req: Request, res: Response<ApiResponse<WebApiFundingRateView>>) => {
    const { symbol } = req.params;
    if (!requireNonEmptyParam(res, symbol, 'Symbol')) {
      return;
    }

    await sendAsyncRouteRead(res, () => bridge.getFundingRate(symbol));
  });

  /**
   * GET /api/data/volume-profile/:symbol?limit=20
   * Get volume profile (price levels vs volume)
   */
  router.get('/volume-profile/:symbol', async (req: Request, res: Response<ApiResponse<WebApiVolumeProfileView>>) => {
    const { symbol } = req.params;
    const limit = parseLimitQuery(req.query.limit, 20, 100);
    if (!requireNonEmptyParam(res, symbol, 'Symbol')) {
      return;
    }

    await sendAsyncRouteRead(res, () => bridge.getVolumeProfile(symbol, limit));
  });

  return router;
}
