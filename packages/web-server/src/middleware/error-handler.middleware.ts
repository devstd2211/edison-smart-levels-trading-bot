import { Request, Response, NextFunction } from 'express';
import {
  ApiError,
  createStatusApiError,
  createErrorResponse,
  getErrorStatus,
  resolveRequestId,
} from '../errors/api-error-response.js';
import { createErrorHandlerLogPayload as createSharedErrorHandlerLogPayload } from '../logging/request-scoped-error-log.js';

export function createErrorHandlerLogPayload(
  error: unknown,
  requestId?: unknown,
  fallbackStatusCode?: number,
): Record<string, unknown> {
  return createSharedErrorHandlerLogPayload(error, {
    requestId,
    fallbackStatusCode: getErrorStatus(error) || fallbackStatusCode || 500,
  });
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
    const requestId = resolveRequestId(_req.headers['x-request-id']);

    // Determine status code
    const statusCode = getErrorStatus(err) || 500;

    // Create response
    const errorResponse = createErrorResponse(err, requestId);

    // Log the same normalized detail and request id that the client receives
    console.error('[ERROR]', createErrorHandlerLogPayload(err, requestId, statusCode));
    res.status(statusCode).json(errorResponse);
  };
}

/**
 * Common API errors
 */
export const ApiErrors = {
  notFound: (resource: string) =>
    createStatusApiError(
      404,
      `${resource} not found`,
      {
        suggestion: `Check that the ${resource} ID is correct and exists`,
      },
    ),

  badRequest: (message: string, suggestion?: string) =>
    createStatusApiError(
      400,
      message,
      {
        suggestion,
      },
    ),

  unauthorized: () =>
    createStatusApiError(
      401,
      'Authentication required',
      {
        suggestion: 'Provide valid authentication credentials',
      },
    ),

  forbidden: () =>
    createStatusApiError(
      403,
      'Access denied',
      {
        suggestion: 'You do not have permission to access this resource',
      },
    ),

  conflict: (message: string) =>
    createStatusApiError(
      409,
      message,
      {
        suggestion: 'Resolve the conflict and try again',
      },
    ),

  unprocessableEntity: (message: string, details?: string) =>
    createStatusApiError(
      422,
      message,
      {
        details,
        suggestion: 'Verify the request body and try again',
      },
    ),

  internalError: (message: string = 'Internal server error', details?: string) =>
    createStatusApiError(
      500,
      message,
      {
        details,
      },
    ),

  serviceUnavailable: () =>
    createStatusApiError(
      503,
      'Service temporarily unavailable',
      {
        suggestion: 'Please try again in a few moments',
      },
    ),
};
