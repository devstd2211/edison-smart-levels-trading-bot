import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { DynamicPositionSizerService } from '../../dynamic-position-sizer.service';
import { createDynamicPositionSizingConfig } from './dynamic-position-sizing-config.builder';
import { ICONS } from '../../../cli/cli-runtime';

export const initializeDynamicPositionSizerService = (
  state: BotServiceState,
  config: Config,
): void => {
  const dynamicPositionSizing = createDynamicPositionSizingConfig(config);
  if (!dynamicPositionSizing?.enabled) {
    return;
  }

  state.dynamicPositionSizer = new DynamicPositionSizerService(
    dynamicPositionSizing,
    state.logger,
    state.errorHandler,
  );
  state.logger.info(`${ICONS.success} Dynamic Position Sizer initialized (Phase 11.1)`, {
    baseRiskPercent: dynamicPositionSizing.baseRiskPercent,
    maxRiskPercent: dynamicPositionSizing.maxRiskPercent,
    volatilityMultiplier: dynamicPositionSizing.volatilityMultiplier,
  });
};
