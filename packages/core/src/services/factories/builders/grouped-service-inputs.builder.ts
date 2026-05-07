import type { ICoreServices } from '../../../interfaces/ICoreServices';
import type { IEventHandlerServices } from '../../../interfaces/IEventHandlerServices';
import type { IExecutionServices } from '../../../interfaces/IExecutionServices';
import type { IMarketDataServices } from '../../../interfaces/IMarketDataServices';
import type { IMonitoringServices } from '../../../interfaces/IMonitoringServices';
import type { IRiskServices } from '../../../interfaces/IRiskServices';
import type { IWebApiReadServices } from '../../../interfaces/IWebApiServices';
import type { IWebApiServicesContainer } from '../../../interfaces/IWebApiServicesContainer';
import { normalizeWebApiConfig } from '../../../config/web-api-config';
import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { selectWebApiReadServices } from '../../containers/web-api-read-services';

export const createMarketDataServicesDeps = (
  state: BotServiceState,
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
  state: BotServiceState,
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
  state: BotServiceState,
): IMonitoringServices => ({
  metrics: state.metrics,
  metricsService: state.metricsService,
  healthCheckService: state.healthCheckService,
  monitoringServer: state.monitoringServer,
  dashboard: state.dashboard,
});

export const createRiskServicesDeps = (
  state: BotServiceState,
): IRiskServices => ({
  riskManager: state.riskManager,
  realTimeRiskMonitor: state.realTimeRiskMonitor,
  realityCheck: state.realityCheck,
});

export const createWebApiServicesDeps = (
  state: BotServiceState,
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
  state: BotServiceState,
): ICoreServices => ({
  logger: state.logger,
  eventBus: state.eventBus,
  telegram: state.telegram,
  timeService: state.timeService,
});

export const createEventHandlerServicesDeps = (
  state: BotServiceState,
): IEventHandlerServices => ({
  positionEventHandler: state.positionEventHandler,
  webSocketEventHandler: state.webSocketEventHandler,
});

export const createBotStateWebApiReadServices = (
  state: Pick<BotServiceState, 'coreServices' | 'webApiServices' | 'wallTrackerService'>,
): IWebApiReadServices => selectWebApiReadServices(state);

export const createWebApiReadServicesDeps = createBotStateWebApiReadServices;
