import type { Response } from 'express';
import {
  createRouteErrorResponse,
  createStatusErrorResponse,
  getDefaultErrorCode,
  getErrorStatus,
  resolveRequestId,
} from '../errors/api-error-response.js';

type ApiJsonResponse = Response;
export type SuccessResponseEnvelope<T> = {
  success: true;
  data: T;
  timestamp: number;
  requestId?: string;
};
type RouteResponseContext = {
  requestId: unknown;
  res: ApiJsonResponse;
};
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

function getResponseRequestId(res: ApiJsonResponse): unknown {
  return res.req?.headers['x-request-id'];
}

export function createRouteResponseContext(res: ApiJsonResponse): RouteResponseContext {
  return {
    requestId: getResponseRequestId(res),
    res,
  };
}

export function createSuccessResponseEnvelope<T>(data: T, requestId?: unknown): SuccessResponseEnvelope<T> {
  const normalizedRequestId = resolveRequestId(requestId);

  return {
    success: true,
    data,
    timestamp: Date.now(),
    ...(normalizedRequestId ? { requestId: normalizedRequestId } : {}),
  };
}

export function sendSuccess<T>(res: ApiJsonResponse, data: T, status: number = 200): void {
  const context = createRouteResponseContext(res);
  context.res.status(status).json(createSuccessResponseEnvelope(data, context.requestId));
}

export function sendError<T>(
  res: ApiJsonResponse,
  status: number,
  error: string,
  options: { code?: string; details?: string; suggestion?: string; extra?: Record<string, unknown> } = {},
): void {
  const context = createRouteResponseContext(res);
  const response = createStatusErrorResponse(status, error, {
    code: options.code ?? getDefaultErrorCode(status),
    details: options.details,
    suggestion: options.suggestion,
    requestId: context.requestId,
  });

  context.res.status(status).json(options.extra ? { ...response, ...options.extra } : response);
}

export function handleRouteError<T>(
  res: ApiJsonResponse,
  error: unknown,
  fallbackMessage: string = 'Unknown error',
  status: number = 500,
  options: Omit<RouteErrorOptions, 'fallbackMessage' | 'status'> = {},
): void {
  const statusCode = getErrorStatus(error) ?? status;
  const context = createRouteResponseContext(res);

  context.res.status(statusCode).json(createRouteErrorResponse(error, {
    requestId: context.requestId,
    fallbackStatusCode: statusCode,
    fallbackMessage,
    code: options.code,
    suggestion: options.suggestion,
  }));
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
  const context = createRouteResponseContext(res);

  try {
    const result = await execute();
    sendSuccess(
      context.res,
      result,
      'successStatus' in options ? options.successStatus : undefined,
    );
  } catch (error) {
    handleRouteExecutionError(context.res, error, options);
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
