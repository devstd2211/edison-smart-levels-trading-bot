import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { TelegramService, TimeService } from '../../index';

export const initializeRuntimeCoreServices = (
  state: BotServicesState,
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
