/**
 * BotServices - Dependency Injection Container
 *
 * Centralizes all bot dependencies and their initialization.
 * Replaces scattered initialization logic in bot.ts constructor.
 *
 * Benefits:
 * - Single place to see all dependencies
 * - Clear initialization order
 * - Easy to swap implementations for testing
 * - Easy to add new services
 */

import type { Candle, Config } from '../types/legacy';
import type { IExchange, IMonitoringHealthReader, IMonitoringMetricsReader } from '../interfaces';
import type { LoggerService } from './logger.service';
import type {
  PositionLifecycleService,
  WebSocketManagerService,
  PositionMonitorService,
  TradingJournalService,
  TimeService,
  TelegramService,
  SessionStatsService,
  BotEventBus,
  PositionExitingService,
} from './index';
import type { IndicatorCacheService } from './indicator-cache.service';
import type { IndicatorPreCalculationService } from './indicator-precalculation.service';
import type { LadderExitDetectorService } from './ladder-exit-detector.service';
import type { PositionEventHandler, WebSocketEventHandler } from './handlers';
import type { CompoundInterestCalculatorService } from './compound-interest-calculator.service';
import type { PublicWebSocketService } from './public-websocket.service';
import type { OrderbookManagerService } from './orderbook-manager.service';
import type { TradingOrchestrator } from './trading-orchestrator.service';
import type { BotMetricsService } from './bot-metrics.service';
import type { TimeframeProvider } from '../providers/timeframe.provider';
import type { CandleProvider } from '../providers/candle.provider';
import type { RetestEntryService } from './retest-entry.service';
import type { DeltaAnalyzerService } from './delta-analyzer.service';
import type { OrderbookImbalanceService } from './orderbook-imbalance.service';
import type { WallTrackerService } from './wall-tracker.service';
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
import type { ConsoleDashboardService } from './console-dashboard.service';
import type { RealityCheckService } from './reality-check.service';
import type { RealTimeRiskMonitor } from './real-time-risk-monitor.service';
import type { StrategyOrchestratorService } from './multi-strategy/strategy-orchestrator.service';
import type { ErrorHandler } from '../errors';
import type { MarketDataServices } from './containers/market-data-services';
import type { ExecutionServices } from './containers/execution-services';
import type { MonitoringServices } from './containers/monitoring-services';
import type { RiskServices } from './containers/risk-services';
import type { WebApiServices } from './containers/web-api-services';
import type { CoreServices } from './containers/core-services';
import type { EventHandlerServices } from './containers/event-handler-services';
import type { IPositionRepository, IJournalRepository, IMarketDataRepository } from '../repositories/IRepositories';
import type { ExchangeFactory } from './exchange-factory.service';
import { buildBotServices } from './bot-services.builder';

/**
 * Container for all bot services
 * Initialized in dependency order
 */
export class BotServices {
  // Core services
  readonly logger!: LoggerService;
  readonly errorHandler!: ErrorHandler; // Phase 8.8: Singleton ErrorHandler injected to all services
  readonly eventBus!: BotEventBus;
  readonly metrics!: BotMetricsService;
  readonly telegram!: TelegramService;
  readonly timeService!: TimeService;
  readonly bybitService!: IExchange;

  // Phase 6.2: Repository Pattern (Data Access Layer)
  readonly positionRepository!: IPositionRepository;
  readonly journalRepository!: IJournalRepository;
  readonly marketDataRepository!: IMarketDataRepository;

  // Data & Providers
  readonly timeframeProvider!: TimeframeProvider;
  readonly candleProvider!: CandleProvider;
  btcCandles1m: Candle[] = []; // BTC 1-minute candles for correlation analysis

  // Indicator Cache System (Phase 0.2 Integration)
  readonly indicatorCache!: IndicatorCacheService;
  readonly indicatorPreCalc!: IndicatorPreCalculationService;

  // Analysis & Orchestration
  readonly tradingOrchestrator!: TradingOrchestrator;
  readonly strategyOrchestrator?: StrategyOrchestratorService; // [Phase 10.2] Optional multi-strategy support

  // Tracking & Journal
  readonly journal!: TradingJournalService;
  readonly sessionStats!: SessionStatsService;
  readonly positionManager!: PositionLifecycleService;
  readonly positionExitingService!: PositionExitingService;
  readonly realityCheck!: RealityCheckService;

  // Phase 9: Live Trading Engine (Risk Monitoring)
  readonly realTimeRiskMonitor!: RealTimeRiskMonitor;

  // WebSocket & Data
  readonly webSocketManager!: WebSocketManagerService;
  readonly publicWebSocket!: PublicWebSocketService;
  readonly orderbookManager!: OrderbookManagerService;
  readonly positionMonitor!: PositionMonitorService;

  // Event Handlers
  readonly positionEventHandler!: PositionEventHandler;
  readonly webSocketEventHandler!: WebSocketEventHandler;

  // UI & Dashboard
  readonly dashboard!: ConsoleDashboardService;

  // Optional services
  readonly compoundInterestCalculator?: CompoundInterestCalculatorService;
  readonly retestEntryService?: RetestEntryService;
  readonly deltaAnalyzerService?: DeltaAnalyzerService;
  readonly orderbookImbalanceService?: OrderbookImbalanceService;
  readonly wallTrackerService?: WallTrackerService;
  readonly ladderExitDetector?: LadderExitDetectorService; // Phase 8.9.27: Ladder TP exit detection
  readonly advancedOrderFlowService?: AdvancedOrderFlowService; // Phase 10.1: Advanced order flow analysis
  readonly dynamicPositionSizer?: DynamicPositionSizerService; // Phase 11.1: Kelly Criterion position sizing
  readonly positionScalingService?: PositionScalingService; // Phase 11.2: Dynamic pyramiding
  readonly smartOrderExecution?: SmartOrderExecutionService; // Phase 13.1: Smart order execution
  readonly orderStateMachine?: AdvancedOrderStateMachineService; // Phase 13.2: Order state machine
  readonly metricsService?: IMonitoringMetricsReader; // Phase 14.1.1: Prometheus metrics
  readonly healthCheckService?: IMonitoringHealthReader; // Phase 14.1.2: Health checks
  readonly monitoringServer?: MonitoringServer; // Phase 14.1.3: HTTP monitoring endpoints
  readonly circuitBreaker?: CircuitBreakerService; // Phase 14.2.1: Circuit breaker pattern
  readonly rateLimiter?: RateLimiterService; // Phase 14.2.2: Adaptive rate limiting
  readonly retryPolicy?: RetryPolicyService; // Phase 14.2.3: Advanced retry strategies
  readonly bulkhead?: BulkheadService; // Phase 14.2.4: Resource isolation
  readonly resilienceCoordinator?: ResilienceCoordinator; // Phase 14.2.5: Unified resilience layer
  readonly marketDataServices!: MarketDataServices;
  readonly executionServices!: ExecutionServices;
  readonly monitoringServices!: MonitoringServices;
  readonly riskServices!: RiskServices;
  readonly webApiServices!: WebApiServices;
  readonly coreServices!: CoreServices;
  readonly eventHandlerServices!: EventHandlerServices;
  readonly exchangeFactory?: ExchangeFactory;

  constructor(config: Config) {
    const built = buildBotServices(config);
    Object.assign(this, built);
  }

  /**
   * Get all services as a collection
   * Useful for dependency injection
   */
  toObject() {
    return {
      logger: this.logger,
      bybitService: this.bybitService,
      coreServices: this.coreServices,
      marketDataServices: this.marketDataServices,
      executionServices: this.executionServices,
      monitoringServices: this.monitoringServices,
      riskServices: this.riskServices,
      webApiServices: this.webApiServices,
      eventHandlerServices: this.eventHandlerServices,
      strategyOrchestrator: this.strategyOrchestrator, // [Phase 10.2] Optional
      // Keep direct handlers only if external consumers still rely on them
      compoundInterestCalculator: this.compoundInterestCalculator,
      retestEntryService: this.retestEntryService,
      deltaAnalyzerService: this.deltaAnalyzerService,
      orderbookImbalanceService: this.orderbookImbalanceService,
      wallTrackerService: this.wallTrackerService,
      // Phase 14: Production Hardening
      circuitBreaker: this.circuitBreaker, // Phase 14.2.1
      rateLimiter: this.rateLimiter, // Phase 14.2.2
      retryPolicy: this.retryPolicy, // Phase 14.2.3
      bulkhead: this.bulkhead, // Phase 14.2.4
      resilienceCoordinator: this.resilienceCoordinator, // Phase 14.2.5
    };
  }
}






