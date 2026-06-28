import { PerformanceAnalytics } from '../../services/performance-analytics.service';
import {
  createPerformanceAnalyticsService,
  createPerformanceAnalyticsJournal,
  createPerformanceAnalyticsTradeSeries,
} from '../helpers/performance-analytics-test.utils';

describe('PerformanceAnalytics functional', () => {
  it('calculateWinRate() returns 0 for empty trades', () => {
    const service = createPerformanceAnalyticsService({
      journal: createPerformanceAnalyticsJournal([]),
    });

    expect(service.calculateWinRate([])).toBe(0);
  });

  it('calculateWinRate() returns correct percent for mixed trades', () => {
    const service = createPerformanceAnalyticsService();
    const trades = createPerformanceAnalyticsTradeSeries([100, -50, 200, -30]);

    const rate = service.calculateWinRate(trades);

    expect(rate).toBe(50);
  });

  it('calculateProfitFactor() returns 100 when all trades are profitable', () => {
    const service = createPerformanceAnalyticsService();
    const trades = createPerformanceAnalyticsTradeSeries([100, 200, 50]);

    expect(service.calculateProfitFactor(trades)).toBe(100);
  });

  it('getMetrics() returns zeroed statistics when journal is empty', async () => {
    const service = createPerformanceAnalyticsService({
      journal: createPerformanceAnalyticsJournal([]),
    });

    const stats = await service.getMetrics('ALL');

    expect(stats.totalTrades).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.totalPnL).toBe(0);
  });

  it('getStatistics() reports zero cacheSize on fresh instance', () => {
    const service = createPerformanceAnalyticsService();

    const stats = service.getStatistics();

    expect(stats.cacheSize).toBe(0);
    expect(stats.totalAnalyzed).toBe(0);
  });

  it('clearCache() does not throw on a fresh instance', () => {
    const service = createPerformanceAnalyticsService();

    expect(() => service.clearCache()).not.toThrow();
  });

  describe('export boundary', () => {
    it('PerformanceAnalytics is a constructible class', () => {
      expect(typeof PerformanceAnalytics).toBe('function');
    });
  });
});
