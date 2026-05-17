import type { StrategyConfigEntryPayload, StrategyConfigSummary } from '@edison/contracts/runtime-api';

function isStrategyConfigEntry(value: unknown): value is StrategyConfigEntryPayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function formatStrategySummaryName(strategyId: string): string {
  return strategyId
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function mapStrategyConfigSummaries(strategies: unknown): StrategyConfigSummary[] {
  if (typeof strategies !== 'object' || strategies === null || Array.isArray(strategies)) {
    return [];
  }

  return Object.entries(strategies).flatMap(([id, value]) => {
    if (!isStrategyConfigEntry(value)) {
      return [];
    }

    return [{
      id,
      name: formatStrategySummaryName(id),
      enabled: value.enabled === true,
      config: value,
    }];
  });
}
