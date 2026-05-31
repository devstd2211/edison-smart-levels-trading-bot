import type { BotServiceState } from '../../bot-services.builder';
import { ExitTypeDetectorService } from '../../exit-type-detector.service';
import { PositionPnLCalculatorService } from '../../position-pnl-calculator.service';
import { PositionSyncService } from '../../position-sync.service';

type PositionMonitorDependencyState = Pick<
  BotServiceState,
  | 'logger'
  | 'bybitService'
  | 'positionManager'
  | 'telegram'
  | 'positionExitingService'
>;

export type PositionMonitorDependencies = {
  exitTypeDetectorService: ExitTypeDetectorService;
  pnlCalculatorService: PositionPnLCalculatorService;
  positionSyncService: PositionSyncService;
};

export const createPositionMonitorDependencies = (
  state: PositionMonitorDependencyState,
): PositionMonitorDependencies => {
  const exitTypeDetectorService = new ExitTypeDetectorService(state.logger);
  const pnlCalculatorService = new PositionPnLCalculatorService();
  const positionSyncService = new PositionSyncService(
    state.bybitService,
    state.positionManager,
    exitTypeDetectorService,
    state.telegram,
    state.logger,
    state.positionExitingService,
  );

  return {
    exitTypeDetectorService,
    pnlCalculatorService,
    positionSyncService,
  };
};
