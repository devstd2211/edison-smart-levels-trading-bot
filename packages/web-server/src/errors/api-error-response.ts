import type {
  ApiErrorDetail,
  ErrorPayload,
  StructuredApiErrorResponse,
  WebSocketErrorCode,
} from '@edison/contracts/runtime-api';

export class ApiError extends Error {
  constructor(
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    message: string = 'Internal server error',
    public details?: string,
    public suggestion?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type StatusErrorResponseOptions = {
  code?: string;
  details?: string;
  suggestion?: string;
  requestId?: unknown;
};
type ErrorDetailOptions = Omit<StatusErrorResponseOptions, 'requestId'> & {
  fallbackMessage?: string;
};
type ErrorResponseOptions = {
  requestId?: unknown;
  timestamp?: number;
};
type ErrorContextOptions = {
  fallbackStatusCode?: number;
  fallbackMessage?: string;
  requestId?: unknown;
  stackSource?: unknown;
  code?: string;
  details?: string;
  suggestion?: string;
};

type WebSocketStatusErrorOptions = {
  code: WebSocketErrorCode;
  details?: string;
  suggestion?: string;
  requestType?: string;
  errorMessage?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isApiErrorDetail(value: unknown): value is ApiErrorDetail {
  return isRecord(value)
    && typeof value.code === 'string'
    && typeof value.message === 'string';
}

const WEBSOCKET_ERROR_CODES: readonly WebSocketErrorCode[] = [
  'INVALID_JSON',
  'INVALID_MESSAGE',
  'UNKNOWN_MESSAGE_TYPE',
  'STATUS_READ_FAILED',
  'POSITION_READ_FAILED',
  'INTERNAL_SERVER_ERROR',
];

function getStringField(error: unknown, fieldName: string): string | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  const value = error[fieldName];
  return typeof value === 'string' ? value : undefined;
}

function getNumberField(error: unknown, fieldName: string): number | undefined {
  if (!isRecord(error)) {
    return undefined;
  }

  const value = error[fieldName];
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function getRequestIdField(value: unknown): string | undefined {
  if (typeof value === 'string') {
    try {
      return getRequestIdField(JSON.parse(value));
    } catch {
      return undefined;
    }
  }

  if (!isRecord(value)) {
    return undefined;
  }

  return resolveRequestId(value.requestId);
}

function resolveErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }
  if (isRecord(error) && typeof error.error === 'string') {
    return error.error;
  }
  return undefined;
}

export function getErrorMessage(error: unknown): string {
  return resolveErrorMessage(error) ?? 'An unknown error occurred';
}

export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  if (isRecord(error) && typeof error.stack === 'string') {
    return error.stack;
  }
  return undefined;
}

export function getErrorCode(error: unknown): string | undefined {
  return getStringField(error, 'code');
}

export function getErrorStatus(error: unknown): number | undefined {
  return getNumberField(error, 'statusCode') ?? getNumberField(error, 'status');
}

export function getErrorDetails(error: unknown): string | undefined {
  if (error instanceof ApiError) {
    return error.details;
  }

  return getStringField(error, 'details');
}

export function getErrorSuggestion(error: unknown, statusCode?: number): string | undefined {
  if (error instanceof ApiError) {
    return error.suggestion;
  }

  return getStringField(error, 'suggestion') ?? (statusCode !== undefined ? getDefaultSuggestion(statusCode) : undefined);
}

export function getDefaultErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'UNPROCESSABLE_ENTITY';
    case 429:
      return 'RATE_LIMIT_EXCEEDED';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return 'INTERNAL_ERROR';
  }
}

function isWebSocketErrorCode(code: string | undefined): code is WebSocketErrorCode {
  return code !== undefined && WEBSOCKET_ERROR_CODES.includes(code as WebSocketErrorCode);
}

export function getDefaultSuggestion(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'Check your request parameters and try again';
    case 404:
      return 'Check that the requested resource or route exists';
    case 409:
      return 'Resolve the current state conflict and try again';
    case 429:
      return 'Wait for the rate limit window to reset and retry';
    default:
      return 'Please try again or contact support';
  }
}

export function getStructuredErrorDetail(value: unknown): ApiErrorDetail | undefined {
  if (typeof value === 'string') {
    try {
      return getStructuredErrorDetail(JSON.parse(value));
    } catch {
      return undefined;
    }
  }

  if (isApiErrorDetail(value)) {
    return {
      code: value.code,
      message: value.message,
      details: getStringField(value, 'details'),
      suggestion: getStringField(value, 'suggestion'),
    };
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const nestedError = value.error;
  if (!isApiErrorDetail(nestedError)) {
    return undefined;
  }

  return {
    code: nestedError.code,
    message: nestedError.message,
    details: getStringField(nestedError, 'details'),
    suggestion: getStringField(nestedError, 'suggestion'),
  };
}

function createApiErrorDetail(error: ApiError): ApiErrorDetail {
  return {
    code: error.code,
    message: error.message,
    details: error.details,
    suggestion: error.suggestion ?? getDefaultSuggestion(error.statusCode),
  };
}

export const DEFAULT_API_ERROR_DETAIL_EXAMPLE = createStatusErrorDetail(500, 'Internal server error', {
  details: 'Additional context when available',
});

export const DEFAULT_STRUCTURED_API_ERROR_RESPONSE_EXAMPLE = createErrorResponseFromDetail(
  DEFAULT_API_ERROR_DETAIL_EXAMPLE,
  {
    timestamp: 1700000000000,
    requestId: 'req-example',
  },
);

export function createStatusApiError(
  statusCode: number,
  message: string,
  options: Omit<StatusErrorResponseOptions, 'requestId'> = {},
): ApiError {
  return new ApiError(
    statusCode,
    options.code ?? getDefaultErrorCode(statusCode),
    message,
    options.details,
    options.suggestion ?? getDefaultSuggestion(statusCode),
  );
}

export function resolveRequestId(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }

  return undefined;
}

export function createErrorDetail(
  error: unknown,
  fallbackStatusCode?: number,
  options: ErrorDetailOptions = {},
): ApiErrorDetail {
  if (error instanceof ApiError) {
    return createApiErrorDetail(error);
  }

  const structuredDetail = getStructuredErrorDetail(error);
  if (structuredDetail) {
    return {
      code: options.code ?? structuredDetail.code,
      message: structuredDetail.message,
      details: options.details ?? structuredDetail.details,
      suggestion: options.suggestion ?? structuredDetail.suggestion,
    };
  }

  if (error instanceof SyntaxError && 'body' in error) {
    return {
      code: 'INVALID_JSON',
      message: 'Invalid JSON in request body',
      details: error.message,
      suggestion: 'Ensure request body contains valid JSON',
    };
  }

  const statusCode = getErrorStatus(error) ?? fallbackStatusCode ?? 500;
  return {
    code: options.code ?? getErrorCode(error) ?? getDefaultErrorCode(statusCode),
    message: resolveErrorMessage(error) ?? options.fallbackMessage ?? 'An unknown error occurred',
    details: options.details ?? getErrorDetails(error) ?? (process.env.NODE_ENV === 'development' ? getErrorStack(error) : undefined),
    suggestion: options.suggestion ?? getErrorSuggestion(error, statusCode),
  };
}

function createErrorContext(error: unknown, options: ErrorContextOptions = {}) {
  const statusCode = getErrorStatus(error) ?? options.fallbackStatusCode ?? 500;
  const detail = createErrorDetail(error, statusCode, {
    fallbackMessage: options.fallbackMessage,
    code: options.code,
    details: options.details,
    suggestion: options.suggestion,
  });
  const requestId = resolveRequestId(options.requestId)
    ?? getRequestIdField(error);
  const stackSource = options.stackSource ?? error;

  return {
    statusCode,
    detail,
    requestId,
    stack: process.env.NODE_ENV === 'development' ? getErrorStack(stackSource) : undefined,
  };
}

export function createErrorLogPayload(
  error: unknown,
  options: string | ErrorContextOptions = {},
) {
  const context = createErrorContext(
    error,
    typeof options === 'string' ? { requestId: options } : options,
  );

  return {
    timestamp: new Date().toISOString(),
    requestId: context.requestId,
    statusCode: context.statusCode,
    code: context.detail.code,
    message: context.detail.message,
    details: context.detail.details,
    suggestion: context.detail.suggestion,
    stack: context.stack,
  };
}

export function createWebSocketErrorPayload(
  error: unknown,
  options: {
    code?: WebSocketErrorCode;
    errorMessage?: string;
    requestType?: string;
  } = {},
): ErrorPayload {
  const detail = createErrorDetail(error);
  const code = options.code ?? (isWebSocketErrorCode(detail.code) ? detail.code : undefined);
  const payloadMessage =
    options.errorMessage
    ?? getStringField(error, 'error')
    ?? detail.message;
  const payloadDetails =
    detail.details
    ?? (error instanceof ApiError ? undefined : error instanceof Error ? error.stack : undefined);

  return {
    error: payloadMessage,
    ...(code ? { code } : {}),
    ...(payloadDetails ? { details: payloadDetails } : {}),
    ...(options.requestType ? { requestType: options.requestType } : {}),
  };
}

export function createErrorResponse(
  error: unknown,
  requestId?: string,
): StructuredApiErrorResponse {
  const context = createErrorContext(error, { requestId });
  return createErrorResponseFromDetail(context.detail, { requestId: context.requestId });
}

export function createErrorResponseFromDetail(
  detail: ApiErrorDetail,
  options: ErrorResponseOptions = {},
): StructuredApiErrorResponse {
  return {
    success: false,
    error: detail,
    timestamp: options.timestamp ?? Date.now(),
    requestId: resolveRequestId(options.requestId),
  };
}

export function createStatusErrorDetail(
  statusCode: number,
  message: string,
  options: Omit<StatusErrorResponseOptions, 'requestId'> = {},
): ApiErrorDetail {
  return createApiErrorDetail(createStatusApiError(statusCode, message, options));
}

export function createStatusErrorResponse(
  statusCode: number,
  message: string,
  options: StatusErrorResponseOptions = {},
): StructuredApiErrorResponse {
  return createErrorResponseFromDetail(
    createStatusErrorDetail(statusCode, message, options),
    { requestId: options.requestId },
  );
}

export function createWebSocketStatusErrorPayload(
  statusCode: number,
  message: string,
  options: WebSocketStatusErrorOptions,
): ErrorPayload {
  return createWebSocketErrorPayload(
    createStatusApiError(statusCode, message, {
      code: options.code,
      details: options.details,
      suggestion: options.suggestion,
    }),
    {
      code: options.code,
      errorMessage: options.errorMessage,
      requestType: options.requestType,
    },
  );
}

export function createWebSocketStatusErrorPayloadFromError(
  error: unknown,
  statusCode: number,
  message: string,
  options: Omit<WebSocketStatusErrorOptions, 'details'>,
): ErrorPayload {
  const detail = createErrorDetail(error, statusCode, { fallbackMessage: message });
  return createWebSocketStatusErrorPayload(statusCode, message, {
    ...options,
    details: detail.details ?? (detail.message !== message ? detail.message : undefined),
  });
}
