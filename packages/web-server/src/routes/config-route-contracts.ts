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
import { createStatusApiError } from '../errors/api-error-response.js';

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
export type StrategyToggleRequestBody = {
  enabled?: unknown;
};
export type ConfigRouteHandlers = {
  readConfig(): Promise<BotConfigPayload>;
  updateConfig(body: unknown): Promise<ConfigUpdateResponsePayload>;
  getStrategySummaries(): Promise<StrategiesResponsePayload>;
  updateStrategyToggle(
    params: StrategyToggleRequestParams,
    body: StrategyToggleRequestBody,
  ): Promise<StrategyToggleResponsePayload>;
  updateRiskSettings(riskPatch: RiskSettingsPayload): Promise<RiskUpdateResponsePayload>;
  previewConfig(body: unknown): Promise<ConfigMutationPreviewPayload>;
  validateConfig(body: unknown): ConfigValidationResponsePayload;
  getBackupCollection(): Promise<ConfigBackupCollectionPayload>;
  restoreConfig(params: ConfigRestoreRequestParams): Promise<ConfigRestoreResponsePayload>;
  cleanupBackups(body: unknown): Promise<ConfigCleanupResponsePayload>;
  getSchema(): ConfigSchemaPayload;
  getHistory(): Promise<ConfigHistoryResponsePayload>;
  readServerRuntimeConfig(): ConfigServerRuntimeResponsePayload;
};

const MIN_SERVER_RUNTIME_PORT = 1;
const MAX_SERVER_RUNTIME_PORT = 65_535;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isConfigPayload(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}

export function parseConfigMutationRequest(
  value: unknown,
): ConfigMutationRequestPayload['config'] | null {
  if (isRecord(value) && 'config' in value) {
    return isRecord(value.config) ? value.config : null;
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

export function requireConfigMutationRequest(
  value: unknown,
  message: string = 'Invalid configuration payload',
): ConfigMutationRequestPayload['config'] {
  const config = parseConfigMutationRequest(value);
  if (config) {
    return config;
  }

  throw createStatusApiError(
    400,
    message,
    {
      details: 'Request body must contain a config object or be a config object',
      suggestion: 'Provide a JSON object in the request body',
    },
  );
}

export function requireStrategyToggleEnabled(enabled: unknown): boolean {
  if (typeof enabled === 'boolean') {
    return enabled;
  }

  throw createStatusApiError(
    400,
    'Missing enabled flag',
    {
      suggestion: 'Check your request parameters and try again',
    },
  );
}

function requireNonEmptyRouteParam(value: string | null | undefined, fieldName: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  throw createStatusApiError(
    400,
    `${fieldName} is required`,
    {
      suggestion: `Provide a non-empty ${fieldName} value`,
    },
  );
}

export function requireValidationConfigRequest(
  value: unknown,
): ConfigMutationRequestPayload['config'] {
  const config = parseValidationConfigRequest(value);
  if (config) {
    return config;
  }

  throw createStatusApiError(
    400,
    'No config provided for validation',
    {
      details: 'Request body must contain a config object or a { "config": ... } wrapper',
      suggestion: 'Provide a JSON object to validate',
    },
  );
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

export function requireRestoreBackupId(params: ConfigRestoreRequestParams): string {
  const backupId = parseRestoreBackupId(params);
  if (backupId) {
    return backupId;
  }

  throw createStatusApiError(
    400,
    'Backup id is required',
    {
      details: 'Route parameter "backupId" must be a non-empty string',
      suggestion: 'Provide a non-empty backup id in the route path',
    },
  );
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
  const apiPort = normalizeServerRuntimePort(
    runtimePorts?.apiPort,
    Number.parseInt(process.env.API_PORT || '', 10),
    DEFAULT_SERVER_RUNTIME_PORTS.api,
  );
  const wsPort = normalizeServerRuntimePort(
    runtimePorts?.wsPort,
    Number.parseInt(process.env.WS_PORT || '', 10),
    DEFAULT_SERVER_RUNTIME_PORTS.websocket,
  );

  return {
    apiPort,
    wsPort,
  };
}

function normalizeServerRuntimePort(
  preferredPort: number | undefined,
  envPort: number,
  fallbackPort: number,
): number {
  const port = isValidServerRuntimePort(preferredPort) ? preferredPort : envPort;
  return isValidServerRuntimePort(port) ? port : fallbackPort;
}

function isValidServerRuntimePort(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= MIN_SERVER_RUNTIME_PORT
    && value <= MAX_SERVER_RUNTIME_PORT;
}

export function createServerRuntimeConfigPayload(
  runtimePorts?: ServerRuntimePorts,
): ConfigServerRuntimeResponsePayload {
  const { apiPort, wsPort } = resolveServerRuntimePorts(runtimePorts);
  return createSharedServerRuntimeConfigPayload(apiPort, wsPort);
}

export function createConfigRouteHandlers(
  configApi: ConfigRouteApi,
  getRuntimePorts?: () => ServerRuntimePorts,
): ConfigRouteHandlers {
  return {
    readConfig: () => configApi.read(),
    updateConfig: async (body) => createConfigUpdateResponse(
      await configApi.write(requireConfigMutationRequest(body)),
    ),
    getStrategySummaries: () => configApi.getStrategySummaries(),
    updateStrategyToggle: (params, body) => configApi.updateStrategyToggle(
      requireNonEmptyRouteParam(params.id, 'Strategy id'),
      requireStrategyToggleEnabled(body.enabled),
    ),
    updateRiskSettings: (riskPatch) => configApi.updateRiskSettings(riskPatch),
    previewConfig: async (body) => createConfigMutationPreviewResponse(
      await configApi.preview(
        requireConfigMutationRequest(body, 'No config provided for preview'),
      ),
    ),
    validateConfig: (body) => createConfigValidationResponse(
      configApi.validate(requireValidationConfigRequest(body)),
    ),
    getBackupCollection: () => configApi.getBackupCollection(),
    restoreConfig: (params) => configApi.restore(requireRestoreBackupId(params)),
    cleanupBackups: (body) => configApi.cleanupOldBackups(parseCleanupKeepCount(body)),
    getSchema: () => configApi.getSchema(),
    getHistory: () => configApi.getHistory(),
    readServerRuntimeConfig: () => createServerRuntimeConfigPayload(getRuntimePorts?.()),
  };
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
