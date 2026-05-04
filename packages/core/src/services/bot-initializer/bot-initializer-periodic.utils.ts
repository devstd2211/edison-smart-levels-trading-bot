import { INTEGER_MULTIPLIERS } from '../../constants';
import { TIME_MULTIPLIERS } from '../../constants/technical.constants';
import type { IBotInitializerServices } from '../../interfaces';
import { isCriticalApiError } from '../../utils/error-helper';
import { getErrorMessage } from '../../utils/error.utils';

export const BOT_INITIALIZER_PERIODIC_INTERVAL_MS =
  INTEGER_MULTIPLIERS.THIRTY * TIME_MULTIPLIERS.MILLISECONDS_PER_SECOND;

export type BotInitializerPeriodicCycleResult = {
  shouldStop: boolean;
};

export async function runBotInitializerPeriodicCycle(
  services: IBotInitializerServices,
): Promise<BotInitializerPeriodicCycleResult> {
  const logger = services.coreServices.logger;

  try {
    if (services.marketDataServices.bybitService.resyncTime) {
      await services.marketDataServices.bybitService.resyncTime();
    }

    const currentPosition = services.executionServices.positionManager.getCurrentPosition();
    const isOpeningPosition = services.executionServices.positionManager.isPositionOpening();

    if (!currentPosition && !isOpeningPosition) {
      logger.debug('🧹 Periodic cleanup: checking for hanging conditional orders...');
      await services.marketDataServices.bybitService.cancelAllConditionalOrders();
    } else {
      if (currentPosition) {
        logger.debug('🧹 Periodic cleanup: skipping (active position exists)', {
          positionId: currentPosition.id,
        });
      }
      if (isOpeningPosition) {
        logger.debug('🧹 Periodic cleanup: skipping (position opening in progress)');
      }
    }

    return { shouldStop: false };
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    if (isCriticalApiError(error)) {
      logger.error('🚨 CRITICAL API ERROR in periodic tasks - emitting critical-error!', {
        error: errorMessage,
        isCritical: true,
      });

      services.coreServices.eventBus.emit('critical-error', error);
      return { shouldStop: true };
    }

    logger.error('Error in periodic tasks', {
      error: errorMessage,
    });
    return { shouldStop: false };
  }
}
