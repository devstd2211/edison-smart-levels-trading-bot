import { ErrorHandler, RecoveryStrategy } from '../../errors';
import { LoggerService, Position } from '../../types/legacy';
import { TelegramService } from '../telegram.service';
import { buildTelegramNotificationSkippedLogMessage } from './position-lifecycle-open.utils';

type NotifyPositionOpenedParams = {
  position: Position;
  telegram: TelegramService;
  logger: LoggerService;
};

export async function notifyPositionOpenedWithResilienceOrchestrated(
  params: NotifyPositionOpenedParams,
): Promise<void> {
  const { position, telegram, logger } = params;
  await ErrorHandler.executeAsync(
    () => telegram.notifyPositionOpened(position),
    {
      strategy: RecoveryStrategy.SKIP,
      logger,
      context: 'PositionLifecycleService.notifyPositionOpened',
      onRecover: () => {
        const message = buildTelegramNotificationSkippedLogMessage();
        logger.info(message);
      },
    }
  );
}
