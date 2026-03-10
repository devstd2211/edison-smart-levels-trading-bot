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
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : null;
}

function getStringProperty(record: Record<string, unknown> | null, key: string): string | undefined {
  if (!record) {
    return undefined;
  }

  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

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
  const err = asRecord(error);
  const message = getStringProperty(err, 'message');
  if (message) {
    return message;
  }
  if (err) {
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
  return getStringProperty(asRecord(error), 'stack');
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
  } else {
    const err = asRecord(error);
    if (!err) {
      return {
        error,
        errorMessage: message,
        stack,
        errorType,
      };
    }

    if (typeof err.code === 'string') {
      errorType = `Error(${err.code})`;
    } else {
      const constructorName = err.constructor?.name;
      if (typeof constructorName === 'string') {
        errorType = constructorName;
      }
    }
  }

  return {
    error,
    errorMessage: message,
    stack,
    errorType,
  };
}
