import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { PositionScalingService } from '../../position-scaling.service';
import { createPositionScalingConfig } from './position-scaling-config.builder';

export const initializePositionScalingService = (
  state: BotServiceState,
  config: Config,
): void => {
  const positionScaling = createPositionScalingConfig(config);
  if (!positionScaling?.enabled) {
    return;
  }

  state.positionScalingService = new PositionScalingService(
    positionScaling,
    state.logger,
    state.errorHandler,
  );
  state.logger.info('\u2705 Position Scaling Service initialized (Phase 11.2)', {
    scaleInThreshold: positionScaling.scaleInThreshold,
    maxScales: positionScaling.maxScales,
    scaleReduction: positionScaling.scaleReduction,
  });
};
