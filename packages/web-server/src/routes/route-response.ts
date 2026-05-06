import type { Response } from 'express';
import { ApiError, createErrorResponse, getDefaultErrorCode } from '../errors/api-error-response.js';

type ApiJsonResponse = Response;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function parseInteger(
  rawValue: unknown,
  fallback: number,
  options: { min?: number; max?: number } = {},
): number {
  const value = typeof rawValue === 'string' ? Number.parseInt(rawValue, 10) : Number.NaN;
  if (!Number.isFinite(value)) {
    return fallback;
  }

  const boundedMin = options.min !== undefined ? Math.max(options.min, value) : value;
  return options.max !== undefined ? Math.min(options.max, boundedMin) : boundedMin;
}

export function sendSuccess<T>(res: ApiJsonResponse, data: T, status: number = 200): void {
  res.status(status).json({
    success: true,
    data,
    timestamp: Date.now(),
  });
}

export function sendError<T>(
  res: ApiJsonResponse,
  status: number,
  error: string,
  options: { code?: string; details?: string; suggestion?: string; extra?: Record<string, unknown> } = {},
): void {
  const response = createErrorResponse(
    new ApiError(
      status,
      options.code ?? getDefaultErrorCode(status),
      error,
      options.details,
      options.suggestion,
    ),
  );

  res.status(status).json(options.extra ? { ...response, ...options.extra } : response);
}

export function handleRouteError<T>(
  res: ApiJsonResponse,
  error: unknown,
  fallbackMessage: string = 'Unknown error',
  status: number = 500,
  options: { code?: string; suggestion?: string } = {},
): void {
  sendError(
    res,
    status,
    getErrorMessage(error, fallbackMessage),
    {
      code: options.code,
      suggestion: options.suggestion,
    },
  );
}

export function parseLimitQuery(rawValue: unknown, fallback: number, max: number): number {
  return parseInteger(rawValue, fallback, { min: 1, max });
}

export function parsePageQuery(rawValue: unknown, fallback: number = 1): number {
  return parseInteger(rawValue, fallback, { min: 1 });
}

export function requireNonEmptyParam<T>(
  res: ApiJsonResponse,
  value: string | undefined,
  fieldName: string,
): value is string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return true;
  }

  sendError(res, 400, `${fieldName} is required`, {
    code: 'BAD_REQUEST',
    suggestion: `Provide a non-empty ${fieldName} value`,
  });
  return false;
}
