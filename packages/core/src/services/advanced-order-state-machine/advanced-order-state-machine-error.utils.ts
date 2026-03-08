import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';

interface HandleSkippableErrorParams {
  error: unknown;
  errorHandler?: ErrorHandler;
  context: string;
  logMessage: string;
  safeLog: (message: string) => void;
}

export function handleSkippableError({
  error,
  errorHandler,
  context,
  logMessage,
  safeLog,
}: HandleSkippableErrorParams): void {
  safeLog(logMessage);
  if (errorHandler) {
    errorHandler.handle(error, {
      strategy: RecoveryStrategy.SKIP,
      context,
    });
  }
}
