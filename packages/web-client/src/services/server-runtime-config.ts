import type {
  ApiErrorDetail,
  ApiResponse,
  ServerRuntimeConfigPayload,
  StructuredApiErrorResponse,
} from '@edison/contracts/runtime-api';

export type ServerConfig = ServerRuntimeConfigPayload;

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
