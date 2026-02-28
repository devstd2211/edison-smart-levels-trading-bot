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
import { BybitService, TradingJournalService, TimeService, TelegramService, SessionStatsService } from './index';
import { BybitServiceAdapter } from './bybit/bybit-service.adapter';
import { ExchangeFactory } from './exchange-factory.service';
import { IndicatorCacheService } from './indicator-cache.service';
import { IndicatorPreCalculationService } from './indicator-precalculation.service';
import { CalculatorFactory } from '../factories/calculator.factory';
import { RiskManager } from './risk-manager.service';
import { RealityCheckService } from './reality-check.service';
import { TimeframeProvider } from '../providers/timeframe.provider';
import { CandleProvider } from '../providers/candle.provider';
import { INTEGER_MULTIPLIERS } from '../constants';
import type { MonitoringConfig } from './factories/builders/bot-services.types';
import { initializeCoreInfrastructure } from './factories/builders/core-infrastructure.builder';
import { initializeOptionalServices } from './factories/builders/optional-services.builder';
import { initializePositionManagement } from './factories/builders/position-management.builder';
import { initializeWebSocketAndMonitoring } from './factories/builders/websocket-monitoring.builder';
import { initializeOrchestratorAndHandlers } from './factories/builders/orchestrator-handlers.builder';
import { initializeMonitoringAndResilience } from './factories/builders/monitoring-resilience.builder';
import { initializeGroupedServices } from './factories/builders/grouped-services.builder';

// Phase 6.2: Repository Pattern Integration
import type { IPositionRepository, IJournalRepository, IMarketDataRepository } from '../repositories/IRepositories';

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
  webApiServices: WebApiServices;
  coreServices: CoreServices;
  eventHandlerServices: EventHandlerServices;
  exchangeFactory?: ExchangeFactory;
};

export const buildBotServices = (config: Config): BotServicesState => {
  const state = {} as BotServicesState;

  initializeCoreInfrastructure(state, config);
  state.btcCandles1m = [];

  // 2. Initialize core services (no dependencies)
  state.telegram = new TelegramService(
    config.telegram || { enabled: false },
    state.logger,
    state.errorHandler,
  );

  state.timeService = new TimeService(
    state.logger,
    config.system.timeSyncIntervalMs,
    config.system.timeSyncMaxFailures,
  );

  // 3. Initialize exchange service using factory pattern
  const exchangeFactory = new ExchangeFactory(state.logger, {
    name: (config.exchange.name || 'bybit') as 'bybit' | 'binance',
    symbol: config.exchange.symbol,
    demo: config.exchange.demo,
    testnet: config.exchange.testnet,
    apiKey: config.exchange.apiKey,
    apiSecret: config.exchange.apiSecret,
  });

  if (!config.exchange.name || config.exchange.name === 'bybit') {
    const rawBybitService = new BybitService(config.exchange, state.logger, state.marketDataRepository);
    state.bybitService = new BybitServiceAdapter(rawBybitService, state.logger);
  } else {
    const exchange = exchangeFactory.getExchange();
    if (!exchange) {
      const exchangeName = config.exchange.name || 'unknown';
      throw new Error(`ExchangeFactory returned no exchange for "${exchangeName}"`);
    }
    state.bybitService = exchange;
  }

  state.exchangeFactory = exchangeFactory;
  state.timeService.setBybitService(state.bybitService);

  // 4. Initialize journal and stats
  state.journal = new TradingJournalService(
    state.logger,
    undefined,
    config.tradeHistory,
    config.compoundInterest?.baseDeposit || INTEGER_MULTIPLIERS.FIFTY,
    state.journalRepository,
    state.errorHandler,
  );

  state.sessionStats = new SessionStatsService(
    state.logger,
    state.journalRepository,
    undefined,
    state.errorHandler,
  );

  // 4.5 Initialize Reality Check Service
  state.realityCheck = new RealityCheckService(state.logger);

  // 5. Initialize data providers
  state.timeframeProvider = new TimeframeProvider(config.timeframes);
  state.candleProvider = new CandleProvider(
    state.timeframeProvider,
    state.bybitService,
    state.logger,
    config.exchange.symbol,
    state.marketDataRepository,
    state.errorHandler,
  );

  state.indicatorCache = new IndicatorCacheService(state.marketDataRepository);
  state.logger.info('📊 Indicator cache initialized (Phase 6.2)', {
    capacity: state.indicatorCache.getStats().capacity,
    backendRepository: 'MarketDataCacheRepository',
  });

  const calculators = CalculatorFactory.createAllCalculators();
  state.indicatorPreCalc = new IndicatorPreCalculationService(
    state.candleProvider,
    state.indicatorCache,
    calculators,
    state.logger,
  );
  state.logger.info('🔄 Pre-calculation service initialized', {
    calculators: calculators.length,
  });

  const monitoring = (config as Partial<{ monitoring: MonitoringConfig }>).monitoring;

  // 6. Initialize optional services
  initializeOptionalServices(state, config, monitoring);

  // 7.5 Initialize RiskManager with proper RiskManagerConfig structure (PHASE 4)
  const riskManagerConfig = {
    dailyLimits: {
      maxDailyLossPercent: 5.0,
      maxDailyProfitPercent: undefined,
      emergencyStopOnLimit: true,
    },
    lossStreak: {
      stopAfterLosses: 4,
      reductions: {
        after2Losses: 0.75,
        after3Losses: 0.50,
        after4Losses: 0.25,
      },
    },
    concurrentRisk: {
      enabled: false,
      maxPositions: 1,
      maxRiskPerPosition: 2.0,
      maxTotalExposurePercent: 5.0,
    },
    positionSizing: {
      riskPerTradePercent: 1.0,
      minPositionSizeUsdt: 5.0,
      maxPositionSizeUsdt: 100.0,
      maxLeverageMultiplier: 2.0,
    },
  };
  const riskManager = new RiskManager(riskManagerConfig, state.logger, state.errorHandler);

  initializePositionManagement(state, config);
  initializeWebSocketAndMonitoring(state, config);
  initializeOrchestratorAndHandlers(state, riskManager, config);
  initializeMonitoringAndResilience(state, config, monitoring);
  initializeGroupedServices(state, riskManager, config);

  state.logger.info('✅ BotServices initialized - all dependencies ready');
  return state;
};








