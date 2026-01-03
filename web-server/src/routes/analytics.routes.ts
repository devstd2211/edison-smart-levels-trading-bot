/**
 * Analytics Routes
 *
 * Endpoints for trade history, session analysis, and performance metrics
 */

import { Router, Request, Response } from 'express';
import { FileWatcherService } from '../services/file-watcher.service';

export function createAnalyticsRoutes(fileWatcher: FileWatcherService): Router {
  const router = Router();

  /**
   * GET /api/analytics/journal
   * Get paginated trade journal entries
   */
  router.get('/journal', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await fileWatcher.getJournalPaginated(page, limit);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch journal',
      });
    }
  });

  /**
   * GET /api/analytics/journal/last24h
   * Get trades from last 24 hours
   */
  router.get('/journal/last24h', async (req: Request, res: Response) => {
    try {
      const entries = await fileWatcher.getJournalFromLastHours(24);

      res.json({
        success: true,
        data: entries,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch recent journal',
      });
    }
  });

  /**
   * GET /api/analytics/journal/stats
   * Get overall journal statistics
   */
  router.get('/journal/stats', async (req: Request, res: Response) => {
    try {
      const stats = await fileWatcher.getJournalStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch journal statistics',
      });
    }
  });

  /**
   * GET /api/analytics/sessions
   * Get all sessions
   */
  router.get('/sessions', async (req: Request, res: Response) => {
    try {
      const sessions = await fileWatcher.readSessions();

      res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch sessions',
      });
    }
  });

  /**
   * GET /api/analytics/sessions/compare
   * Compare two sessions
   */
  router.get('/sessions/compare', async (req: Request, res: Response) => {
    try {
      const id1 = req.query.id1 as string;
      const id2 = req.query.id2 as string;

      if (!id1 || !id2) {
        return res.status(400).json({
          success: false,
          error: 'Missing id1 or id2 query parameter',
        });
      }

      const comparison = await fileWatcher.comparesessions(id1, id2);

      res.json({
        success: true,
        data: comparison,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to compare sessions',
      });
    }
  });

  /**
   * GET /api/analytics/strategy-performance
   * Get performance breakdown by strategy
   */
  router.get('/strategy-performance', async (req: Request, res: Response) => {
    try {
      const performance = await fileWatcher.getStrategyPerformance();

      res.json({
        success: true,
        data: performance,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch strategy performance',
      });
    }
  });

  /**
   * GET /api/analytics/pnl-history
   * Get PnL over time for charting
   */
  router.get('/pnl-history', async (req: Request, res: Response) => {
    try {
      const journal = await fileWatcher.readJournal();

      // Calculate cumulative PnL over time
      const history = journal.map((entry, index) => {
        const cumulativePnL = journal.slice(0, index + 1).reduce((sum, e) => sum + e.pnl, 0);

        return {
          time: new Date(entry.timestamp).toISOString(),
          timestamp: entry.timestamp,
          pnl: entry.pnl,
          cumulativePnL,
          tradeNumber: index + 1,
        };
      });

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch PnL history',
      });
    }
  });

  /**
   * GET /api/analytics/equity-curve
   * Get equity curve data (cumulative balance over time)
   */
  router.get('/equity-curve', async (req: Request, res: Response) => {
    try {
      const journal = await fileWatcher.readJournal();
      const initialBalance = 1000; // Default starting balance

      // Calculate equity curve
      let runningBalance = initialBalance;
      const equityCurve = journal.map((entry, index) => {
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

      res.json({
        success: true,
        data: equityCurve,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch equity curve',
      });
    }
  });

  return router;
}
