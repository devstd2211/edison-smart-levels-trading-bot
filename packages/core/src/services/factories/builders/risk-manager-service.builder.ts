import type { BotServiceState } from '../../bot-services.builder';
import { RiskManager } from '../../risk-manager.service';
import { createRiskManagerConfig } from './risk-manager-config.builder';

export const initializeRiskManager = (state: BotServiceState): void => {
  state.riskManager = new RiskManager(createRiskManagerConfig(), state.logger, state.errorHandler);
};
