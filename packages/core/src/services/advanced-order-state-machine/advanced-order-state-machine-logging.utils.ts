import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { LoggerService } from '../logger.service';

type LogLevel = 'info' | 'warn' | 'error';

interface SafeLogParams {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  message: string;
  level?: LogLevel;
  context: Record<string, unknown>;
  errorContext: string;
}

export function safeLogWithRecovery({
  logger,
  errorHandler,
  message,
  level = 'info',
  context,
  errorContext,
}: SafeLogParams): void {
  if (!logger) {
    return;
  }

  try {
    if (level === 'warn') {
      logger.warn(message, context);
    } else if (level === 'error') {
      logger.error(message, context);
    } else {
      logger.info(message, context);
    }
  } catch (error) {
    if (errorHandler) {
      errorHandler.handle(error, {
        strategy: RecoveryStrategy.SKIP,
        context: errorContext,
      });
    }
  }
}
