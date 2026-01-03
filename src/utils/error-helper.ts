/**
 * Error Helper Utilities
 *
 * Standardized error handling patterns for unknown error types.
 * Replaces repeated boilerplate code across services.
 */

import { ErrorContext } from '../types';

/**
 * Extract error message from unknown error type
 * Handles Error objects, strings, and other types safely
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    if (typeof err.message === 'string') {
      return err.message;
    }
  }

  return String(error);
}

/**
 * Extract error stack trace if available
 */
export function extractErrorStack(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }

  return undefined;
}

/**
 * Create standardized error context for logging
 */
export function createErrorContext(
  error: unknown,
  context?: Record<string, unknown>,
): ErrorContext {
  return {
    message: extractErrorMessage(error),
    timestamp: Date.now(),
    context,
  };
}

/**
 * Extract error code/name if available
 */
export function extractErrorCode(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.name;
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    if (typeof err.code === 'string') {
      return err.code;
    }
    if (typeof err.name === 'string') {
      return err.name;
    }
  }

  return undefined;
}

/**
 * Type guard: check if value is Error instance
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard: check if value is ErrorContext
 */
export function isErrorContext(value: unknown): value is ErrorContext {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const ctx = value as Record<string, unknown>;
  return (
    typeof ctx.message === 'string' &&
    typeof ctx.timestamp === 'number'
  );
}
