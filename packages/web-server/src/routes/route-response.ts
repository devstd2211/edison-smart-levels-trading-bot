import type { Response } from 'express';
import {
  createStatusErrorResponse,
  getDefaultErrorCode,
  getErrorCode,
  getErrorDetails,
  getErrorMessage,
  getErrorStatus,
  getErrorSuggestion,
} from '../errors/api-error-response.js';

type ApiJsonResponse = Response;
type RouteErrorOptions = {
  fallbackMessage?: string;
  status?: number;
  code?: string;
  suggestion?: string;
};
type RouteMutationOptions = RouteErrorOptions & { successStatus?: number };

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
  const response = createStatusErrorResponse(status, error, {
    code: options.code ?? getDefaultErrorCode(status),
    details: options.details,
    suggestion: options.suggestion,
  });

  res.status(status).json(options.extra ? { ...response, ...options.extra } : response);
}

export function handleRouteError<T>(
  res: ApiJsonResponse,
  error: unknown,
  fallbackMessage: string = 'Unknown error',
  status: number = 500,
  options: Omit<RouteErrorOptions, 'fallbackMessage' | 'status'> = {},
): void {
  const statusCode = getErrorStatus(error) ?? status;
  sendError(
    res,
    statusCode,
    getErrorMessage(error) ?? fallbackMessage,
    {
      code: options.code ?? getErrorCode(error),
      details: getErrorDetails(error),
      suggestion: options.suggestion ?? getErrorSuggestion(error, statusCode),
    },
  );
}

function handleRouteExecutionError(
  res: ApiJsonResponse,
  error: unknown,
  options: RouteErrorOptions | RouteMutationOptions = {},
): void {
  handleRouteError(
    res,
    error,
    options.fallbackMessage,
    options.status,
    {
      code: options.code,
      suggestion: options.suggestion,
    },
  );
}

async function runRouteHandler<T>(
  res: ApiJsonResponse,
  execute: () => T | Promise<T>,
  options: RouteErrorOptions | RouteMutationOptions = {},
): Promise<void> {
  try {
    const result = await execute();
    sendSuccess(
      res,
      result,
      'successStatus' in options ? options.successStatus : undefined,
    );
  } catch (error) {
    handleRouteExecutionError(res, error, options);
  }
}

export function sendRouteRead<T>(
  res: ApiJsonResponse,
  read: () => T,
  options: RouteErrorOptions = {},
): void {
  void runRouteHandler(res, read, options);
}

export async function sendAsyncRouteRead<T>(
  res: ApiJsonResponse,
  read: () => Promise<T>,
  options: RouteErrorOptions = {},
): Promise<void> {
  await runRouteHandler(res, read, options);
}

export function sendRouteMutation<T>(
  res: ApiJsonResponse,
  write: () => T,
  options: RouteMutationOptions = {},
): void {
  void runRouteHandler(res, write, options);
}

export async function sendAsyncRouteMutation<T>(
  res: ApiJsonResponse,
  write: () => Promise<T>,
  options: RouteMutationOptions = {},
): Promise<void> {
  await runRouteHandler(res, write, options);
}

export function parseLimitQuery(rawValue: unknown, fallback: number, max: number): number {
  return parseInteger(rawValue, fallback, { min: 1, max });
}

export function parsePageQuery(rawValue: unknown, fallback: number = 1): number {
  return parseInteger(rawValue, fallback, { min: 1 });
}

export function requireNonEmptyParam<T>(
  res: ApiJsonResponse,
  value: string | null | undefined,
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
