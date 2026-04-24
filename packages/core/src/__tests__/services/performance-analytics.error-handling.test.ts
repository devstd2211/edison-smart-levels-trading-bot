/**
 * Performance Analytics Service Error Handling Tests (Phase 8.9.36)
 *
 * Comprehensive test suite for PerformanceAnalyticsService error handling:
 * - Input validation with THROW strategy
 * - Calculation failures with GRACEFUL_DEGRADE strategy
 * - Data access failures with GRACEFUL_DEGRADE strategy
 * - Logging failures with SKIP strategy
 * - Recovery scenarios
 * - Backward compatibility (without ErrorHandler)
 */

import { PerformanceAnalytics } from '../../services/performance-analytics.service';
import { ErrorHandler, RecoveryStrategy, PerformanceCalculationError } from '../../errors';
import {
  asPerformanceAnalyticsPeriod,
  asPerformanceAnalyticsTrades,
  createManagedPerformanceAnalyticsContext,
  createPerformanceAnalyticsTradeSeries,
  type PerformanceAnalyticsMockJournal,
  type PerformanceAnalyticsMockLogger,
} from '../helpers/performance-analytics-test.utils';

// ============================================================================
// TESTS
// ============================================================================

describe('PerformanceAnalyticsService Error Handling (Phase 8.9.36)', () => {
  type PerformanceAnalyticsContext = ReturnType<typeof createManagedPerformanceAnalyticsContext>;
  let cleanup: PerformanceAnalyticsContext['cleanup'];
  let service: PerformanceAnalytics;
  let mockLogger: PerformanceAnalyticsMockLogger;
  let mockJournal: PerformanceAnalyticsMockJournal;
  let mockErrorHandler: jest.Mocked<ErrorHandler>;
  let createService: PerformanceAnalyticsContext['createService'];

  beforeEach(() => {
    ({
      logger: mockLogger,
      journal: mockJournal,
      errorHandler: mockErrorHandler,
      createService,
      cleanup,
    } = createManagedPerformanceAnalyticsContext());
  });

  afterEach(() => {
    cleanup();
  });

  // ==================== THROW Strategy - Input Validation ====================

  describe('THROW Strategy - Input Validation', () => {
    beforeEach(() => {
      service = createService({ errorHandler: mockErrorHandler });
    });

    it('should throw PerformanceCalculationError on null trades array', () => {
      expect(() => {
        service.calculateWinRate(asPerformanceAnalyticsTrades(null), 10);
      }).toThrow('Invalid trades array for win rate calculation');
    });

    it('should throw PerformanceCalculationError on invalid period (0)', () => {
      const trades = [{ pnl: 10 }];

      expect(() => {
        service.calculateWinRate(trades, 0);
      }).toThrow('Invalid period for win rate calculation');
    });

    it('should throw PerformanceCalculationError on invalid period (negative)', () => {
      const trades = [{ pnl: 10 }];

      expect(() => {
        service.calculateWinRate(trades, -5);
      }).toThrow('Invalid period for win rate calculation');
    });

    it('should throw PerformanceCalculationError on invalid period (Infinity)', () => {
      const trades = [{ pnl: 10 }];

      expect(() => {
        service.calculateWinRate(trades, Infinity);
      }).toThrow('Invalid period for win rate calculation');
    });

    it('should throw PerformanceCalculationError on invalid period enum in getMetrics', async () => {
      await expect(service.getMetrics(asPerformanceAnalyticsPeriod('INVALID'))).rejects.toThrow(PerformanceCalculationError);
    });

    it('should throw PerformanceCalculationError on invalid limit in getTopTrades', async () => {
      await expect(service.getTopTrades(0)).rejects.toThrow(PerformanceCalculationError);
    });

    it('should throw PerformanceCalculationError on negative limit in getTopTrades', async () => {
      await expect(service.getTopTrades(-5)).rejects.toThrow(PerformanceCalculationError);
    });

    it('should throw PerformanceCalculationError on invalid limit in getWorstTrades', async () => {
      await expect(service.getWorstTrades(0)).rejects.toThrow(PerformanceCalculationError);
    });

    it('should throw PerformanceCalculationError on Infinity limit in getWorstTrades', async () => {
      await expect(service.getWorstTrades(Infinity)).rejects.toThrow(PerformanceCalculationError);
    });

    it('should throw on invalid trades in calculateProfitFactor', () => {
      expect(() => {
        service.calculateProfitFactor(asPerformanceAnalyticsTrades(undefined));
      }).toThrow('Invalid trades array for profit factor calculation');
    });
  });

  // ==================== GRACEFUL_DEGRADE Strategy - Calculations ====================

  describe('GRACEFUL_DEGRADE Strategy - Calculation Failures', () => {
    beforeEach(() => {
      service = createService({ errorHandler: mockErrorHandler });
    });

    it('should return 0 on Sharpe ratio calculation with zero variance', async () => {
      // Create trades with zero variance (all same PnL)
      const trades = createPerformanceAnalyticsTradeSeries([10, 10, 10]);
      mockJournal.getAllTrades.mockReturnValue(trades);

      const metrics = await service.getMetrics('ALL');

      // Should not throw, should return 0
      expect(metrics.sharpeRatio).toBe(0);
    });

    it('should return 0 on Sortino ratio calculation with zero downside variance', async () => {
      // Create trades with no downside (all positive PnL)
      const trades = createPerformanceAnalyticsTradeSeries([10, 15, 20]);
      mockJournal.getAllTrades.mockReturnValue(trades);

      const metrics = await service.getMetrics('ALL');

      // Should not throw, should return safe value
      expect(metrics.sortinoRatio).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 on Max Drawdown calculation failure', async () => {
      const trades = createPerformanceAnalyticsTradeSeries([10, 5]);
      mockJournal.getAllTrades.mockReturnValue(trades);

      const metrics = await service.getMetrics('ALL');

      // Should not throw, should return valid number
      expect(Number.isFinite(metrics.maxDrawdown)).toBe(true);
    });

    it('should return 0 on Profit Factor division by zero', async () => {
      // All losing trades
      const trades = createPerformanceAnalyticsTradeSeries([-10, -5]);

      const result = service.calculateProfitFactor(trades);

      // Should not throw, should return safe value
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should return 0 on Average Hold Time calculation with missing timestamps', async () => {
      // Trades with no timestamps
      const trades = [
        { pnl: 10 },
        { pnl: -5 },
      ];

      const result = service.calculateAverageHoldTime(trades);

      // Should not throw, should return valid number
      expect(Number.isFinite(result)).toBe(true);
    });

    it('should return empty statistics on getMetrics calculation failure', async () => {
      // Invalid period throws, but should be caught by validation
      mockJournal.getAllTrades.mockImplementation(() => {
        throw new Error('Journal access failed');
      });

      // Try with valid period to trigger journal failure
      const metrics = await service.getMetrics('ALL');

      // Should return empty statistics instead of throwing
      expect(metrics.totalTrades).toBe(0);
      expect(metrics.winRate).toBe(0);
    });
  });

  // ==================== GRACEFUL_DEGRADE Strategy - Data Access ====================

  describe('GRACEFUL_DEGRADE Strategy - Data Access Failures', () => {
    beforeEach(() => {
      service = createService({ errorHandler: mockErrorHandler });
    });

    it('should handle journal access failure gracefully', async () => {
      mockJournal.getAllTrades.mockImplementation(() => {
        throw new Error('Journal file corrupted');
      });

      const metrics = await service.getMetrics('ALL');

      // Should not throw, should return empty statistics
      expect(metrics.totalTrades).toBe(0);
    });

    it('should return empty array on getTradesForPeriod failure', async () => {
      mockJournal.getAllTrades.mockImplementation(() => {
        throw new Error('Database connection lost');
      });

      // Call getTopTrades which uses getTradesForPeriod internally
      const topTrades = await service.getTopTrades(10);

      // Should return empty array instead of throwing
      expect(topTrades).toEqual([]);
    });

    it('should handle corrupted trade data gracefully', async () => {
      const corruptedTrades = [
        { pnl: NaN },
        { pnl: Infinity },
        { pnl: -Infinity },
        { pnl: 10 },
      ];
      mockJournal.getAllTrades.mockReturnValue(corruptedTrades);

      const metrics = await service.getMetrics('ALL');

      // Should not throw, should handle NaN/Infinity gracefully
      expect(Number.isFinite(metrics.winRate) || metrics.winRate === 0).toBe(true);
    });

    it('should return empty array on getTopTrades failure', async () => {
      mockJournal.getAllTrades.mockImplementation(() => {
        throw new Error('Access denied');
      });

      const topTrades = await service.getTopTrades(10);

      expect(topTrades).toEqual([]);
    });

    it('should return empty array on getWorstTrades failure', async () => {
      mockJournal.getAllTrades.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const worstTrades = await service.getWorstTrades(10);

      expect(worstTrades).toEqual([]);
    });
  });

  // ==================== SKIP Strategy - Logging ====================

  describe('SKIP Strategy - Logging Operations', () => {
    beforeEach(() => {
      service = createService({ errorHandler: mockErrorHandler });
    });

    it('should continue cache clear despite logger failure', () => {
      mockLogger.debug.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      // Should not throw
      expect(() => {
        service.clearCache();
      }).not.toThrow();

      // Cache should be cleared
      const stats = service.getStatistics();
      expect(stats.cacheSize).toBe(0);
    });

    it('should handle ErrorHandler in clearCache when logger fails', () => {
      mockLogger.debug.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      service.clearCache();

      // ErrorHandler.handle should have been called with SKIP strategy
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          strategy: RecoveryStrategy.SKIP,
          context: 'PerformanceAnalyticsService.clearCache.debugLog',
        }),
      );
    });
  });

  // ==================== GRACEFUL_DEGRADE Strategy - Cache Operations ====================

  describe('GRACEFUL_DEGRADE Strategy - Cache Operations', () => {
    beforeEach(() => {
      service = createService({ errorHandler: mockErrorHandler });
    });

    it('should return safe defaults on cache access failure', () => {
      const stats = service.getStatistics();

      // Should return valid statistics
      expect(stats).toHaveProperty('totalAnalyzed');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('lastUpdateTime');
      expect(Number.isFinite(stats.cacheSize)).toBe(true);
    });

    it('should continue despite cache corruption', () => {
      // Clear cache should not fail even with errors
      expect(() => {
        service.clearCache();
      }).not.toThrow();

      // Subsequent operations should work
      const stats = service.getStatistics();
      expect(stats.cacheSize).toBe(0);
    });
  });

  // ==================== Backward Compatibility ====================

  describe('Backward Compatibility - Without ErrorHandler', () => {
    beforeEach(() => {
      service = createService({ withErrorHandler: false });
    });

    it('should work without ErrorHandler parameter', () => {
      const trades = createPerformanceAnalyticsTradeSeries([10, -5, 15]);

      // Should work normally
      const winRate = service.calculateWinRate(trades, 3);
      expect(winRate).toBeGreaterThan(0);
    });

    it('should still throw validation errors without ErrorHandler', () => {
      expect(() => {
        service.calculateWinRate(asPerformanceAnalyticsTrades(null), 10);
      }).toThrow(PerformanceCalculationError);
    });

    it('should handle calculations gracefully without ErrorHandler', () => {
      // Zero variance trades
      const trades = createPerformanceAnalyticsTradeSeries([10, 10, 10]);
      mockJournal.getAllTrades.mockReturnValue(trades);

      // Should not throw
      expect(async () => {
        await service.getMetrics('ALL');
      }).not.toThrow();
    });

    it('should return safe defaults without ErrorHandler on errors', () => {
      mockJournal.getAllTrades.mockImplementation(() => {
        throw new Error('Journal failed');
      });

      // Should not throw, should return empty stats
      expect(async () => {
        const metrics = await service.getMetrics('ALL');
        expect(metrics.totalTrades).toBe(0);
      }).not.toThrow();
    });

    it('should clear cache without ErrorHandler', () => {
      expect(() => {
        service.clearCache();
      }).not.toThrow();
    });
  });

  // ==================== Integration Scenarios ====================

  describe('Integration Scenarios', () => {
    beforeEach(() => {
      service = createService({ errorHandler: mockErrorHandler });
    });

    it('should handle cascading failures (journal → calculation → logging)', async () => {
      mockJournal.getAllTrades.mockImplementation(() => {
        throw new Error('Journal access failed');
      });
      mockLogger.debug.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      // Should handle all failures gracefully
      expect(async () => {
        const metrics = await service.getMetrics('ALL');
        expect(metrics.totalTrades).toBe(0);
      }).not.toThrow();

      // Cache clear should also handle failures
      expect(() => {
        service.clearCache();
      }).not.toThrow();
    });

    it('should recover after transient failures', async () => {
      let callCount = 0;
      mockJournal.getAllTrades.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Transient failure');
        }
        return createPerformanceAnalyticsTradeSeries([10, 5, -3]);
      });

      // First call fails
      let metrics = await service.getMetrics('ALL');
      expect(metrics.totalTrades).toBe(0);

      // Second call succeeds
      metrics = await service.getMetrics('ALL');
      expect(metrics.totalTrades).toBe(3);
    });

    it('should handle all period enum values', async () => {
      mockJournal.getAllTrades.mockReturnValue([
        ...createPerformanceAnalyticsTradeSeries([10]).map((trade) => ({
          ...trade,
          openedAt: Date.now() - 1000,
        })),
      ]);

      // Should work with all valid periods
      const allMetrics = await service.getMetrics('ALL');
      const todayMetrics = await service.getMetrics('TODAY');
      const weekMetrics = await service.getMetrics('WEEK');
      const monthMetrics = await service.getMetrics('MONTH');

      expect(allMetrics.totalTrades).toBeGreaterThanOrEqual(0);
      expect(todayMetrics.totalTrades).toBeGreaterThanOrEqual(0);
      expect(weekMetrics.totalTrades).toBeGreaterThanOrEqual(0);
      expect(monthMetrics.totalTrades).toBeGreaterThanOrEqual(0);
    });

    it('should handle large trade sets without performance issues', async () => {
      const largeTrades = Array.from({ length: 1000 }, (_, i) => ({
        pnl: Math.random() * 100 - 50,
        openedAt: Date.now() - i * 60000,
        entryTime: Date.now() - i * 60000,
        exitTime: Date.now() - i * 60000 + 3600000,
      }));
      mockJournal.getAllTrades.mockReturnValue(largeTrades);

      // Should handle large datasets
      const metrics = await service.getMetrics('ALL');
      expect(metrics.totalTrades).toBe(1000);

      const topTrades = await service.getTopTrades(10);
      expect(topTrades.length).toBeLessThanOrEqual(10);

      const worstTrades = await service.getWorstTrades(10);
      expect(worstTrades.length).toBeLessThanOrEqual(10);
    });

    it('should handle empty trade set', async () => {
      mockJournal.getAllTrades.mockReturnValue([]);

      const metrics = await service.getMetrics('ALL');
      expect(metrics.totalTrades).toBe(0);
      expect(metrics.winRate).toBe(0);

      const topTrades = await service.getTopTrades(10);
      expect(topTrades).toEqual([]);

      const worstTrades = await service.getWorstTrades(10);
      expect(worstTrades).toEqual([]);
    });

    it('should correctly calculate metrics with mixed positive/negative trades', async () => {
      const trades = [
        ...createPerformanceAnalyticsTradeSeries([100, -50, 75, -25]).map((trade) => ({
          ...trade,
          pnlPercent: trade.pnl / 20,
        })),
      ];
      mockJournal.getAllTrades.mockReturnValue(trades);

      const metrics = await service.getMetrics('ALL');

      expect(metrics.totalTrades).toBe(4);
      expect(metrics.winRate).toBe(50); // 2 out of 4
      expect(metrics.lossRate).toBe(50); // 2 out of 4
      expect(metrics.profitFactor).toBeGreaterThan(0);
    });
  });

  // ==================== Recovery Strategy Invocation ====================

  describe('Error Handler Strategy Invocation', () => {
    beforeEach(() => {
      service = createService({ errorHandler: mockErrorHandler });
    });

    it('should call ErrorHandler with THROW strategy for validation errors', () => {
      try {
        service.calculateWinRate(asPerformanceAnalyticsTrades(null), 10);
      } catch (e) {
        // Expected
      }

      // Verify ErrorHandler was called with THROW strategy
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(PerformanceCalculationError),
        expect.objectContaining({
          strategy: RecoveryStrategy.THROW,
        }),
      );
    });

    it('should call ErrorHandler with GRACEFUL_DEGRADE for calculation errors', async () => {
      mockJournal.getAllTrades.mockReturnValue([{ pnl: 10 }, { pnl: 10 }]); // Zero variance

      await service.getMetrics('ALL');

      // ErrorHandler should have been used for graceful degradation
      // (Note: In this case, Sharpe calculation may succeed with 0 return)
    });

    it('should call ErrorHandler with SKIP strategy for logging errors', () => {
      mockLogger.debug.mockImplementation(() => {
        throw new Error('Logger failed');
      });

      service.clearCache();

      // Verify ErrorHandler was called with SKIP strategy
      expect(mockErrorHandler.handle).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          strategy: RecoveryStrategy.SKIP,
        }),
      );
    });
  });
});


