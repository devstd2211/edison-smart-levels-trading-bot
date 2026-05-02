import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { PositionLifecycleService } from '../../position-lifecycle.service';
import { PositionExitingService } from '../../position-exiting.service';
import { RealTimeRiskMonitor } from '../../real-time-risk-monitor.service';
import { createRiskMonitoringConfig } from './risk-monitoring-config.builder';

export const initializePositionManagement = (
  state: BotServicesState,
  config: Config,
): void => {
  const liveTradingConfig = (config as Partial<{ liveTrading: { riskMonitoring?: unknown } }>).liveTrading;

  state.positionManager = new PositionLifecycleService(
    state.bybitService,
    config.trading,
    config.riskManagement,
    state.telegram,
    state.logger,
    state.journal,
    config.entryConfirmation,
    config,
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
    config.trading,
    config.riskManagement,
    config,
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

  state.logger.info('🛡️  Real-Time Risk Monitor initialized (Phase 9.2)', {
    enabled: riskMonitoringConfig.enabled,
    checkIntervalCandles: riskMonitoringConfig.checkIntervalCandles,
    healthScoreThreshold: riskMonitoringConfig.healthScoreThreshold,
    emergencyCloseOnCritical: riskMonitoringConfig.emergencyCloseOnCritical,
    p1CacheInvalidation: 'ENABLED - subscribed to position-closed events for cache invalidation',
    configSource: liveTradingConfig?.riskMonitoring ? 'config.liveTrading.riskMonitoring' : 'defaults',
  });
};
