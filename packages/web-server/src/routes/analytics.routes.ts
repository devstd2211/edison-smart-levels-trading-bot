/**
 * Analytics Routes
 *
 * Endpoints for trade history, session analysis, and performance metrics
 */

import { Router, Request, Response } from 'express';
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
import type { FileWatcherAnalyticsReadApi } from '../services/file-watcher.service.js';
import {
  parseLimitQuery,
  parsePageQuery,
  requireNonEmptyParam,
  sendAsyncRouteRead,
} from './route-response.js';
import { DEFAULT_EQUITY_CURVE_STARTING_BALANCE } from './analytics.constants.js';

type AnalyticsRouteDerivedReadApi = {
  getPnlHistory(): Promise<PnlHistoryPoint[]>;
  getEquityCurve(): Promise<EquityCurvePoint[]>;
};

export type AnalyticsRouteReadApi = FileWatcherAnalyticsReadApi & AnalyticsRouteDerivedReadApi;
type SessionComparisonRouteQuery = { id1: string; id2: string };

function createPnlHistory(journal: WebApiJournalEntry[]): PnlHistoryPoint[] {
  return journal.map((entry, index) => {
    const cumulativePnL = journal.slice(0, index + 1).reduce((sum, currentEntry) => sum + currentEntry.pnl, 0);

    return {
      time: new Date(entry.timestamp).toISOString(),
      timestamp: entry.timestamp,
      pnl: entry.pnl,
      cumulativePnL,
      tradeNumber: index + 1,
    };
  });
}

function createEquityCurve(journal: WebApiJournalEntry[]): EquityCurvePoint[] {
  const initialBalance = DEFAULT_EQUITY_CURVE_STARTING_BALANCE;
  let runningBalance = initialBalance;

  return journal.map((entry, index) => {
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
}

export function createAnalyticsRouteReadApi(readApi: FileWatcherAnalyticsReadApi): AnalyticsRouteReadApi {
  return {
    getJournalPaginated: (page, limit) => readApi.getJournalPaginated(page, limit),
    getJournalFromLastHours: (hours) => readApi.getJournalFromLastHours(hours),
    getJournalStats: () => readApi.getJournalStats(),
    readSessions: () => readApi.readSessions(),
    compareSessions: (id1, id2) => readApi.compareSessions(id1, id2),
    getStrategyPerformance: () => readApi.getStrategyPerformance(),
    getPnlHistory: async () => createPnlHistory(await readApi.readJournal()),
    getEquityCurve: async () => createEquityCurve(await readApi.readJournal()),
    readJournal: () => readApi.readJournal(),
  };
}

function requireSessionComparisonQuery(
  res: Response<ApiResponse<SessionComparisonPayload>>,
  query: Request['query'],
): SessionComparisonRouteQuery | undefined {
  const id1 = query.id1 as string;
  const id2 = query.id2 as string;

  if (!requireNonEmptyParam(res, id1, 'id1') || !requireNonEmptyParam(res, id2, 'id2')) {
    return undefined;
  }

  return { id1, id2 };
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
    const comparisonQuery = requireSessionComparisonQuery(res, req.query);
    if (!comparisonQuery) {
      return;
    }

    await sendAsyncRouteRead(res, () => fileWatcher.compareSessions(comparisonQuery.id1, comparisonQuery.id2), {
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
    sendAsyncRouteRead(res, () => fileWatcher.getPnlHistory(), { fallbackMessage: 'Failed to fetch PnL history' }));

  /**
   * GET /api/analytics/equity-curve
   * Get equity curve data (cumulative balance over time)
   */
  router.get('/equity-curve', async (_req: Request, res: Response<ApiResponse<EquityCurvePoint[]>>) =>
    sendAsyncRouteRead(res, () => fileWatcher.getEquityCurve(), { fallbackMessage: 'Failed to fetch equity curve' }));

  return router;
}
