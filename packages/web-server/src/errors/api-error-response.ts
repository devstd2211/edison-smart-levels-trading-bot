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

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }
  if (isRecord(error) && typeof error.error === 'string') {
    return error.error;
  }
  return 'An unknown error occurred';
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

function createApiErrorDetail(error: ApiError): ApiErrorDetail {
  return {
    code: error.code,
    message: error.message,
    details: error.details,
    suggestion: error.suggestion ?? getDefaultSuggestion(error.statusCode),
  };
}

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

export function createErrorDetail(error: unknown, fallbackStatusCode?: number): ApiErrorDetail {
  if (error instanceof ApiError) {
    return createApiErrorDetail(error);
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
    code: getErrorCode(error) ?? getDefaultErrorCode(statusCode),
    message: getErrorMessage(error),
    details: getErrorDetails(error) ?? (process.env.NODE_ENV === 'development' ? getErrorStack(error) : undefined),
    suggestion: getErrorSuggestion(error, statusCode),
  };
}

export function createErrorLogPayload(error: unknown, requestId?: string) {
  const statusCode = getErrorStatus(error) ?? 500;
  const detail = createErrorDetail(error, statusCode);

  return {
    timestamp: new Date().toISOString(),
    requestId,
    statusCode,
    code: detail.code,
    message: detail.message,
    stack: process.env.NODE_ENV === 'development' ? getErrorStack(error) : undefined,
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
    ?? (error instanceof Error ? error.stack : undefined);

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
  const timestamp = Date.now();
  return {
    success: false,
    error: createErrorDetail(error),
    timestamp,
    requestId,
  };
}

function createStatusErrorDetail(
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
  return {
    success: false,
    error: createStatusErrorDetail(statusCode, message, options),
    timestamp: Date.now(),
    requestId: resolveRequestId(options.requestId),
  };
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
  const detail = createErrorDetail(error, statusCode);
  return createWebSocketStatusErrorPayload(statusCode, message, {
    ...options,
    details: detail.details ?? detail.message,
  });
}
