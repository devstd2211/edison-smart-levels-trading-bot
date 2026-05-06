import type { Response } from 'express';
import type { ApiResponse } from '@edison/contracts';

type ApiJsonResponse<T> = Response<ApiResponse<T>>;

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

export function sendSuccess<T>(res: ApiJsonResponse<T>, data: T, status: number = 200): void {
  res.status(status).json({
    success: true,
    data,
    timestamp: Date.now(),
  });
}

export function sendError<T>(
  res: ApiJsonResponse<T>,
  status: number,
  error: string,
): void {
  res.status(status).json({
    success: false,
    error,
    timestamp: Date.now(),
  });
}

export function handleRouteError<T>(
  res: ApiJsonResponse<T>,
  error: unknown,
  fallbackMessage: string = 'Unknown error',
  status: number = 500,
): void {
  sendError(res, status, getErrorMessage(error, fallbackMessage));
}

export function parseLimitQuery(rawValue: unknown, fallback: number, max: number): number {
  return parseInteger(rawValue, fallback, { min: 1, max });
}

export function parsePageQuery(rawValue: unknown, fallback: number = 1): number {
  return parseInteger(rawValue, fallback, { min: 1 });
}

export function requireNonEmptyParam<T>(
  res: ApiJsonResponse<T>,
  value: string | undefined,
  fieldName: string,
): value is string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return true;
  }

  sendError(res, 400, `${fieldName} is required`);
  return false;
}
