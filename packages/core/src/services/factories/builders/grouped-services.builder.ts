import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { createGroupedServices } from '../../containers/bot-services-grouped';
import { RiskManager } from '../../risk-manager.service';

export const initializeGroupedServices = (
  state: BotServicesState,
  riskManager: RiskManager,
  config: Config,
): void => {
  const groupedServices = createGroupedServices({
    bybitService: state.bybitService,
    timeframeProvider: state.timeframeProvider,
    candleProvider: state.candleProvider,
    orderbookManager: state.orderbookManager,
    publicWebSocket: state.publicWebSocket,
    webSocketManager: state.webSocketManager,
    indicatorCache: state.indicatorCache,
    indicatorPreCalc: state.indicatorPreCalc,
    positionManager: state.positionManager,
    positionExitingService: state.positionExitingService,
    tradingOrchestrator: state.tradingOrchestrator,
    realTimeRiskMonitor: state.realTimeRiskMonitor,
    positionMonitor: state.positionMonitor,
    ladderExitDetector: state.ladderExitDetector,
    dynamicPositionSizer: state.dynamicPositionSizer,
    positionScalingService: state.positionScalingService,
    smartOrderExecution: state.smartOrderExecution,
    orderStateMachine: state.orderStateMachine,
    metrics: state.metrics,
    metricsService: state.metricsService,
    healthCheckService: state.healthCheckService,
    monitoringServer: state.monitoringServer,
    dashboard: state.dashboard,
    riskManager: riskManager,
    realityCheck: state.realityCheck,
    journal: state.journal,
    indicatorPreferences: config.webApi?.indicatorPreferences,
    logger: state.logger,
    eventBus: state.eventBus,
    telegram: state.telegram,
    timeService: state.timeService,
    positionEventHandler: state.positionEventHandler,
    webSocketEventHandler: state.webSocketEventHandler,
  });

  state.marketDataServices = groupedServices.marketDataServices;
  state.executionServices = groupedServices.executionServices;
  state.monitoringServices = groupedServices.monitoringServices;
  state.riskServices = groupedServices.riskServices;
  state.webApiServices = groupedServices.webApiServices;
  state.coreServices = groupedServices.coreServices;
  state.eventHandlerServices = groupedServices.eventHandlerServices;
};
