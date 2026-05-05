import type { ICoreServices } from '../../../interfaces/ICoreServices';
import type { IEventHandlerServices } from '../../../interfaces/IEventHandlerServices';
import type { IExecutionServices } from '../../../interfaces/IExecutionServices';
import type { IMarketDataServices } from '../../../interfaces/IMarketDataServices';
import type { IMonitoringServices } from '../../../interfaces/IMonitoringServices';
import type { IRiskServices } from '../../../interfaces/IRiskServices';
import type { IWebApiServicesContainer } from '../../../interfaces/IWebApiServicesContainer';
import { normalizeWebApiConfig } from '../../../config/web-api-config';
import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';

export const createMarketDataServicesDeps = (
  state: BotServicesState,
): IMarketDataServices => ({
  bybitService: state.bybitService,
  timeframeProvider: state.timeframeProvider,
  candleProvider: state.candleProvider,
  orderbookManager: state.orderbookManager,
  publicWebSocket: state.publicWebSocket,
  webSocketManager: state.webSocketManager,
  indicatorCache: state.indicatorCache,
  indicatorPreCalc: state.indicatorPreCalc,
});

export const createExecutionServicesDeps = (
  state: BotServicesState,
): IExecutionServices => ({
  positionManager: state.positionManager,
  positionMonitor: state.positionMonitor,
  positionExitingService: state.positionExitingService,
  tradingOrchestrator: state.tradingOrchestrator,
  realTimeRiskMonitor: state.realTimeRiskMonitor,
  ladderExitDetector: state.ladderExitDetector,
  dynamicPositionSizer: state.dynamicPositionSizer,
  positionScalingService: state.positionScalingService,
  smartOrderExecution: state.smartOrderExecution,
  orderStateMachine: state.orderStateMachine,
});

export const createMonitoringServicesDeps = (
  state: BotServicesState,
): IMonitoringServices => ({
  metrics: state.metrics,
  metricsService: state.metricsService,
  healthCheckService: state.healthCheckService,
  monitoringServer: state.monitoringServer,
  dashboard: state.dashboard,
});

export const createRiskServicesDeps = (
  state: BotServicesState,
): IRiskServices => ({
  riskManager: state.riskManager,
  realTimeRiskMonitor: state.realTimeRiskMonitor,
  realityCheck: state.realityCheck,
});

export const createWebApiServicesDeps = (
  state: BotServicesState,
  config: Config,
): IWebApiServicesContainer => {
  const normalizedWebApiConfig = normalizeWebApiConfig(config.webApi);

  return {
    marketDataServices: {
      candleProvider: state.candleProvider,
      orderbookManager: state.orderbookManager,
      indicatorCache: state.indicatorCache,
    },
    journal: state.journal,
    bybitService: state.bybitService,
    indicatorPreferences: normalizedWebApiConfig.indicatorPreferences,
  };
};

export const createCoreServicesDeps = (
  state: BotServicesState,
): ICoreServices => ({
  logger: state.logger,
  eventBus: state.eventBus,
  telegram: state.telegram,
  timeService: state.timeService,
});

export const createEventHandlerServicesDeps = (
  state: BotServicesState,
): IEventHandlerServices => ({
  positionEventHandler: state.positionEventHandler,
  webSocketEventHandler: state.webSocketEventHandler,
});
