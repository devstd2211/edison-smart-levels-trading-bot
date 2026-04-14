/**
 * Phase 9.1: Performance Analytics Service Tests
 *
 * Unit tests for PerformanceAnalytics service
 * Tests trade performance calculations and analysis
 *
 * Coverage:
 * - Win rate calculation
 * - Profit factor analysis
 * - Sharpe/Sortino ratio calculation
 * - Maximum drawdown analysis
 * - Period-based metrics (ALL/TODAY/WEEK/MONTH)
 * - Top/worst trade identification
 */

import { PerformanceAnalytics } from '../../services/performance-analytics.service';
import { LoggerService } from '../../types/legacy';
import {
  createManagedPerformanceAnalyticsContext,
  createLegacyPerformanceAnalyticsService,
  createPerformanceAnalyticsTrade,
  createPerformanceAnalyticsTrades,
  type PerformanceAnalyticsMockJournal,
  type PerformanceAnalyticsMockLogger,
} from '../helpers/performance-analytics-test.utils';

describe('PerformanceAnalytics Service Tests', () => {
  let analytics: PerformanceAnalytics;
  let mockJournalService: PerformanceAnalyticsMockJournal;
  let mockLogger: PerformanceAnalyticsMockLogger;
  let createService: () => PerformanceAnalytics;
  let cleanup: () => void;

  beforeEach(() => {
    const context = createManagedPerformanceAnalyticsContext();
    ({ cleanup } = context);
    createService = () =>
      createLegacyPerformanceAnalyticsService({
        config: context.config,
        journal: context.journal,
        logger: context.logger,
      });
    analytics = createService();
    mockJournalService = context.journal;
    mockLogger = context.logger;
  });

  afterEach(() => {
    cleanup();
  });

  // ========================================================================
  // WIN RATE CALCULATION TESTS
  // ========================================================================

  describe('Win Rate Calculation', () => {
    it('should calculate 100% win rate with all profitable trades', () => {
      const trades = createPerformanceAnalyticsTrades([
        { pnl: 100, pnlPercent: 1 },
        { pnl: 200, pnlPercent: 2 },
        { pnl: 150, pnlPercent: 1.5 },
      ]);

      const winRate = analytics.calculateWinRate(trades);

      expect(winRate).toBe(100);
    });

    it('should calculate 0% win rate with all losing trades', () => {
      const trades = createPerformanceAnalyticsTrades([
        { pnl: -100, pnlPercent: -1 },
        { pnl: -200, pnlPercent: -2 },
        { pnl: -150, pnlPercent: -1.5 },
      ]);

      const winRate = analytics.calculateWinRate(trades);

      expect(winRate).toBe(0);
    });

    it('should calculate 50% win rate with mixed trades', () => {
      const trades = createPerformanceAnalyticsTrades([
        { pnl: 100, pnlPercent: 1 },
        { pnl: -100, pnlPercent: -1 },
      ]);

      const winRate = analytics.calculateWinRate(trades);

      expect(winRate).toBe(50);
    });

    it('should return 0 for empty trade list', () => {
      const winRate = analytics.calculateWinRate([]);

      expect(winRate).toBe(0);
    });
  });

  // ========================================================================
  // PROFIT FACTOR ANALYSIS TESTS
  // ========================================================================

  describe('Profit Factor Analysis', () => {
    it('should calculate profit factor > 1 for profitable trades', () => {
      const trades = createPerformanceAnalyticsTrades([
        { pnl: 500 },
        { pnl: 300 },
        { pnl: -200 },
      ]);

      const profitFactor = analytics.calculateProfitFactor(trades);

      // Gross profit: 500 + 300 = 800
      // Gross loss: 200
      // Profit Factor: 800 / 200 = 4.0
      expect(profitFactor).toBe(4.0);
    });

    it('should return 100 when all trades are profitable', () => {
      const trades = createPerformanceAnalyticsTrades([{ pnl: 100 }, { pnl: 200 }]);

      const profitFactor = analytics.calculateProfitFactor(trades);

      expect(profitFactor).toBe(100); // Profit / 0 loss = 100 (cap)
    });

    it('should return 0 when all trades are losses', () => {
      const trades = createPerformanceAnalyticsTrades([{ pnl: -100 }, { pnl: -200 }]);

      const profitFactor = analytics.calculateProfitFactor(trades);

      expect(profitFactor).toBe(0); // 0 profit / loss = 0
    });

    it('should return 0 for empty trade list', () => {
      const profitFactor = analytics.calculateProfitFactor([]);

      expect(profitFactor).toBe(0);
    });
  });

  // ========================================================================
  // SHARPE & SORTINO RATIO TESTS
  // ========================================================================

  describe('Sharpe & Sortino Ratios', () => {
    it('should calculate Sharpe ratio > 0 for consistent profits', async () => {
      const trades = createPerformanceAnalyticsTrades([
        { pnl: 100 },
        { pnl: 120 },
        { pnl: 110 },
      ]);
      mockJournalService.getAllTrades.mockReturnValue(trades);

      const stats = await analytics.getMetrics('ALL');

      expect(stats.sharpeRatio).toBeGreaterThan(0);
    });

    it('should calculate Sortino ratio > Sharpe for mixed performance', async () => {
      const trades = createPerformanceAnalyticsTrades([
        { pnl: 500 },
        { pnl: -100 },
        { pnl: 300 },
      ]);
      mockJournalService.getAllTrades.mockReturnValue(trades);

      const stats = await analytics.getMetrics('ALL');

      // Sortino should be >= Sharpe (penalizes downside less)
      expect(stats.sortinoRatio).toBeGreaterThanOrEqual(stats.sharpeRatio);
    });

    it('should return 0 for single trade', async () => {
      const trades = [createPerformanceAnalyticsTrade({ pnl: 100 })];
      mockJournalService.getAllTrades.mockReturnValue(trades);

      const stats = await analytics.getMetrics('ALL');

      expect(stats.sharpeRatio).toBe(0);
      expect(stats.sortinoRatio).toBe(0);
    });
  });

  // ========================================================================
  // MAXIMUM DRAWDOWN TESTS
  // ========================================================================

  describe('Maximum Drawdown Analysis', () => {
    it('should calculate max drawdown as 0 for consistently profitable trades', async () => {
      const trades = createPerformanceAnalyticsTrades([
        { pnl: 100 },
        { pnl: 200 },
        { pnl: 150 },
      ]);
      mockJournalService.getAllTrades.mockReturnValue(trades);

      const stats = await analytics.getMetrics('ALL');

      expect(stats.maxDrawdown).toBe(0);
    });

    it('should detect max drawdown when peak followed by loss', async () => {
      const trades = createPerformanceAnalyticsTrades([{ pnl: 1000 }, { pnl: -600 }]);
      mockJournalService.getAllTrades.mockReturnValue(trades);

      const stats = await analytics.getMetrics('ALL');

      // Max drawdown: (1000 - 400) / 1000 = 60%
      expect(stats.maxDrawdown).toBeCloseTo(60, 1);
    });

    it('should handle continuous drawdown correctly', async () => {
      const trades = createPerformanceAnalyticsTrades([
        { pnl: 500 },
        { pnl: -200 },
        { pnl: -150 },
      ]);
      mockJournalService.getAllTrades.mockReturnValue(trades);

      const stats = await analytics.getMetrics('ALL');

      expect(stats.maxDrawdown).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // PERIOD-BASED METRICS TESTS
  // ========================================================================

  describe('Period-Based Metrics', () => {
    it('should return all trades for ALL period', async () => {
      const trades = createPerformanceAnalyticsTrades([
        { openedAt: Date.now() - 86400000 * 40 },
        { openedAt: Date.now() - 100 },
      ]);
      mockJournalService.getAllTrades.mockReturnValue(trades);

      const stats = await analytics.getMetrics('ALL');

      expect(stats.totalTrades).toBe(2);
    });

    it('should filter trades for TODAY period', async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime();

      const trades = createPerformanceAnalyticsTrades([
        {
          openedAt: todayTimestamp + 3600000, // Today
          entryTime: todayTimestamp + 3600000,
        },
        {
          openedAt: todayTimestamp - 86400000, // Yesterday
          entryTime: todayTimestamp - 86400000,
        },
      ]);
      mockJournalService.getAllTrades.mockReturnValue(trades);

      const stats = await analytics.getMetrics('TODAY');

      expect(stats.totalTrades).toBe(1);
    });

    it('should filter trades for WEEK period', async () => {
      const now = Date.now();
      const trades = createPerformanceAnalyticsTrades([
        { openedAt: now - 86400000 * 5 },
        { openedAt: now - 86400000 * 15 },
      ]);
      mockJournalService.getAllTrades.mockReturnValue(trades);

      const stats = await analytics.getMetrics('WEEK');

      expect(stats.totalTrades).toBe(1);
    });

    it('should filter trades for MONTH period', async () => {
      const now = Date.now();
      const trades = createPerformanceAnalyticsTrades([
        { openedAt: now - 86400000 * 20 },
        { openedAt: now - 86400000 * 50 },
      ]);
      mockJournalService.getAllTrades.mockReturnValue(trades);

      const stats = await analytics.getMetrics('MONTH');

      expect(stats.totalTrades).toBe(1);
    });
  });

  // ========================================================================
  // TOP/WORST TRADES TESTS
  // ========================================================================

  describe('Top/Worst Trades Identification', () => {
    it('should identify top (best) trades sorted by PnL', async () => {
      const trades = [
        createPerformanceAnalyticsTrade({ tradeId: 'trade1', pnl: 100 }),
        createPerformanceAnalyticsTrade({ tradeId: 'trade2', pnl: 500 }),
        createPerformanceAnalyticsTrade({ tradeId: 'trade3', pnl: 250 }),
      ];
      mockJournalService.getAllTrades.mockReturnValue(trades);

      const topTrades = await analytics.getTopTrades(2);

      expect(topTrades.length).toBe(2);
      expect(topTrades[0].tradeId).toBe('trade2'); // 500 is largest
      expect(topTrades[1].tradeId).toBe('trade3'); // 250 is second
    });

    it('should identify worst (losing) trades sorted by PnL', async () => {
      const trades = [
        createPerformanceAnalyticsTrade({ tradeId: 'trade1', pnl: 100 }),
        createPerformanceAnalyticsTrade({ tradeId: 'trade2', pnl: -200 }),
        createPerformanceAnalyticsTrade({ tradeId: 'trade3', pnl: -50 }),
      ];
      mockJournalService.getAllTrades.mockReturnValue(trades);

      const worstTrades = await analytics.getWorstTrades(2);

      expect(worstTrades.length).toBe(2);
      expect(worstTrades[0].tradeId).toBe('trade2'); // -200 is worst
      expect(worstTrades[1].tradeId).toBe('trade3'); // -50 is second worst
    });

    it('should respect limit parameter for top trades', async () => {
      const trades = [
        createPerformanceAnalyticsTrade({ pnl: 100 }),
        createPerformanceAnalyticsTrade({ pnl: 200 }),
        createPerformanceAnalyticsTrade({ pnl: 300 }),
        createPerformanceAnalyticsTrade({ pnl: 400 }),
      ];
      mockJournalService.getAllTrades.mockReturnValue(trades);

      const topTrades = await analytics.getTopTrades(2);

      expect(topTrades.length).toBe(2);
    });
  });

  // ========================================================================
  // COMPREHENSIVE METRICS TESTS
  // ========================================================================

  describe('Comprehensive Metrics', () => {
    it('should calculate all metrics for a mixed trade set', async () => {
      const trades = [
        createPerformanceAnalyticsTrade({ pnl: 500, pnlPercent: 5 }),
        createPerformanceAnalyticsTrade({ pnl: 300, pnlPercent: 3 }),
        createPerformanceAnalyticsTrade({ pnl: -100, pnlPercent: -1 }),
        createPerformanceAnalyticsTrade({ pnl: 200, pnlPercent: 2 }),
      ];
      mockJournalService.getAllTrades.mockReturnValue(trades);

      const stats = await analytics.getMetrics('ALL');

      expect(stats.totalTrades).toBe(4);
      expect(stats.winRate).toBeGreaterThan(0);
      expect(stats.lossRate).toBeGreaterThan(0);
      expect(stats.profitFactor).toBeGreaterThan(1);
      expect(stats.totalPnL).toBe(900);
    });

    it('should return empty statistics when no trades', async () => {
      mockJournalService.getAllTrades.mockReturnValue([]);

      const stats = await analytics.getMetrics('ALL');

      expect(stats.totalTrades).toBe(0);
      expect(stats.winRate).toBe(0);
      expect(stats.profitFactor).toBe(0);
      expect(stats.sharpeRatio).toBe(0);
    });

    it('should calculate average holding time correctly', () => {
      const now = Date.now();
      const trades = [
        createPerformanceAnalyticsTrade({
          entryTime: now - 3600000, // 1 hour
          exitTime: now,
        }),
        createPerformanceAnalyticsTrade({
          entryTime: now - 7200000, // 2 hours
          exitTime: now,
        }),
      ];

      const avgHoldTime = analytics.calculateAverageHoldTime(trades);

      // Average of 60 + 120 = 180 / 2 = 90 minutes
      expect(avgHoldTime).toBe(90);
    });
  });

  // ========================================================================
  // CACHE MANAGEMENT TESTS
  // ========================================================================

  describe('Cache Management', () => {
    it('should clear metrics cache', () => {
      // Add something to cache by getting statistics
      analytics.getStatistics();

      // Clear cache
      analytics.clearCache();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cleared metrics cache')
      );
    });

    it('should provide cache statistics', () => {
      const stats = analytics.getStatistics();

      expect(stats.cacheSize).toBeDefined();
      expect(stats.totalAnalyzed).toBeDefined();
      expect(stats.lastUpdateTime).toBeDefined();
    });
  });

  // ========================================================================
  // EDGE CASES & BOUNDARY TESTS
  // ========================================================================

  describe('Edge Cases & Boundaries', () => {
    it('should handle trades with zero PnL', async () => {
      const trades = [
        createPerformanceAnalyticsTrade({ pnl: 0, pnlPercent: 0 }),
        createPerformanceAnalyticsTrade({ pnl: 100, pnlPercent: 1 }),
      ];
      mockJournalService.getAllTrades.mockReturnValue(trades);

      const stats = await analytics.getMetrics('ALL');

      expect(stats.totalTrades).toBe(2);
      expect(stats.winRate).toBe(50); // Only 1 of 2 is profitable
    });

    it('should handle very large profit factors', async () => {
      const trades = [
        createPerformanceAnalyticsTrade({ pnl: 10000 }),
        createPerformanceAnalyticsTrade({ pnl: 5000 }),
        createPerformanceAnalyticsTrade({ pnl: -1 }),
      ];
      mockJournalService.getAllTrades.mockReturnValue(trades);

      const stats = await analytics.getMetrics('ALL');

      expect(stats.profitFactor).toBeGreaterThan(10000);
    });

    it('should handle identical pnl trades', async () => {
      const trades = [
        createPerformanceAnalyticsTrade({ pnl: 100 }),
        createPerformanceAnalyticsTrade({ pnl: 100 }),
        createPerformanceAnalyticsTrade({ pnl: 100 }),
      ];

      const avgHoldTime = analytics.calculateAverageHoldTime(trades);

      expect(avgHoldTime).toBeGreaterThan(0);
    });
  });
});

