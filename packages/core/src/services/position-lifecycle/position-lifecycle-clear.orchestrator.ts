import { ErrorHandler, RecoveryStrategy } from '../../errors';
import { LoggerService } from '../../types/legacy';
import {
  buildConditionalOrderCancelFailureLogMessage,
  buildConditionalOrderCancelRetryLog,
  buildConditionalOrderCancelStartLogMessage,
} from './position-lifecycle-atomic.utils';

type CancelConditionalOrdersAfterCloseParams = {
  cancelAllConditionalOrders: () => Promise<void>;
  logger: LoggerService;
};

export async function cancelConditionalOrdersAfterCloseOrchestrated(
  params: CancelConditionalOrdersAfterCloseParams,
): Promise<void> {
  const { cancelAllConditionalOrders, logger } = params;

  const startMessage = buildConditionalOrderCancelStartLogMessage();
  logger.debug(startMessage);

  await ErrorHandler.executeAsync(
    () => cancelAllConditionalOrders(),
    {
      strategy: RecoveryStrategy.RETRY,
      retryConfig: {
        maxAttempts: 3,
        initialDelayMs: 200,
        backoffMultiplier: 2,
        maxDelayMs: 2000,
      },
      logger,
      context: 'PositionLifecycleService.cancelAllConditionalOrders',
      onRetry: (attempt, error, delayMs) => {
        const logShape = buildConditionalOrderCancelRetryLog(attempt, delayMs, error.message);
        logger.warn(logShape.message, logShape.payload);
      },
      onFailure: () => {
        const message = buildConditionalOrderCancelFailureLogMessage();
        logger.warn(message);
      },
    }
  );
}
