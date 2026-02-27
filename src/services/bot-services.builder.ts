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
  IMonitoringMetricsRecorder,
} from '../interfaces';
import { LoggerService } from './logger.service';
import {
  BybitService,
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
import { BybitServiceAdapter } from './bybit/bybit-service.adapter';
import { ExchangeFactory } from './exchange-factory.service';
import { IndicatorCacheService } from './indicator-cache.service';
import { IndicatorPreCalculationService } from './indicator-precalculation.service';
import { CalculatorFactory } from '../factories/calculator.factory';
import { RiskManager } from './risk-manager.service';
import { OrderExecutionDetectorService } from './order-execution-detector.service';
import { WebSocketAuthenticationService } from './websocket-authentication.service';
import { EventDeduplicationService } from './event-deduplication.service';
import { WebSocketKeepAliveService } from './websocket-keep-alive.service';
import { ExitTypeDetectorService } from './exit-type-detector.service';
import { LadderExitDetectorService } from './ladder-exit-detector.service';
import { PositionPnLCalculatorService } from './position-pnl-calculator.service';
import { PositionSyncService } from './position-sync.service';
import { PositionEventHandler, WebSocketEventHandler } from './handlers';
import { CompoundInterestCalculatorService } from './compound-interest-calculator.service';
import { PublicWebSocketService } from './public-websocket.service';
import { OrderbookManagerService } from './orderbook-manager.service';
import { TradingOrchestrator } from './trading-orchestrator.service';
import { BotMetricsService } from './bot-metrics.service';
import { TimeframeProvider } from '../providers/timeframe.provider';
import { CandleProvider } from '../providers/candle.provider';
import { RetestEntryService } from './retest-entry.service';
import { DeltaAnalyzerService } from './delta-analyzer.service';
import { OrderbookImbalanceService } from './orderbook-imbalance.service';
import { WallTrackerService } from './wall-tracker.service';
import { AdvancedOrderFlowService } from './advanced-order-flow.service';
import { DynamicPositionSizerService, type SizingConfig } from './dynamic-position-sizer.service';
import { PositionScalingService, type ScalingConfig } from './position-scaling.service';
import { SmartOrderExecutionService, type SmartOrderConfig } from './smart-order-execution.service';
import { AdvancedOrderStateMachineService } from './advanced-order-state-machine.service';
import { PrometheusMetricsService } from './prometheus-metrics.service';
import { HealthCheckService } from './health-check.service';
import { MonitoringServer } from './monitoring-server.service';
import { CircuitBreakerService } from './resilience/circuit-breaker.service';
import { RateLimiterService } from './resilience/rate-limiter.service';
import { RetryPolicyService } from './resilience/retry-policy.service';
import { BulkheadService } from './resilience/bulkhead.service';
import { ResilienceCoordinator } from './resilience/resilience-coordinator.service';
import { ConsoleDashboardService } from './console-dashboard.service';
import { INTEGER_MULTIPLIERS } from '../constants';
import { RealityCheckService } from './reality-check.service';
import { RealTimeRiskMonitor } from './real-time-risk-monitor.service';
import type { LiveTradingConfig, RiskMonitoringConfig } from '../types/legacy';
import { StrategyOrchestratorService } from './multi-strategy/strategy-orchestrator.service';
import { StrategyRegistryService } from './multi-strategy/strategy-registry.service';
import { ErrorHandler } from '../errors';
import { MarketDataServices } from './containers/market-data-services';
import { ExecutionServices } from './containers/execution-services';
import { MonitoringServices } from './containers/monitoring-services';
import { RiskServices } from './containers/risk-services';
import { WebApiServices } from './containers/web-api-services';
import { CoreServices } from './containers/core-services';
import { EventHandlerServices } from './containers/event-handler-services';
import { createGroupedServices } from './containers/bot-services-grouped';

// Phase 6.2: Repository Pattern Integration
import { IPositionRepository, IJournalRepository, IMarketDataRepository } from '../repositories/IRepositories';
import { PositionMemoryRepository } from '../repositories/position.memory-repository';
import { JournalFileRepository } from '../repositories/journal.file-repository';
import { MarketDataCacheRepository } from '../repositories/market-data.cache-repository';

type DashboardConfig = {
  enabled?: boolean;
  updateInterval?: number;
  theme?: 'dark' | 'light';
};

type StrategyMeta = {
  strategy?: string;
  strategyFile?: string;
  notes?: string;
};

type AnalyzerConfig = {
  enabled?: boolean;
  name?: string;
  weight?: number;
  priority?: number;
};

type IndicatorConfigParams = {
  period?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  kPeriod?: number;
  dPeriod?: number;
  stdDev?: number;
};

type DynamicPositionSizingConfig = SizingConfig & { enabled?: boolean };
type PositionScalingConfig = ScalingConfig & { enabled?: boolean };
type SmartOrderExecutionConfig = SmartOrderConfig & { enabled?: boolean };

type OrderStateMachineConfig = {
  enabled?: boolean;
  [key: string]: unknown;
};

type MonitoringConfig = {
  metricsEnabled?: boolean;
  metricsPrefix?: string;
  collectInterval?: number;
  defaultLabels?: Record<string, string>;
  healthCheckEnabled?: boolean;
  thresholds?: {
    memoryUsagePercent?: number;
    cpuUsagePercent?: number;
    diskUsagePercent?: number;
  };
  serverEnabled?: boolean;
  port?: number;
  metricsPath?: string;
  healthPath?: string;
  cors?: boolean;
};

type ResilienceConfig = {
  enabled?: boolean;
  circuitBreaker?: Record<string, unknown>;
  rateLimiter?: Record<string, unknown>;
  retry?: Record<string, unknown>;
  bulkhead?: Record<string, unknown>;
};

type MultiStrategyConfig = {
  enabled?: boolean;
};

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

const initializeCoreInfrastructure = (state: BotServicesState, config: Config): void => {
  // 0. Initialize dashboard FIRST to capture early logs
  const dashboardConfig = (config as Partial<{ dashboard: DashboardConfig }>).dashboard || {};
  const dashboardEnabled = dashboardConfig.enabled === true;

  const dashboardTheme: 'dark' | 'light' = dashboardConfig.theme === 'light' ? 'light' : 'dark';
  state.dashboard = new ConsoleDashboardService({
    enabled: dashboardEnabled,
    updateInterval: dashboardConfig.updateInterval || 1000,
    theme: dashboardTheme,
  });
  if (dashboardEnabled) {
    console.log('🎨 Console Dashboard ENABLED');
  }

  // 1. Initialize logger
  state.logger = new LoggerService(
    config.logging.level,
    config.logging.logDir,
    true,
  );

  const logFilePath = state.logger.getLogFilePath();
  if (logFilePath) {
    state.logger.info('📝 Log file', { path: logFilePath });
  }

  // Log loaded strategy file
  const meta = (config as Partial<{ meta: StrategyMeta }>).meta;
  if (meta?.strategy) {
    const strategyFile = meta.strategyFile || `strategies/json/${meta.strategy}.strategy.json`;
    state.logger.info('📋 Strategy loaded', {
      strategy: meta.strategy,
      file: strategyFile,
      notes: meta.notes,
    });
  }

  // CRITICAL: Disable console output when dashboard is enabled
  if (dashboardEnabled) {
    state.logger.setConsoleOutputEnabled(false);
    state.logger.info('📊 Console output disabled - logs to file only (dashboard mode active)');
  }

  // Log strategy analyzer information
  const analyzerList = Array.isArray(config.analyzers)
    ? (config.analyzers as AnalyzerConfig[])
    : [];
  if (analyzerList.length > 0) {
    const enabledAnalyzers = analyzerList.filter((a) => a.enabled);
    state.logger.info(`📊 Strategy Analyzers loaded: ${enabledAnalyzers.length}/${analyzerList.length} enabled`, {
      enabled: enabledAnalyzers.length,
      disabled: analyzerList.length - enabledAnalyzers.length,
      total: analyzerList.length,
    });

    const byWeight = enabledAnalyzers.reduce(
      (acc: Record<string, string[]>, a) => {
        const weightValue = a.weight ?? 0;
        const key = `${(weightValue * 100).toFixed(1)}%`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(a.name ?? 'unknown');
        return acc;
      },
      {} as Record<string, string[]>,
    );

    Object.entries(byWeight)
      .sort(([w1], [w2]) => parseFloat(w2) - parseFloat(w1))
      .forEach(([weight, names]) => {
        const nameList = names as string[];
        state.logger.info(`   ${weight}: ${nameList.length} analyzers`);
      });

    const topAnalyzers = [...enabledAnalyzers]
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
      .slice(0, 5);
    if (topAnalyzers.length > 0) {
      state.logger.info('   Top 5 analyzers:');
      topAnalyzers.forEach((a) => {
        const weight = a.weight ?? 0;
        const name = a.name ?? 'unknown';
        state.logger.info(`     • ${name}: ${(weight * 100).toFixed(2)}% weight, priority=${a.priority ?? 0}`);
      });
    }
  }

  // Log indicator configuration
  if (config.indicators) {
    const indicatorNames = Object.keys(config.indicators);
    state.logger.info(`📈 Indicators configured: ${indicatorNames.length}`, {
      indicators: indicatorNames.join(', '),
    });

    Object.entries(config.indicators).forEach(([name, cfg]) => {
      const details: string[] = [];
      const indCfg = cfg as IndicatorConfigParams;
      if (indCfg.period) details.push(`period=${indCfg.period}`);
      if (indCfg.fastPeriod) details.push(`fast=${indCfg.fastPeriod}, slow=${indCfg.slowPeriod}`);
      if (indCfg.kPeriod) details.push(`k=${indCfg.kPeriod}, d=${indCfg.dPeriod}`);
      if (indCfg.stdDev) details.push(`stdDev=${indCfg.stdDev}`);
      if (details.length > 0) {
        state.logger.info(`   ${name}: ${details.join(', ')}`);
      }
    });
  }

  // 1.5 Initialize ErrorHandler
  state.errorHandler = new ErrorHandler(state.logger);
  state.logger.info('⚡ ErrorHandler initialized (singleton instance)');

  // 1.6 Initialize event bus
  state.eventBus = new BotEventBus(state.logger);

  // 1.7 Initialize metrics service
  state.metrics = new BotMetricsService(state.logger, state.errorHandler);

  // 1.8 Initialize repositories
  state.positionRepository = new PositionMemoryRepository();
  state.journalRepository = new JournalFileRepository(state.logger);
  state.marketDataRepository = new MarketDataCacheRepository();
  state.logger.info('📦 Repositories initialized', {
    position: 'PositionMemoryRepository',
    journal: 'JournalFileRepository',
    marketData: 'MarketDataCacheRepository',
  });
};

const initializeOptionalServices = (
  state: BotServicesState,
  config: Config,
  monitoring?: MonitoringConfig,
): void => {
  if (config.compoundInterest && config.compoundInterest.enabled) {
    state.compoundInterestCalculator = new CompoundInterestCalculatorService(
      config.compoundInterest,
      state.logger,
      async () => {
        if (config.compoundInterest?.useVirtualBalance) {
          return state.journal.getVirtualBalance();
        }
        const balance = await state.bybitService.getBalance();
        return balance.walletBalance;
      },
    );
  }

  if (config.retestEntry?.enabled) {
    state.retestEntryService = new RetestEntryService(
      config.retestEntry,
      state.logger,
    );
  }

  if (config.delta?.enabled) {
    state.deltaAnalyzerService = new DeltaAnalyzerService(
      config.delta,
      state.logger,
    );
    state.logger.info('✅ Delta Analyzer initialized', {
      windowMs: config.delta.windowSizeMs,
      threshold: config.delta.minDeltaThreshold,
    });
  }

  if (config.orderbookImbalance?.enabled) {
    state.orderbookImbalanceService = new OrderbookImbalanceService(
      config.orderbookImbalance,
      state.logger,
    );
    state.logger.info('✅ Orderbook Imbalance initialized', {
      minImbalance: config.orderbookImbalance.minImbalancePercent + '%',
      levels: config.orderbookImbalance.levels,
    });
  }

  if (config.wallTracking?.enabled) {
    state.wallTrackerService = new WallTrackerService(
      config.wallTracking,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Wall Tracker initialized (PHASE 4)', {
      minLifetime: config.wallTracking.minLifetimeMs + 'ms',
      spoofingThreshold: config.wallTracking.spoofingThresholdMs + 'ms',
      trackHistory: config.wallTracking.trackHistoryCount,
    });
  }

  if (config.advancedOrderFlow?.enabled) {
    state.advancedOrderFlowService = new AdvancedOrderFlowService(
      config.advancedOrderFlow,
      config.orderFlowAnalysis,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Advanced Order Flow Service initialized (Phase 10.1)', {
      tickWindowMs: config.advancedOrderFlow.tickWindowMs,
      enableSpoofing: config.advancedOrderFlow.enableSpoofingDetection,
      enableMomentum: config.advancedOrderFlow.enableMomentum,
    });
  }

  const dynamicPositionSizing = (config as Partial<{ dynamicPositionSizing: DynamicPositionSizingConfig }>).dynamicPositionSizing;
  if (dynamicPositionSizing?.enabled) {
    state.dynamicPositionSizer = new DynamicPositionSizerService(
      dynamicPositionSizing,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Dynamic Position Sizer initialized (Phase 11.1)', {
      baseRiskPercent: dynamicPositionSizing.baseRiskPercent,
      maxRiskPercent: dynamicPositionSizing.maxRiskPercent,
      volatilityMultiplier: dynamicPositionSizing.volatilityMultiplier,
    });
  }

  const positionScaling = (config as Partial<{ positionScaling: PositionScalingConfig }>).positionScaling;
  if (positionScaling?.enabled) {
    state.positionScalingService = new PositionScalingService(
      positionScaling,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Position Scaling Service initialized (Phase 11.2)', {
      scaleInThreshold: positionScaling.scaleInThreshold,
      maxScales: positionScaling.maxScales,
      scaleReduction: positionScaling.scaleReduction,
    });
  }

  const smartOrderExecution = (config as Partial<{ smartOrderExecution: SmartOrderExecutionConfig }>).smartOrderExecution;
  if (smartOrderExecution?.enabled) {
    state.smartOrderExecution = new SmartOrderExecutionService(
      smartOrderExecution,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Smart Order Execution initialized (Phase 13.1)', {
      maxSlippagePercent: smartOrderExecution.maxSlippagePercent,
      executionStrategy: smartOrderExecution.executionStrategy,
      adaptiveExecution: smartOrderExecution.adaptiveExecution,
    });
  }

  const orderStateMachine = (config as Partial<{ orderStateMachine: OrderStateMachineConfig }>).orderStateMachine;
  if (orderStateMachine?.enabled) {
    state.orderStateMachine = new AdvancedOrderStateMachineService(
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Order State Machine initialized (Phase 13.2)', {
      hasErrorHandler: !!state.errorHandler,
    });
  }

  if (monitoring?.metricsEnabled) {
    state.metricsService = new PrometheusMetricsService(
      {
        enabled: true,
        prefix: monitoring.metricsPrefix || 'trading_bot_',
        collectInterval: monitoring.collectInterval || 10000,
        defaultLabels: monitoring.defaultLabels,
      },
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Prometheus Metrics initialized (Phase 14.1.1)', {
      prefix: monitoring.metricsPrefix || 'trading_bot_',
      collectInterval: monitoring.collectInterval || 10000,
    });
  }

  state.ladderExitDetector = new LadderExitDetectorService(
    state.logger,
    state.bybitService,
    state.errorHandler,
  );
  state.logger.debug('✅ Ladder Exit Detector initialized (Phase 8.9.27)', {
    hasErrorHandler: !!state.errorHandler,
  });
};

const initializeMonitoringAndResilience = (
  state: BotServicesState,
  config: Config,
  monitoring?: MonitoringConfig,
): void => {
  if (monitoring?.healthCheckEnabled) {
    state.healthCheckService = new HealthCheckService(
      state.bybitService,
      state.webSocketManager,
      {
        enabled: true,
        thresholds: {
          memoryUsagePercent: monitoring?.thresholds?.memoryUsagePercent || 90,
          cpuUsagePercent: monitoring?.thresholds?.cpuUsagePercent || 80,
          diskUsagePercent: monitoring?.thresholds?.diskUsagePercent || 90,
        },
      },
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Health Check Service initialized (Phase 14.1.2)', {
      memoryThreshold: monitoring?.thresholds?.memoryUsagePercent || 90,
      cpuThreshold: monitoring?.thresholds?.cpuUsagePercent || 80,
    });
  }

  if (monitoring?.serverEnabled && (state.metricsService || state.healthCheckService)) {
    state.monitoringServer = new MonitoringServer(
      state.metricsService,
      state.healthCheckService,
      {
        enabled: true,
        port: monitoring?.port || 9090,
        metricsPath: monitoring?.metricsPath || '/metrics',
        healthPath: monitoring?.healthPath || '/health',
        cors: monitoring?.cors ?? true,
      },
      state.logger,
      state.errorHandler,
    );

    state.logger.info('✅ Monitoring Server initialized (Phase 14.1.3)', {
      port: monitoring?.port || 9090,
      metricsPath: monitoring?.metricsPath || '/metrics',
      healthPath: monitoring?.healthPath || '/health',
    });
  }

  const resilience = (config as Partial<{ resilience: ResilienceConfig }>).resilience;
  if (resilience?.enabled) {
    const isMetricsRecorder = (value: unknown): value is IMonitoringMetricsRecorder => {
      if (typeof value !== 'object' || value === null) {
        return false;
      }
      const candidate = value as { recordOrderLatency?: unknown };
      return typeof candidate.recordOrderLatency === 'function';
    };
    const metricsRecorder = isMetricsRecorder(state.metricsService)
      ? state.metricsService
      : undefined;

    state.circuitBreaker = new CircuitBreakerService(
      resilience.circuitBreaker || {
        failureThreshold: 5,
        failureRateThreshold: 0.5,
        successThreshold: 2,
        timeout: 60000,
        volumeThreshold: 10,
      },
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Circuit Breaker initialized (Phase 14.2.1)', {
      failureThreshold: (resilience.circuitBreaker as { failureThreshold?: number } | undefined)?.failureThreshold || 5,
      timeout: (resilience.circuitBreaker as { timeout?: number } | undefined)?.timeout || 60000,
    });

    state.rateLimiter = new RateLimiterService(
      resilience.rateLimiter || {
        bybit: {
          maxRequests: 10,
          windowMs: 1000,
          burstSize: 15,
          queueSize: 50,
        },
      },
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Rate Limiter initialized (Phase 14.2.2)', {
      configs: Object.keys(resilience.rateLimiter || { bybit: {} }),
    });

    state.retryPolicy = new RetryPolicyService(
      resilience.retry || {
        maxAttempts: 3,
        baseDelayMs: 100,
        maxDelayMs: 5000,
        exponentialBase: 2,
        jitterEnabled: true,
        retryBudgetPercent: 10,
      },
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Retry Policy initialized (Phase 14.2.3)', {
      maxAttempts: (resilience.retry as { maxAttempts?: number } | undefined)?.maxAttempts || 3,
      retryBudget: `${(resilience.retry as { retryBudgetPercent?: number } | undefined)?.retryBudgetPercent || 10}%`,
    });

    state.bulkhead = new BulkheadService(
      resilience.bulkhead || {
        trading: {
          maxConcurrent: 10,
          queueSize: 20,
          timeoutMs: 5000,
        },
      },
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Bulkhead initialized (Phase 14.2.4)', {
      pools: Object.keys(resilience.bulkhead || { trading: {} }),
    });

    state.resilienceCoordinator = new ResilienceCoordinator(
      state.circuitBreaker,
      state.rateLimiter,
      state.retryPolicy,
      state.bulkhead,
      metricsRecorder,
      state.logger,
      state.errorHandler,
    );
    state.logger.info('✅ Resilience Coordinator initialized (Phase 14.2.5)', {
      patterns: ['circuitBreaker', 'rateLimiter', 'retryPolicy', 'bulkhead'],
      hasMetrics: !!state.metricsService,
    });
  }
};

const initializeWebSocketAndMonitoring = (state: BotServicesState, config: Config): void => {
  const orderExecutionDetector = new OrderExecutionDetectorService(state.logger);
  const authService = new WebSocketAuthenticationService();
  const deduplicationService = new EventDeduplicationService(
    100,
    60000,
    state.logger,
    state.errorHandler,
  );
  const keepAliveService = new WebSocketKeepAliveService(20000, state.logger);
  state.webSocketManager = new WebSocketManagerService(
    config.exchange,
    config.exchange.symbol,
    state.errorHandler,
    orderExecutionDetector,
    authService,
    deduplicationService,
    keepAliveService,
  );

  state.publicWebSocket = new PublicWebSocketService(
    config.exchange,
    config.exchange.symbol,
    state.timeframeProvider,
    state.logger,
    state.errorHandler,
    config.btcConfirmation,
  );

  state.orderbookManager = new OrderbookManagerService(
    config.exchange.symbol,
    state.logger,
    state.wallTrackerService,
  );

  const exitTypeDetectorService = new ExitTypeDetectorService(state.logger);
  const pnlCalculatorService = new PositionPnLCalculatorService();
  const positionSyncService = new PositionSyncService(
    state.bybitService,
    state.positionManager,
    exitTypeDetectorService,
    state.telegram,
    state.logger,
    state.positionExitingService,
  );

  state.positionMonitor = new PositionMonitorService(
    state.bybitService,
    state.positionManager,
    config.riskManagement,
    state.telegram,
    state.logger,
    exitTypeDetectorService,
    pnlCalculatorService,
    positionSyncService,
    state.positionExitingService,
  );
};

const initializePositionManagement = (state: BotServicesState, config: Config): void => {
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

  const liveTradingConfig = (config as Partial<{ liveTrading: LiveTradingConfig }>).liveTrading;
  const riskMonitoringConfig: RiskMonitoringConfig = {
    enabled: true,
    checkIntervalCandles: 5,
    healthScoreThreshold: 30,
    emergencyCloseOnCritical: true,
    ...(liveTradingConfig?.riskMonitoring ?? {}),
  };

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
    configSource: liveTradingConfig ? 'config.liveTrading.riskMonitoring' : 'defaults',
  });
};

const initializeOrchestratorAndHandlers = (
  state: BotServicesState,
  riskManager: RiskManager,
  config: Config,
): void => {
  const orchestratorConfig = {
    contextConfig: {
      atrPeriod: config.indicators.atrPeriod,
      emaPeriod: config.indicators.slowEmaPeriod,
      zigzagDepth: config.indicators.zigzagDepth,
      minimumATR: config.atrFilter?.minimumATR || 0.01,
      maximumATR: config.atrFilter?.maximumATR || 100,
      maxEmaDistance: config.strategy?.emaDistanceThreshold || 0.5,
      filteringMode: (config.strategy?.contextFilteringMode) || 'HARD_BLOCK',
      atrFilterEnabled: config.atrFilter?.enabled === true,
    },
    entryConfig: {
      rsiPeriod: config.indicators.rsiPeriod,
      fastEmaPeriod: config.indicators.fastEmaPeriod,
      slowEmaPeriod: config.indicators.slowEmaPeriod,
      zigzagDepth: config.indicators.zigzagDepth,
      rsiOversold: config.indicators.rsiOversold,
      rsiOverbought: config.indicators.rsiOverbought,
      stopLossPercent: config.riskManagement.stopLossPercent,
      takeProfits: config.riskManagement.takeProfits,
      priceAction: config?.strategy?.priceAction,
      divergenceDetector: config.entryConfig.divergenceDetector,
    },
    strategiesConfig: config.strategies,
    positionSizeUsdt: config.riskManagement.positionSizeUsdt,
    leverage: config.trading.leverage,
    btcConfirmation: config?.btcConfirmation,
    system: config.system,
    strategicWeights: config.strategicWeights,
    trendConfirmation: config.trendConfirmation,
    analysisConfig: config.analysisConfig,
    volatilityRegime: config.volatilityRegime,
    riskManagement: config.riskManagement,
    indicators: config.indicators,
    analyzers: config.analyzers,
    analyzerDefaults: (config as Partial<{ analyzerDefaults: Record<string, unknown> }>).analyzerDefaults,
  };

  state.logger.info('🔬 OrchestratorConfig prepared', {
    hasBtcConfirmation: !!orchestratorConfig.btcConfirmation,
    btcEnabled: orchestratorConfig.btcConfirmation?.enabled,
  });

  state.tradingOrchestrator = new TradingOrchestrator(
    orchestratorConfig,
    state.candleProvider,
    state.timeframeProvider,
    state.bybitService,
    state.positionManager,
    state.telegram,
    state.logger,
    riskManager,
    state.positionExitingService,
  );

  state.tradingOrchestrator.setIndicatorPreCalculationService(state.indicatorPreCalc);
  state.logger.info('🔬 Pre-calculation service linked to TradingOrchestrator');

  if (config.btcConfirmation?.enabled) {
    state.tradingOrchestrator.setBtcCandlesStore(state);
    state.logger.info('🔬 BTC candles store linked to TradingOrchestrator');
  }

  const multiStrategyMode = (config as Partial<{ multiStrategy: MultiStrategyConfig }>).multiStrategy?.enabled || false;
  if (multiStrategyMode) {
    try {
      const strategyRegistry = new StrategyRegistryService();
      state.logger.warn('⚠️ StrategyOrchestratorService not initialized: missing factory/state manager');
      state.strategyOrchestrator = undefined;
    } catch (error) {
      state.logger.warn('⚠️  Failed to initialize StrategyOrchestratorService', {
        error: error instanceof Error ? error.message : String(error),
        fallbackMode: 'single-strategy',
      });
    }
  }

  state.positionEventHandler = new PositionEventHandler(
    state.positionManager,
    state.positionExitingService,
    state.bybitService,
    state.telegram,
    state.logger,
  );

  state.webSocketEventHandler = new WebSocketEventHandler(
    state.positionManager,
    state.positionExitingService,
    state.bybitService,
    state.webSocketManager,
    state.journal,
    state.telegram,
    state.logger,
  );

  if (config.btcConfirmation?.enabled) {
    state.publicWebSocket.setBtcCandlesStore(state);
    state.logger.info('🔬 BTC candles store linked to PublicWebSocket');
  }
};

const initializeGroupedServices = (
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
