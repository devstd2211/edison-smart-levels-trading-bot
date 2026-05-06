/**
 * Analytics Routes
 *
 * Endpoints for trade history, session analysis, and performance metrics
 */

import { Router, Request, Response } from 'express';
import { FileWatcherService } from '../services/file-watcher.service';
import type {
  ApiResponse,
  EquityCurvePoint,
  JournalPagePayload,
  JournalStatsPayload,
  PnlHistoryPoint,
  SessionComparisonPayload,
  StrategyPerformancePayload,
  WebApiJournalEntry,
  WebApiSessionStats,
} from '@edison/contracts';
import { handleRouteError, parseLimitQuery, parsePageQuery, requireNonEmptyParam, sendSuccess } from './route-response.js';
import { DEFAULT_EQUITY_CURVE_STARTING_BALANCE } from './analytics.constants.js';

export function createAnalyticsRoutes(fileWatcher: FileWatcherService): Router {
  const router = Router();

  /**
   * GET /api/analytics/journal
   * Get paginated trade journal entries
   */
  router.get('/journal', async (req: Request, res: Response<ApiResponse<JournalPagePayload>>) => {
    try {
      const page = parsePageQuery(req.query.page);
      const limit = parseLimitQuery(req.query.limit, 50, 500);
      sendSuccess(res, await fileWatcher.getJournalPaginated(page, limit));
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch journal');
    }
  });

  /**
   * GET /api/analytics/journal/last24h
   * Get trades from last 24 hours
   */
  router.get('/journal/last24h', async (req: Request, res: Response<ApiResponse<WebApiJournalEntry[]>>) => {
    try {
      sendSuccess(res, await fileWatcher.getJournalFromLastHours(24));
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch recent journal');
    }
  });

  /**
   * GET /api/analytics/journal/stats
   * Get overall journal statistics
   */
  router.get('/journal/stats', async (req: Request, res: Response<ApiResponse<JournalStatsPayload>>) => {
    try {
      sendSuccess(res, await fileWatcher.getJournalStats());
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch journal statistics');
    }
  });

  /**
   * GET /api/analytics/sessions
   * Get all sessions
   */
  router.get('/sessions', async (req: Request, res: Response<ApiResponse<WebApiSessionStats[]>>) => {
    try {
      sendSuccess(res, await fileWatcher.readSessions());
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch sessions');
    }
  });

  /**
   * GET /api/analytics/sessions/compare
   * Compare two sessions
   */
  router.get('/sessions/compare', async (req: Request, res: Response<ApiResponse<SessionComparisonPayload>>) => {
    try {
      const id1 = req.query.id1 as string;
      const id2 = req.query.id2 as string;

      if (!requireNonEmptyParam(res, id1, 'id1') || !requireNonEmptyParam(res, id2, 'id2')) {
        return;
      }
      sendSuccess(res, await fileWatcher.comparesessions(id1, id2));
    } catch (error) {
      handleRouteError(res, error, 'Failed to compare sessions');
    }
  });

  /**
   * GET /api/analytics/strategy-performance
   * Get performance breakdown by strategy
   */
  router.get('/strategy-performance', async (req: Request, res: Response<ApiResponse<StrategyPerformancePayload[]>>) => {
    try {
      sendSuccess(res, await fileWatcher.getStrategyPerformance());
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch strategy performance');
    }
  });

  /**
   * GET /api/analytics/pnl-history
   * Get PnL over time for charting
   */
  router.get('/pnl-history', async (req: Request, res: Response<ApiResponse<PnlHistoryPoint[]>>) => {
    try {
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

      sendSuccess(res, history);
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch PnL history');
    }
  });

  /**
   * GET /api/analytics/equity-curve
   * Get equity curve data (cumulative balance over time)
   */
  router.get('/equity-curve', async (req: Request, res: Response<ApiResponse<EquityCurvePoint[]>>) => {
    try {
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

      sendSuccess(res, equityCurve);
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch equity curve');
    }
  });

  return router;
}
