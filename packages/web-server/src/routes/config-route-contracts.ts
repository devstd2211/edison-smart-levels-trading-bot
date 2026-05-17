import {
  DEFAULT_CONFIG_BACKUP_KEEP_COUNT,
  DEFAULT_SERVER_RUNTIME_PORTS,
} from '@edison/contracts/runtime-api';

type ServerRuntimePorts = {
  apiPort: number;
  wsPort: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isConfigPayload(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
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
