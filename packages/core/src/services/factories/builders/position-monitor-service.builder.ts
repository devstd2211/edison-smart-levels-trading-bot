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

export type PositionMonitorServiceDependencies = Pick<
  PositionMonitorBuilderState,
  | 'bybitService'
  | 'positionManager'
  | 'telegram'
  | 'logger'
  | 'positionExitingService'
>;

export type PositionMonitorConfig = Pick<Config, 'riskManagement'>;

export const createPositionMonitorConfig = (
  config: Pick<Config, 'riskManagement'>,
): PositionMonitorConfig => ({
  riskManagement: config.riskManagement,
});

export const createPositionMonitorServiceDependencies = (
  state: PositionMonitorServiceDependencies,
): PositionMonitorServiceDependencies => ({
  bybitService: state.bybitService,
  positionManager: state.positionManager,
  telegram: state.telegram,
  logger: state.logger,
  positionExitingService: state.positionExitingService,
});

export const createPositionMonitorService = (
  state: PositionMonitorServiceDependencies,
  config: Pick<Config, 'riskManagement'>,
  dependencies: PositionMonitorDependencies,
): PositionMonitorService => {
  const positionMonitorConfig = createPositionMonitorConfig(config);
  const serviceDependencies = createPositionMonitorServiceDependencies(state);

  return new PositionMonitorService(
    serviceDependencies.bybitService,
    serviceDependencies.positionManager,
    positionMonitorConfig.riskManagement,
    serviceDependencies.telegram,
    serviceDependencies.logger,
    dependencies.exitTypeDetectorService,
    dependencies.pnlCalculatorService,
    dependencies.positionSyncService,
    serviceDependencies.positionExitingService,
  );
};

export const initializePositionMonitor = (
  state: PositionMonitorBuilderState,
  config: Pick<Config, 'riskManagement'>,
  dependencies: PositionMonitorDependencies,
): void => {
  state.positionMonitor = createPositionMonitorService(state, config, dependencies);
};
