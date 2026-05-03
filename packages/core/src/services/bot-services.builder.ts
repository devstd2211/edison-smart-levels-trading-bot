/**
 * BotServices builder
 *
 * Builds the full BotServices state without mutating the BotServices class.
 * Keeps construction logic out of the container class for thin wrapper usage.
 */

import type { Candle, Config } from '../types/legacy';
import type {
  IExchange,
  IMonitoringHealthReader,
  IMonitoringMetricsReader,
  IWebApiReadServices,
} from '../interfaces';
import type { LoggerService } from './logger.service';
import type { ErrorHandler } from '../errors';
import type { BotEventBus } from './event-bus';
import type { BotMetricsService } from './bot-metrics.service';
import type { PositionLifecycleService } from './position-lifecycle.service';
import type { PositionExitingService } from './position-exiting.service';
import type { PositionMonitorService } from './position-monitor.service';
import type { WebSocketManagerService } from './websocket-manager.service';
import type { PublicWebSocketService } from './public-websocket.service';
import type { OrderbookManagerService } from './orderbook-manager.service';
import type { PositionEventHandler, WebSocketEventHandler } from './handlers';
import type { CompoundInterestCalculatorService } from './compound-interest-calculator.service';
import type { RetestEntryService } from './retest-entry.service';
import type { DeltaAnalyzerService } from './delta-analyzer.service';
import type { OrderbookImbalanceService } from './orderbook-imbalance.service';
import type { WallTrackerService } from './wall-tracker.service';
import type { LadderExitDetectorService } from './ladder-exit-detector.service';
import type { AdvancedOrderFlowService } from './advanced-order-flow.service';
import type { DynamicPositionSizerService } from './dynamic-position-sizer.service';
import type { PositionScalingService } from './position-scaling.service';
import type { SmartOrderExecutionService } from './smart-order-execution.service';
import type { AdvancedOrderStateMachineService } from './advanced-order-state-machine.service';
import type { MonitoringServer } from './monitoring-server.service';
import type { CircuitBreakerService } from './resilience/circuit-breaker.service';
import type { RateLimiterService } from './resilience/rate-limiter.service';
import type { RetryPolicyService } from './resilience/retry-policy.service';
import type { BulkheadService } from './resilience/bulkhead.service';
import type { ResilienceCoordinator } from './resilience/resilience-coordinator.service';
import type { MarketDataServices } from './containers/market-data-services';
import type { ExecutionServices } from './containers/execution-services';
import type { MonitoringServices } from './containers/monitoring-services';
import type { RiskServices } from './containers/risk-services';
import type { WebApiServices } from './containers/web-api-services';
import type { CoreServices } from './containers/core-services';
import type { EventHandlerServices } from './containers/event-handler-services';
import type { TradingOrchestrator } from './trading-orchestrator.service';
import type { StrategyOrchestratorService } from './multi-strategy/strategy-orchestrator.service';
import type { RealTimeRiskMonitor } from './real-time-risk-monitor.service';
import type { ConsoleDashboardService } from './console-dashboard.service';
import type {
  SessionStatsService,
  TelegramService,
  TimeService,
  TradingJournalService,
} from './index';
import type { ExchangeFactory } from './exchange-factory.service';
import type { IndicatorCacheService } from './indicator-cache.service';
import type { IndicatorPreCalculationService } from './indicator-precalculation.service';
import { RiskManager } from './risk-manager.service';
import type { RealityCheckService } from './reality-check.service';
import type { TimeframeProvider } from '../providers/timeframe.provider';
import type { CandleProvider } from '../providers/candle.provider';
import { initializeCoreInfrastructure } from './factories/builders/core-infrastructure.builder';
import { initializeRuntimeCoreServices } from './factories/builders/runtime-core.builder';
import { initializeExchangeServices } from './factories/builders/exchange-services.builder';
import { initializeJournalAndMarketData } from './factories/builders/journal-market-data.builder';
import { initializeOptionalServices } from './factories/builders/optional-services.builder';
import { initializePositionManagement } from './factories/builders/position-management.builder';
import { initializeWebSocketAndMonitoring } from './factories/builders/websocket-monitoring.builder';
import { initializeOrchestratorAndHandlers } from './factories/builders/orchestrator-handlers.builder';
import { initializeMonitoringAndResilience } from './factories/builders/monitoring-resilience.builder';
import { initializeGroupedServices } from './factories/builders/grouped-services.builder';
import { initializeRiskManager } from './factories/builders/risk-manager-service.builder';
import { resolveMonitoringConfig } from './factories/builders/monitoring-config.builder';

// Phase 6.2: Repository Pattern Integration
import type {
  IJournalRepository,
  IMarketDataRepository,
  IPositionRepository,
} from '../repositories/IRepositories';

export type BotServicesState = {
  // Core services
  logger: LoggerService;
  errorHandler: ErrorHandler;
  eventBus: BotEventBus;
  metrics: BotMetricsService;
  telegram: TelegramService;
  timeService: TimeService;
  bybitService: IExchange;

  // Phase 6.2: Repository Pattern (Data Access Layer)
  positionRepository: IPositionRepository;
  journalRepository: IJournalRepository;
  marketDataRepository: IMarketDataRepository;

  // Data & Providers
  timeframeProvider: TimeframeProvider;
  candleProvider: CandleProvider;
  btcCandles1m: Candle[];

  // Indicator Cache System
  indicatorCache: IndicatorCacheService;
  indicatorPreCalc: IndicatorPreCalculationService;

  // Analysis & Orchestration
  tradingOrchestrator: TradingOrchestrator;
  strategyOrchestrator?: StrategyOrchestratorService;

  // Tracking & Journal
  journal: TradingJournalService;
  sessionStats: SessionStatsService;
  positionManager: PositionLifecycleService;
  positionExitingService: PositionExitingService;
  realityCheck: RealityCheckService;
  riskManager: RiskManager;

  // Phase 9: Live Trading Engine (Risk Monitoring)
  realTimeRiskMonitor: RealTimeRiskMonitor;

  // WebSocket & Data
  webSocketManager: WebSocketManagerService;
  publicWebSocket: PublicWebSocketService;
  orderbookManager: OrderbookManagerService;
  positionMonitor: PositionMonitorService;

  // Event Handlers
  positionEventHandler: PositionEventHandler;
  webSocketEventHandler: WebSocketEventHandler;

  // UI & Dashboard
  dashboard: ConsoleDashboardService;

  // Optional services
  compoundInterestCalculator?: CompoundInterestCalculatorService;
  retestEntryService?: RetestEntryService;
  deltaAnalyzerService?: DeltaAnalyzerService;
  orderbookImbalanceService?: OrderbookImbalanceService;
  wallTrackerService?: WallTrackerService;
  ladderExitDetector?: LadderExitDetectorService;
  advancedOrderFlowService?: AdvancedOrderFlowService;
  dynamicPositionSizer?: DynamicPositionSizerService;
  positionScalingService?: PositionScalingService;
  smartOrderExecution?: SmartOrderExecutionService;
  orderStateMachine?: AdvancedOrderStateMachineService;
  metricsService?: IMonitoringMetricsReader;
  healthCheckService?: IMonitoringHealthReader;
  monitoringServer?: MonitoringServer;
  circuitBreaker?: CircuitBreakerService;
  rateLimiter?: RateLimiterService;
  retryPolicy?: RetryPolicyService;
  bulkhead?: BulkheadService;
  resilienceCoordinator?: ResilienceCoordinator;
  marketDataServices: MarketDataServices;
  executionServices: ExecutionServices;
  monitoringServices: MonitoringServices;
  riskServices: RiskServices;
  webApiReadServices: IWebApiReadServices;
  webApiServices: WebApiServices;
  coreServices: CoreServices;
  eventHandlerServices: EventHandlerServices;
  exchangeFactory?: ExchangeFactory;
};

export const buildBotServices = (config: Config): BotServicesState => {
  const state = {} as BotServicesState;

  initializeCoreInfrastructure(state, config);
  initializeRuntimeCoreServices(state, config);
  initializeExchangeServices(state, config);
  initializeJournalAndMarketData(state, config);

  const monitoring = resolveMonitoringConfig(config);

  // 6. Initialize optional services
  initializeOptionalServices(state, config, monitoring);
  initializeRiskManager(state);

  initializePositionManagement(state, config);
  initializeWebSocketAndMonitoring(state, config);
  initializeOrchestratorAndHandlers(state, config);
  initializeMonitoringAndResilience(state, config, monitoring);
  initializeGroupedServices(state, config);

  state.logger.info('BotServices initialized - all dependencies ready');
  return state;
};
