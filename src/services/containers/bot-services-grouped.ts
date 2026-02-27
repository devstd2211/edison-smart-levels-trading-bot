/**
 * Grouped service factory for BotServices.
 *
 * Keeps grouped container wiring out of the BotServices constructor.
 */

import { MarketDataServices } from './market-data-services';
import { ExecutionServices } from './execution-services';
import { createMonitoringServices, type MonitoringServices } from './monitoring-services';
import { RiskServices } from './risk-services';
import { createWebApiServices, type WebApiServices } from './web-api-services';
import { CoreServices } from './core-services';
import { EventHandlerServices } from './event-handler-services';
import type { IMonitoringHealthReader, IMonitoringMetricsReader } from '../../interfaces';
import type { BotMetricsService } from '../bot-metrics.service';
import type { ConsoleDashboardService } from '../console-dashboard.service';
import type { TradingJournalService } from '../trading-journal.service';
import type { IExchange } from '../../interfaces/IExchange';
import type { WebApiIndicatorPreferences } from '../../types/web-api';

type GroupedServiceDeps = {
  // Market data
  bybitService: IExchange;
  timeframeProvider: MarketDataServices['timeframeProvider'];
  candleProvider: MarketDataServices['candleProvider'];
  orderbookManager: MarketDataServices['orderbookManager'];
  publicWebSocket: MarketDataServices['publicWebSocket'];
  webSocketManager: MarketDataServices['webSocketManager'];
  indicatorCache: MarketDataServices['indicatorCache'];
  indicatorPreCalc: MarketDataServices['indicatorPreCalc'];

  // Execution
  positionManager: ExecutionServices['positionManager'];
  positionExitingService: ExecutionServices['positionExitingService'];
  tradingOrchestrator: ExecutionServices['tradingOrchestrator'];
  realTimeRiskMonitor: ExecutionServices['realTimeRiskMonitor'];
  positionMonitor: ExecutionServices['positionMonitor'];
  ladderExitDetector?: ExecutionServices['ladderExitDetector'];
  dynamicPositionSizer?: ExecutionServices['dynamicPositionSizer'];
  positionScalingService?: ExecutionServices['positionScalingService'];
  smartOrderExecution?: ExecutionServices['smartOrderExecution'];
  orderStateMachine?: ExecutionServices['orderStateMachine'];

  // Monitoring
  metrics: BotMetricsService;
  metricsService?: IMonitoringMetricsReader;
  healthCheckService?: IMonitoringHealthReader;
  monitoringServer?: MonitoringServices['monitoringServer'];
  dashboard: ConsoleDashboardService;

  // Risk
  riskManager: RiskServices['riskManager'];
  realityCheck: RiskServices['realityCheck'];

  // Web API
  journal: TradingJournalService;
  indicatorPreferences?: WebApiIndicatorPreferences;

  // Core
  logger: CoreServices['logger'];
  eventBus: CoreServices['eventBus'];
  telegram: CoreServices['telegram'];
  timeService: CoreServices['timeService'];

  // Event handlers
  positionEventHandler: EventHandlerServices['positionEventHandler'];
  webSocketEventHandler: EventHandlerServices['webSocketEventHandler'];
};

export const createGroupedServices = (deps: GroupedServiceDeps) => ({
  marketDataServices: new MarketDataServices({
    bybitService: deps.bybitService,
    timeframeProvider: deps.timeframeProvider,
    candleProvider: deps.candleProvider,
    orderbookManager: deps.orderbookManager,
    publicWebSocket: deps.publicWebSocket,
    webSocketManager: deps.webSocketManager,
    indicatorCache: deps.indicatorCache,
    indicatorPreCalc: deps.indicatorPreCalc,
  }),

  executionServices: new ExecutionServices({
    positionManager: deps.positionManager,
    positionExitingService: deps.positionExitingService,
    tradingOrchestrator: deps.tradingOrchestrator,
    realTimeRiskMonitor: deps.realTimeRiskMonitor,
    positionMonitor: deps.positionMonitor,
    ladderExitDetector: deps.ladderExitDetector,
    dynamicPositionSizer: deps.dynamicPositionSizer,
    positionScalingService: deps.positionScalingService,
    smartOrderExecution: deps.smartOrderExecution,
    orderStateMachine: deps.orderStateMachine,
  }),

  monitoringServices: createMonitoringServices({
    metrics: deps.metrics,
    metricsService: deps.metricsService,
    healthCheckService: deps.healthCheckService,
    monitoringServer: deps.monitoringServer,
    dashboard: deps.dashboard,
  }),

  riskServices: new RiskServices({
    riskManager: deps.riskManager,
    realTimeRiskMonitor: deps.realTimeRiskMonitor,
    realityCheck: deps.realityCheck,
  }),

  webApiServices: createWebApiServices({
    marketDataServices: {
      candleProvider: deps.candleProvider,
      orderbookManager: deps.orderbookManager,
      indicatorCache: deps.indicatorCache,
    },
    journal: deps.journal,
    bybitService: deps.bybitService,
    indicatorPreferences: deps.indicatorPreferences,
  }),

  coreServices: new CoreServices({
    logger: deps.logger,
    eventBus: deps.eventBus,
    telegram: deps.telegram,
    timeService: deps.timeService,
  }),

  eventHandlerServices: new EventHandlerServices({
    positionEventHandler: deps.positionEventHandler,
    webSocketEventHandler: deps.webSocketEventHandler,
  }),
});
