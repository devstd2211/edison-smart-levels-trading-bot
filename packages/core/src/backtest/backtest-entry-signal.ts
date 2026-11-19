import type { AggregationResult } from '../decision-engine/signal-aggregation';
import type { AnalyzerSignal } from '../types/strategy';
import type { Signal } from '../types/signal';
import { SignalDirection, SignalType } from '../types/enums';

export type BacktestEntrySignal = Signal & { signalCount: number };

/**
 * Converts a weighted aggregation into the entry signal fed to EntryOrchestrator.
 * Mirrors the live TradingOrchestrator aggregated signal: it carries the contributing
 * signal count, which the BlindZone filter needs (without it the filter sees 1 signal).
 */
export function buildBacktestEntrySignals(
  aggregation: AggregationResult,
  analyzerSignals: AnalyzerSignal[],
  price: number,
  timestamp: number,
): BacktestEntrySignal[] {
  if (aggregation.direction !== SignalDirection.LONG && aggregation.direction !== SignalDirection.SHORT) {
    return [];
  }

  const longSignalCount = analyzerSignals.filter((s) => s.direction === SignalDirection.LONG).length;
  const shortSignalCount = analyzerSignals.filter((s) => s.direction === SignalDirection.SHORT).length;

  return [
    {
      type: SignalType.LEVEL_BASED,
      direction: aggregation.direction,
      confidence: Math.round(aggregation.confidence * 100),
      price,
      stopLoss: 0,
      takeProfits: [],
      reason: `Aggregated backtest signal (${aggregation.signalCount} signals)`,
      timestamp,
      signalCount: aggregation.signalCount,
      aggregationContext: {
        signalCount: aggregation.signalCount,
        longSignalCount,
        shortSignalCount,
        originalSignals: analyzerSignals as unknown as Signal[],
      },
    },
  ];
}
