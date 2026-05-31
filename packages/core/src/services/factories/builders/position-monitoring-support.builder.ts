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

export type PositionMonitoringSupportDependencies = Pick<
  PositionMonitorDependencyState,
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

export const createPositionMonitoringSupportDependencies = (
  state: PositionMonitoringSupportDependencies,
): PositionMonitoringSupportDependencies => ({
  logger: state.logger,
  bybitService: state.bybitService,
  positionManager: state.positionManager,
  telegram: state.telegram,
  positionExitingService: state.positionExitingService,
});

export const createPositionMonitorRuntimeServices = (
  dependencies: PositionMonitoringSupportDependencies,
): PositionMonitorDependencies => {
  const exitTypeDetectorService = new ExitTypeDetectorService(dependencies.logger);
  const pnlCalculatorService = new PositionPnLCalculatorService();
  const positionSyncService = new PositionSyncService(
    dependencies.bybitService,
    dependencies.positionManager,
    exitTypeDetectorService,
    dependencies.telegram,
    dependencies.logger,
    dependencies.positionExitingService,
  );

  return {
    exitTypeDetectorService,
    pnlCalculatorService,
    positionSyncService,
  };
};

export const createPositionMonitorDependencies = (
  state: PositionMonitorDependencyState,
): PositionMonitorDependencies =>
  createPositionMonitorRuntimeServices(createPositionMonitoringSupportDependencies(state));
