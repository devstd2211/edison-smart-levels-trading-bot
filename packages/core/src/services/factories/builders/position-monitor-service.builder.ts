import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { PositionMonitorService } from '../../position-monitor.service';
import type { PositionMonitorDependencies } from './position-monitoring-support.builder';

export const initializePositionMonitor = (
  state: BotServicesState,
  config: Config,
  dependencies: PositionMonitorDependencies,
): void => {
  state.positionMonitor = new PositionMonitorService(
    state.bybitService,
    state.positionManager,
    config.riskManagement,
    state.telegram,
    state.logger,
    dependencies.exitTypeDetectorService,
    dependencies.pnlCalculatorService,
    dependencies.positionSyncService,
    state.positionExitingService,
  );
};
