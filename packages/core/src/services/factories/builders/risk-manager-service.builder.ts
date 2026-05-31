import type { BotServiceState } from '../../bot-services.builder';
import { RiskManager } from '../../risk-manager.service';
import { createRiskManagerConfig } from './risk-manager-config.builder';

type RiskManagerBuilderState = Pick<
  BotServiceState,
  'logger' | 'errorHandler' | 'riskManager'
>;

type RiskManagerDependencies = Pick<RiskManagerBuilderState, 'logger' | 'errorHandler'>;

export const createRiskManagerDependencies = (
  state: Pick<BotServiceState, 'logger' | 'errorHandler'>,
): RiskManagerDependencies => ({
  logger: state.logger,
  errorHandler: state.errorHandler,
});

export const initializeRiskManager = (state: RiskManagerBuilderState): void => {
  const dependencies = createRiskManagerDependencies(state);
  state.riskManager = new RiskManager(
    createRiskManagerConfig(),
    dependencies.logger,
    dependencies.errorHandler,
  );
};
