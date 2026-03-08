import { ErrorHandler, RecoveryStrategy } from '../../errors';
import type { LoggerService } from '../logger.service';

type LogLevel = 'info' | 'warn' | 'error';

export function safeLogWithRecovery(params: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
}): void {
  const { logger, errorHandler, level, message, metadata } = params;

  try {
    if (logger) {
      logger[level](message, metadata);
    }
  } catch (error) {
    // Logging failures should not crash the service.
    if (errorHandler) {
      errorHandler.handle(error as Error, {
        strategy: RecoveryStrategy.SKIP,
      });
    }
  }
}
