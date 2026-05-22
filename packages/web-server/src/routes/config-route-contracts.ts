import {
  createServerRuntimeConfigPayload as createSharedServerRuntimeConfigPayload,
  type BotConfigPayload,
  type ConfigBackupCollectionPayload,
  type ConfigServerRuntimeResponsePayload,
  type ConfigCleanupResponsePayload,
  type ConfigMutationRequestPayload,
  type ConfigMutationPreviewPayload,
  type ConfigHistoryResponsePayload,
  type ConfigRestoreResponsePayload,
  type ConfigUpdateResponsePayload,
  type ConfigValidationResponsePayload,
  type ConfigSchemaPayload,
  type RiskSettingsPayload,
  type RiskUpdateResponsePayload,
  type StrategiesResponsePayload,
  type StrategyToggleResponsePayload,
  DEFAULT_CONFIG_BACKUP_KEEP_COUNT,
  DEFAULT_SERVER_RUNTIME_PORTS,
} from '@edison/contracts/runtime-api';

export type StrategyToggleRequestParams = {
  id: string;
};

export type ConfigRestoreRequestParams = {
  backupId: string;
};

export type ServerRuntimePorts = {
  apiPort: number;
  wsPort: number;
};

export type ConfigRouteReadApi = {
  read(): Promise<BotConfigPayload>;
  getStrategySummaries(): Promise<StrategiesResponsePayload>;
  getBackupCollection(): Promise<ConfigBackupCollectionPayload>;
  getSchema(): ConfigSchemaPayload;
  getHistory(): Promise<ConfigHistoryResponsePayload>;
  validate(config: BotConfigPayload): ConfigValidationResponsePayload;
};

export type ConfigRouteMutationApi = {
  write(config: BotConfigPayload): Promise<ConfigUpdateResponsePayload>;
  updateStrategyToggle(
    strategyId: string,
    enabled: boolean,
  ): Promise<StrategyToggleResponsePayload>;
  updateRiskSettings(riskPatch: RiskSettingsPayload): Promise<RiskUpdateResponsePayload>;
  preview(config: BotConfigPayload): Promise<ConfigMutationPreviewPayload>;
  restore(backupId: string): Promise<ConfigRestoreResponsePayload>;
  cleanupOldBackups(keepCount: number): Promise<ConfigCleanupResponsePayload>;
};

export type ConfigRouteApi = ConfigRouteReadApi & ConfigRouteMutationApi;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isConfigPayload(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}

export function parseConfigMutationRequest(
  value: unknown,
): ConfigMutationRequestPayload['config'] | null {
  if (isRecord(value) && isRecord(value.config)) {
    return value.config;
  }

  return isConfigPayload(value) ? value : null;
}

export function parseValidationConfigRequest(
  value: unknown,
): ConfigMutationRequestPayload['config'] | null {
  if (value === undefined || value === null) {
    return null;
  }

  return parseConfigMutationRequest(value);
}

export function parseCleanupKeepCount(value: unknown): number {
  if (!isRecord(value) || value.keepCount === undefined) {
    return DEFAULT_CONFIG_BACKUP_KEEP_COUNT;
  }

  const keepCount = value.keepCount;
  return typeof keepCount === 'number' && Number.isFinite(keepCount) && keepCount >= 0
    ? Math.floor(keepCount)
    : DEFAULT_CONFIG_BACKUP_KEEP_COUNT;
}

export function parseRestoreBackupId(params: ConfigRestoreRequestParams): string | null {
  const backupId = params.backupId?.trim();
  return backupId && backupId.length > 0 ? backupId : null;
}

export function createConfigUpdateResponse(
  result: ConfigUpdateResponsePayload,
): ConfigUpdateResponsePayload {
  return {
    message: result.message,
    backupPath: result.backupPath,
    requiresRestart: result.requiresRestart,
    preview: result.preview,
    validation: result.validation,
  };
}

export function createConfigMutationPreviewResponse(
  preview: ConfigMutationPreviewPayload,
): ConfigMutationPreviewPayload {
  return {
    changes: preview.changes,
    summary: preview.summary,
    validation: preview.validation,
  };
}

export function createConfigValidationResponse(
  validation: ConfigValidationResponsePayload,
): ConfigValidationResponsePayload {
  return {
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings,
    summary: validation.summary,
  };
}

export function resolveServerRuntimePorts(
  runtimePorts?: ServerRuntimePorts,
): ServerRuntimePorts {
  const apiPort = runtimePorts?.apiPort ?? Number.parseInt(process.env.API_PORT || '', 10);
  const wsPort = runtimePorts?.wsPort ?? Number.parseInt(process.env.WS_PORT || '', 10);

  return {
    apiPort: Number.isFinite(apiPort) ? apiPort : DEFAULT_SERVER_RUNTIME_PORTS.api,
    wsPort: Number.isFinite(wsPort) ? wsPort : DEFAULT_SERVER_RUNTIME_PORTS.websocket,
  };
}

export function createServerRuntimeConfigPayload(
  runtimePorts?: ServerRuntimePorts,
): ConfigServerRuntimeResponsePayload {
  const { apiPort, wsPort } = resolveServerRuntimePorts(runtimePorts);
  return createSharedServerRuntimeConfigPayload(apiPort, wsPort);
}

export function createConfigRouteApi(service: ConfigRouteApi): ConfigRouteApi {
  return {
    read: () => service.read(),
    write: (config) => service.write(config),
    getStrategySummaries: () => service.getStrategySummaries(),
    updateStrategyToggle: (id, enabled) => service.updateStrategyToggle(id, enabled),
    updateRiskSettings: (riskPatch) => service.updateRiskSettings(riskPatch),
    preview: (config) => service.preview(config),
    validate: (config) => service.validate(config),
    getBackupCollection: () => service.getBackupCollection(),
    restore: (backupId) => service.restore(backupId),
    cleanupOldBackups: (keepCount) => service.cleanupOldBackups(keepCount),
    getSchema: () => service.getSchema(),
    getHistory: () => service.getHistory(),
  };
}
