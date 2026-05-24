import {
  createErrorLogPayload,
  createStatusApiError,
  resolveRequestId,
} from '../errors/api-error-response.js';

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
  requestType?: string;
  context?: string;
};

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
    context: options.context,
    requestId: options.requestId,
    requestType: options.requestType,
    fallbackStatusCode: 500,
    code: options.code,
    stackSource: options.error,
  });
}
