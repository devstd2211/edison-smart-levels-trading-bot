import type {
  ConfigSchemaPayload,
  ControlConfigPayload,
  RiskSettingsPayload,
  StrategyConfigEntryPayload,
  StrategyConfigSummary,
  StrategiesConfigPayload,
} from '@edison/contracts/runtime-api';
import * as runtimeApiContracts from '@edison/contracts/runtime-api';
import { configApi } from './api.service';

const FALLBACK_CONTROL_CONFIG: ControlConfigPayload = {
  trading: {
    symbol: 'APEXUSDT',
    timeframe: '5m',
    enabled: true,
  },
  risk: {
    maxLeverage: 5,
    maxPositionSize: 0.1,
    dailyLossLimit: 100,
    stopLossPercent: 1.5,
    takeProfitPercent: 3,
  },
  strategies: {},
};

const FALLBACK_CONFIG_SCHEMA = runtimeApiContracts.CONFIG_SCHEMA_METADATA as ConfigSchemaPayload;

function isStrategyConfigEntry(value: unknown): value is StrategyConfigEntryPayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatStrategySummaryName(strategyId: string): string {
  return strategyId
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function createFallbackControlConfig(): ControlConfigPayload {
  return {
    ...FALLBACK_CONTROL_CONFIG,
    trading: { ...FALLBACK_CONTROL_CONFIG.trading },
    risk: { ...FALLBACK_CONTROL_CONFIG.risk },
    strategies: {},
  };
}

export function createFallbackConfigSchema(): ConfigSchemaPayload {
  return FALLBACK_CONFIG_SCHEMA;
}

export function getStrategyEntry(
  strategies: StrategiesConfigPayload | undefined,
  strategyId: string,
): StrategyConfigEntryPayload | undefined {
  const strategy = strategies?.[strategyId];
  return isStrategyConfigEntry(strategy) ? strategy : undefined;
}

export function buildStrategySummariesFromConfig(
  strategies: StrategiesConfigPayload | undefined,
): StrategyConfigSummary[] {
  if (!strategies) {
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

export function getStrategyDescription(strategy: StrategyConfigSummary): string {
  const description = strategy.config?.description;
  return typeof description === 'string' && description.trim().length > 0
    ? description
    : 'Strategy configuration is loaded from the active runtime config.';
}

export function applyStrategyToggleToConfig(
  config: ControlConfigPayload,
  strategyId: string,
  enabled: boolean,
): ControlConfigPayload {
  return {
    ...config,
    strategies: {
      ...config.strategies,
      [strategyId]: {
        ...getStrategyEntry(config.strategies, strategyId),
        enabled,
      },
    },
  };
}

export function applyRiskSettingsToConfig(
  config: ControlConfigPayload,
  risk: RiskSettingsPayload,
): ControlConfigPayload {
  return {
    ...config,
    risk,
  };
}

export function buildRiskSummaryRows(
  risk: RiskSettingsPayload | undefined,
  schema: ConfigSchemaPayload,
): Array<{ label: string; value: string }> {
  const riskFields = schema.sections.risk?.fields ?? [];
  const valueByFieldName: Record<string, string> = {
    maxLeverage: `${risk?.maxLeverage ?? 0}x`,
    maxPositionSize: `${((risk?.maxPositionSize ?? 0) * 100).toFixed(1)}%`,
    dailyLossLimit: `$${risk?.dailyLossLimit ?? 0}`,
    stopLossPercent: `${risk?.stopLossPercent ?? 0}%`,
    takeProfitPercent: `${risk?.takeProfitPercent ?? 0}%`,
  };

  return riskFields
    .filter((field) => valueByFieldName[field.name] !== undefined)
    .map((field) => ({
      label: field.label,
      value: valueByFieldName[field.name],
    }));
}

export async function loadControlBootstrap(): Promise<{
  config: ControlConfigPayload;
  strategies: StrategyConfigSummary[];
  schema: ConfigSchemaPayload;
}> {
  const [configResponse, strategiesResponse, schemaResponse] = await Promise.all([
    configApi.getConfig(),
    configApi.getStrategies(),
    configApi.getConfigSchema(),
  ]);

  const config = configResponse.success && configResponse.data
    ? configResponse.data
    : createFallbackControlConfig();
  const strategies = strategiesResponse.success && strategiesResponse.data?.strategies
    ? strategiesResponse.data.strategies
    : buildStrategySummariesFromConfig(config.strategies);
  const schema = schemaResponse.success && schemaResponse.data
    ? schemaResponse.data
    : createFallbackConfigSchema();

  return { config, strategies, schema };
}
