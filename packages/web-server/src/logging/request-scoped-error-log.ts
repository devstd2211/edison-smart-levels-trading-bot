import {
  createErrorLogPayload,
  createStatusApiError,
  getErrorStatus,
  getStructuredErrorDetail,
  resolveRequestId,
} from '../errors/api-error-response.js';
import type { WebSocketRequestType } from '@edison/contracts/runtime-api';

type RequestScopedErrorLogOptions = {
  requestId?: unknown;
  fallbackStatusCode?: number;
  stackSource?: unknown;
  code?: string;
  details?: string;
  suggestion?: string;
  context?: string;
  requestType?: string;
};

type WebSocketRequestValidationLogOptions = {
  code: string;
  error: string;
  details: string;
  requestId?: unknown;
  requestType?: string;
};

type WebSocketReadFailureLogOptions = {
  error: unknown;
  code: string;
  requestId?: unknown;
  requestType?: WebSocketLogRequestType;
  context?: WebSocketLogContext;
};

type WebSocketLogContext = 'new client' | 'status request';
type WebSocketLogRequestType = WebSocketRequestType | string;
type WebSocketLogScopeOptions = {
  requestId?: unknown;
  requestType?: WebSocketLogRequestType;
  context?: WebSocketLogContext;
};

type WebSocketServerEvent =
  | 'server-initialized'
  | 'port-retry'
  | 'alternate-port-attempt'
  | 'alternate-port-active'
  | 'client-connected'
  | 'client-disconnected'
  | 'message-received'
  | 'outbound-message'
  | 'server-closed';

type WebSocketServerEventLogOptions = WebSocketLogScopeOptions & {
  event: WebSocketServerEvent;
  port?: number;
  nextPort?: number;
  clientCount?: number;
  messageType?: string;
  error?: unknown;
  details?: Record<string, unknown>;
};

type WebSocketServerErrorEvent = 'server-error' | 'client-error' | 'message-handler-error';
type WebSocketServerErrorLogOptions = WebSocketLogScopeOptions & {
  event: WebSocketServerErrorEvent;
  error: unknown;
  port?: number;
  clientCount?: number;
  code?: string;
  details?: string;
};

type RuntimeService = 'api' | 'websocket' | 'file-watcher';
type RuntimeServiceEvent = 'service-started' | 'port-retry' | 'service-closed' | 'shutdown-requested';
type RuntimeServiceLogOptions = {
  service: RuntimeService;
  event: RuntimeServiceEvent;
  port?: number;
  nextPort?: number;
  url?: string;
  error?: unknown;
  details?: Record<string, unknown>;
};

type FileWatcherLogEvent =
  | 'watcher-started'
  | 'watcher-stopped'
  | 'watcher-error'
  | 'watcher-start-failed'
  | 'file-change-handler-failed'
  | 'journal-updated'
  | 'session-updated'
  | 'journal-read-failed'
  | 'sessions-read-failed';

type FileWatcherLogOptions = {
  event: FileWatcherLogEvent;
  target?: string;
  entryCount?: number;
  sessionCount?: number;
  error?: unknown;
  details?: Record<string, unknown>;
};

type ConfigLogEvent =
  | 'backup-created'
  | 'backup-create-failed'
  | 'config-updated'
  | 'backups-read-failed'
  | 'pre-restore-backup-create-failed'
  | 'config-restored'
  | 'backup-delete-failed'
  | 'backups-cleaned-up'
  | 'backups-cleanup-failed';

type ConfigLifecycleLogOptions = {
  event: ConfigLogEvent;
  backupId?: string;
  backupPath?: string;
  deleted?: number;
  remainingBackups?: number;
  totalBackups?: number;
  keepCount?: number;
  error?: unknown;
  details?: Record<string, unknown>;
};

type BridgeReadOperation =
  | 'getBalance'
  | 'getMarketData'
  | 'getCandles'
  | 'getPositionHistory'
  | 'getOrderBook'
  | 'getWalls'
  | 'getFundingRate'
  | 'getVolumeProfile';

type BridgeReadFallbackLogOptions = {
  operation: BridgeReadOperation;
  error: unknown;
};

type HttpLogOptions = {
  method: string;
  path: string;
  query?: unknown;
  statusCode: number;
  durationMs: number;
  responseSize: string;
  requestBody?: unknown;
  headers?: Record<string, unknown>;
  requestId?: unknown;
  error?: unknown;
};

type HttpResponseErrorLogOptions = {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  requestId?: unknown;
  error: unknown;
  responseBody?: unknown;
};

function createRetryErrorLogDetails(error: unknown): Record<string, unknown> {
  const payload = createErrorLogPayload(error, {
    fallbackStatusCode: 500,
    stackSource: error,
  });

  return {
    code: payload.code,
    message: payload.message,
    ...(payload.details ? { details: payload.details } : {}),
  };
}

function createWebSocketLogScope(
  options: WebSocketLogScopeOptions,
): Record<string, unknown> {
  return {
    ...(resolveRequestId(options.requestId) ? { requestId: options.requestId } : {}),
    ...(options.requestType ? { requestType: options.requestType } : {}),
    ...(options.context ? { context: options.context } : {}),
  };
}

function createStructuredErrorLogData(
  error: unknown,
  requestId: unknown,
  fallbackStatusCode: number,
): Record<string, unknown> {
  if (!getStructuredErrorDetail(error)) {
    return resolveRequestId(requestId) ? { requestId: resolveRequestId(requestId) } : {};
  }

  const errorLogPayload = createErrorLogPayload(error, {
    requestId,
    fallbackStatusCode,
  });

  if (!errorLogPayload.code || !errorLogPayload.message) {
    return {};
  }

  return {
    ...(resolveRequestId(errorLogPayload.requestId) ? { requestId: errorLogPayload.requestId } : {}),
    errorCode: errorLogPayload.code,
    errorMessage: errorLogPayload.message,
    errorDetails: errorLogPayload.details,
    errorSuggestion: errorLogPayload.suggestion,
  };
}

export function createRequestScopedErrorLogPayload(
  error: unknown,
  options: RequestScopedErrorLogOptions = {},
): Record<string, unknown> {
  const payload = createErrorLogPayload(error, options);

  return {
    ...(options.context ? { context: options.context } : {}),
    ...(resolveRequestId(payload.requestId) ? { requestId: payload.requestId } : {}),
    ...(options.requestType ? { requestType: options.requestType } : {}),
    statusCode: payload.statusCode,
    code: payload.code,
    message: payload.message,
    ...(payload.details ? { details: payload.details } : {}),
    ...(payload.suggestion ? { suggestion: payload.suggestion } : {}),
    ...(payload.stack ? { stack: payload.stack } : {}),
  };
}

export function createWebSocketRequestValidationLogPayload(
  options: WebSocketRequestValidationLogOptions,
): Record<string, unknown> {
  return createRequestScopedErrorLogPayload(createStatusApiError(400, options.error, {
    code: options.code,
    details: options.details,
  }), {
    requestId: options.requestId,
    requestType: options.requestType,
    fallbackStatusCode: 400,
  });
}

export function createWebSocketReadFailureLogPayload(
  options: WebSocketReadFailureLogOptions,
): Record<string, unknown> {
  return createRequestScopedErrorLogPayload(options.error, {
    ...createWebSocketLogScope(options),
    fallbackStatusCode: 500,
    code: options.code,
    stackSource: options.error,
  });
}

export function createWebSocketServerEventLogPayload(
  options: WebSocketServerEventLogOptions,
): Record<string, unknown> {
  return {
    event: options.event,
    ...createWebSocketLogScope(options),
    ...(typeof options.port === 'number' ? { port: options.port } : {}),
    ...(typeof options.nextPort === 'number' ? { nextPort: options.nextPort } : {}),
    ...(typeof options.clientCount === 'number' ? { clientCount: options.clientCount } : {}),
    ...(options.messageType ? { messageType: options.messageType } : {}),
    ...(options.error ? createRetryErrorLogDetails(options.error) : {}),
    ...(options.details ?? {}),
  };
}

export function createWebSocketServerErrorLogPayload(
  options: WebSocketServerErrorLogOptions,
): Record<string, unknown> {
  return {
    event: options.event,
    ...createWebSocketLogScope(options),
    ...(typeof options.port === 'number' ? { port: options.port } : {}),
    ...(typeof options.clientCount === 'number' ? { clientCount: options.clientCount } : {}),
    ...createRequestScopedErrorLogPayload(options.error, {
      fallbackStatusCode: 500,
      code: options.code,
      details: options.details,
      stackSource: options.error,
    }),
  };
}

export function createRuntimeServiceLogPayload(
  options: RuntimeServiceLogOptions,
): Record<string, unknown> {
  return {
    service: options.service,
    event: options.event,
    ...(typeof options.port === 'number' ? { port: options.port } : {}),
    ...(typeof options.nextPort === 'number' ? { nextPort: options.nextPort } : {}),
    ...(options.url ? { url: options.url } : {}),
    ...(options.error ? createRetryErrorLogDetails(options.error) : {}),
    ...(options.details ?? {}),
  };
}

export function createFileWatcherLogPayload(
  options: FileWatcherLogOptions,
): Record<string, unknown> {
  return {
    event: options.event,
    ...(options.target ? { target: options.target } : {}),
    ...(typeof options.entryCount === 'number' ? { entryCount: options.entryCount } : {}),
    ...(typeof options.sessionCount === 'number' ? { sessionCount: options.sessionCount } : {}),
    ...(options.error
      ? createRequestScopedErrorLogPayload(options.error, {
        fallbackStatusCode: 500,
        stackSource: options.error,
      })
      : {}),
    ...(options.details ?? {}),
  };
}

export function createConfigLifecycleLogPayload(
  options: ConfigLifecycleLogOptions,
): Record<string, unknown> {
  return {
    event: options.event,
    ...(options.backupId ? { backupId: options.backupId } : {}),
    ...(options.backupPath ? { backupPath: options.backupPath } : {}),
    ...(typeof options.deleted === 'number' ? { deleted: options.deleted } : {}),
    ...(typeof options.remainingBackups === 'number'
      ? { remainingBackups: options.remainingBackups }
      : {}),
    ...(typeof options.totalBackups === 'number' ? { totalBackups: options.totalBackups } : {}),
    ...(typeof options.keepCount === 'number' ? { keepCount: options.keepCount } : {}),
    ...(options.error
      ? createRequestScopedErrorLogPayload(options.error, {
        fallbackStatusCode: 500,
        stackSource: options.error,
      })
      : {}),
    ...(options.details ?? {}),
  };
}

export function createBridgeReadFallbackLogPayload(
  options: BridgeReadFallbackLogOptions,
): Record<string, unknown> {
  return {
    operation: options.operation,
    fallbackUsed: true,
    ...createRequestScopedErrorLogPayload(options.error, {
      fallbackStatusCode: 500,
      stackSource: options.error,
    }),
  };
}

export function createHttpLogPayload(
  options: HttpLogOptions,
): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    method: options.method,
    path: options.path,
    query: options.query,
    statusCode: options.statusCode,
    duration: `${options.durationMs.toFixed(2)}ms`,
    responseSize: options.responseSize,
    ...(options.requestBody !== undefined ? { requestBody: options.requestBody } : {}),
    ...(options.headers ? { headers: options.headers } : {}),
    ...(options.error
      ? createStructuredErrorLogData(
        options.error,
        options.requestId,
        options.statusCode,
      )
      : (resolveRequestId(options.requestId) ? { requestId: resolveRequestId(options.requestId) } : {})),
  };
}

export function createHttpResponseErrorLogPayload(
  options: HttpResponseErrorLogOptions,
): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    method: options.method,
    path: options.path,
    statusCode: options.statusCode,
    duration: `${options.durationMs.toFixed(2)}ms`,
    error: options.error instanceof Error ? options.error.message : 'Unknown error',
    ...createStructuredErrorLogData(
      options.responseBody,
      options.requestId,
      options.statusCode,
    ),
  };
}

export function createErrorHandlerLogPayload(
  error: unknown,
  options: {
    requestId?: unknown;
    fallbackStatusCode?: number;
  } = {},
): Record<string, unknown> {
  return createRequestScopedErrorLogPayload(error, {
    requestId: options.requestId,
    fallbackStatusCode: getErrorStatus(error) || options.fallbackStatusCode || 500,
    stackSource: error,
  });
}
