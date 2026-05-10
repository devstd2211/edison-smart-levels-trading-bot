import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { WallTrackerService } from '../../wall-tracker.service';
import { ICONS } from '../../../cli/cli-runtime';

export const initializeWallTrackerService = (
  state: BotServiceState,
  config: Config,
): void => {
  if (!config.wallTracking?.enabled) {
    return;
  }

  state.wallTrackerService = new WallTrackerService(
    config.wallTracking,
    state.logger,
    state.errorHandler,
  );
  state.logger.info(`${ICONS.success} Wall Tracker initialized (PHASE 4)`, {
    minLifetime: `${config.wallTracking.minLifetimeMs}ms`,
    spoofingThreshold: `${config.wallTracking.spoofingThresholdMs}ms`,
    trackHistory: config.wallTracking.trackHistoryCount,
  });
};
