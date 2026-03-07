import { ErrorHandler, RecoveryStrategy } from '../../errors';

type LogLevel = 'info' | 'warn' | 'error';

export async function executeWithGracefulDegrade<T>(params: {
  errorHandler?: ErrorHandler;
  operation: () => Promise<T>;
  safeLog: (level: LogLevel, message: string, metadata?: Record<string, unknown>) => void;
  options: {
    failureLogLevel?: LogLevel;
    directFailureLogLevel?: LogLevel;
    requireValue?: boolean;
    resolveSuccess?: (value: T | undefined) => T;
    failureLogMessage: string;
    directFailureLogMessage: string;
    onFailure: (error: unknown) => T | Promise<T>;
    failureMetadata?: (error: unknown) => Record<string, unknown>;
  };
}): Promise<T> {
  const { errorHandler, operation, safeLog, options } = params;

  if (errorHandler) {
    const result = await errorHandler.executeAsync(operation, {
      strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
    });

    if (result.success && (!options.requireValue || Boolean(result.value))) {
      return options.resolveSuccess
        ? options.resolveSuccess(result.value as T | undefined)
        : (result.value as T);
    }

    safeLog(
      options.failureLogLevel ?? 'warn',
      options.failureLogMessage,
      options.failureMetadata?.(result.error)
    );
    return options.onFailure(result.error);
  }

  try {
    return await operation();
  } catch (error) {
    safeLog(
      options.directFailureLogLevel ?? 'warn',
      options.directFailureLogMessage,
      options.failureMetadata?.(error)
    );
    return options.onFailure(error);
  }
}

export function executeSyncWithGracefulDegrade<T>(params: {
  errorHandler?: ErrorHandler;
  operation: () => T;
  safeLog: (level: LogLevel, message: string, metadata?: Record<string, unknown>) => void;
  options: {
    failureLogMessage: string;
    onFailure: (error: unknown) => T;
    failureMetadata?: (error: unknown) => Record<string, unknown>;
  };
}): T {
  const { errorHandler, operation, safeLog, options } = params;
  try {
    return operation();
  } catch (error) {
    if (errorHandler) {
      errorHandler.handle(error as Error, {
        strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
      });
    }

    safeLog('warn', options.failureLogMessage, options.failureMetadata?.(error));
    return options.onFailure(error);
  }
}
