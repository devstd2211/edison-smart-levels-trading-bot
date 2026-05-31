import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { PositionLifecycleService } from '../../position-lifecycle.service';
import { PositionExitingService } from '../../position-exiting.service';
import { RealTimeRiskMonitor } from '../../real-time-risk-monitor.service';
import { createRiskMonitoringConfig } from './risk-monitoring-config.builder';
import { ICONS } from '../../../cli/cli-runtime';

type PositionManagementBuilderState = Pick<
  BotServiceState,
  | 'bybitService'
  | 'telegram'
  | 'logger'
  | 'journal'
  | 'eventBus'
  | 'compoundInterestCalculator'
  | 'sessionStats'
  | 'positionRepository'
  | 'errorHandler'
  | 'dynamicPositionSizer'
  | 'positionScalingService'
  | 'positionManager'
  | 'positionExitingService'
  | 'realityCheck'
  | 'realTimeRiskMonitor'
>;

type PositionManagementLiveTradingConfig = Partial<{
  riskMonitoring?: unknown;
}>;

export type PositionManagementConfig = {
  trading: Config['trading'];
  riskManagement: Config['riskManagement'];
  entryConfirmation: Config['entryConfirmation'];
  liveTrading?: PositionManagementLiveTradingConfig;
  fullConfig: Config;
};

export const createPositionManagementConfig = (
  config: Config,
): PositionManagementConfig => ({
  trading: config.trading,
  riskManagement: config.riskManagement,
  entryConfirmation: config.entryConfirmation,
  liveTrading: (config as Partial<{ liveTrading: PositionManagementLiveTradingConfig }>).liveTrading,
  fullConfig: config,
});

export const initializePositionManagement = (
  state: PositionManagementBuilderState,
  config: Config,
): void => {
  const positionManagementConfig = createPositionManagementConfig(config);

  state.positionManager = new PositionLifecycleService(
    state.bybitService,
    positionManagementConfig.trading,
    positionManagementConfig.riskManagement,
    state.telegram,
    state.logger,
    state.journal,
    positionManagementConfig.entryConfirmation,
    positionManagementConfig.fullConfig,
    state.eventBus,
    state.compoundInterestCalculator,
    state.sessionStats,
    undefined,
    state.positionRepository,
    state.errorHandler,
    state.dynamicPositionSizer,
    state.positionScalingService,
  );

  state.positionExitingService = new PositionExitingService(
    state.bybitService,
    state.telegram,
    state.logger,
    state.journal,
    positionManagementConfig.trading,
    positionManagementConfig.riskManagement,
    positionManagementConfig.fullConfig,
    state.sessionStats,
    state.positionManager,
    state.realityCheck,
  );

  const riskMonitoringConfig = createRiskMonitoringConfig(config);

  state.realTimeRiskMonitor = new RealTimeRiskMonitor(
    riskMonitoringConfig,
    state.positionManager,
    state.logger,
    state.eventBus,
  );

  state.logger.info(`${ICONS.shield}  Real-Time Risk Monitor initialized (Phase 9.2)`, {
    enabled: riskMonitoringConfig.enabled,
    checkIntervalCandles: riskMonitoringConfig.checkIntervalCandles,
    healthScoreThreshold: riskMonitoringConfig.healthScoreThreshold,
    emergencyCloseOnCritical: riskMonitoringConfig.emergencyCloseOnCritical,
    p1CacheInvalidation: 'ENABLED - subscribed to position-closed events for cache invalidation',
    configSource: positionManagementConfig.liveTrading?.riskMonitoring
      ? 'config.liveTrading.riskMonitoring'
      : 'defaults',
  });
};
