import {
  type ConfigBackupCollectionPayload,
  type ConfigBackupPayload,
  type ConfigMutationRequestPayload,
  type ConfigMutationPreviewPayload,
  type ConfigUpdateResponsePayload,
  type ConfigValidationResponsePayload,
  DEFAULT_CONFIG_BACKUP_KEEP_COUNT,
  DEFAULT_SERVER_RUNTIME_PORTS,
} from '@edison/contracts/runtime-api';

export type StrategyToggleRequestParams = {
  id: string;
};

export type ConfigRestoreRequestParams = {
  backupId: string;
};

type ServerRuntimePorts = {
  apiPort: number;
  wsPort: number;
};

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

export function hasValidationConfigPayload(
  value: unknown,
): value is { config: Record<string, unknown> } {
  return isRecord(value) && isRecord(value.config);
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

export function createConfigBackupCollection(
  backups: ConfigBackupPayload[],
): ConfigBackupCollectionPayload {
  return {
    backups,
    count: backups.length,
  };
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
