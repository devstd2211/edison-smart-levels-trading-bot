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
import type { BotBridgeService } from '../services/bot-bridge.service.js';
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
import { createStatusApiError } from '../errors/api-error-response.js';
import {
  parseLimitQuery,
  sendAsyncRouteRead,
  sendRouteRead,
} from './route-response.js';

type DataRouteBridgeReadApi = Pick<
  BotBridgeService,
  | 'getPosition'
  | 'getBalance'
  | 'getMarketData'
  | 'getRecentSignals'
  | 'getCandles'
  | 'getPositionHistory'
  | 'getOrderBook'
  | 'getWalls'
  | 'getFundingRate'
  | 'getVolumeProfile'
>;

export type DataRouteReadApi = {
  getPosition(): Position | null;
  getBalance(): Promise<BalanceResponsePayload>;
  getMarketData(): Promise<WebApiMarketData>;
  getRecentSignals(limit?: number): RecentSignalsResponsePayload;
  getCandles(timeframe: string, limit: number): Promise<WebApiCandlesResponse>;
  getPositionHistory(limit?: number): Promise<WebApiPositionsResponse>;
  getOrderBook(symbol: string): Promise<WebApiOrderBookView>;
  getWalls(symbol: string): Promise<WebApiWallsView>;
  getFundingRate(symbol: string): Promise<WebApiFundingRateView>;
  getVolumeProfile(symbol: string, levels: number): Promise<WebApiVolumeProfileView>;
};

function requireSymbol(symbol: string | null | undefined): string {
  if (typeof symbol === 'string' && symbol.trim().length > 0) {
    return symbol;
  }

  throw createStatusApiError(400, 'Symbol is required', {
    code: 'BAD_REQUEST',
    suggestion: 'Provide a non-empty Symbol value',
  });
}

export function createDataRouteReadApi(bridge: DataRouteBridgeReadApi): DataRouteReadApi {
  return {
    getPosition: () => bridge.getPosition(),
    getBalance: async () => ({ balance: await bridge.getBalance() }),
    getMarketData: () => bridge.getMarketData(),
    getRecentSignals: (limit) => {
      const signals = bridge.getRecentSignals(limit);
      return { signals, count: signals.length };
    },
    getCandles: async (timeframe, limit) => ({ candles: await bridge.getCandles(timeframe, limit) }),
    getPositionHistory: async (limit) => ({ positions: await bridge.getPositionHistory(limit) }),
    getOrderBook: (symbol) => bridge.getOrderBook(symbol),
    getWalls: (symbol) => bridge.getWalls(symbol),
    getFundingRate: (symbol) => bridge.getFundingRate(symbol),
    getVolumeProfile: (symbol, levels) => bridge.getVolumeProfile(symbol, levels),
  };
}

export function createDataRoutes(bridge: DataRouteReadApi): Router {
  const router = Router();

  const sendSymbolRouteRead = async <T>(
    req: Request<{ symbol: string }>,
    res: Response<ApiResponse<T>>,
    read: (symbol: string) => Promise<T>,
  ): Promise<void> => {
    await sendAsyncRouteRead(res, () => read(requireSymbol(req.params.symbol)));
  };

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
    sendAsyncRouteRead(res, () => bridge.getBalance()));

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
    sendRouteRead(res, () => bridge.getRecentSignals(parseLimitQuery(req.query.limit, 50, 100))));

  /**
   * GET /api/data/candles?timeframe=5m&limit=100
   * Get candlestick data for web chart
   */
  router.get('/candles', async (req: Request, res: Response<ApiResponse<WebApiCandlesResponse>>) =>
    sendAsyncRouteRead(res, () => bridge.getCandles(
      (req.query.timeframe as string) || '5m',
      parseLimitQuery(req.query.limit, 100, 500),
    )));

  /**
   * GET /api/data/positions/history?limit=50
   * Get recent closed positions with entry/exit points
   */
  router.get('/positions/history', async (req: Request, res: Response<ApiResponse<WebApiPositionsResponse>>) =>
    sendAsyncRouteRead(res, () => bridge.getPositionHistory(parseLimitQuery(req.query.limit, 50, 500))));


  /**
   * GET /api/data/orderbook/:symbol
   * Get orderbook snapshot for a trading pair
   */
  router.get('/orderbook/:symbol', async (req: Request<{ symbol: string }>, res: Response<ApiResponse<WebApiOrderBookView>>) =>
    sendSymbolRouteRead(req, res, (symbol) => bridge.getOrderBook(symbol)));

  /**
   * GET /api/data/walls/:symbol
   * Get detected walls (large orders)
   */
  router.get('/walls/:symbol', async (req: Request<{ symbol: string }>, res: Response<ApiResponse<WebApiWallsView>>) =>
    sendSymbolRouteRead(req, res, (symbol) => bridge.getWalls(symbol)));

  /**
   * GET /api/data/funding-rate/:symbol
   * Get current and predicted funding rate
   */
  router.get('/funding-rate/:symbol', async (req: Request<{ symbol: string }>, res: Response<ApiResponse<WebApiFundingRateView>>) =>
    sendSymbolRouteRead(req, res, (symbol) => bridge.getFundingRate(symbol)));

  /**
   * GET /api/data/volume-profile/:symbol?limit=20
   * Get volume profile (price levels vs volume)
   */
  router.get('/volume-profile/:symbol', async (req: Request, res: Response<ApiResponse<WebApiVolumeProfileView>>) => {
    const limit = parseLimitQuery(req.query.limit, 20, 100);
    await sendAsyncRouteRead(res, () => bridge.getVolumeProfile(requireSymbol(req.params.symbol), limit));
  });

  return router;
}
