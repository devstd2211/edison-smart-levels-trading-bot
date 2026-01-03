/**
 * BotMetricsService Tests
 *
 * Tests for comprehensive performance monitoring and metrics collection.
 * Covers:
 * - Trade tracking and PnL calculation
 * - Performance metrics (win rate, profit factor, drawdown, etc.)
 * - Event processing metrics
 * - Session duration tracking
 * - Report generation
 * - Metrics reset
 */

import { BotMetricsService, TradeMetrics, PerformanceMetrics, EventMetrics } from '../services/bot-metrics.service';
import { LoggerService } from '../types';

// Mock logger
const createMockLogger = (): Partial<LoggerService> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  getLogFilePath: jest.fn().mockReturnValue('/mock/log/path'),
});

describe('BotMetricsService', () => {
  let metricsService: BotMetricsService;
  let mockLogger: Partial<LoggerService>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    metricsService = new BotMetricsService(mockLogger as LoggerService);
  });

  describe('initialization', () => {
    it('should initialize with empty trades and event metrics', () => {
      expect(metricsService.getTrades()).toEqual([]);
      expect(metricsService.getEventMetrics().size).toBe(0);
    });

    it('should initialize with zero session start time', () => {
      const duration = metricsService.getSessionDuration();
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(1); // Should be nearly zero
    });

    it('should log initialization message', () => {
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('BotMetrics')
      );
    });
  });

  describe('recordTrade', () => {
    it('should record a profitable trade', () => {
      const trade: TradeMetrics = {
        id: 'trade-1',
        direction: 'LONG',
        entryPrice: 100,
        exitPrice: 105,
        quantity: 1,
        pnl: 5,
        pnlPercent: 5,
        duration: 60000,
        exitType: 'TAKE_PROFIT_1',
        timestamp: Date.now(),
      };

      metricsService.recordTrade(trade);
      const trades = metricsService.getTrades();

      expect(trades).toHaveLength(1);
      expect(trades[0]).toEqual(trade);
    });

    it('should record a losing trade', () => {
      const trade: TradeMetrics = {
        id: 'trade-2',
        direction: 'SHORT',
        entryPrice: 100,
        exitPrice: 95,
        quantity: 1,
        pnl: -5,
        pnlPercent: -5,
        duration: 30000,
        exitType: 'STOP_LOSS',
        timestamp: Date.now(),
      };

      metricsService.recordTrade(trade);
      const trades = metricsService.getTrades();

      expect(trades).toHaveLength(1);
      expect(trades[0].pnl).toBe(-5);
    });

    it('should track total profit correctly', () => {
      const trade1: TradeMetrics = {
        id: 'trade-1',
        direction: 'LONG',
        entryPrice: 100,
        exitPrice: 110,
        quantity: 1,
        pnl: 10,
        pnlPercent: 10,
        duration: 60000,
        exitType: 'TAKE_PROFIT_1',
        timestamp: Date.now(),
      };

      const trade2: TradeMetrics = {
        id: 'trade-2',
        direction: 'LONG',
        entryPrice: 100,
        exitPrice: 105,
        quantity: 1,
        pnl: 5,
        pnlPercent: 5,
        duration: 60000,
        exitType: 'TAKE_PROFIT_1',
        timestamp: Date.now(),
      };

      metricsService.recordTrade(trade1);
      metricsService.recordTrade(trade2);

      const perf = metricsService.getPerformanceMetrics();
      expect(perf.totalPnL).toBe(15);
    });

    it('should calculate drawdown correctly', () => {
      // First winning trade - new peak
      const trade1: TradeMetrics = {
        id: 'trade-1',
        direction: 'LONG',
        entryPrice: 100,
        exitPrice: 110,
        quantity: 1,
        pnl: 10,
        pnlPercent: 10,
        duration: 60000,
        exitType: 'TAKE_PROFIT_1',
        timestamp: Date.now(),
      };

      // Losing trade - creates drawdown
      const trade2: TradeMetrics = {
        id: 'trade-2',
        direction: 'LONG',
        entryPrice: 100,
        exitPrice: 95,
        quantity: 1,
        pnl: -5,
        pnlPercent: -5,
        duration: 60000,
        exitType: 'STOP_LOSS',
        timestamp: Date.now(),
      };

      metricsService.recordTrade(trade1);
      const perf1 = metricsService.getPerformanceMetrics();
      expect(perf1.maxDrawdown).toBe(0); // Peak hasn't been breached

      metricsService.recordTrade(trade2);
      const perf2 = metricsService.getPerformanceMetrics();
      expect(perf2.maxDrawdown).toBeGreaterThan(0); // Drawdown occurred
    });

    it('should log trade recording', () => {
      const trade: TradeMetrics = {
        id: 'trade-1',
        direction: 'LONG',
        entryPrice: 100,
        exitPrice: 105,
        quantity: 1,
        pnl: 5,
        pnlPercent: 5.5,
        duration: 60000,
        exitType: 'TAKE_PROFIT_1',
        timestamp: Date.now(),
      };

      metricsService.recordTrade(trade);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Trade recorded'),
        expect.objectContaining({
          tradeId: 'trade-1',
          pnl: '5.0000',
          pnlPercent: '5.50%',
        })
      );
    });
  });

  describe('getTradeById', () => {
    it('should find trade by ID', () => {
      const trade: TradeMetrics = {
        id: 'specific-trade',
        direction: 'LONG',
        entryPrice: 100,
        exitPrice: 105,
        quantity: 1,
        pnl: 5,
        pnlPercent: 5,
        duration: 60000,
        exitType: 'TAKE_PROFIT_1',
        timestamp: Date.now(),
      };

      metricsService.recordTrade(trade);
      const found = metricsService.getTradeById('specific-trade');

      expect(found).toEqual(trade);
    });

    it('should return undefined for non-existent trade', () => {
      const found = metricsService.getTradeById('non-existent');
      expect(found).toBeUndefined();
    });
  });

  describe('recordEvent', () => {
    it('should record a successful event', () => {
      metricsService.recordEvent('positionUpdate', 50, true);

      const events = metricsService.getEventMetrics();
      expect(events.size).toBe(1);

      const metric = events.get('positionUpdate')!;
      expect(metric.count).toBe(1);
      expect(metric.successes).toBe(1);
      expect(metric.failures).toBe(0);
      expect(metric.errorRate).toBe(0);
    });

    it('should record a failed event', () => {
      metricsService.recordEvent('apiCall', 100, false, 'Timeout');

      const events = metricsService.getEventMetrics();
      const metric = events.get('apiCall')!;

      expect(metric.count).toBe(1);
      expect(metric.failures).toBe(1);
      expect(metric.errorRate).toBe(100);
    });

    it('should track duration statistics', () => {
      metricsService.recordEvent('processing', 10, true);
      metricsService.recordEvent('processing', 20, true);
      metricsService.recordEvent('processing', 30, true);

      const events = metricsService.getEventMetrics();
      const metric = events.get('processing')!;

      expect(metric.count).toBe(3);
      expect(metric.minDuration).toBe(10);
      expect(metric.maxDuration).toBe(30);
      expect(metric.avgDuration).toBe(20);
    });

    it('should calculate error rate correctly', () => {
      metricsService.recordEvent('test', 50, true);
      metricsService.recordEvent('test', 50, true);
      metricsService.recordEvent('test', 50, true);
      metricsService.recordEvent('test', 50, false);

      const events = metricsService.getEventMetrics();
      const metric = events.get('test')!;

      expect(metric.count).toBe(4);
      expect(metric.failures).toBe(1);
      expect(metric.successes).toBe(3);
      expect(metric.errorRate).toBeCloseTo(25, 1);
    });

    it('should log failed events with error message', () => {
      metricsService.recordEvent('dangerous', 100, false, 'Network error');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Event processing error'),
        expect.objectContaining({
          error: 'Network error',
        })
      );
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return zero metrics for empty state', () => {
      const perf = metricsService.getPerformanceMetrics();

      expect(perf.totalTrades).toBe(0);
      expect(perf.winningTrades).toBe(0);
      expect(perf.losingTrades).toBe(0);
      expect(perf.winRate).toBe(0);
      expect(perf.totalPnL).toBe(0);
      expect(perf.avgPnLPerTrade).toBe(0);
    });

    it('should calculate win rate correctly', () => {
      const trades = [
        { id: '1', direction: 'LONG' as const, entryPrice: 100, exitPrice: 105, quantity: 1, pnl: 5, pnlPercent: 5, duration: 60000, exitType: 'TAKE_PROFIT_1', timestamp: Date.now() },
        { id: '2', direction: 'LONG' as const, entryPrice: 100, exitPrice: 105, quantity: 1, pnl: 5, pnlPercent: 5, duration: 60000, exitType: 'TAKE_PROFIT_1', timestamp: Date.now() },
        { id: '3', direction: 'LONG' as const, entryPrice: 100, exitPrice: 95, quantity: 1, pnl: -5, pnlPercent: -5, duration: 60000, exitType: 'STOP_LOSS', timestamp: Date.now() },
      ];

      trades.forEach(t => metricsService.recordTrade(t));

      const perf = metricsService.getPerformanceMetrics();
      expect(perf.totalTrades).toBe(3);
      expect(perf.winningTrades).toBe(2);
      expect(perf.losingTrades).toBe(1);
      expect(perf.winRate).toBeCloseTo(66.67, 1);
    });

    it('should calculate profit factor correctly', () => {
      const trades = [
        { id: '1', direction: 'LONG' as const, entryPrice: 100, exitPrice: 110, quantity: 1, pnl: 10, pnlPercent: 10, duration: 60000, exitType: 'TAKE_PROFIT_1', timestamp: Date.now() },
        { id: '2', direction: 'LONG' as const, entryPrice: 100, exitPrice: 95, quantity: 1, pnl: -5, pnlPercent: -5, duration: 60000, exitType: 'STOP_LOSS', timestamp: Date.now() },
      ];

      trades.forEach(t => metricsService.recordTrade(t));

      const perf = metricsService.getPerformanceMetrics();
      expect(perf.profitFactor).toBeCloseTo(2, 1); // 10 / 5
    });

    it('should calculate average win and loss correctly', () => {
      const trades = [
        { id: '1', direction: 'LONG' as const, entryPrice: 100, exitPrice: 120, quantity: 1, pnl: 20, pnlPercent: 20, duration: 60000, exitType: 'TAKE_PROFIT_1', timestamp: Date.now() },
        { id: '2', direction: 'LONG' as const, entryPrice: 100, exitPrice: 110, quantity: 1, pnl: 10, pnlPercent: 10, duration: 60000, exitType: 'TAKE_PROFIT_2', timestamp: Date.now() },
        { id: '3', direction: 'LONG' as const, entryPrice: 100, exitPrice: 95, quantity: 1, pnl: -5, pnlPercent: -5, duration: 60000, exitType: 'STOP_LOSS', timestamp: Date.now() },
      ];

      trades.forEach(t => metricsService.recordTrade(t));

      const perf = metricsService.getPerformanceMetrics();
      expect(perf.avgWin).toBe(15); // (20 + 10) / 2
      expect(perf.avgLoss).toBe(5); // 5 / 1
      expect(perf.winLossRatio).toBe(3); // 15 / 5
    });

    it('should handle zero division in profit factor', () => {
      const trade: TradeMetrics = {
        id: '1',
        direction: 'LONG',
        entryPrice: 100,
        exitPrice: 110,
        quantity: 1,
        pnl: 10,
        pnlPercent: 10,
        duration: 60000,
        exitType: 'TAKE_PROFIT_1',
        timestamp: Date.now(),
      };

      metricsService.recordTrade(trade);

      const perf = metricsService.getPerformanceMetrics();
      expect(perf.profitFactor).toBe(Infinity); // All wins, no losses
    });

    it('should handle zero division in win/loss ratio', () => {
      const trade: TradeMetrics = {
        id: '1',
        direction: 'LONG',
        entryPrice: 100,
        exitPrice: 95,
        quantity: 1,
        pnl: -5,
        pnlPercent: -5,
        duration: 60000,
        exitType: 'STOP_LOSS',
        timestamp: Date.now(),
      };

      metricsService.recordTrade(trade);

      const perf = metricsService.getPerformanceMetrics();
      expect(perf.winLossRatio).toBe(0); // All losses, no wins
    });

    it('should calculate average duration correctly', () => {
      const trades = [
        { id: '1', direction: 'LONG' as const, entryPrice: 100, exitPrice: 105, quantity: 1, pnl: 5, pnlPercent: 5, duration: 60000, exitType: 'TAKE_PROFIT_1', timestamp: Date.now() },
        { id: '2', direction: 'LONG' as const, entryPrice: 100, exitPrice: 105, quantity: 1, pnl: 5, pnlPercent: 5, duration: 120000, exitType: 'TAKE_PROFIT_1', timestamp: Date.now() },
        { id: '3', direction: 'LONG' as const, entryPrice: 100, exitPrice: 105, quantity: 1, pnl: 5, pnlPercent: 5, duration: 180000, exitType: 'TAKE_PROFIT_1', timestamp: Date.now() },
      ];

      trades.forEach(t => metricsService.recordTrade(t));

      const perf = metricsService.getPerformanceMetrics();
      expect(perf.avgDuration).toBe(120000); // (60000 + 120000 + 180000) / 3
    });
  });

  describe('getEventMetrics', () => {
    it('should return empty map initially', () => {
      const events = metricsService.getEventMetrics();
      expect(events.size).toBe(0);
    });

    it('should return map with multiple event types', () => {
      metricsService.recordEvent('event1', 50, true);
      metricsService.recordEvent('event2', 100, true);
      metricsService.recordEvent('event3', 75, false);

      const events = metricsService.getEventMetrics();
      expect(events.size).toBe(3);
      expect(events.has('event1')).toBe(true);
      expect(events.has('event2')).toBe(true);
      expect(events.has('event3')).toBe(true);
    });
  });

  describe('getSessionDuration', () => {
    it('should return duration in seconds', () => {
      const duration = metricsService.getSessionDuration();
      expect(typeof duration).toBe('number');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should increase over time', (done) => {
      const duration1 = metricsService.getSessionDuration();

      setTimeout(() => {
        const duration2 = metricsService.getSessionDuration();
        expect(duration2).toBeGreaterThan(duration1);
        done();
      }, 100);
    });
  });

  describe('printReport', () => {
    it('should log performance report', () => {
      const trades = [
        { id: '1', direction: 'LONG' as const, entryPrice: 100, exitPrice: 110, quantity: 1, pnl: 10, pnlPercent: 10, duration: 60000, exitType: 'TAKE_PROFIT_1', timestamp: Date.now() },
        { id: '2', direction: 'LONG' as const, entryPrice: 100, exitPrice: 95, quantity: 1, pnl: -5, pnlPercent: -5, duration: 60000, exitType: 'STOP_LOSS', timestamp: Date.now() },
      ];

      trades.forEach(t => metricsService.recordTrade(t));
      metricsService.recordEvent('positionUpdate', 50, true);

      metricsService.printReport();

      // Check that various report lines were logged
      const calls = (mockLogger.info as jest.Mock).mock.calls.map(c => c[0]);
      expect(calls.some(c => c.includes('PERFORMANCE METRICS REPORT'))).toBe(true);
      expect(calls.some(c => c.includes('PnL'))).toBe(true);
      expect(calls.some(c => c.includes('Trade Statistics'))).toBe(true);
    });

    it('should handle report with no trades', () => {
      metricsService.printReport();

      const calls = (mockLogger.info as jest.Mock).mock.calls.map(c => c[0]);
      expect(calls.some(c => c.includes('PERFORMANCE METRICS REPORT'))).toBe(true);
    });

    it('should show event processing metrics when events exist', () => {
      metricsService.recordEvent('apiCall', 50, true);
      metricsService.recordEvent('processing', 100, true);

      metricsService.printReport();

      const calls = (mockLogger.info as jest.Mock).mock.calls.map(c => c[0]);
      expect(calls.some(c => c.includes('Event Processing'))).toBe(true);
    });
  });

  describe('reset', () => {
    it('should clear all trades', () => {
      const trade: TradeMetrics = {
        id: '1',
        direction: 'LONG',
        entryPrice: 100,
        exitPrice: 105,
        quantity: 1,
        pnl: 5,
        pnlPercent: 5,
        duration: 60000,
        exitType: 'TAKE_PROFIT_1',
        timestamp: Date.now(),
      };

      metricsService.recordTrade(trade);
      expect(metricsService.getTrades()).toHaveLength(1);

      metricsService.reset();
      expect(metricsService.getTrades()).toHaveLength(0);
    });

    it('should clear all event metrics', () => {
      metricsService.recordEvent('test', 50, true);
      expect(metricsService.getEventMetrics().size).toBe(1);

      metricsService.reset();
      expect(metricsService.getEventMetrics().size).toBe(0);
    });

    it('should reset drawdown and profit/loss tracking', () => {
      const trade: TradeMetrics = {
        id: '1',
        direction: 'LONG',
        entryPrice: 100,
        exitPrice: 110,
        quantity: 1,
        pnl: 10,
        pnlPercent: 10,
        duration: 60000,
        exitType: 'TAKE_PROFIT_1',
        timestamp: Date.now(),
      };

      metricsService.recordTrade(trade);
      const perfBefore = metricsService.getPerformanceMetrics();
      expect(perfBefore.totalPnL).toBe(10);

      metricsService.reset();
      const perfAfter = metricsService.getPerformanceMetrics();
      expect(perfAfter.totalPnL).toBe(0);
      expect(perfAfter.totalTrades).toBe(0);
    });

    it('should log reset message', () => {
      metricsService.reset();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Metrics reset')
      );
    });
  });

  describe('getTrades', () => {
    it('should return a copy of trades array', () => {
      const trade: TradeMetrics = {
        id: '1',
        direction: 'LONG',
        entryPrice: 100,
        exitPrice: 105,
        quantity: 1,
        pnl: 5,
        pnlPercent: 5,
        duration: 60000,
        exitType: 'TAKE_PROFIT_1',
        timestamp: Date.now(),
      };

      metricsService.recordTrade(trade);
      const trades1 = metricsService.getTrades();
      const trades2 = metricsService.getTrades();

      expect(trades1).toEqual(trades2);
      expect(trades1).not.toBe(trades2); // Should be different array instances
    });
  });

  describe('integration scenarios', () => {
    it('should track a complete trading session with multiple trades', () => {
      const trades = [
        { id: 'trade-1', direction: 'LONG' as const, entryPrice: 100, exitPrice: 102, quantity: 10, pnl: 20, pnlPercent: 2, duration: 5000, exitType: 'TAKE_PROFIT_1', timestamp: Date.now() },
        { id: 'trade-2', direction: 'SHORT' as const, entryPrice: 100, exitPrice: 99, quantity: 10, pnl: 10, pnlPercent: 1, duration: 3000, exitType: 'TAKE_PROFIT_1', timestamp: Date.now() },
        { id: 'trade-3', direction: 'LONG' as const, entryPrice: 100, exitPrice: 98, quantity: 10, pnl: -20, pnlPercent: -2, duration: 4000, exitType: 'STOP_LOSS', timestamp: Date.now() },
        { id: 'trade-4', direction: 'SHORT' as const, entryPrice: 100, exitPrice: 101, quantity: 10, pnl: -10, pnlPercent: -1, duration: 2000, exitType: 'STOP_LOSS', timestamp: Date.now() },
      ];

      trades.forEach(t => metricsService.recordTrade(t));

      const perf = metricsService.getPerformanceMetrics();

      expect(perf.totalTrades).toBe(4);
      expect(perf.winningTrades).toBe(2);
      expect(perf.losingTrades).toBe(2);
      expect(perf.winRate).toBe(50);
      expect(perf.totalPnL).toBe(0); // 20 + 10 - 20 - 10
      expect(perf.avgPnLPerTrade).toBe(0);
    });

    it('should track events during trading session', () => {
      metricsService.recordEvent('positionOpened', 50, true);
      metricsService.recordEvent('orderFilled', 100, true);
      metricsService.recordEvent('positionUpdated', 25, true);
      metricsService.recordEvent('positionClosed', 75, true);
      metricsService.recordEvent('websocketError', 50, false, 'Connection lost');

      const events = metricsService.getEventMetrics();

      expect(events.size).toBe(5);
      const totalEvents = Array.from(events.values()).reduce((sum, e) => sum + e.count, 0);
      expect(totalEvents).toBe(5);

      const errorEvent = events.get('websocketError')!;
      expect(errorEvent.errorRate).toBe(100);
    });
  });
});
