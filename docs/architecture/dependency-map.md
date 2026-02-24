# BotServices Dependency Map

Scope: Immediate dependencies as wired in `src/services/bot-services.ts`. Optional services are marked `(optional)`.

| Service | Immediate Dependencies | Notes |
| --- | --- | --- |
| `ConsoleDashboardService` | `config.dashboard` | Enables console UI; toggles logger console output. |
| `LoggerService` | `config.logging` | Base logger for most services. |
| `ErrorHandler` | `LoggerService` | Singleton injected widely. |
| `BotEventBus` | `LoggerService` | Event emitter for bot‑wide events. |
| `BotMetricsService` | `LoggerService`, `ErrorHandler` | Internal metrics (not Prometheus). |
| `PositionMemoryRepository` | none | In‑memory position storage. |
| `JournalFileRepository` | `LoggerService` | File‑based journal repo. |
| `MarketDataCacheRepository` | none | Market data cache repo. |
| `TelegramService` | `config.telegram`, `LoggerService`, `ErrorHandler` | Notifications. |
| `TimeService` | `LoggerService`, `config.system` | Later: `setBybitService(IExchange)`. |
| `ExchangeFactory` | `LoggerService`, `config.exchange` | Builds exchange adapter by name. |
| `BybitService` | `config.exchange`, `LoggerService`, `MarketDataCacheRepository` | Raw Bybit client (legacy path). |
| `BybitServiceAdapter` | `BybitService`, `LoggerService` | IExchange adapter. |
| `TradingJournalService` | `LoggerService`, `config.tradeHistory`, `config.compoundInterest`, `JournalFileRepository`, `ErrorHandler` | Journal + virtual balance. |
| `SessionStatsService` | `LoggerService`, `JournalFileRepository`, `ErrorHandler` | Session stats tracking. |
| `RealityCheckService` | `LoggerService` | Broken assumption tracker. |
| `TimeframeProvider` | `config.timeframes` | Timeframe definitions. |
| `CandleProvider` | `TimeframeProvider`, `IExchange`, `LoggerService`, `config.exchange.symbol`, `MarketDataCacheRepository`, `ErrorHandler` | Candle storage + fetch. |
| `IndicatorCacheService` | `MarketDataCacheRepository` | TTL cache for indicators. |
| `IndicatorPreCalculationService` | `CandleProvider`, `IndicatorCacheService`, `CalculatorFactory`, `LoggerService` | Pre‑calc indicator cache. |
| `CompoundInterestCalculatorService` (optional) | `config.compoundInterest`, `LoggerService`, balance provider | Balance provider reads `TradingJournalService` or `IExchange`. |
| `RetestEntryService` (optional) | `config.retestEntry`, `LoggerService` | Retest entries. |
| `DeltaAnalyzerService` (optional) | `config.delta`, `LoggerService` | Tick delta analysis. |
| `OrderbookImbalanceService` (optional) | `config.orderbookImbalance`, `LoggerService` | Orderbook imbalance. |
| `WallTrackerService` (optional) | `config.wallTracking`, `LoggerService`, `ErrorHandler` | Wall tracking + spoofing. |
| `AdvancedOrderFlowService` (optional) | `config.advancedOrderFlow`, `config.orderFlowAnalysis`, `LoggerService`, `ErrorHandler` | Order flow analysis. |
| `DynamicPositionSizerService` (optional) | `config.dynamicPositionSizing`, `LoggerService`, `ErrorHandler` | Kelly sizing. |
| `PositionScalingService` (optional) | `config.positionScaling`, `LoggerService`, `ErrorHandler` | Pyramiding. |
| `SmartOrderExecutionService` (optional) | `config.smartOrderExecution`, `LoggerService`, `ErrorHandler` | Smart execution. |
| `AdvancedOrderStateMachineService` (optional) | `LoggerService`, `ErrorHandler` | Order lifecycle. |
| `PrometheusMetricsService` (optional) | `config.monitoring`, `LoggerService`, `ErrorHandler` | Prometheus metrics. |
| `LadderExitDetectorService` | `LoggerService`, `IExchange`, `ErrorHandler` | Ladder TP exit detection. |
| `RiskManager` | `riskManagerConfig`, `LoggerService`, `ErrorHandler` | Risk logic (config defined inline). |
| `PositionLifecycleService` | `IExchange`, `config.trading`, `config.riskManagement`, `TelegramService`, `LoggerService`, `TradingJournalService`, `config.entryConfirmation`, `config`, `BotEventBus`, `CompoundInterestCalculatorService?`, `SessionStatsService`, `PositionMemoryRepository`, `ErrorHandler`, `DynamicPositionSizerService?`, `PositionScalingService?` | Core position lifecycle. |
| `PositionExitingService` | `IExchange`, `TelegramService`, `LoggerService`, `TradingJournalService`, `config.trading`, `config.riskManagement`, `config`, `SessionStatsService`, `PositionLifecycleService`, `RealityCheckService` | Exit handling. |
| `RealTimeRiskMonitor` | `liveTrading.riskMonitoring`, `PositionLifecycleService`, `LoggerService`, `BotEventBus` | Live risk checks. |
| `OrderExecutionDetectorService` | `LoggerService` | WS helper. |
| `WebSocketAuthenticationService` | none | WS auth helper. |
| `EventDeduplicationService` | limits, `LoggerService`, `ErrorHandler` | WS event de‑dup. |
| `WebSocketKeepAliveService` | interval, `LoggerService` | WS keepalive. |
| `WebSocketManagerService` | `config.exchange`, `config.exchange.symbol`, `ErrorHandler`, `OrderExecutionDetectorService`, `WebSocketAuthenticationService`, `EventDeduplicationService`, `WebSocketKeepAliveService` | Private WS. |
| `PublicWebSocketService` | `config.exchange`, `config.exchange.symbol`, `TimeframeProvider`, `LoggerService`, `ErrorHandler`, `config.btcConfirmation` | Public WS. |
| `OrderbookManagerService` | `config.exchange.symbol`, `LoggerService`, `WallTrackerService?` | Orderbook snapshot. |
| `ExitTypeDetectorService` | `LoggerService` | Exit classification helper. |
| `PositionPnLCalculatorService` | none | PnL helper. |
| `PositionSyncService` | `IExchange`, `PositionLifecycleService`, `ExitTypeDetectorService`, `TelegramService`, `LoggerService`, `PositionExitingService` | Position sync. |
| `PositionMonitorService` | `IExchange`, `PositionLifecycleService`, `config.riskManagement`, `TelegramService`, `LoggerService`, `ExitTypeDetectorService`, `PositionPnLCalculatorService`, `PositionSyncService`, `PositionExitingService` | Position monitoring. |
| `TradingOrchestrator` | `orchestratorConfig`, `CandleProvider`, `TimeframeProvider`, `IExchange`, `PositionLifecycleService`, `TelegramService`, `LoggerService`, `RiskManager`, `PositionExitingService` | Core orchestration. |
| `StrategyRegistryService` (optional) | none | Multi‑strategy registry. |
| `StrategyOrchestratorService` (optional) | `StrategyRegistryService`, `StrategyFactoryService?`, `StrategyStateManagerService?`, `LoggerService`, `BotEventBus` | Multi‑strategy orchestration. |
| `PositionEventHandler` | `PositionLifecycleService`, `PositionExitingService`, `IExchange`, `TelegramService`, `LoggerService` | Position events. |
| `WebSocketEventHandler` | `PositionLifecycleService`, `PositionExitingService`, `IExchange`, `WebSocketManagerService`, `TradingJournalService`, `TelegramService`, `LoggerService` | WS events. |
| `HealthCheckService` (optional) | `IExchange`, `WebSocketManagerService`, `monitoring.thresholds`, `LoggerService`, `ErrorHandler` | Health checks. |
| `MonitoringServer` (optional) | `PrometheusMetricsService?`, `HealthCheckService?`, `monitoring.server`, `LoggerService`, `ErrorHandler` | Monitoring endpoints. |
| `CircuitBreakerService` (optional) | `resilience.circuitBreaker`, `LoggerService`, `ErrorHandler` | Resilience. |
| `RateLimiterService` (optional) | `resilience.rateLimiter`, `LoggerService`, `ErrorHandler` | Resilience. |
| `RetryPolicyService` (optional) | `resilience.retry`, `LoggerService`, `ErrorHandler` | Resilience. |
| `BulkheadService` (optional) | `resilience.bulkhead`, `LoggerService`, `ErrorHandler` | Resilience. |
| `ResilienceCoordinator` (optional) | `CircuitBreakerService?`, `RateLimiterService?`, `RetryPolicyService?`, `BulkheadService?`, `PrometheusMetricsService?`, `LoggerService`, `ErrorHandler` | Resilience coordinator. |

Notes:
- `StrategyFactoryService` and `StrategyStateManagerService` are referenced but not initialized (TODO in code).
- `TradingOrchestrator` and `PublicWebSocketService` both call `setBtcCandlesStore(this)` when BTC confirmation is enabled.
