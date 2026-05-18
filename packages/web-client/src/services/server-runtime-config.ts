import type {
  ApiErrorDetail,
  ApiResponse,
  ConfigServerRuntimeResponsePayload,
  StructuredApiErrorResponse,
} from '@edison/contracts/runtime-api';

export type ServerConfig = ConfigServerRuntimeResponsePayload;
export const DEFAULT_SERVER_RUNTIME_PORTS = {
  api: 4000,
  websocket: 4001,
} as const;
const LEGACY_SERVER_RUNTIME_API_PORTS = [4002] as const;

declare global {
  interface Window {
    __SERVER_CONFIG__?: ServerConfig;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiErrorDetail(value: unknown): value is ApiErrorDetail {
  return isRecord(value) && typeof value.code === 'string' && typeof value.message === 'string';
}

export function extractApiErrorMessage(
  payload: unknown,
  fallback: string,
): string {
  if (isRecord(payload)) {
    const nestedError = payload.error;
    if (isApiErrorDetail(nestedError)) {
      return nestedError.message;
    }
    if (typeof nestedError === 'string' && nestedError.length > 0) {
      return nestedError;
    }
  }
  return fallback;
}

export function getCachedServerConfig(): ServerConfig | undefined {
  return typeof window !== 'undefined' ? window.__SERVER_CONFIG__ : undefined;
}

export function cacheServerConfig(config: ServerConfig): void {
  if (typeof window !== 'undefined') {
    window.__SERVER_CONFIG__ = config;
  }
}

export function getRuntimeHostname(hostname?: string): string {
  return hostname
    ?? (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
}

export function createApiBaseUrl(hostname: string, port: number): string {
  return `http://${hostname}:${port}/api`;
}

export function getServerConfigApiBaseUrl(config: ServerConfig): string {
  return `${config.api.url}/api`;
}

export function resolveServerConfigApiBaseUrl(): string {
  const cachedConfig = getCachedServerConfig();
  if (cachedConfig) {
    return getServerConfigApiBaseUrl(cachedConfig);
  }

  if (typeof window !== 'undefined' && window.location.port) {
    return `${window.location.origin}/api`;
  }

  return createApiBaseUrl(getRuntimeHostname(), DEFAULT_SERVER_RUNTIME_PORTS.api);
}

export function getServerConfigCandidateApiBaseUrls(hostname?: string): string[] {
  const resolvedHostname = getRuntimeHostname(hostname);
  const candidates = [
    resolveServerConfigApiBaseUrl(),
    createApiBaseUrl(resolvedHostname, DEFAULT_SERVER_RUNTIME_PORTS.api),
    ...LEGACY_SERVER_RUNTIME_API_PORTS.map((port) => createApiBaseUrl(resolvedHostname, port)),
  ];

  return [...new Set(candidates)];
}

export function createFallbackServerConfig(
  hostname?: string,
): ServerConfig {
  const resolvedHostname = getRuntimeHostname(hostname);

  return {
    api: {
      port: DEFAULT_SERVER_RUNTIME_PORTS.api,
      url: `http://${resolvedHostname}:${DEFAULT_SERVER_RUNTIME_PORTS.api}`,
    },
    websocket: {
      port: DEFAULT_SERVER_RUNTIME_PORTS.websocket,
      url: `ws://${resolvedHostname}:${DEFAULT_SERVER_RUNTIME_PORTS.websocket}`,
    },
  };
}

export async function preloadServerConfig(hostname?: string): Promise<ApiResponse<ServerConfig>> {
  const cachedConfig = getCachedServerConfig();
  if (cachedConfig) {
    return {
      success: true,
      data: cachedConfig,
      timestamp: Date.now(),
    };
  }

  let lastFailure: ApiResponse<ServerConfig> | undefined;
  for (const apiBaseUrl of getServerConfigCandidateApiBaseUrls(hostname)) {
    const response = await loadServerConfigFromUrl(apiBaseUrl);
    if (response.success && response.data) {
      return response;
    }
    lastFailure = response;
  }

  return lastFailure ?? {
    success: false,
    error: 'Unable to load runtime server configuration',
    timestamp: Date.now(),
  };
}

export async function loadServerConfigFromUrl(apiBaseUrl: string): Promise<ApiResponse<ServerConfig>> {
  try {
    const response = await fetch(`${apiBaseUrl}/config/server`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const json = await response.json() as ApiResponse<ServerConfig> | StructuredApiErrorResponse;

    if (!response.ok) {
      return {
        success: false,
        error: extractApiErrorMessage(json, `HTTP ${response.status}`),
        timestamp: isRecord(json) && typeof json.timestamp === 'number' ? json.timestamp : Date.now(),
      };
    }

    if (json.success && json.data) {
      cacheServerConfig(json.data);
    }

    return json as ApiResponse<ServerConfig>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    };
  }
}
