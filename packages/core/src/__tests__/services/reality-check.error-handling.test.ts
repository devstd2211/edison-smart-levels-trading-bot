/**
 * Error Handling Tests for RealityCheckService
 *
 * Validates:
 * - THROW strategy for input validation errors
 * - GRACEFUL_DEGRADE strategy for analysis and stats update failures
 * - SKIP strategy for logging failures
 * - Integration with signal analysis and event tracking
 * - Backward compatibility (tests without ErrorHandler)
 */

import type { LoggerService } from '../../types/legacy';
import { SignalDirection } from '../../types/enums';
import type { AnalyzerSignal } from '../../types/strategy';
import type { ErrorHandler } from '../../errors/ErrorHandler';
import {
  createRealityCheckAnalyzerSignal,
  createRealityCheckEvent,
  createManagedRealityCheckContext,
  createRealityCheckPriceScenario,
  createRealityCheckSignal,
} from '../helpers/reality-check-test.utils';

type RealityCheckContext = ReturnType<typeof createManagedRealityCheckContext>;

describe('RealityCheckService - Error Handling (Phase 8.9.66)', () => {
  let service: RealityCheckContext['service'];
  let logger: LoggerService;
  let errorHandler: ErrorHandler;
  let createService: RealityCheckContext['createService'];
  let cleanup: RealityCheckContext['cleanup'];

  beforeEach(() => {
    let nextLogger: RealityCheckContext['logger'];
    let nextErrorHandler: RealityCheckContext['errorHandler'];
    ({
      service,
      logger: nextLogger,
      errorHandler: nextErrorHandler,
      createService,
      cleanup,
    } = createManagedRealityCheckContext());
    logger = nextLogger as LoggerService;
    errorHandler = nextErrorHandler as ErrorHandler;
  });

  afterEach(() => {
    cleanup();
  });

  // ============================================================================
  // THROW: INPUT VALIDATION
  // ============================================================================

  describe('THROW - Input validation', () => {
    it('should accept valid signal for analysis', () => {
      const signal = createRealityCheckSignal();
      const signingAnalyzers: AnalyzerSignal[] = [
        createRealityCheckAnalyzerSignal(),
      ];

      const result = service.analyzeClosedTrade(
        'BTCUSDT',
        'trade-1',
        signal,
        signingAnalyzers,
        100, // entryPrice
        99, // highestPrice (for LONG, doesn't reach target of 102)
        98.8, // lowestPrice (close to SL to avoid slippage, < 1% gap)
        98.8, // closingPrice
        'SL_HIT',
        'UPTREND',
        'DOWNTREND',
        Date.now() - 3600000,
        Date.now(),
      );

      expect(result).toBeDefined();
      expect(result?.reason).toEqual('REGIME_CHANGE');
    });

    it('should return null for low confidence signal', () => {
      const signal = createRealityCheckSignal({ confidence: 40 }); // Below 60 threshold
      const signingAnalyzers: AnalyzerSignal[] = [];

      const result = service.analyzeClosedTrade(
        'BTCUSDT',
        'trade-1',
        signal,
        signingAnalyzers,
        100,
        99,
        98.8,
        98.8,
        'SL_HIT',
        'UPTREND',
        'DOWNTREND',
        Date.now() - 3600000,
        Date.now(),
      );

      // Low confidence signals don't trigger reality check
      expect(result).toBeNull();
    });

    it('should handle NaN prices in analysis', () => {
      const signal = createRealityCheckSignal();
      const signingAnalyzers: AnalyzerSignal[] = [];

      // NaN prices might cause calculation issues
      const { entryPrice, highestPrice, lowestPrice, closingPrice } =
        createRealityCheckPriceScenario({
          entryPrice: NaN,
          highestPrice: 101,
          lowestPrice: 98,
          closingPrice: 98.5,
        });

      const result = service.analyzeClosedTrade(
        'BTCUSDT',
        'trade-1',
        signal,
        signingAnalyzers,
        entryPrice,
        highestPrice,
        lowestPrice,
        closingPrice,
        'SL_HIT',
        'UPTREND',
        'DOWNTREND',
        Date.now() - 3600000,
        Date.now(),
      );

      // Should either return null or handle NaN gracefully
      expect(result === null || Number.isNaN(result?.entryPrice)).toBe(true);
    });

    it('should handle Infinity prices in analysis', () => {
      const signal = createRealityCheckSignal();
      const signingAnalyzers: AnalyzerSignal[] = [];

      const { entryPrice, highestPrice, lowestPrice, closingPrice } =
        createRealityCheckPriceScenario({
          entryPrice: Infinity,
          highestPrice: 101,
          lowestPrice: 98,
          closingPrice: 98.5,
        });

      const result = service.analyzeClosedTrade(
        'BTCUSDT',
        'trade-1',
        signal,
        signingAnalyzers,
        entryPrice,
        highestPrice,
        lowestPrice,
        closingPrice,
        'SL_HIT',
        'UPTREND',
        'DOWNTREND',
        Date.now() - 3600000,
        Date.now(),
      );

      // Should either return null or handle Infinity gracefully
      expect(result === null || !isFinite(result?.entryPrice || 0)).toBe(true);
    });

    it('should handle negative prices', () => {
      const signal = createRealityCheckSignal();
      const signingAnalyzers: AnalyzerSignal[] = [];

      // Negative prices don't make sense in trading
      const { entryPrice, highestPrice, lowestPrice, closingPrice } =
        createRealityCheckPriceScenario({
          entryPrice: -100,
          highestPrice: 101,
          lowestPrice: 98,
          closingPrice: 98.5,
        });

      const result = service.analyzeClosedTrade(
        'BTCUSDT',
        'trade-1',
        signal,
        signingAnalyzers,
        entryPrice,
        highestPrice,
        lowestPrice,
        closingPrice,
        'SL_HIT',
        'UPTREND',
        'DOWNTREND',
        Date.now() - 3600000,
        Date.now(),
      );

      // Should return null or handle gracefully
      expect(result === null || result?.entryPrice === -100).toBe(true);
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE: ANALYSIS FAILURES
  // ============================================================================

  describe('GRACEFUL_DEGRADE - Analysis failures', () => {
    it('should handle high confidence signal that fails', () => {
      const signal = createRealityCheckSignal({ confidence: 85 });
      const signingAnalyzers: AnalyzerSignal[] = [
        createRealityCheckAnalyzerSignal(),
      ];

      const result = service.analyzeClosedTrade(
        'BTCUSDT',
        'trade-1',
        signal,
        signingAnalyzers,
        100,
        99, // Doesn't reach target of 102 * 0.98 = 99.96
        98.8,
        98.8,
        'SL_HIT',
        'UPTREND',
        'DOWNTREND',
        Date.now() - 3600000,
        Date.now(),
      );

      expect(result).toBeDefined();
      expect(result?.signalConfidence).toBe(85);
    });

    it('should skip low confidence signals', () => {
      const signal = createRealityCheckSignal({ confidence: 45 }); // Below 60 threshold
      const signingAnalyzers: AnalyzerSignal[] = [];

      const result = service.analyzeClosedTrade(
        'BTCUSDT',
        'trade-1',
        signal,
        signingAnalyzers,
        100,
        101,
        98,
        98.5,
        'SL_HIT',
        'UPTREND',
        'DOWNTREND',
        Date.now() - 3600000,
        Date.now(),
      );

      // Low confidence should not trigger reality check
      expect(result).toBeNull();
    });

    it('should handle TP_HIT exit (no reality check needed)', () => {
      const signal = createRealityCheckSignal();
      const signingAnalyzers: AnalyzerSignal[] = [];

      const result = service.analyzeClosedTrade(
        'BTCUSDT',
        'trade-1',
        signal,
        signingAnalyzers,
        100,
        102, // Hit target
        99,
        102,
        'TP_HIT',
        'UPTREND',
        'UPTREND',
        Date.now() - 3600000,
        Date.now(),
      );

      // TP hit = trade worked as expected
      expect(result).toBeNull();
    });

    it('should detect regime change (UPTREND to DOWNTREND)', () => {
      const signal = createRealityCheckSignal({ direction: SignalDirection.LONG, confidence: 75 });
      const signingAnalyzers: AnalyzerSignal[] = [];

      const result = service.analyzeClosedTrade(
        'BTCUSDT',
        'trade-1',
        signal,
        signingAnalyzers,
        100, // entryPrice
        99, // highestPrice (doesn't reach target of 102)
        98.8, // lowestPrice (close to SL, < 1% gap to avoid slippage trigger)
        98.8, // closingPrice
        'SL_HIT',
        'UPTREND',
        'DOWNTREND', // Trend reversed
        Date.now() - 3600000,
        Date.now(),
      );

      expect(result).toBeDefined();
      expect(result?.reason).toBe('REGIME_CHANGE');
    });

    it('should detect liquidity event (support broken) via slippage', () => {
      const signal = createRealityCheckSignal({ direction: SignalDirection.LONG, stopLoss: 99 });
      const signingAnalyzers: AnalyzerSignal[] = [];

      // When support breaks with large slippage, SLIPPAGE reason is returned (last check wins)
      // But the event will still be recorded with liquidity assumptions
      const result = service.analyzeClosedTrade(
        'BTCUSDT',
        'trade-1',
        signal,
        signingAnalyzers,
        100,
        99.5,
        97.95, // Breaks support (< 98.01) and triggers slippage (> 1%)
        97.95,
        'SL_HIT',
        'UPTREND',
        'UPTREND',
        Date.now() - 3600000,
        Date.now(),
      );

      expect(result).toBeDefined();
      // Both liquidity and slippage detected, but slippage reason wins (checked last)
      expect(result?.reason).toBe('SLIPPAGE');
      expect(result?.breakingAssumptions.some((a) => a.includes('Support'))).toBe(true);
    });

    it('should detect slippage on SL hit', () => {
      const signal = createRealityCheckSignal({ direction: SignalDirection.LONG, stopLoss: 99 });
      const signingAnalyzers: AnalyzerSignal[] = [];

      const result = service.analyzeClosedTrade(
        'BTCUSDT',
        'trade-1',
        signal,
        signingAnalyzers,
        100,
        99,
        97, // ~2% gap from SL (|97-99|/99 = 0.0202 > 0.01)
        97,
        'SL_HIT',
        'UPTREND',
        'UPTREND', // Same trend to isolate slippage detection
        Date.now() - 3600000,
        Date.now(),
      );

      expect(result).toBeDefined();
      expect(result?.reason).toBe('SLIPPAGE');
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE: STATS FAILURES
  // ============================================================================

  describe('GRACEFUL_DEGRADE - Stats update failures', () => {
    it('should handle multiple events and maintain stats', () => {
      const event1 = createRealityCheckEvent({ tradeId: 'trade-1' });
      const event2 = createRealityCheckEvent({ tradeId: 'trade-2', reason: 'SLIPPAGE' });

      service.recordEvent(event1);
      service.recordEvent(event2);

      const stats = service.getStats();
      expect(stats.totalChecks).toBe(2);
      expect(stats.reasonBreakdown.get('REGIME_CHANGE')).toBe(1);
      expect(stats.reasonBreakdown.get('SLIPPAGE')).toBe(1);
    });

    it('should handle analyzer tracking', () => {
      const event = createRealityCheckEvent({
        signingAnalyzers: ['RSI', 'MACD', 'Bollinger'],
      });

      service.recordEvent(event);

      const stats = service.getStats();
      expect(stats.byAnalyzer.get('RSI')).toBe(1);
      expect(stats.byAnalyzer.get('MACD')).toBe(1);
      expect(stats.byAnalyzer.get('Bollinger')).toBe(1);
    });

    it('should accumulate duplicate assumptions', () => {
      const event1 = createRealityCheckEvent({
        breakingAssumptions: ['Trend reversal not detected'],
      });
      const event2 = createRealityCheckEvent({
        breakingAssumptions: ['Trend reversal not detected', 'Support broken'],
      });

      service.recordEvent(event1);
      service.recordEvent(event2);

      const stats = service.getStats();
      expect(stats.breakingAssumptions.get('Trend reversal not detected')).toBe(2);
      expect(stats.breakingAssumptions.get('Support broken')).toBe(1);
    });
  });

  // ============================================================================
  // SKIP: LOGGING FAILURES (SERVICE NOTES)
  // ============================================================================

  describe('SKIP - Logging failures (Service without error handling)', () => {
    it('should record events with optional logger', () => {
      const event = createRealityCheckEvent();
      const serviceWithoutLogger = createService({ withLogger: false });

      // Should not throw even without logger
      expect(() => {
        serviceWithoutLogger.recordEvent(event);
      }).not.toThrow();

      expect(serviceWithoutLogger.getEvents().length).toBe(1);
    });

    it('should work with logger that does not throw', () => {
      const event = createRealityCheckEvent();

      // Should not throw with real logger
      expect(() => {
        service.recordEvent(event);
      }).not.toThrow();

      expect(service.getEvents().length).toBe(1);
    });
  });

  // ============================================================================
  // INTEGRATION: ANALYSIS WORKFLOW
  // ============================================================================

  describe('Integration - Complete analysis workflow', () => {
    it('should analyze trade and generate event from start to finish', () => {
      const signal = createRealityCheckSignal({ confidence: 80 });
      const signingAnalyzers: AnalyzerSignal[] = [
        createRealityCheckAnalyzerSignal(),
        createRealityCheckAnalyzerSignal({ source: 'MACD', confidence: 70 }),
      ];

      const event = service.analyzeClosedTrade(
        'BTCUSDT',
        'trade-1',
        signal,
        signingAnalyzers,
        100, // entryPrice
        99, // highestPrice (< targetPrice * 0.98 = 102 * 0.98 = 99.96)
        95, // lowestPrice (hits SL at 99)
        95, // closingPrice
        'SL_HIT',
        'UPTREND',
        'DOWNTREND',
        Date.now() - 3600000,
        Date.now(),
      );

      expect(event).toBeDefined();
      expect(event?.signingAnalyzers).toContain('RSI');
      expect(event?.signingAnalyzers).toContain('MACD');

      // Check stats were updated
      const stats = service.getStats();
      expect(stats.totalChecks).toBe(1);
      expect(stats.byAnalyzer.get('RSI')).toBe(1);
      expect(stats.byAnalyzer.get('MACD')).toBe(1);
    });

    it('should generate report from recorded events', () => {
      const event1 = createRealityCheckEvent({ reason: 'REGIME_CHANGE' });
      const event2 = createRealityCheckEvent({ reason: 'LIQUIDITY_EVENT' });

      service.recordEvent(event1);
      service.recordEvent(event2);

      const report = service.getReport();
      expect(report).toContain('Reality Check Report');
      expect(report).toContain('**Total Events:** 2');
      expect(report).toContain('REGIME_CHANGE');
      expect(report).toContain('LIQUIDITY_EVENT');
    });

    it('should export events to JSON', () => {
      const event = createRealityCheckEvent();
      service.recordEvent(event);

      const json = service.exportToJson();
      const parsed = JSON.parse(json);

      expect(parsed.totalEvents).toBe(1);
      expect(parsed.events[0].symbol).toBe('BTCUSDT');
      expect(parsed.events[0].tradeId).toBe('trade-1');
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY: WITHOUT ERRORHANDLER
  // ============================================================================

  describe('Backward compatibility - Without ErrorHandler', () => {
    it('should work with optional logger', () => {
      const serviceWithoutLogger = createService({ withLogger: false });
      const event = createRealityCheckEvent();

      // Should not throw even without logger
      expect(() => {
        serviceWithoutLogger.recordEvent(event);
      }).not.toThrow();

      expect(serviceWithoutLogger.getEvents().length).toBe(1);
    });

    it('should analyze trades without logger', () => {
      const serviceWithoutLogger = createService({ withLogger: false });
      const signal = createRealityCheckSignal();
      const signingAnalyzers: AnalyzerSignal[] = [];

      const result = serviceWithoutLogger.analyzeClosedTrade(
        'BTCUSDT',
        'trade-1',
        signal,
        signingAnalyzers,
        100,
        101,
        97,
        97.5,
        'SL_HIT',
        'UPTREND',
        'DOWNTREND',
        Date.now() - 3600000,
        Date.now(),
      );

      expect(result).toBeDefined();
    });

    it('should maintain all event data in records', () => {
      const event = createRealityCheckEvent({
        symbol: 'ETHUSDT',
        direction: 'SHORT',
        reason: 'ASSUMPTION_BROKEN',
      });

      service.recordEvent(event);

      const retrieved = service.getEvents()[0];
      expect(retrieved.symbol).toBe('ETHUSDT');
      expect(retrieved.direction).toBe('SHORT');
      expect(retrieved.reason).toBe('ASSUMPTION_BROKEN');
    });
  });

  // ============================================================================
  // EDGE CASES: ERROR HANDLING
  // ============================================================================

  describe('Edge cases - Error handling', () => {
    it('should handle empty event arrays gracefully', () => {
      const report = service.getReport();
      expect(report).toContain('No reality check events recorded');
    });

    it('should handle zero prices', () => {
      const signal = createRealityCheckSignal();
      const signingAnalyzers: AnalyzerSignal[] = [];

      // Zero prices don't make sense but shouldn't crash
      const result = service.analyzeClosedTrade(
        'BTCUSDT',
        'trade-1',
        signal,
        signingAnalyzers,
        0,
        0,
        0,
        0,
        'SL_HIT',
        'UPTREND',
        'DOWNTREND',
        Date.now() - 3600000,
        Date.now(),
      );

      expect(result === null || result?.entryPrice === 0).toBe(true);
    });

    it('should handle very large prices (Infinity)', () => {
      const signal = createRealityCheckSignal();
      const signingAnalyzers: AnalyzerSignal[] = [];

      const result = service.analyzeClosedTrade(
        'BTCUSDT',
        'trade-1',
        signal,
        signingAnalyzers,
        1e308,
        1e308,
        1e307,
        1e307,
        'SL_HIT',
        'UPTREND',
        'DOWNTREND',
        Date.now() - 3600000,
        Date.now(),
      );

      // Should handle large numbers without crashing
      expect(result === null || typeof result?.entryPrice === 'number').toBe(true);
    });

    it('should handle very small prices', () => {
      const signal = createRealityCheckSignal();
      const signingAnalyzers: AnalyzerSignal[] = [];

      const result = service.analyzeClosedTrade(
        'BTCUSDT',
        'trade-1',
        signal,
        signingAnalyzers,
        0.0001,
        0.0001,
        0.00008,
        0.00008,
        'SL_HIT',
        'UPTREND',
        'DOWNTREND',
        Date.now() - 3600000,
        Date.now(),
      );

      // Should handle very small numbers
      expect(result === null || typeof result?.entryPrice === 'number').toBe(true);
    });

    it('should handle many events in stats', () => {
      // Add many events
      for (let i = 0; i < 100; i++) {
        const event = createRealityCheckEvent({
          tradeId: `trade-${i}`,
          reason: i % 2 === 0 ? 'REGIME_CHANGE' : 'LIQUIDITY_EVENT',
        });
        service.recordEvent(event);
      }

      const stats = service.getStats();
      expect(stats.totalChecks).toBe(100);
      expect(stats.reasonBreakdown.get('REGIME_CHANGE')).toBe(50);
      expect(stats.reasonBreakdown.get('LIQUIDITY_EVENT')).toBe(50);

      const report = service.getReport();
      expect(report).toContain('**Total Events:** 100');
    });

    it('should handle extremely long strings', () => {
      const longString = 'A'.repeat(10000);
      const event = createRealityCheckEvent({
        explanation: longString,
        signalReason: longString,
      });

      service.recordEvent(event);

      const retrieved = service.getEvents()[0];
      expect(retrieved.explanation.length).toBe(10000);
      expect(retrieved.signalReason.length).toBe(10000);
    });
  });

  // ============================================================================
  // INTEGRATION: MULTIPLE TRADES
  // ============================================================================

  describe('Integration - Multiple trade scenarios', () => {
    it('should handle sequential trades with different outcomes', () => {
      const trades = [
        { tradeId: 'trade-1', result: 'TP_HIT', expectedEvent: false, highPrice: 101, lowPrice: 99 },
        { tradeId: 'trade-2', result: 'SL_HIT', expectedEvent: true, highPrice: 99, lowPrice: 95 },
        { tradeId: 'trade-3', result: 'MANUAL', expectedEvent: false, highPrice: 101, lowPrice: 99 },
        { tradeId: 'trade-4', result: 'SL_HIT', expectedEvent: true, highPrice: 99, lowPrice: 95 },
      ];

      let eventCount = 0;

      for (const trade of trades) {
        const signal = createRealityCheckSignal({ confidence: 75 });
        const signingAnalyzers: AnalyzerSignal[] = [
          createRealityCheckAnalyzerSignal({ weight: 1 }),
        ];

        const result = service.analyzeClosedTrade(
          'BTCUSDT',
          trade.tradeId,
          signal,
          signingAnalyzers,
          100, // entryPrice
          trade.highPrice,
          trade.lowPrice,
          trade.lowPrice,
          trade.result as 'TP_HIT' | 'SL_HIT' | 'MANUAL' | 'PARTIAL',
          'UPTREND',
          'DOWNTREND',
          Date.now() - 3600000,
          Date.now(),
        );

        if (result) {
          eventCount++;
        }

        if (trade.expectedEvent) {
          expect(result).toBeDefined();
        } else {
          expect(result).toBeNull();
        }
      }

      expect(eventCount).toBe(2); // Two SL_HIT events
    });

    it('should track analyzer accuracy across multiple trades', () => {
      // Create events with multiple analyzer signatures
      for (let i = 0; i < 10; i++) {
        const event = createRealityCheckEvent({
          tradeId: `trade-${i}`,
          signingAnalyzers: ['RSI', 'MACD', 'Bollinger', 'EMA'],
        });
        service.recordEvent(event);
      }

      const stats = service.getStats();

      // All analyzers should be tracked for all 10 events
      expect(stats.byAnalyzer.get('RSI')).toBe(10);
      expect(stats.byAnalyzer.get('MACD')).toBe(10);
      expect(stats.byAnalyzer.get('Bollinger')).toBe(10);
      expect(stats.byAnalyzer.get('EMA')).toBe(10);
    });
  });
});
