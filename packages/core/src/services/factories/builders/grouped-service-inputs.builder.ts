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
import type { GroupedServiceDeps } from '../../containers/bot-services-grouped';
import { selectWebApiReadServices } from '../../containers/web-api-read-services';

type MarketDataServicesState = Pick<
  BotServiceState,
  | 'bybitService'
  | 'timeframeProvider'
  | 'candleProvider'
  | 'orderbookManager'
  | 'publicWebSocket'
  | 'webSocketManager'
  | 'indicatorCache'
  | 'indicatorPreCalc'
>;

type ExecutionServicesState = Pick<
  BotServiceState,
  | 'positionManager'
  | 'positionMonitor'
  | 'positionExitingService'
  | 'tradingOrchestrator'
  | 'realTimeRiskMonitor'
  | 'ladderExitDetector'
  | 'dynamicPositionSizer'
  | 'positionScalingService'
  | 'smartOrderExecution'
  | 'orderStateMachine'
>;

type MonitoringServicesState = Pick<
  BotServiceState,
  'metrics' | 'metricsService' | 'healthCheckService' | 'monitoringServer' | 'dashboard'
>;

type RiskServicesState = Pick<
  BotServiceState,
  'riskManager' | 'realTimeRiskMonitor' | 'realityCheck'
>;

type WebApiServicesState = Pick<
  BotServiceState,
  'candleProvider' | 'orderbookManager' | 'indicatorCache' | 'journal' | 'bybitService'
>;

type CoreServicesState = Pick<
  BotServiceState,
  'logger' | 'eventBus' | 'telegram' | 'timeService'
>;

type EventHandlerServicesState = Pick<
  BotServiceState,
  'positionEventHandler' | 'webSocketEventHandler'
>;

type GroupedServicesDependencyState =
  & MarketDataServicesState
  & ExecutionServicesState
  & MonitoringServicesState
  & RiskServicesState
  & WebApiServicesState
  & CoreServicesState
  & EventHandlerServicesState;

export type GroupedServicesBuilderState =
  & GroupedServicesDependencyState
  & Pick<
    BotServiceState,
    | 'marketDataServices'
    | 'executionServices'
    | 'monitoringServices'
    | 'riskServices'
    | 'webApiServices'
    | 'coreServices'
    | 'eventHandlerServices'
  >;

export const createMarketDataServicesDeps = (
  state: MarketDataServicesState,
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
  state: ExecutionServicesState,
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
  state: MonitoringServicesState,
): IMonitoringServices => ({
  metrics: state.metrics,
  metricsService: state.metricsService,
  healthCheckService: state.healthCheckService,
  monitoringServer: state.monitoringServer,
  dashboard: state.dashboard,
});

export const createRiskServicesDeps = (
  state: RiskServicesState,
): IRiskServices => ({
  riskManager: state.riskManager,
  realTimeRiskMonitor: state.realTimeRiskMonitor,
  realityCheck: state.realityCheck,
});

export const createWebApiServicesDeps = (
  state: WebApiServicesState,
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
  state: CoreServicesState,
): ICoreServices => ({
  logger: state.logger,
  eventBus: state.eventBus,
  telegram: state.telegram,
  timeService: state.timeService,
});

export const createEventHandlerServicesDeps = (
  state: EventHandlerServicesState,
): IEventHandlerServices => ({
  positionEventHandler: state.positionEventHandler,
  webSocketEventHandler: state.webSocketEventHandler,
});

export const createGroupedServicesDeps = (
  state: GroupedServicesDependencyState,
  config: Config,
): GroupedServiceDeps => ({
  marketDataServices: createMarketDataServicesDeps(state),
  executionServices: createExecutionServicesDeps(state),
  monitoringServices: createMonitoringServicesDeps(state),
  riskServices: createRiskServicesDeps(state),
  webApiServices: createWebApiServicesDeps(state, config),
  coreServices: createCoreServicesDeps(state),
  eventHandlerServices: createEventHandlerServicesDeps(state),
});

export const createBotStateWebApiReadServices = (
  state: Pick<BotServiceState, 'coreServices' | 'webApiServices' | 'wallTrackerService'>,
): IWebApiReadServices => selectWebApiReadServices(state);
