import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { DynamicPositionSizerService } from '../../dynamic-position-sizer.service';
import { createDynamicPositionSizingConfig } from './dynamic-position-sizing-config.builder';

export const initializeDynamicPositionSizerService = (
  state: BotServicesState,
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
  state.logger.info('\u2705 Dynamic Position Sizer initialized (Phase 11.1)', {
    baseRiskPercent: dynamicPositionSizing.baseRiskPercent,
    maxRiskPercent: dynamicPositionSizing.maxRiskPercent,
    volatilityMultiplier: dynamicPositionSizing.volatilityMultiplier,
  });
};
