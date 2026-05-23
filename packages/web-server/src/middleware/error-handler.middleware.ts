import { Request, Response, NextFunction } from 'express';
import {
  ApiError,
  createErrorLogPayload,
  createErrorResponse,
  getErrorStatus,
  resolveRequestId,
} from '../errors/api-error-response.js';

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

    // Log error
    console.error('[ERROR]', createErrorLogPayload(err, requestId));

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
  notFound: (resource: string) =>
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
