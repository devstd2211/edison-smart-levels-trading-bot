import {
  createErrorLogPayload,
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
