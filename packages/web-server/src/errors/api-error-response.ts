import type { ApiErrorDetail, StructuredApiErrorResponse } from '@edison/contracts/runtime-api';

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

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

function getDefaultSuggestion(statusCode: number): string {
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
    suggestion: error.suggestion,
  };
}

export function createErrorResponse(
  error: unknown,
  requestId?: string,
): StructuredApiErrorResponse {
  const timestamp = Date.now();

  if (error instanceof ApiError) {
    return {
      success: false,
      error: createApiErrorDetail(error),
      timestamp,
      requestId,
    };
  }

  if (error instanceof SyntaxError && 'body' in error) {
    return {
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON in request body',
        details: error.message,
        suggestion: 'Ensure request body contains valid JSON',
      },
      timestamp,
      requestId,
    };
  }

  const statusCode = getErrorStatus(error) ?? 500;
  return {
    success: false,
    error: {
      code: getErrorCode(error) ?? getDefaultErrorCode(statusCode),
      message: getErrorMessage(error),
      details: getErrorDetails(error) ?? (process.env.NODE_ENV === 'development' ? getErrorStack(error) : undefined),
      suggestion: getErrorSuggestion(error, statusCode),
    },
    timestamp,
    requestId,
  };
}
