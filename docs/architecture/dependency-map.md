# Dependency Map (BotServices)

Source: `src/services/bot-services.ts`

Flat list of services and immediate dependencies (constructor args + direct setter injections).

- ConsoleDashboardService: config.dashboard
- LoggerService: config.logging
- ErrorHandler: logger
- BotEventBus: logger
- BotMetricsService: logger, errorHandler
- PositionMemoryRepository: none
- JournalFileRepository: logger
- MarketDataCacheRepository: none
- TelegramService: config.telegram, logger, errorHandler
- TimeService: logger, config.system.timeSyncIntervalMs, config.system.timeSyncMaxFailures, bybitService (via `setBybitService`)
- ExchangeFactory: logger, config.exchange
- BybitService (raw): config.exchange, logger, marketDataRepository
- BybitServiceAdapter: rawBybitService, logger
- TradingJournalService: logger, config.tradeHistory, config.compoundInterest.baseDeposit, journalRepository, errorHandler
- SessionStatsService: logger, journalRepository, errorHandler
- RealityCheckService: logger
- TimeframeProvider: config.timeframes
- CandleProvider: timeframeProvider, bybitService, logger, config.exchange.symbol, marketDataRepository, errorHandler
- IndicatorCacheService: marketDataRepository
- IndicatorPreCalculationService: candleProvider, indicatorCache, calculators, logger
- CompoundInterestCalculatorService (optional): config.compoundInterest, logger, journal, bybitService (balance provider)
- RetestEntryService (optional): config.retestEntry, logger
- DeltaAnalyzerService (optional): config.delta, logger
- OrderbookImbalanceService (optional): config.orderbookImbalance, logger
- WallTrackerService (optional): config.wallTracking, logger, errorHandler
- AdvancedOrderFlowService (optional): config.advancedOrderFlow, config.orderFlowAnalysis, logger, errorHandler
- DynamicPositionSizerService (optional): config.dynamicPositionSizing, logger, errorHandler
- PositionScalingService (optional): config.positionScaling, logger, errorHandler
- SmartOrderExecutionService (optional): config.smartOrderExecution, logger, errorHandler
- AdvancedOrderStateMachineService (optional): logger, errorHandler
- PrometheusMetricsService (optional): config.monitoring.metrics, logger, errorHandler
- LadderExitDetectorService: logger, bybitService, errorHandler
- RiskManager: riskManagerConfig (local), logger, errorHandler
- PositionLifecycleService: bybitService, config.trading, config.riskManagement, telegram, logger, journal, config.entryConfirmation, config, eventBus, compoundInterestCalculator, sessionStats, positionRepository, errorHandler, dynamicPositionSizer, positionScalingService
- PositionExitingService: bybitService, telegram, logger, journal, config.trading, config.riskManagement, config, sessionStats, positionManager, realityCheck
- RealTimeRiskMonitor: riskMonitoringConfig (local), positionManager, logger, eventBus
- OrderExecutionDetectorService: logger
- WebSocketAuthenticationService: none
- EventDeduplicationService: capacity, ttlMs, logger, errorHandler
- WebSocketKeepAliveService: intervalMs, logger
- WebSocketManagerService: config.exchange, config.exchange.symbol, errorHandler, orderExecutionDetector, authService, deduplicationService, keepAliveService
- PublicWebSocketService: config.exchange, config.exchange.symbol, timeframeProvider, logger, errorHandler, config.btcConfirmation
- OrderbookManagerService: config.exchange.symbol, logger, wallTrackerService
- ExitTypeDetectorService: logger
- PositionPnLCalculatorService: none
- PositionSyncService: bybitService, positionManager, exitTypeDetectorService, telegram, logger, positionExitingService
- PositionMonitorService: bybitService, positionManager, config.riskManagement, telegram, logger, exitTypeDetectorService, pnlCalculatorService, positionSyncService, positionExitingService
- TradingOrchestrator: orchestratorConfig (local), candleProvider, timeframeProvider, bybitService, positionManager, telegram, logger, riskManager, positionExitingService
- TradingOrchestrator.setIndicatorPreCalculationService: indicatorPreCalc
- TradingOrchestrator.setBtcCandlesStore (optional): btcCandles store (BotServices)
- StrategyRegistryService: none
- StrategyOrchestratorService (optional): strategyRegistry, strategyFactory (null stub), strategyStateManager (null stub), logger, eventBus
- StrategyOrchestratorService.setSharedServices: candleProvider, timeframeProvider, positionManager, riskManager, telegram, positionExitingService
- PositionEventHandler: positionManager, positionExitingService, bybitService, telegram, logger
- WebSocketEventHandler: positionManager, positionExitingService, bybitService, webSocketManager, journal, telegram, logger
- PublicWebSocketService.setBtcCandlesStore (optional): btcCandles store (BotServices)
- HealthCheckService (optional): bybitService, webSocketManager, monitoring thresholds, logger, errorHandler
- MonitoringServer (optional): metricsService, healthCheckService, monitoring server config, logger, errorHandler
- CircuitBreakerService (optional): resilience.circuitBreaker config, logger, errorHandler
- RateLimiterService (optional): resilience.rateLimiter config, logger, errorHandler
- RetryPolicyService (optional): resilience.retry config, logger, errorHandler
- BulkheadService (optional): resilience.bulkhead config, logger, errorHandler
- ResilienceCoordinator (optional): circuitBreaker, rateLimiter, retryPolicy, bulkhead, metricsService, logger, errorHandler
- MarketDataServices (container): bybitService, timeframeProvider, candleProvider, orderbookManager, publicWebSocket, webSocketManager, indicatorCache, indicatorPreCalc
- ExecutionServices (container): positionManager, positionExitingService, tradingOrchestrator, realTimeRiskMonitor, positionMonitor, ladderExitDetector, dynamicPositionSizer, positionScalingService, smartOrderExecution, orderStateMachine
- MonitoringServices (container): metrics, metricsService, healthCheckService, monitoringServer, dashboard
- RiskServices (container): riskManager, realTimeRiskMonitor, realityCheck
- WebApiServices (container): marketDataServices (candleProvider, orderbookManager), journal, bybitService
- CoreServices (container): logger, eventBus, telegram, timeService
- EventHandlerServices (container): positionEventHandler, webSocketEventHandler

## Proposed First Migration Slice (Low Risk)
Focus: `WebApiServices` + `BotWebAPI` read-only endpoints.

Why low risk:
- Read-only usage of cached market data and journals (no order placement).
- Narrow dependencies: `marketDataServices` (candleProvider, orderbookManager, indicatorCache) + `journal` + `bybitService`.
- Already behind a web adapter boundary, so we can refactor wiring without touching trading runtime.

Scope proposal:
- Extract a dedicated `WebApiReadServices` interface from `WebApiServices`.
- Move construction to a small container module and inject into `BotWebAPI`.
- Avoid changes to runtime execution paths (no changes in trading or WebSocket loops).

## Proposed Next Migration Slice (Low Risk)
Focus: read-only monitoring adapters (`MonitoringServices` consumers).

Why low risk:
- Read-only access to metrics/health checks; no trading state mutations.
- Already isolated behind monitoring adapters and optional toggles.

Scope proposal:
- Introduce `MonitoringReadServices` interface (metrics/health/dashboard).
- Wire monitoring adapters (e.g., monitoring server bootstrap) to the narrowed interface.
- Keep lifecycle/startup behavior unchanged for now.
