import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { TelegramService, TimeService } from '../../index';

type RuntimeCoreServicesState = Pick<
  BotServiceState,
  'logger' | 'errorHandler' | 'telegram' | 'timeService'
>;

export type RuntimeCoreConfig = {
  telegram: NonNullable<Config['telegram']> | { enabled: false };
  timeSyncIntervalMs: Config['system']['timeSyncIntervalMs'];
  timeSyncMaxFailures: Config['system']['timeSyncMaxFailures'];
};

export const createRuntimeCoreConfig = (
  config: Pick<Config, 'telegram' | 'system'>,
): RuntimeCoreConfig => ({
  telegram: config.telegram || { enabled: false },
  timeSyncIntervalMs: config.system.timeSyncIntervalMs,
  timeSyncMaxFailures: config.system.timeSyncMaxFailures,
});

export const initializeRuntimeCoreServices = (
  state: RuntimeCoreServicesState,
  config: Pick<Config, 'telegram' | 'system'>,
): void => {
  const runtimeCoreConfig = createRuntimeCoreConfig(config);

  state.telegram = new TelegramService(
    runtimeCoreConfig.telegram,
    state.logger,
    state.errorHandler,
  );

  state.timeService = new TimeService(
    state.logger,
    runtimeCoreConfig.timeSyncIntervalMs,
    runtimeCoreConfig.timeSyncMaxFailures,
  );
};
