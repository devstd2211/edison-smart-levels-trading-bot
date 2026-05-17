import type {
  ConfigBackupPayload,
  ConfigBackupsResponsePayload,
  ConfigCleanupResponsePayload,
  ConfigHistoryResponsePayload,
  ConfigRestoreResponsePayload,
  ConfigSchemaPayload,
  ConfigSchemaSectionKey,
  ControlConfigPayload,
  RiskSettingsPayload,
  StrategyConfigEntryPayload,
  StrategyConfigSummary,
  StrategiesConfigPayload,
} from '@edison/contracts/runtime-api';
import { configApi } from './api.service';
import { DEFAULT_CONTROL_BACKUP_KEEP_COUNT } from './control-config.constants';

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

const FALLBACK_CONFIG_SCHEMA: ConfigSchemaPayload = {
  sections: {
    trading: {
      name: 'Trading Parameters',
      fields: [
        { name: 'symbol', type: 'string', label: 'Trading Pair' },
        { name: 'timeframe', type: 'string', label: 'Candle Timeframe' },
        { name: 'enabled', type: 'boolean', label: 'Enable Trading' },
      ],
    },
    risk: {
      name: 'Risk Management',
      fields: [
        { name: 'maxLeverage', type: 'number', label: 'Max Leverage' },
        { name: 'maxPositionSize', type: 'number', label: 'Max Position Size' },
        { name: 'dailyLossLimit', type: 'number', label: 'Daily Loss Limit' },
        { name: 'stopLossPercent', type: 'number', label: 'Stop Loss %' },
        { name: 'takeProfitPercent', type: 'number', label: 'Take Profit %' },
      ],
    },
    strategies: {
      name: 'Strategies',
      fields: [
        { name: 'enabled', type: 'boolean', label: 'Enabled' },
        { name: 'confidence', type: 'number', label: 'Min Confidence' },
        { name: 'maxTrades', type: 'number', label: 'Max Concurrent Trades' },
      ],
    },
  },
};

const RISK_SECTION_KEY: ConfigSchemaSectionKey = 'risk';

export interface ControlBackupStatus {
  latestBackup: ConfigBackupPayload | null;
  backupCount: number;
  historyCount: number;
  historyMatchesBackups: boolean;
}

const FALLBACK_BACKUP_STATUS: ControlBackupStatus = {
  latestBackup: null,
  backupCount: 0,
  historyCount: 0,
  historyMatchesBackups: true,
};

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

export function createFallbackBackupStatus(): ControlBackupStatus {
  return FALLBACK_BACKUP_STATUS;
}

function resolveBackupCollectionCount(
  payload: ConfigBackupsResponsePayload | ConfigHistoryResponsePayload | undefined,
): number {
  if (!payload) {
    return 0;
  }

  return Number.isFinite(payload.count) ? payload.count : payload.backups.length;
}

export function buildControlBackupStatus(
  backupsPayload?: ConfigBackupsResponsePayload,
  historyPayload?: ConfigHistoryResponsePayload,
): ControlBackupStatus {
  const backups = backupsPayload?.backups ?? [];
  const historyBackups = historyPayload?.backups ?? [];
  const latestBackup = backups[0] ?? historyBackups[0] ?? null;
  const backupCount = resolveBackupCollectionCount(backupsPayload);
  const historyCount = resolveBackupCollectionCount(historyPayload);

  return {
    latestBackup,
    backupCount,
    historyCount,
    historyMatchesBackups: backupCount === historyCount,
  };
}

function requireApiPayload<T>(
  response: { success: boolean; data?: T; error?: string },
  fallbackMessage: string,
): T {
  if (response.success && response.data) {
    return response.data;
  }

  throw new Error(response.error || fallbackMessage);
}

export async function loadControlBackupStatus(): Promise<ControlBackupStatus> {
  const [backupsResponse, historyResponse] = await Promise.all([
    configApi.getConfigBackups(),
    configApi.getConfigHistory(),
  ]);

  return buildControlBackupStatus(
    backupsResponse.success ? backupsResponse.data : undefined,
    historyResponse.success ? historyResponse.data : undefined,
  );
}

export async function restoreLatestControlBackup(
  latestBackup: ConfigBackupPayload | null,
): Promise<{
  backupStatus: ControlBackupStatus;
  result: ConfigRestoreResponsePayload;
}> {
  if (!latestBackup) {
    throw new Error('No backup metadata available to restore');
  }

  const result = requireApiPayload(
    await configApi.restoreConfigBackup(latestBackup.id),
    'Failed to restore configuration backup',
  );

  return {
    result,
    backupStatus: await loadControlBackupStatus(),
  };
}

export async function cleanupControlBackups(
  keepCount: number = DEFAULT_CONTROL_BACKUP_KEEP_COUNT,
): Promise<{
  backupStatus: ControlBackupStatus;
  result: ConfigCleanupResponsePayload;
}> {
  const result = requireApiPayload(
    await configApi.cleanupConfigBackups(keepCount),
    'Failed to cleanup configuration backups',
  );

  return {
    result,
    backupStatus: await loadControlBackupStatus(),
  };
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
  const riskFields = schema.sections[RISK_SECTION_KEY]?.fields ?? [];
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
  backupStatus: ControlBackupStatus;
}> {
  const [configResponse, strategiesResponse, schemaResponse, backupStatus] = await Promise.all([
    configApi.getConfig(),
    configApi.getStrategies(),
    configApi.getConfigSchema(),
    loadControlBackupStatus(),
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

  return { config, strategies, schema, backupStatus };
}
