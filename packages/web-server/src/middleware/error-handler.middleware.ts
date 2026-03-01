/**
 * Error Handler Middleware
 *
 * Standardizes all error responses with:
 * - Consistent error format
 * - Detailed error messages
 * - Error context and suggestions
 * - Proper HTTP status codes
 */

import { Request, Response, NextFunction } from 'express';

export interface StandardizedError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string;
    suggestion?: string;
  };
  timestamp: number;
  requestId?: string;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    message: string = 'Internal server error',
    public details?: string,
    public suggestion?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }
  return 'An unknown error occurred';
}

function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  if (isRecord(error) && typeof error.stack === 'string') {
    return error.stack;
  }
  return undefined;
}

function getErrorCode(error: unknown): string | undefined {
  if (isRecord(error) && typeof error.code === 'string') {
    return error.code;
  }
  return undefined;
}

function getErrorStatus(error: unknown): number | undefined {
  if (isRecord(error) && typeof error.statusCode === 'number') {
    return error.statusCode;
  }
  return undefined;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: unknown,
  requestId?: string
): StandardizedError {
  const timestamp = Date.now();

  if (error instanceof ApiError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        suggestion: error.suggestion,
      },
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

  return {
    success: false,
    error: {
      code: 'UNKNOWN_ERROR',
      message: getErrorMessage(error),
      details: process.env.NODE_ENV === 'development' ? getErrorStack(error) : undefined,
      suggestion: 'Please try again or contact support',
    },
    timestamp,
    requestId,
  };
}

/**
 * Global error handler middleware
 * Should be registered LAST in middleware chain
 */
export function createErrorHandlerMiddleware() {
  return (
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    const requestId = _req.headers['x-request-id'] as string | undefined;

    // Log error
    console.error('[ERROR]', {
      timestamp: new Date().toISOString(),
      requestId,
      statusCode: getErrorStatus(err) || 500,
      code: getErrorCode(err) || 'UNKNOWN_ERROR',
      message: getErrorMessage(err),
      stack: process.env.NODE_ENV === 'development' ? getErrorStack(err) : undefined,
    });

    // Determine status code
    const statusCode = getErrorStatus(err) || 500;

    // Create response
    const errorResponse = createErrorResponse(err, requestId);

    // Send response
    res.status(statusCode).json(errorResponse);
  };
}

/**
 * Common API errors
 */
export const ApiErrors = {
  notFound: (resource: string, requestId?: string) =>
    new ApiError(
      404,
      'NOT_FOUND',
      `${resource} not found`,
      undefined,
      `Check that the ${resource} ID is correct and exists`
    ),

  badRequest: (message: string, suggestion?: string) =>
    new ApiError(
      400,
      'BAD_REQUEST',
      message,
      undefined,
      suggestion || 'Check your request parameters'
    ),

  unauthorized: () =>
    new ApiError(
      401,
      'UNAUTHORIZED',
      'Authentication required',
      undefined,
      'Provide valid authentication credentials'
    ),

  forbidden: () =>
    new ApiError(
      403,
      'FORBIDDEN',
      'Access denied',
      undefined,
      'You do not have permission to access this resource'
    ),

  conflict: (message: string) =>
    new ApiError(
      409,
      'CONFLICT',
      message,
      undefined,
      'Resolve the conflict and try again'
    ),

  unprocessableEntity: (message: string, details?: string) =>
    new ApiError(
      422,
      'UNPROCESSABLE_ENTITY',
      message,
      details,
      'Verify the request body and try again'
    ),

  internalError: (message: string = 'Internal server error', details?: string) =>
    new ApiError(
      500,
      'INTERNAL_ERROR',
      message,
      details,
      'Please try again or contact support'
    ),

  serviceUnavailable: () =>
    new ApiError(
      503,
      'SERVICE_UNAVAILABLE',
      'Service temporarily unavailable',
      undefined,
      'Please try again in a few moments'
    ),
};
