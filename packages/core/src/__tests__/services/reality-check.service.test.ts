import { SignalDirection } from '../../types/enums';
import type { AnalyzerSignal } from '../../types/strategy';
import {
  createManagedRealityCheckContext,
  createRealityCheckAnalyzerSignal,
  createRealityCheckSignal,
  type ManagedRealityCheckContext,
} from '../helpers/reality-check-test.utils';

describe('RealityCheckService', () => {
  let realityCheckContext: ManagedRealityCheckContext;

  beforeEach(() => {
    realityCheckContext = createManagedRealityCheckContext();
  });

  afterEach(() => {
    realityCheckContext.cleanup();
  });

  it('records a long trade that reverses into a regime change', () => {
    const signal = createRealityCheckSignal({
      direction: SignalDirection.LONG,
      confidence: 82,
      reason: 'Support held with strong momentum',
    });
    const analyzers: AnalyzerSignal[] = [
      createRealityCheckAnalyzerSignal({ source: 'RSI', confidence: 84 }),
      createRealityCheckAnalyzerSignal({ source: 'EMA', confidence: 78 }),
    ];

    const event = realityCheckContext.service.analyzeClosedTrade(
      'BTCUSDT',
      'long-regime-change',
      signal,
      analyzers,
      100,
      99.2,
      98.85,
      98.9,
      'SL_HIT',
      'UPTREND',
      'DOWNTREND',
      1_710_000_000_000,
      1_710_000_300_000,
    );

    expect(event).not.toBeNull();
    expect(event?.reason).toBe('REGIME_CHANGE');
    expect(event?.breakingAssumptions).toContain(
      'Trend reversal (UPTREND->DOWNTREND not detected)',
    );
    expect(event?.priceMovedAgainst).toBe(true);
    expect(realityCheckContext.service.getStats().byAnalyzer.get('EMA')).toBe(1);
  });

  it('records a short trade with liquidity break and slippage', () => {
    const signal = createRealityCheckSignal({
      direction: SignalDirection.SHORT,
      confidence: 88,
      stopLoss: 101,
      takeProfits: [{ level: 1, percent: 2, sizePercent: 50, price: 98, hit: false }],
      reason: 'Breakdown continuation',
    });
    const analyzers: AnalyzerSignal[] = [
      createRealityCheckAnalyzerSignal({
        source: 'OrderFlow',
        direction: SignalDirection.SHORT,
        confidence: 90,
      }),
    ];

    const event = realityCheckContext.service.analyzeClosedTrade(
      'ETHUSDT',
      'short-liquidity-break',
      signal,
      analyzers,
      100,
      103,
      100.2,
      102.5,
      'SL_HIT',
      'DOWNTREND',
      'UPTREND',
      1_710_100_000_000,
      1_710_100_180_000,
    );

    expect(event).not.toBeNull();
    expect(event?.reason).toBe('SLIPPAGE');
    expect(event?.breakingAssumptions).toEqual(
      expect.arrayContaining([
        'Trend reversal (DOWNTREND->UPTREND not detected)',
        'Resistance level broken violently (liquidity sweep)',
      ]),
    );
    expect(event?.breakingAssumptions.some((assumption) => assumption.includes('Large slippage'))).toBe(true);
  });

  it('skips trades that either hit target or stay below the confidence threshold', () => {
    const lowConfidenceSignal = createRealityCheckSignal({ confidence: 45 });
    const targetHitSignal = createRealityCheckSignal({ confidence: 70 });

    const lowConfidenceResult = realityCheckContext.service.analyzeClosedTrade(
      'BTCUSDT',
      'low-confidence',
      lowConfidenceSignal,
      [],
      100,
      99,
      98.8,
      98.8,
      'SL_HIT',
      'UPTREND',
      'DOWNTREND',
      1,
      2,
    );

    const targetHitResult = realityCheckContext.service.analyzeClosedTrade(
      'BTCUSDT',
      'target-hit',
      targetHitSignal,
      [],
      100,
      102,
      99,
      102,
      'TP_HIT',
      'UPTREND',
      'UPTREND',
      3,
      4,
    );

    expect(lowConfidenceResult).toBeNull();
    expect(targetHitResult).toBeNull();
    expect(realityCheckContext.service.getEvents()).toHaveLength(0);
  });

  it('builds stable report and json exports from accumulated events', () => {
    realityCheckContext.service.recordEvent({
      symbol: 'BTCUSDT',
      tradeId: 'event-1',
      openedAt: 1,
      closedAt: 2,
      direction: 'LONG',
      signalConfidence: 75,
      signalReason: 'Support bounce',
      trendAtEntry: 'UPTREND',
      entryPrice: 100,
      targetPrice: 102,
      stoplossPrice: 99,
      highestPrice: 100.5,
      lowestPrice: 97.5,
      closingPrice: 98,
      exitType: 'SL_HIT',
      actualTrendAtExit: 'DOWNTREND',
      priceMovedAgainst: true,
      priceReachedTarget: false,
      breakingAssumptions: ['Trend reversal (UPTREND->DOWNTREND not detected)'],
      reason: 'REGIME_CHANGE',
      explanation: 'Trend failed after entry.',
      signingAnalyzers: ['RSI'],
      conflictingSignals: false,
    });

    realityCheckContext.service.recordEvent({
      symbol: 'ETHUSDT',
      tradeId: 'event-2',
      openedAt: 3,
      closedAt: 4,
      direction: 'SHORT',
      signalConfidence: 80,
      signalReason: 'Breakdown continuation',
      trendAtEntry: 'DOWNTREND',
      entryPrice: 100,
      targetPrice: 98,
      stoplossPrice: 101,
      highestPrice: 103,
      lowestPrice: 99,
      closingPrice: 102,
      exitType: 'SL_HIT',
      actualTrendAtExit: 'UPTREND',
      priceMovedAgainst: true,
      priceReachedTarget: false,
      breakingAssumptions: ['Resistance level broken violently (liquidity sweep)'],
      reason: 'LIQUIDITY_EVENT',
      explanation: 'Resistance failed unexpectedly.',
      signingAnalyzers: ['OrderFlow'],
      conflictingSignals: false,
    });

    const report = realityCheckContext.service.getReport();
    const exported = JSON.parse(realityCheckContext.service.exportToJson()) as {
      totalEvents: number;
      stats: {
        reasonBreakdown: Record<string, number>;
      };
    };

    expect(report).toContain('**Total Events:** 2');
    expect(report).toContain('REGIME_CHANGE: 1 (50.0%)');
    expect(report).toContain('LIQUIDITY_EVENT: 1 (50.0%)');
    expect(exported.totalEvents).toBe(2);
    expect(exported.stats.reasonBreakdown.REGIME_CHANGE).toBe(1);
    expect(exported.stats.reasonBreakdown.LIQUIDITY_EVENT).toBe(1);
  });
});
