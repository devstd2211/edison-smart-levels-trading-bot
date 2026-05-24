import {
  createErrorLogPayload,
  createStatusApiError,
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
type RuntimeServiceEvent = 'service-started' | 'port-retry' | 'service-closed';
type RuntimeServiceLogOptions = {
  service: RuntimeService;
  event: RuntimeServiceEvent;
  port?: number;
  nextPort?: number;
  url?: string;
  error?: unknown;
  details?: Record<string, unknown>;
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
