/**
 * Analytics Routes
 *
 * Endpoints for trade history, session analysis, and performance metrics
 */

import { Router, Request, Response } from 'express';
import type { FileWatcherService } from '../services/file-watcher.service';
import type {
  ApiResponse,
  EquityCurvePoint,
  JournalPagePayload,
  JournalStatsPayload,
  PnlHistoryPoint,
  SessionComparisonPayload,
  StrategyPerformancePayload,
} from '@edison/contracts/runtime-api';
import type {
  WebApiJournalEntry,
  WebApiSessionStats,
} from '@edison/contracts/web-api';
import {
  parseLimitQuery,
  parsePageQuery,
  requireNonEmptyParam,
  sendAsyncRouteRead,
} from './route-response.js';
import { DEFAULT_EQUITY_CURVE_STARTING_BALANCE } from './analytics.constants.js';

export type AnalyticsRouteReadApi = Pick<
  FileWatcherService,
  | 'getJournalPaginated'
  | 'getJournalFromLastHours'
  | 'getJournalStats'
  | 'readSessions'
  | 'comparesessions'
  | 'getStrategyPerformance'
  | 'readJournal'
>;

export function createAnalyticsRouteReadApi(readApi: AnalyticsRouteReadApi): AnalyticsRouteReadApi {
  return {
    getJournalPaginated: (page, limit) => readApi.getJournalPaginated(page, limit),
    getJournalFromLastHours: (hours) => readApi.getJournalFromLastHours(hours),
    getJournalStats: () => readApi.getJournalStats(),
    readSessions: () => readApi.readSessions(),
    comparesessions: (id1, id2) => readApi.comparesessions(id1, id2),
    getStrategyPerformance: () => readApi.getStrategyPerformance(),
    readJournal: () => readApi.readJournal(),
  };
}

export function createAnalyticsRoutes(fileWatcher: AnalyticsRouteReadApi): Router {
  const router = Router();

  /**
   * GET /api/analytics/journal
   * Get paginated trade journal entries
   */
  router.get('/journal', async (req: Request, res: Response<ApiResponse<JournalPagePayload>>) =>
    sendAsyncRouteRead(res, async () => {
      const page = parsePageQuery(req.query.page);
      const limit = parseLimitQuery(req.query.limit, 50, 500);
      return fileWatcher.getJournalPaginated(page, limit);
    }, { fallbackMessage: 'Failed to fetch journal' }));

  /**
   * GET /api/analytics/journal/last24h
   * Get trades from last 24 hours
   */
  router.get('/journal/last24h', async (_req: Request, res: Response<ApiResponse<WebApiJournalEntry[]>>) =>
    sendAsyncRouteRead(res, () => fileWatcher.getJournalFromLastHours(24), {
      fallbackMessage: 'Failed to fetch recent journal',
    }));

  /**
   * GET /api/analytics/journal/stats
   * Get overall journal statistics
   */
  router.get('/journal/stats', async (_req: Request, res: Response<ApiResponse<JournalStatsPayload>>) =>
    sendAsyncRouteRead(res, () => fileWatcher.getJournalStats(), {
      fallbackMessage: 'Failed to fetch journal statistics',
    }));

  /**
   * GET /api/analytics/sessions
   * Get all sessions
   */
  router.get('/sessions', async (_req: Request, res: Response<ApiResponse<WebApiSessionStats[]>>) =>
    sendAsyncRouteRead(res, () => fileWatcher.readSessions(), {
      fallbackMessage: 'Failed to fetch sessions',
    }));

  /**
   * GET /api/analytics/sessions/compare
   * Compare two sessions
   */
  router.get('/sessions/compare', async (req: Request, res: Response<ApiResponse<SessionComparisonPayload>>) => {
    const id1 = req.query.id1 as string;
    const id2 = req.query.id2 as string;

    if (!requireNonEmptyParam(res, id1, 'id1') || !requireNonEmptyParam(res, id2, 'id2')) {
      return;
    }

    await sendAsyncRouteRead(res, () => fileWatcher.comparesessions(id1, id2), {
      fallbackMessage: 'Failed to compare sessions',
    });
  });

  /**
   * GET /api/analytics/strategy-performance
   * Get performance breakdown by strategy
   */
  router.get('/strategy-performance', async (_req: Request, res: Response<ApiResponse<StrategyPerformancePayload[]>>) =>
    sendAsyncRouteRead(res, () => fileWatcher.getStrategyPerformance(), {
      fallbackMessage: 'Failed to fetch strategy performance',
    }));

  /**
   * GET /api/analytics/pnl-history
   * Get PnL over time for charting
   */
  router.get('/pnl-history', async (_req: Request, res: Response<ApiResponse<PnlHistoryPoint[]>>) =>
    sendAsyncRouteRead(res, async () => {
      const journal = await fileWatcher.readJournal();

      // Calculate cumulative PnL over time
      const history: PnlHistoryPoint[] = journal.map((entry, index) => {
        const cumulativePnL = journal.slice(0, index + 1).reduce((sum, e) => sum + e.pnl, 0);

        return {
          time: new Date(entry.timestamp).toISOString(),
          timestamp: entry.timestamp,
          pnl: entry.pnl,
          cumulativePnL,
          tradeNumber: index + 1,
        };
      });

      return history;
    }, { fallbackMessage: 'Failed to fetch PnL history' }));

  /**
   * GET /api/analytics/equity-curve
   * Get equity curve data (cumulative balance over time)
   */
  router.get('/equity-curve', async (_req: Request, res: Response<ApiResponse<EquityCurvePoint[]>>) =>
    sendAsyncRouteRead(res, async () => {
      const journal = await fileWatcher.readJournal();
      const initialBalance = DEFAULT_EQUITY_CURVE_STARTING_BALANCE;

      // Calculate equity curve
      let runningBalance = initialBalance;
      const equityCurve: EquityCurvePoint[] = journal.map((entry, index) => {
        runningBalance += entry.pnl;

        return {
          time: new Date(entry.timestamp).toISOString(),
          timestamp: entry.timestamp,
          equity: runningBalance,
          pnl: entry.pnl,
          tradeNumber: index + 1,
          drawdown: initialBalance > 0 ? ((runningBalance - initialBalance) / initialBalance) * 100 : 0,
        };
      });

      return equityCurve;
    }, { fallbackMessage: 'Failed to fetch equity curve' }));

  return router;
}
