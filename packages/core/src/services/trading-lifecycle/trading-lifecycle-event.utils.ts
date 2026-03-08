import { BotEventBus } from '../event-bus';
import { ErrorHandler, RecoveryStrategy } from '../../errors';
import { LiveTradingEventType } from '../../types/legacy';

interface PublishWithRetryParams {
  eventBus: BotEventBus;
  errorHandler?: ErrorHandler;
  type: LiveTradingEventType;
  data: unknown;
  timestamp: number;
  context: string;
  onFailure: (error: unknown) => void;
}

export async function publishEventWithRetryOrWarn({
  eventBus,
  errorHandler,
  type,
  data,
  timestamp,
  context,
  onFailure,
}: PublishWithRetryParams): Promise<void> {
  if (!errorHandler) {
    eventBus.publishSync({ type, data, timestamp });
    return;
  }

  try {
    await errorHandler.executeAsync(
      async () => {
        eventBus.publishSync({ type, data, timestamp });
      },
      {
        strategy: RecoveryStrategy.RETRY,
        context,
        retryConfig: {
          maxAttempts: 2,
          initialDelayMs: 100,
          backoffMultiplier: 2,
          maxDelayMs: 400,
        },
      }
    );
  } catch (error) {
    onFailure(error);
  }
}
