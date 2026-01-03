/**
 * Error Handling Utilities
 *
 * Standardized error handling for catch blocks and error logging.
 * Converts unknown error types to proper Error objects with type safety.
 */

/**
 * Extract error message from unknown error object
 * @param error - Unknown error type
 * @returns Error message as string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error === null || error === undefined) {
    return 'Unknown error (null/undefined)';
  }
  // For objects, try to get message property or stringify
  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;
    if (typeof err.message === 'string') {
      return err.message;
    }
    return JSON.stringify(error);
  }
  return String(error);
}

/**
 * Extract stack trace from unknown error object
 * @param error - Unknown error type
 * @returns Stack trace as string or undefined
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    if (typeof err.stack === 'string') {
      return err.stack;
    }
  }
  return undefined;
}

/**
 * Convert unknown error to standard Error object
 * @param error - Unknown error type
 * @returns Standard Error object
 */
export function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(getErrorMessage(error));
}

/**
 * Create standardized error log object for LoggerService
 * @param error - Unknown error type
 * @returns Object suitable for logger.error()
 */
export function createErrorLogObject(error: unknown): {
  error: unknown;
  errorMessage: string;
  stack?: string;
  errorType?: string;
} {
  const message = getErrorMessage(error);
  const stack = getErrorStack(error);

  let errorType: string | undefined;
  if (error instanceof Error) {
    errorType = error.constructor.name;
  } else if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    if (typeof err.code === 'string') {
      errorType = `Error(${err.code})`;
    } else {
      errorType = (error as Record<string, unknown>).constructor?.name as string;
    }
  }

  return {
    error,
    errorMessage: message,
    stack,
    errorType,
  };
}
