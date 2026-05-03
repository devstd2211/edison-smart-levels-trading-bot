import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { WallTrackerService } from '../../wall-tracker.service';

export const initializeWallTrackerService = (
  state: BotServicesState,
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
  state.logger.info('\u2705 Wall Tracker initialized (PHASE 4)', {
    minLifetime: `${config.wallTracking.minLifetimeMs}ms`,
    spoofingThreshold: `${config.wallTracking.spoofingThresholdMs}ms`,
    trackHistory: config.wallTracking.trackHistoryCount,
  });
};
