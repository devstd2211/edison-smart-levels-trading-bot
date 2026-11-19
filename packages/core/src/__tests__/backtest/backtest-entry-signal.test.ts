import { buildBacktestEntrySignals } from '../../backtest/backtest-entry-signal';
import { FilterOrchestrator } from '../../orchestrators/filter.orchestrator';
import type { AggregationResult } from '../../decision-engine/signal-aggregation';
import type { AnalyzerSignal } from '../../types/strategy';
import type { LoggerService } from '../../services/logger.service';
import { SignalDirection } from '../../types/enums';

const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as unknown as LoggerService;

function analyzerSignal(direction: SignalDirection): AnalyzerSignal {
  return { source: 'TEST', direction, confidence: 80, weight: 1, priority: 1 } as AnalyzerSignal;
}

function aggregation(direction: SignalDirection | null, signalCount: number, confidence = 0.8): AggregationResult {
  return {
    direction,
    totalScore: 0.8,
    confidence,
    signalCount,
    appliedPenalty: 1,
    analyzerBreakdown: new Map(),
    conflictAnalysis: { conflictLevel: 0, shouldWait: false },
  } as unknown as AggregationResult;
}

describe('buildBacktestEntrySignals', () => {
  const analyzerSignals = [
    analyzerSignal(SignalDirection.LONG),
    analyzerSignal(SignalDirection.LONG),
    analyzerSignal(SignalDirection.LONG),
    analyzerSignal(SignalDirection.LONG),
    analyzerSignal(SignalDirection.SHORT),
  ];

  it('returns no signals when aggregation has no direction', () => {
    expect(buildBacktestEntrySignals(aggregation(null, 0), analyzerSignals, 1.5, 1000)).toEqual([]);
  });

  it('carries the contributing signal count like the live aggregated signal', () => {
    const [signal] = buildBacktestEntrySignals(aggregation(SignalDirection.LONG, 4), analyzerSignals, 1.5, 1000);

    expect(signal.direction).toBe(SignalDirection.LONG);
    expect(signal.confidence).toBe(80);
    expect(signal.price).toBe(1.5);
    expect(signal.signalCount).toBe(4);
    expect(signal.aggregationContext).toMatchObject({ signalCount: 4, longSignalCount: 4, shortSignalCount: 1 });
  });

  it('passes the blind zone filter when enough analyzers agree', () => {
    const filters = new FilterOrchestrator(logger, {
      blindZone: { minSignalsForLong: 3, minSignalsForShort: 3 },
      flatMarket: { enabled: false },
    } as never);
    const [signal] = buildBacktestEntrySignals(aggregation(SignalDirection.LONG, 4), analyzerSignals, 1.5, 1000);

    const result = filters.evaluateFilters({
      signal,
      accountBalance: 10000,
      openPositions: [],
      marketData: {},
    } as never);

    expect(result.blockedBy).not.toBe('BlindZone');
  });
});
