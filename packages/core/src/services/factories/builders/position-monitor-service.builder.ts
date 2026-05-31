import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { PositionMonitorService } from '../../position-monitor.service';
import type { PositionMonitorDependencies } from './position-monitoring-support.builder';

type PositionMonitorBuilderState = Pick<
  BotServiceState,
  | 'bybitService'
  | 'positionManager'
  | 'telegram'
  | 'logger'
  | 'positionExitingService'
  | 'positionMonitor'
>;

export type PositionMonitorConfig = Pick<Config, 'riskManagement'>;

export const createPositionMonitorConfig = (
  config: Pick<Config, 'riskManagement'>,
): PositionMonitorConfig => ({
  riskManagement: config.riskManagement,
});

export const initializePositionMonitor = (
  state: PositionMonitorBuilderState,
  config: Pick<Config, 'riskManagement'>,
  dependencies: PositionMonitorDependencies,
): void => {
  const positionMonitorConfig = createPositionMonitorConfig(config);

  state.positionMonitor = new PositionMonitorService(
    state.bybitService,
    state.positionManager,
    positionMonitorConfig.riskManagement,
    state.telegram,
    state.logger,
    dependencies.exitTypeDetectorService,
    dependencies.pnlCalculatorService,
    dependencies.positionSyncService,
    state.positionExitingService,
  );
};
