import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { TelegramService, TimeService } from '../../index';

export const initializeRuntimeCoreServices = (
  state: BotServiceState,
  config: Config,
): void => {
  state.telegram = new TelegramService(
    config.telegram || { enabled: false },
    state.logger,
    state.errorHandler,
  );

  state.timeService = new TimeService(
    state.logger,
    config.system.timeSyncIntervalMs,
    config.system.timeSyncMaxFailures,
  );
};
