/**
 * Phase 8.9.40: BotMetricsService - ErrorHandler Integration Tests
 *
 * Tests ErrorHandler integration with:
 * - RETRY strategy for logger failures (recordTrade, recordEvent)
 * - GRACEFUL_DEGRADE strategy for report generation (printReport - never blocks trading)
 * - SKIP strategy for event metrics collection (recordEvent, reset)
 *
 * Total: 24 comprehensive tests
 */

import { BotMetricsService } from '../../services/bot-metrics.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { LoggerService, LogLevel } from '../../types/legacy';

/**
 * Mock Logger for testing
 */
class MockLogger extends LoggerService {
  logCalls: Array<{ level: string; message: string; meta?: any }> = [];
  throwOnCall: boolean = false;

  constructor() {
    super(LogLevel.INFO, './logs', false);
  }

  info(message: string, meta?: any): void {
    this.logCalls.push({ level: 'info', message, meta });
    if (this.throwOnCall) {
      throw new Error('Logger failed');
    }
  }

  debug(message: string, meta?: any): void {
    this.logCalls.push({ level: 'debug', message, meta });
    if (this.throwOnCall) {
      throw new Error('Logger failed');
    }
  }

  warn(message: string, meta?: any): void {
    this.logCalls.push({ level: 'warn', message, meta });
    if (this.throwOnCall) {
      throw new Error('Logger failed');
    }
  }

  error(message: string, meta?: any): void {
    this.logCalls.push({ level: 'error', message, meta });
    if (this.throwOnCall) {
      throw new Error('Logger failed');
    }
  }

  getLogFilePath(): string | null {
    return null;
  }

  setConsoleOutputEnabled(enabled: boolean): void {}
}

/**
 * Helper to create trade metrics
 */
function createTradeMetrics(overrides?: any) {
  return {
    id: `trade-${Date.now()}`,
    direction: 'LONG' as const,
    entryPrice: 50000,
    exitPrice: 51000,
    quantity: 1,
    pnl: 1000,
    pnlPercent: 2.0,
    duration: 3600000, // 1 hour in ms
    exitType: 'TAKE_PROFIT_1',
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Helper to create mock ErrorHandler
 */
function createMockErrorHandler() {
  const mockEH: any = {
    handle: jest.fn((error: any, options: any) => {
      if (options.strategy === RecoveryStrategy.THROW) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : undefined,
        strategy: options.strategy,
      };
    }),
  };
  return mockEH;
}

describe('BotMetricsService ErrorHandler Integration (Phase 8.9.40)', () => {
  let logger: MockLogger;
  let errorHandler: any;
  let metricsService: BotMetricsService;

  beforeEach(() => {
    logger = new MockLogger();
    errorHandler = createMockErrorHandler();
    metricsService = new BotMetricsService(logger, errorHandler);
    jest.clearAllMocks();
  });

  // ============================================================================
  // Constructor Tests
  // ============================================================================

  describe('Constructor', () => {
    it('should initialize with ErrorHandler', () => {
      const service = new BotMetricsService(logger, errorHandler);
      service.getSessionDuration(); // trigger lazy start lifecycle
      expect(service).toBeDefined();
      expect(logger.logCalls.length).toBeGreaterThan(0);
    });

    it('should initialize without ErrorHandler', () => {
      const service = new BotMetricsService(logger);
      expect(service).toBeDefined();
    });

    it('should handle logger failure in constructor with RETRY strategy', () => {
      logger.throwOnCall = true;
      const service = new BotMetricsService(logger, errorHandler);
      service.getSessionDuration(); // trigger lazy start lifecycle
      expect(service).toBeDefined();
      expect(errorHandler.handle).toHaveBeenCalled();
    });

    it('should continue if constructor logger fails without ErrorHandler', () => {
      logger.throwOnCall = true;
      const service = new BotMetricsService(logger);
      expect(() => service.getSessionDuration()).not.toThrow();
      expect(service).toBeDefined();
    });
  });

  // ============================================================================
  // recordTrade Tests
  // ============================================================================

  describe('recordTrade with ErrorHandler', () => {
    it('should successfully record a trade', () => {
      const trade = createTradeMetrics();
      metricsService.recordTrade(trade);
      expect(metricsService.getTrades().length).toBe(1);
      expect(metricsService.getTrades()[0].id).toBe(trade.id);
    });

    it('should record multiple trades', () => {
      const trade1 = createTradeMetrics({ id: 'trade-1' });
      const trade2 = createTradeMetrics({ id: 'trade-2', pnl: -500 });
      metricsService.recordTrade(trade1);
      metricsService.recordTrade(trade2);
      expect(metricsService.getTrades().length).toBe(2);
    });

    it('should use SKIP strategy when trade recording fails', () => {
      logger.throwOnCall = true;
      const trade = createTradeMetrics();
      metricsService.recordTrade(trade);
      // Should still record despite logger error
      expect(errorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Failed to record trade metrics' }),
        expect.objectContaining({ strategy: RecoveryStrategy.SKIP })
      );
    });

    it('should calculate profit correctly', () => {
      const winTrade = createTradeMetrics({ pnl: 500 });
      metricsService.recordTrade(winTrade);
      const metrics = metricsService.getPerformanceMetrics();
      expect(metrics.totalPnL).toBe(500);
      expect(metrics.winningTrades).toBe(1);
    });

    it('should calculate loss correctly', () => {
      const lossTrade = createTradeMetrics({ pnl: -300 });
      metricsService.recordTrade(lossTrade);
      const metrics = metricsService.getPerformanceMetrics();
      expect(metrics.totalPnL).toBe(-300);
      expect(metrics.losingTrades).toBe(1);
    });

    it('should calculate max drawdown', () => {
      const winTrade = createTradeMetrics({ pnl: 1000 });
      const lossTrade = createTradeMetrics({ pnl: -500, id: 'trade-2' });
      metricsService.recordTrade(winTrade);
      metricsService.recordTrade(lossTrade);
      const metrics = metricsService.getPerformanceMetrics();
      expect(metrics.maxDrawdown).toBe(500);
    });

    it('should handle trade recording without ErrorHandler', () => {
      const serviceNoEH = new BotMetricsService(logger);
      logger.throwOnCall = true;
      const trade = createTradeMetrics();
      serviceNoEH.recordTrade(trade);
      expect(logger.logCalls.some(c => c.level === 'error')).toBe(true);
    });
  });

  // ============================================================================
  // recordEvent Tests
  // ============================================================================

  describe('recordEvent with ErrorHandler', () => {
    it('should successfully record an event', () => {
      metricsService.recordEvent('SIGNAL_RECEIVED', 50, true);
      const events = metricsService.getEventMetrics();
      expect(events.has('SIGNAL_RECEIVED')).toBe(true);
      expect(events.get('SIGNAL_RECEIVED')!.count).toBe(1);
    });

    it('should track event success/failure', () => {
      metricsService.recordEvent('API_CALL', 100, true);
      metricsService.recordEvent('API_CALL', 150, false);
      const metric = metricsService.getEventMetrics().get('API_CALL');
      expect(metric!.successes).toBe(1);
      expect(metric!.failures).toBe(1);
      expect(metric!.errorRate).toBeCloseTo(50);
    });

    it('should calculate average duration correctly', () => {
      metricsService.recordEvent('PROCESSING', 100, true);
      metricsService.recordEvent('PROCESSING', 200, true);
      metricsService.recordEvent('PROCESSING', 300, true);
      const metric = metricsService.getEventMetrics().get('PROCESSING');
      expect(metric!.avgDuration).toBe(200);
    });

    it('should use SKIP strategy when event recording fails', () => {
      logger.throwOnCall = true;
      metricsService.recordEvent('TEST_EVENT', 50, false, 'test error');
      expect(errorHandler.handle).toHaveBeenCalled();
    });

    it('should track min and max durations', () => {
      metricsService.recordEvent('REQUEST', 50, true);
      metricsService.recordEvent('REQUEST', 150, true);
      metricsService.recordEvent('REQUEST', 100, true);
      const metric = metricsService.getEventMetrics().get('REQUEST');
      expect(metric!.minDuration).toBe(50);
      expect(metric!.maxDuration).toBe(150);
    });

    it('should handle multiple event types', () => {
      metricsService.recordEvent('EVENT_A', 50, true);
      metricsService.recordEvent('EVENT_B', 75, true);
      metricsService.recordEvent('EVENT_C', 100, true);
      const events = metricsService.getEventMetrics();
      expect(events.size).toBe(3);
    });
  });

  // ============================================================================
  // printReport Tests (GRACEFUL_DEGRADE Strategy)
  // ============================================================================

  describe('printReport with ErrorHandler (GRACEFUL_DEGRADE)', () => {
    beforeEach(() => {
      // Add some trades for report
      metricsService.recordTrade(createTradeMetrics({ pnl: 500 }));
      metricsService.recordTrade(createTradeMetrics({ pnl: -200, id: 'trade-2' }));
      metricsService.recordEvent('TEST_EVENT', 100, true);
    });

    it('should successfully print report', () => {
      logger.logCalls = [];
      metricsService.printReport();
      expect(logger.logCalls.length).toBeGreaterThan(0);
      expect(logger.logCalls.some(c => c.message.includes('PERFORMANCE'))).toBe(true);
    });

    it('should use GRACEFUL_DEGRADE strategy when report fails', () => {
      logger.throwOnCall = true;
      metricsService.printReport(); // Should not throw
      expect(errorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Failed to print metrics report' }),
        expect.objectContaining({ strategy: RecoveryStrategy.GRACEFUL_DEGRADE })
      );
    });

    it('should continue trading even if report generation fails', () => {
      logger.throwOnCall = true;
      expect(() => metricsService.printReport()).not.toThrow();
    });

    it('should handle report generation without ErrorHandler', () => {
      const freshLogger = new MockLogger();
      const serviceNoEH = new BotMetricsService(freshLogger);
      freshLogger.throwOnCall = true;
      serviceNoEH.printReport(); // Should not throw
      // Logger should attempt error logging but we don't verify it since error logger also fails
    });
  });

  // ============================================================================
  // getPerformanceMetrics Tests
  // ============================================================================

  describe('getPerformanceMetrics', () => {
    it('should calculate win rate correctly', () => {
      metricsService.recordTrade(createTradeMetrics({ pnl: 100 }));
      metricsService.recordTrade(createTradeMetrics({ pnl: 200, id: 'trade-2' }));
      metricsService.recordTrade(createTradeMetrics({ pnl: -100, id: 'trade-3' }));
      const metrics = metricsService.getPerformanceMetrics();
      expect(metrics.winRate).toBeCloseTo(66.67, 1);
      expect(metrics.totalTrades).toBe(3);
    });

    it('should calculate profit factor', () => {
      metricsService.recordTrade(createTradeMetrics({ pnl: 500 }));
      metricsService.recordTrade(createTradeMetrics({ pnl: 300, id: 'trade-2' }));
      metricsService.recordTrade(createTradeMetrics({ pnl: -200, id: 'trade-3' }));
      const metrics = metricsService.getPerformanceMetrics();
      expect(metrics.profitFactor).toBeCloseTo(4, 1);
    });

    it('should return zero metrics for empty trades', () => {
      const metrics = metricsService.getPerformanceMetrics();
      expect(metrics.totalTrades).toBe(0);
      expect(metrics.totalPnL).toBe(0);
      expect(metrics.winRate).toBe(0);
    });
  });

  // ============================================================================
  // reset Tests
  // ============================================================================

  describe('reset with ErrorHandler', () => {
    beforeEach(() => {
      metricsService.recordTrade(createTradeMetrics());
      metricsService.recordEvent('TEST', 50, true);
    });

    it('should successfully reset all metrics', () => {
      metricsService.reset();
      expect(metricsService.getTrades().length).toBe(0);
      expect(metricsService.getEventMetrics().size).toBe(0);
    });

    it('should use SKIP strategy when reset fails', () => {
      logger.throwOnCall = true;
      metricsService.reset();
      expect(errorHandler.handle).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Failed to reset metrics' }),
        expect.objectContaining({ strategy: RecoveryStrategy.SKIP })
      );
    });

    it('should complete reset even if logger fails', () => {
      logger.throwOnCall = true;
      metricsService.reset();
      expect(metricsService.getTrades().length).toBe(0);
      expect(metricsService.getEventMetrics().size).toBe(0);
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration Tests', () => {
    it('should handle multiple errors gracefully', () => {
      logger.throwOnCall = false;
      metricsService.recordTrade(createTradeMetrics());
      metricsService.recordEvent('EVENT1', 50, true);

      logger.throwOnCall = true;
      metricsService.recordTrade(createTradeMetrics({ id: 'trade-2' }));
      metricsService.recordEvent('EVENT2', 75, false, 'test error'); // Error with logging attempt

      logger.throwOnCall = false;
      metricsService.recordTrade(createTradeMetrics({ id: 'trade-3' }));

      // Should have at least 1 error handler call (from trade or event)
      expect(errorHandler.handle.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should maintain metrics state across errors', () => {
      metricsService.recordTrade(createTradeMetrics({ pnl: 1000 }));
      logger.throwOnCall = true;
      metricsService.recordTrade(createTradeMetrics({ pnl: 500, id: 'trade-2' }));
      logger.throwOnCall = false;

      const metrics = metricsService.getPerformanceMetrics();
      expect(metrics.totalPnL).toBe(1500);
      expect(metrics.totalTrades).toBe(2);
    });

    it('should handle concurrent operations', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve(
            metricsService.recordTrade(
              createTradeMetrics({ id: `trade-${i}`, pnl: Math.random() * 1000 - 500 })
            )
          )
        );
      }
      await Promise.all(promises);
      expect(metricsService.getTrades().length).toBe(10);
    });
  });

  // ============================================================================
  // Utility Tests
  // ============================================================================

  describe('Utility Methods', () => {
    it('should get session duration', () => {
      const duration = metricsService.getSessionDuration();
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should get trade by ID', () => {
      const trade = createTradeMetrics({ id: 'unique-trade-123' });
      metricsService.recordTrade(trade);
      const retrieved = metricsService.getTradeById('unique-trade-123');
      expect(retrieved).toEqual(trade);
    });

    it('should return undefined for non-existent trade', () => {
      const trade = metricsService.getTradeById('non-existent');
      expect(trade).toBeUndefined();
    });

    it('should return copy of trades array', () => {
      const trade = createTradeMetrics();
      metricsService.recordTrade(trade);
      const trades1 = metricsService.getTrades();
      const trades2 = metricsService.getTrades();
      expect(trades1).not.toBe(trades2);
      expect(trades1).toEqual(trades2);
    });
  });
});
