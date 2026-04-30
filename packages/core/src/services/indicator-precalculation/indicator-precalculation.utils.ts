import type { Candle, IIndicatorCalculator, TimeframeRole } from '../../types/legacy';

export type IndicatorPrecalculationPendingClose = {
  timeframe: TimeframeRole;
  closeTime: number;
};

export type IndicatorTimeframeRequirement = Map<string, number>;

export function partitionPendingCloses(
  pendingCloses: IndicatorPrecalculationPendingClose[],
): {
  currentTime: number;
  sameTimeBatch: IndicatorPrecalculationPendingClose[];
  remainingCloses: IndicatorPrecalculationPendingClose[];
} {
  const currentTime = pendingCloses[0].closeTime;
  return {
    currentTime,
    sameTimeBatch: pendingCloses.filter((close) => close.closeTime === currentTime),
    remainingCloses: pendingCloses.filter((close) => close.closeTime !== currentTime),
  };
}

export function findAffectedCalculators(
  calculators: IIndicatorCalculator[],
  closedTimeframe: TimeframeRole,
): IIndicatorCalculator[] {
  return calculators.filter((calculator) =>
    calculator
      .getConfig()
      .indicators.some((indicator) =>
        indicator.timeframes.includes(closedTimeframe as unknown as string),
      ),
  );
}

export function collectTimeframeRequirements(
  calculators: IIndicatorCalculator[],
): IndicatorTimeframeRequirement {
  const requirements = new Map<string, number>();

  for (const calculator of calculators) {
    calculator.getConfig().indicators.forEach((indicator) => {
      indicator.timeframes.forEach((timeframe) => {
        const currentRequirement = requirements.get(timeframe) ?? 0;
        requirements.set(
          timeframe,
          Math.max(currentRequirement, indicator.minCandlesRequired),
        );
      });
    });
  }

  return requirements;
}

export function buildInvalidationKeys(
  calculators: IIndicatorCalculator[],
  closedTimeframe: TimeframeRole,
): string[] {
  const keys = new Set<string>();

  for (const calculator of calculators) {
    calculator.getConfig().indicators.forEach((indicator) => {
      if (!indicator.timeframes.includes(closedTimeframe as unknown as string)) {
        return;
      }

      indicator.periods.forEach((period) => {
        keys.add(`${indicator.name}-${period}-${closedTimeframe}`);
      });
    });
  }

  return [...keys];
}

export function shouldNotifyIndicatorsReady(
  batch: IndicatorPrecalculationPendingClose[],
  entryTimeframe: TimeframeRole,
): boolean {
  return batch.some((close) => close.timeframe === entryTimeframe);
}

export function createCalculationContext(
  candlesByTimeframe: Map<string, Candle[]>,
  timestamp: number,
): {
  candlesByTimeframe: Map<string, Candle[]>;
  timestamp: number;
} {
  return {
    candlesByTimeframe,
    timestamp,
  };
}

export function countUpdatedEntries(results: Array<Map<string, number>>): number {
  return results.reduce((sum, result) => sum + result.size, 0);
}
