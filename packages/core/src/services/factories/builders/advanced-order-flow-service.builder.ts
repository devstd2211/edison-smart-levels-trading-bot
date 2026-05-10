import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { AdvancedOrderFlowService } from '../../advanced-order-flow.service';
import { ICONS } from '../../../cli/cli-runtime';

export const initializeAdvancedOrderFlowService = (
  state: BotServiceState,
  config: Config,
): void => {
  if (!config.advancedOrderFlow?.enabled) {
    return;
  }

  state.advancedOrderFlowService = new AdvancedOrderFlowService(
    config.advancedOrderFlow,
    config.orderFlowAnalysis,
    state.logger,
    state.errorHandler,
  );
  state.logger.info(`${ICONS.success} Advanced Order Flow Service initialized (Phase 10.1)`, {
    tickWindowMs: config.advancedOrderFlow.tickWindowMs,
    enableSpoofing: config.advancedOrderFlow.enableSpoofingDetection,
    enableMomentum: config.advancedOrderFlow.enableMomentum,
  });
};
