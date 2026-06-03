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
import {
  ANALYTICS_ROUTE_FALLBACK_MESSAGES,
  DEFAULT_ANALYTICS_JOURNAL_LIMIT,
  DEFAULT_ANALYTICS_JOURNAL_PAGE,
  DEFAULT_ANALYTICS_RECENT_JOURNAL_HOURS,
  DEFAULT_EQUITY_CURVE_STARTING_BALANCE,
  MAX_ANALYTICS_JOURNAL_LIMIT,
} from './analytics.constants.js';

type AnalyticsRouteDerivedReadApi = {
  getPnlHistory(): Promise<PnlHistoryPoint[]>;
  getEquityCurve(): Promise<EquityCurvePoint[]>;
};

type AnalyticsRouteJournalReadApi = Pick<
  FileWatcherAnalyticsReadApi,
  'getJournalPaginated' | 'getJournalFromLastHours' | 'getJournalStats' | 'readJournal'
>;
type AnalyticsRouteSessionReadApi = Pick<FileWatcherAnalyticsReadApi, 'readSessions' | 'compareSessions'>;
type AnalyticsRouteStrategyReadApi = Pick<FileWatcherAnalyticsReadApi, 'getStrategyPerformance'>;
type AnalyticsRouteCurveReadApi = AnalyticsRouteDerivedReadApi;

export type AnalyticsRouteReadApi = {
  journal: AnalyticsRouteJournalReadApi;
  sessions: AnalyticsRouteSessionReadApi;
  strategy: AnalyticsRouteStrategyReadApi;
  curves: AnalyticsRouteCurveReadApi;
};
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
  const journal = {
    getJournalPaginated: (page: number | undefined, limit: number | undefined) => readApi.getJournalPaginated(page, limit),
    getJournalFromLastHours: (hours: number | undefined) => readApi.getJournalFromLastHours(hours),
    getJournalStats: () => readApi.getJournalStats(),
    readJournal: () => readApi.readJournal(),
  };

  return {
    journal,
    sessions: {
      readSessions: () => readApi.readSessions(),
      compareSessions: (id1, id2) => readApi.compareSessions(id1, id2),
    },
    strategy: {
      getStrategyPerformance: () => readApi.getStrategyPerformance(),
    },
    curves: {
      getPnlHistory: async () => createPnlHistory(await journal.readJournal()),
      getEquityCurve: async () => createEquityCurve(await journal.readJournal()),
    },
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

export function createAnalyticsRoutes(analyticsApi: AnalyticsRouteReadApi): Router {
  const router = Router();

  /**
   * GET /api/analytics/journal
   * Get paginated trade journal entries
   */
  router.get('/journal', async (req: Request, res: Response<ApiResponse<JournalPagePayload>>) =>
    sendAsyncRouteRead(res, async () => {
      const page = parsePageQuery(req.query.page, DEFAULT_ANALYTICS_JOURNAL_PAGE);
      const limit = parseLimitQuery(req.query.limit, DEFAULT_ANALYTICS_JOURNAL_LIMIT, MAX_ANALYTICS_JOURNAL_LIMIT);
      return analyticsApi.journal.getJournalPaginated(page, limit);
    }, { fallbackMessage: ANALYTICS_ROUTE_FALLBACK_MESSAGES.journal }));

  /**
   * GET /api/analytics/journal/last24h
   * Get trades from last 24 hours
   */
  router.get('/journal/last24h', async (_req: Request, res: Response<ApiResponse<WebApiJournalEntry[]>>) =>
    sendAsyncRouteRead(res, () => analyticsApi.journal.getJournalFromLastHours(DEFAULT_ANALYTICS_RECENT_JOURNAL_HOURS), {
      fallbackMessage: ANALYTICS_ROUTE_FALLBACK_MESSAGES.recentJournal,
    }));

  /**
   * GET /api/analytics/journal/stats
   * Get overall journal statistics
   */
  router.get('/journal/stats', async (_req: Request, res: Response<ApiResponse<JournalStatsPayload>>) =>
    sendAsyncRouteRead(res, () => analyticsApi.journal.getJournalStats(), {
      fallbackMessage: ANALYTICS_ROUTE_FALLBACK_MESSAGES.journalStats,
    }));

  /**
   * GET /api/analytics/sessions
   * Get all sessions
   */
  router.get('/sessions', async (_req: Request, res: Response<ApiResponse<WebApiSessionStats[]>>) =>
    sendAsyncRouteRead(res, () => analyticsApi.sessions.readSessions(), {
      fallbackMessage: ANALYTICS_ROUTE_FALLBACK_MESSAGES.sessions,
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

    await sendAsyncRouteRead(res, () => analyticsApi.sessions.compareSessions(comparisonQuery.id1, comparisonQuery.id2), {
      fallbackMessage: ANALYTICS_ROUTE_FALLBACK_MESSAGES.compareSessions,
    });
  });

  /**
   * GET /api/analytics/strategy-performance
   * Get performance breakdown by strategy
   */
  router.get('/strategy-performance', async (_req: Request, res: Response<ApiResponse<StrategyPerformancePayload[]>>) =>
    sendAsyncRouteRead(res, () => analyticsApi.strategy.getStrategyPerformance(), {
      fallbackMessage: ANALYTICS_ROUTE_FALLBACK_MESSAGES.strategyPerformance,
    }));

  /**
   * GET /api/analytics/pnl-history
   * Get PnL over time for charting
   */
  router.get('/pnl-history', async (_req: Request, res: Response<ApiResponse<PnlHistoryPoint[]>>) =>
    sendAsyncRouteRead(res, () => analyticsApi.curves.getPnlHistory(), {
      fallbackMessage: ANALYTICS_ROUTE_FALLBACK_MESSAGES.pnlHistory,
    }));

  /**
   * GET /api/analytics/equity-curve
   * Get equity curve data (cumulative balance over time)
   */
  router.get('/equity-curve', async (_req: Request, res: Response<ApiResponse<EquityCurvePoint[]>>) =>
    sendAsyncRouteRead(res, () => analyticsApi.curves.getEquityCurve(), {
      fallbackMessage: ANALYTICS_ROUTE_FALLBACK_MESSAGES.equityCurve,
    }));

  return router;
}
