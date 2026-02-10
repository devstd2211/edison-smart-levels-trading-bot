# Edison Trading Bot - Component Index

**Version:** 1.0
**Last Updated:** 2026-02-10
**Total Components:** 95+ services, 3 orchestrators, 4 repositories, 2 providers

---

## 📋 Quick Navigation

- [Core Trading Engine](#core-trading-engine) - Main trading logic
- [Market Analysis](#market-analysis-phase-10) - Real-time market analysis (Phase 10)
- [Position Management](#position-management-phase-11) - Dynamic position sizing (Phase 11)
- [Order Management](#order-management-phase-13) - Advanced order execution (Phase 13)
- [Monitoring & Observability](#monitoring--observability-phase-141) - Metrics & health checks (Phase 14.1)
- [Resilience Patterns](#resilience-patterns-phase-142) - Circuit breakers & rate limiting (Phase 14.2)
- [Risk Management](#risk-management) - Risk calculation & monitoring
- [Data Access Layer](#data-access-layer-phase-6) - Repository pattern (Phase 6)
- [Error Handling](#error-handling-phase-7-8) - Error recovery system (Phase 7-8)
- [Infrastructure](#infrastructure-services) - Supporting services
- [Utilities](#utility-services) - Helper services

---

## Core Trading Engine

### 🎯 TradingOrchestrator
**File:** `src/services/trading-orchestrator.service.ts`
**Phase:** 1
**Responsibility:** Main trading loop coordinator
- Orchestrates signal processing and position management
- Coordinates strategy execution across timeframes
- Manages entry/exit decisions
- Uses SKIP recovery for non-critical failures

### 🔄 PositionLifecycleService
**File:** `src/services/position-lifecycle.service.ts`
**Phase:** 8.9.17
**Responsibility:** Complete position lifecycle management
- Opens new positions with risk validation
- Coordinates position state transitions
- Integrates with journal and monitoring
- ErrorHandler with RETRY/GRACEFUL_DEGRADE/SKIP strategies

### 🚪 PositionExitingService
**File:** `src/services/position-exiting.service.ts`
**Phase:** 8.2
**Responsibility:** Position exit execution
- Atomic lock pattern (prevents concurrent closes)
- Handles TP/SL order placement
- Transactional journal recording
- ErrorHandler with RETRY/FALLBACK/SKIP strategies

### 📊 PositionMonitorService
**File:** `src/services/position-monitor.service.ts`
**Phase:** 1
**Responsibility:** Active position monitoring
- Tracks open positions
- Monitors TP/SL levels
- Detects position state changes
- Real-time PnL tracking

### 🔐 PositionStateMachineService
**File:** `src/services/position-state-machine.service.ts`
**Phase:** 8.9.28
**Responsibility:** Position state management
- State transition validation (PENDING → OPEN → CLOSING → CLOSED)
- State history tracking
- Prevents invalid state changes
- Thread-safe state operations

### 🔄 PositionSyncService
**File:** `src/services/position-sync.service.ts`
**Phase:** 8.9.21
**Responsibility:** Position synchronization with exchange
- Syncs local positions with exchange state
- Detects position discrepancies
- Handles orphaned positions
- ErrorHandler with RETRY/GRACEFUL_DEGRADE strategies

---

## Market Analysis (Phase 10)

### 📈 AdvancedOrderFlowService
**File:** `src/services/advanced-order-flow.service.ts`
**Phase:** 10.1.1
**Tests:** 44
**Responsibility:** Real-time tick-level order flow analysis
- Buy/sell imbalance calculation (rolling window)
- Spoofing detection (fake wall identification)
- Momentum calculation (OFI - Order Flow Imbalance)
- Trade classification (aggressor detection)
- Performance: <5ms per tick

### 🔥 LiquidityHeatmapService
**File:** `src/services/liquidity-heatmap.service.ts`
**Phase:** 10.1.2
**Tests:** 43
**Responsibility:** Liquidity distribution analysis
- Support/resistance level detection (volume clustering)
- Slippage estimation for orders
- Execution cost calculation
- Liquidity gap identification
- Performance: <100ms for full orderbook scan

### 🎯 SmartOrderPlacementService
**File:** `src/services/smart-order-placement.service.ts`
**Phase:** 10.1.3
**Tests:** 33
**Responsibility:** Intelligent order placement optimization
- Optimal order splitting (minimize market impact)
- Fill probability estimation
- Adaptive execution strategies (aggressive/passive/balanced)
- Dynamic order adjustment based on liquidity
- Works with AdvancedOrderFlowService and LiquidityHeatmapService

### 🧠 MLSignalValidatorService
**File:** `src/services/ml-signal-validator.service.ts`
**Phase:** 10.2.1
**Tests:** 45
**Responsibility:** Machine learning-based signal validation
- Historical win rate tracking (per signal type)
- Market regime detection (trending/ranging/volatile)
- Confidence scoring (0-1 scale)
- Feature extraction for ML models
- Adaptive thresholds based on regime

### 📊 PatternRecognitionService
**File:** `src/services/pattern-recognition.service.ts`
**Phase:** 10.2.2
**Tests:** 40
**Responsibility:** Technical pattern detection
- 15+ candlestick patterns (doji, engulfing, hammer, etc.)
- Fibonacci level calculation (retracement/extension)
- Support/resistance zones (volume profile-based)
- Supply/demand zones (price action-based)
- Pattern strength scoring

### ⚠️ AnomalyDetectionService
**File:** `src/services/anomaly-detection.service.ts`
**Phase:** 10.2.3
**Tests:** 35
**Responsibility:** Market anomaly detection
- Volume spike detection (z-score based)
- Volatility spike detection (ATR deviation)
- Price manipulation flags (pump/dump patterns)
- Whale activity detection (large order clustering)
- Anomaly severity scoring (low/medium/high)

---

## Position Management (Phase 11)

### 💰 DynamicPositionSizerService
**File:** `src/services/dynamic-position-sizer.service.ts`
**Phase:** 11.1
**Tests:** 47
**Responsibility:** Intelligent position sizing
- Kelly Criterion-based sizing (optimal capital allocation)
- Volatility adjustment (ATR-based)
- Confidence-weighted sizing (signal quality)
- Account risk limits (max risk per trade)
- Dynamic position sizing based on market conditions

### 📈 PositionScalingService
**File:** `src/services/position-scaling.service.ts`
**Phase:** 11.2
**Tests:** 35
**Responsibility:** Position scaling logic
- Scale into winning positions (pyramiding)
- Move stop-loss to breakeven
- Dynamic scale size calculation (0.5x, 0.25x, 0.125x...)
- Maximum 3 scales per position
- Scale validation (price movement, profit threshold)

---

## Order Management (Phase 13)

### 🎯 SmartOrderExecutionService
**File:** `src/services/smart-order-execution.service.ts`
**Phase:** 13.1
**Tests:** 45
**Responsibility:** Advanced order execution strategies
- Adaptive execution (minimize slippage)
- Order splitting (minimize market impact)
- TWAP execution (Time-Weighted Average Price)
- VWAP execution (Volume-Weighted Average Price)
- Market impact estimation (square-root model)
- Partial fill handling (continue/cancel logic)

### 🔄 AdvancedOrderStateMachineService
**File:** `src/services/advanced-order-state-machine.service.ts`
**Phase:** 13.2
**Tests:** 40
**Responsibility:** Order state lifecycle management
- State validation (PENDING → SUBMITTED → PARTIAL → FILLED/CANCELLED/REJECTED)
- Automatic timeout handling
- Complete state history tracking
- Concurrent safety with locks
- Rollback support on errors
- Event emission on state changes

### 📋 OrderExecutionPipelineService
**File:** `src/services/order-execution-pipeline.service.ts`
**Phase:** 8.3
**Responsibility:** Order execution pipeline
- Coordinates order placement
- Handles order retries (exponential backoff)
- ErrorHandler with RETRY strategy
- Order validation before execution

### 🔍 OrderExecutionDetectorService
**File:** `src/services/order-execution-detector.service.ts`
**Phase:** 8.9.34
**Responsibility:** Order fill detection
- Detects order fills from WebSocket updates
- Tracks partial fills
- Updates position state on fills
- ErrorHandler with SKIP strategy

---

## Monitoring & Observability (Phase 14.1)

### 📊 PrometheusMetricsService
**File:** `src/services/prometheus-metrics.service.ts`
**Phase:** 14.1.1
**Tests:** 34
**Responsibility:** Prometheus-compatible metrics collection
- Counters (trades, errors, events)
- Gauges (positions, balance, PnL)
- Histograms (latency, duration)
- Summaries (quantiles)
- Custom labels for filtering
- Metrics export in Prometheus format

### ✅ HealthCheckService
**File:** `src/services/health-check.service.ts`
**Phase:** 14.1.2
**Tests:** 24
**Responsibility:** System health monitoring
- Service health checks (exchange, WebSocket, DB)
- Dependency health aggregation
- Health status (healthy/degraded/unhealthy)
- Detailed health reports
- Configurable check intervals
- Graceful degradation support

### 🌐 MonitoringServer
**File:** `src/services/monitoring-server.service.ts`
**Phase:** 14.1.3
**Tests:** 10
**Responsibility:** HTTP server for metrics & health endpoints
- `/metrics` - Prometheus metrics endpoint
- `/health` - Health check endpoint
- `/health/live` - Liveness probe
- `/health/ready` - Readiness probe
- Express.js-based server
- Graceful shutdown support

---

## Resilience Patterns (Phase 14.2)

### 🔌 CircuitBreakerService
**File:** `src/services/resilience/circuit-breaker.service.ts`
**Phase:** 14.2.1
**Tests:** 27
**Responsibility:** Circuit breaker pattern implementation
- 3 states: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing)
- Failure threshold (5 failures → OPEN)
- Success threshold (2 successes → CLOSED)
- Timeout (30s before HALF_OPEN)
- Automatic recovery testing
- Fail-fast when circuit is OPEN

### ⏱️ RateLimiterService
**File:** `src/services/resilience/rate-limiter.service.ts`
**Phase:** 14.2.2
**Tests:** 25
**Responsibility:** Rate limiting (token bucket algorithm)
- Configurable rate limits (requests per second)
- Token bucket with refill
- Non-blocking rate checks
- Multiple rate limit configs
- Automatic token refill
- Burst support

### 🔄 RetryPolicyService
**File:** `src/services/resilience/retry-policy.service.ts`
**Phase:** 14.2.3
**Tests:** 25
**Responsibility:** Retry logic with exponential backoff
- Configurable max attempts (3 default)
- Exponential backoff (100ms → 200ms → 400ms)
- Jitter support (prevent thundering herd)
- Retry budget (rate limiting for retries)
- Custom retry conditions
- Timeout support

### 🏊 BulkheadService
**File:** `src/services/resilience/bulkhead.service.ts`
**Phase:** 14.2.4
**Tests:** 16
**Responsibility:** Bulkhead pattern (resource isolation)
- Concurrent operation limiting
- Queue support (max queue size)
- Timeout support (max wait time)
- Fair queue processing (FIFO)
- Resource isolation (prevent cascading failures)
- Saturation detection

### 🎛️ ResilienceCoordinator
**File:** `src/services/resilience/resilience-coordinator.service.ts`
**Phase:** 14.2.5
**Tests:** 24
**Responsibility:** Unified resilience API
- Combines all 4 resilience patterns (CB, RL, BH, Retry)
- Layered execution: Circuit Breaker → Rate Limiter → Bulkhead → Retry → Operation
- Two modes: `execute()` (returns result) and `executeOrThrow()` (throws on error)
- Metadata tracking (duration, attempts, patterns used)
- Statistics aggregation from all patterns
- Health checks (circuit state, retry budget, bulkhead saturation)
- Lifecycle management (reset, stop)

---

## Risk Management

### ⚠️ RiskManager
**File:** `src/services/risk-manager.service.ts`
**Phase:** 1
**Responsibility:** Risk calculation and validation
- Position size validation
- Leverage limit enforcement
- Max drawdown monitoring
- Risk per trade calculation
- Account exposure tracking

### 🔍 RealTimeRiskMonitor
**File:** `src/services/real-time-risk-monitor.service.ts`
**Phase:** 8.5
**Responsibility:** Real-time risk monitoring
- Position validation with cached health scores
- Price validation with fallback to entry price
- Event publishing (non-blocking)
- ErrorHandler with GRACEFUL_DEGRADE/SKIP strategies

### 📊 RiskCalculatorService
**File:** `src/services/risk-calculator.service.ts`
**Phase:** 8.9.40
**Responsibility:** Risk calculation utilities
- Position risk calculation (% of account)
- Stop-loss distance calculation
- Risk/reward ratio calculation
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 🎲 RealityCheckService
**File:** `src/services/reality-check.service.ts`
**Phase:** 8.9.69
**Responsibility:** Sanity checks for trading operations
- Validates position sizes (not too large)
- Validates prices (not stale)
- Validates margins (sufficient balance)
- ErrorHandler with THROW strategy (halts on critical failures)

---

## Data Access Layer (Phase 6)

### 📦 PositionMemoryRepository
**File:** `src/repositories/position.memory-repository.ts`
**Phase:** 6.2
**Tests:** 18
**Responsibility:** In-memory position storage
- O(1) access by position ID
- Thread-safe operations
- Atomic snapshots for concurrent reads
- findAll, findById, save, delete operations

### 📝 JournalFileRepository
**File:** `src/repositories/journal.file-repository.ts`
**Phase:** 6.2
**Tests:** 18
**Responsibility:** Trade journal persistence
- Append-only file writes
- JSON serialization
- Transaction safety
- Rotation support

### 💾 MarketDataCacheRepository
**File:** `src/repositories/market-data.cache-repository.ts`
**Phase:** 6.2
**Tests:** 18
**Responsibility:** Candle data caching
- LRU cache with TTL expiration
- Bounded memory usage
- Multi-timeframe support
- Cache hit/miss tracking

### 📚 IRepositories
**File:** `src/repositories/IRepositories.ts`
**Phase:** 6.1
**Responsibility:** Repository interfaces
- Defines repository contracts
- Abstraction for data access
- Easy to swap implementations

---

## Error Handling (Phase 7-8)

### 🛡️ ErrorHandler
**File:** `src/errors/ErrorHandler.ts`
**Phase:** 7
**Tests:** 138
**Responsibility:** Centralized error recovery
- 5 recovery strategies: RETRY, FALLBACK, GRACEFUL_DEGRADE, SKIP, THROW
- Exponential backoff (100ms → 200ms → 400ms)
- Callbacks: onRetry, onRecover, onFailure
- Error classification (transient vs permanent)
- Integrated into all 78 services

### 📋 DomainErrors
**File:** `src/errors/DomainErrors.ts`
**Phase:** 7
**Responsibility:** Domain-specific error types
- 20+ specialized errors (PositionNotFound, InsufficientBalance, etc.)
- 4 notification errors (TelegramSendError, etc.)
- Error codes for categorization
- Rich error context

### 📊 ErrorRegistry
**File:** `src/errors/ErrorRegistry.ts`
**Phase:** 7
**Responsibility:** Error telemetry
- Centralized error tracking
- Error statistics (count, last occurrence)
- Error patterns detection
- Metrics for monitoring

### 🎯 BaseError
**File:** `src/errors/BaseError.ts`
**Phase:** 7
**Responsibility:** Base error class
- Extends native Error
- Adds error codes
- Adds context data
- Stack trace preservation

---

## Infrastructure Services

### 🌐 WebSocketManagerService
**File:** `src/services/websocket-manager.service.ts`
**Phase:** 1
**Responsibility:** WebSocket connection management
- Private WebSocket (positions, orders, executions)
- Connection lifecycle (connect, disconnect, reconnect)
- Event subscription management
- Automatic reconnection with exponential backoff
- ErrorHandler integration

### 📡 PublicWebSocketService
**File:** `src/services/public-websocket.service.ts`
**Phase:** 8.9.44
**Responsibility:** Public WebSocket (market data)
- Orderbook updates
- Trade updates
- Ticker updates
- Candle updates (1m, 5m, 15m, etc.)
- ErrorHandler with RETRY/GRACEFUL_DEGRADE strategies

### 🔐 WebSocketAuthenticationService
**File:** `src/services/websocket-authentication.service.ts`
**Phase:** 8.9.80
**Responsibility:** WebSocket authentication
- Generates authentication payloads
- Manages API keys
- Signature generation
- ErrorHandler with THROW strategy

### 💓 WebSocketKeepAliveService
**File:** `src/services/websocket-keep-alive.service.ts`
**Phase:** 8.9.36
**Responsibility:** WebSocket connection health
- Periodic ping/pong
- Connection timeout detection
- Automatic reconnection trigger
- ErrorHandler with SKIP strategy

### 🔄 WebSocketEventHandlerManager
**File:** `src/services/websocket-event-handler-manager.ts`
**Phase:** 8.9.81
**Responsibility:** WebSocket event routing
- Routes WebSocket events to handlers
- Event filtering and transformation
- Handler registration/unregistration
- ErrorHandler with SKIP strategy

### 🏭 ExchangeFactory
**File:** `src/services/exchange-factory.service.ts`
**Phase:** 8.9.42
**Responsibility:** Exchange service factory
- Creates exchange service instances (Bybit, Binance, etc.)
- Configuration validation
- Service lifecycle management
- ErrorHandler with THROW strategy

### 📊 BybitService (via BybitServiceAdapter)
**File:** `src/services/bybit/bybit-service.adapter.ts`
**Phase:** 8.3
**Responsibility:** Bybit exchange integration
- Order placement (market, limit)
- Position management (open, close, modify)
- Market data fetching (candles, orderbook)
- Balance queries
- ErrorHandler with RETRY/GRACEFUL_DEGRADE strategies

---

## Utility Services

### 📝 LoggerService
**File:** `src/services/logger.service.ts`
**Phase:** 1
**Responsibility:** Structured logging
- Log levels (debug, info, warn, error)
- Structured output (JSON)
- Context injection
- Performance logging

### ⏰ TimeService
**File:** `src/services/time.service.ts`
**Phase:** 8.9.47
**Responsibility:** Time utilities
- Current timestamp (ms)
- Time formatting
- Timezone handling
- ErrorHandler with THROW strategy (time must be accurate)

### 📊 SessionStatsService
**File:** `src/services/session-stats.service.ts`
**Phase:** 8.9.10
**Responsibility:** Trading session statistics
- Win rate calculation
- PnL tracking
- Trade count
- Max drawdown
- ErrorHandler with GRACEFUL_DEGRADE/SKIP strategies

### 📓 TradingJournalService
**File:** `src/services/trading-journal.service.ts`
**Phase:** 8.9.2
**Responsibility:** Trade journaling
- Records all trades (entry, exit, profit/loss)
- File-based persistence
- Trade analytics
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 💬 TelegramService
**File:** `src/services/telegram.service.ts`
**Phase:** 8.9.5
**Responsibility:** Telegram notifications
- Trade notifications (entry, exit, TP hit)
- Error notifications
- Daily reports
- ErrorHandler with RETRY (network) / GRACEFUL_DEGRADE (rate limits) / SKIP (all)

### 📊 BotMetricsService
**File:** `src/services/bot-metrics.service.ts`
**Phase:** 8.9.45
**Responsibility:** Bot performance metrics
- Latency tracking
- Throughput tracking
- Error rate tracking
- Memory usage tracking
- ErrorHandler with SKIP strategy

### 🖥️ ConsoleDashboardService
**File:** `src/services/console-dashboard.service.ts`
**Phase:** 8.9.67
**Responsibility:** Terminal dashboard
- Real-time position display
- PnL display
- Market data display
- Order status display
- ErrorHandler with SKIP strategy

### 🎯 BotEventBus
**File:** `src/services/event-bus.ts`
**Phase:** 1
**Responsibility:** Event bus (pub/sub)
- Event emission
- Event subscription
- Event filtering
- Event history

### 🔄 EventDeduplicationService
**File:** `src/services/event-deduplication.service.ts`
**Phase:** 8.9.36
**Responsibility:** Duplicate event filtering
- Tracks processed events (sliding window)
- Prevents duplicate processing
- TTL-based cleanup
- ErrorHandler with SKIP strategy

### 📈 PnLCalculatorService
**File:** `src/services/pnl-calculator.service.ts`
**Phase:** 8.9.59
**Responsibility:** PnL calculation utilities
- Unrealized PnL (mark-to-market)
- Realized PnL (closed positions)
- ROI calculation
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 📊 PositionPnLCalculatorService
**File:** `src/services/position-pnl-calculator.service.ts`
**Phase:** 8.9.40
**Responsibility:** Position-specific PnL calculation
- Real-time PnL updates
- Fee calculation
- Funding rate adjustment
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 💰 VirtualBalanceService
**File:** `src/services/virtual-balance.service.ts`
**Phase:** 8.9.48
**Responsibility:** Virtual balance tracking (backtesting)
- Simulates account balance
- Tracks virtual positions
- Calculates virtual PnL
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 📈 CompoundInterestCalculatorService
**File:** `src/services/compound-interest-calculator.service.ts`
**Phase:** 8.9.75
**Responsibility:** Compound interest projection
- Future balance calculation
- Required win rate calculation
- Growth projection
- ErrorHandler with GRACEFUL_DEGRADE strategy

---

## Orchestrators

### 🎯 EntryOrchestrator
**File:** `src/orchestrators/entry.orchestrator.ts`
**Phase:** 3
**Responsibility:** Entry decision logic
- Signal ranking
- Multi-timeframe validation
- Entry confirmation
- Risk validation before entry

### 🚪 ExitOrchestrator
**File:** `src/orchestrators/exit.orchestrator.ts`
**Phase:** 3
**Responsibility:** Exit state machine
- TP1 → TP2 → TP3 progression
- Stop-loss monitoring
- Trailing stop logic
- Partial exit handling

### 🔍 FilterOrchestrator
**File:** `src/orchestrators/filter.orchestrator.ts`
**Phase:** 3
**Responsibility:** Signal filtering
- Filters out low-quality signals
- Applies user-defined filters
- Risk-based filtering
- Market condition filtering

---

## Providers

### 🕐 TimeframeProvider
**File:** `src/providers/timeframe.provider.ts`
**Phase:** 1
**Responsibility:** Timeframe utilities
- Timeframe conversion (1m, 5m, 15m, 1h, 4h, 1d)
- Candle alignment
- Timeframe validation

### 📊 CandleProvider
**File:** `src/providers/candle.provider.ts`
**Phase:** 8.9.9
**Responsibility:** Multi-timeframe candle caching
- Fetches candles from exchange
- Multi-level caching (memory + repository)
- Cache invalidation on new candles
- ErrorHandler with RETRY/SKIP strategies

---

## Strategy Services

### 📋 StrategyLoader
**File:** `src/services/strategy-loader.service.ts`
**Phase:** 8.9.76
**Responsibility:** Strategy configuration loading
- Loads strategy JSON files
- Validates strategy config
- Merges default settings
- ErrorHandler with THROW strategy

### 🎛️ StrategyManager
**File:** `src/services/strategy-manager.service.ts`
**Phase:** 8.9.77
**Responsibility:** Strategy lifecycle management
- Activates/deactivates strategies
- Monitors strategy performance
- Applies strategy updates
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 🎯 StrategyOrchestratorService
**File:** `src/services/multi-strategy/strategy-orchestrator.service.ts`
**Phase:** Multi-Strategy
**Responsibility:** Multi-strategy coordination
- Coordinates multiple strategies
- Allocates capital per strategy
- Resolves strategy conflicts
- ErrorHandler integration

### 📚 StrategyRegistryService
**File:** `src/services/multi-strategy/strategy-registry.service.ts`
**Phase:** Multi-Strategy
**Responsibility:** Strategy registry
- Registers strategies
- Tracks available strategies
- Strategy lookup by ID/name

### 🏭 StrategyFactoryService
**File:** `src/services/multi-strategy/strategy-factory.service.ts`
**Phase:** Multi-Strategy
**Responsibility:** Strategy factory
- Creates strategy instances
- Configures strategies
- Validates strategy config

### 🔄 StrategyStateManagerService
**File:** `src/services/multi-strategy/strategy-state-manager.service.ts`
**Phase:** Multi-Strategy
**Responsibility:** Strategy state management
- Persists strategy state
- Loads strategy state
- State validation

### 🔧 StrategyConfigMergerService
**File:** `src/services/strategy-config-merger.service.ts`
**Phase:** 8.9.78
**Responsibility:** Strategy config merging
- Merges user config with defaults
- Validates merged config
- Handles config overrides
- ErrorHandler with THROW strategy

---

## Analyzer Services

### 🔬 AnalyzerEngineService
**File:** `src/services/analyzer-engine.service.ts`
**Phase:** 4
**Tests:** 28
**Responsibility:** Analyzer orchestration
- Runs all registered analyzers
- Aggregates analyzer results
- Weighted scoring
- Parallel execution

### 📚 AnalyzerRegistryService
**File:** `src/services/analyzer-registry.service.ts`
**Phase:** 8.9.61
**Responsibility:** Analyzer registry
- Registers custom analyzers
- Tracks available analyzers
- Analyzer lookup by ID/name
- ErrorHandler with THROW strategy

---

## Indicator Services

### 📊 IndicatorCacheService
**File:** `src/services/indicator-cache.service.ts`
**Phase:** 8.9.63
**Responsibility:** Indicator result caching
- Caches calculated indicators
- TTL-based expiration
- Multi-timeframe support
- ErrorHandler with SKIP strategy

### 🔧 IndicatorPreCalculationService
**File:** `src/services/indicator-precalculation.service.ts`
**Phase:** 8.9.32
**Responsibility:** Indicator pre-calculation
- Pre-calculates indicators for all timeframes
- Reduces latency during signal processing
- Batch calculation
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 📚 IndicatorRegistryService
**File:** `src/services/indicator-registry.service.ts`
**Phase:** 8.9.62
**Responsibility:** Indicator registry
- Registers custom indicators
- Tracks available indicators
- Indicator lookup by ID/name
- ErrorHandler with THROW strategy

---

## Market Data Services

### 📖 OrderbookManagerService
**File:** `src/services/orderbook-manager.service.ts`
**Phase:** 8.9.45
**Responsibility:** Real-time orderbook management
- Maintains local orderbook snapshot
- Processes incremental updates
- Bid/ask spread calculation
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 📊 OrderbookImbalanceService
**File:** `src/services/orderbook-imbalance.service.ts`
**Phase:** 8.9.52
**Responsibility:** Orderbook imbalance detection
- Calculates buy/sell imbalance
- Detects liquidity asymmetry
- Predicts short-term price movement
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 🧱 WallTrackerService
**File:** `src/services/wall-tracker.service.ts`
**Phase:** 8.9.39
**Responsibility:** Large order detection ("walls")
- Detects large bid/ask orders (>100x average)
- Tracks wall lifetime
- Wall removal detection
- ErrorHandler with SKIP strategy

### 🐋 WhaleDetectionService
**File:** `src/services/whale-detection.service.ts`
**Phase:** 8.9.66
**Responsibility:** Whale trade detection
- Detects unusually large trades
- Calculates trade size percentile
- Whale activity tracking
- ErrorHandler with SKIP strategy

### 📊 WhaleWallTPService
**File:** `src/services/whale-wall-tp.service.ts`
**Phase:** 8.9.74
**Responsibility:** Whale wall-based TP calculation
- Calculates TP based on whale walls
- Identifies significant resistance/support
- Dynamic TP adjustment
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 🐳 RealTimeWhaleDetector
**File:** `src/services/realtime-whale-detector.ts`
**Phase:** 8.9.6
**Responsibility:** Real-time whale activity monitoring
- Real-time whale trade detection
- Whale order detection
- Event emission on whale activity
- ErrorHandler with SKIP strategy

### 🐋 MicroWallDetectorService
**File:** `src/services/micro-wall-detector.service.ts`
**Phase:** 8.9.64
**Responsibility:** Small wall detection
- Detects smaller walls (10-50x average)
- Tracks micro-wall clusters
- Identifies local support/resistance
- ErrorHandler with SKIP strategy

---

## Technical Analysis Services

### 📈 DeltaAnalyzerService
**File:** `src/services/delta-analyzer.service.ts`
**Phase:** 8.9.51
**Responsibility:** Volume delta analysis
- Calculates buy/sell volume delta
- Cumulative delta tracking
- Delta divergence detection
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 📊 TickDeltaAnalyzerService
**File:** `src/services/tick-delta-analyzer.service.ts`
**Phase:** 8.9.63
**Responsibility:** Tick-level delta analysis
- Tick-by-tick delta calculation
- Uptick/downtick ratio
- Tick pressure measurement
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 📉 OrderFlowAnalyzerService
**File:** `src/services/order-flow-analyzer.service.ts`
**Phase:** 8.9.53
**Responsibility:** Order flow analysis
- Aggressive buy/sell detection
- Order flow imbalance
- Momentum calculation
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 🎯 SwingPointDetectorService
**File:** `src/services/swing-point-detector.service.ts`
**Phase:** 8.9.50
**Responsibility:** Swing high/low detection
- Identifies swing points (highs/lows)
- Swing strength calculation
- Trend structure analysis
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 📊 MultiTimeframeTrendService
**File:** `src/services/multi-timeframe-trend.service.ts`
**Phase:** 8.9.51
**Responsibility:** Multi-timeframe trend alignment
- Detects trend on multiple timeframes
- Calculates trend alignment score
- Identifies strong vs weak trends
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 📈 VolatilityRegimeService
**File:** `src/services/volatility-regime.service.ts`
**Phase:** 8.9.52
**Responsibility:** Volatility regime detection
- Calculates volatility percentile
- Detects regime changes (low/normal/high)
- Adaptive strategy parameters
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 📊 VolumeProfileService
**File:** `src/services/volume-profile.service.ts`
**Phase:** 8.9.53
**Responsibility:** Volume profile analysis
- Point of Control (POC) calculation
- Value Area calculation (70% volume)
- High Volume Nodes (HVN)
- Low Volume Nodes (LVN)
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 📊 CandleAggregatorService
**File:** `src/services/candle-aggregator.service.ts`
**Phase:** 8.9.64
**Responsibility:** Custom candle aggregation
- Aggregates candles to custom timeframes
- Range bars, Renko, Heikin-Ashi
- Volume-based candles
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 🧠 MLFeatureExtractorService
**File:** `src/services/ml-feature-extractor.service.ts`
**Phase:** 8.9.64
**Responsibility:** ML feature extraction
- Extracts features from market data
- Technical indicator features
- Price action features
- Order flow features
- ErrorHandler with GRACEFUL_DEGRADE strategy

---

## Signal Processing Services

### 📊 TFAlignmentService
**File:** `src/services/tf-alignment.service.ts`
**Phase:** 8.9.71
**Responsibility:** Timeframe alignment validation
- Validates signal alignment across timeframes
- Calculates alignment score
- Identifies conflicting signals
- ErrorHandler with GRACEFUL_DEGRADE strategy

### ⚖️ TimeframeWeightingService
**File:** `src/services/timeframe-weighting.service.ts`
**Phase:** 8.9.72
**Responsibility:** Timeframe weight calculation
- Assigns weights to timeframes (e.g., 4h > 1h > 15m)
- Adaptive weighting based on market regime
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 📐 FractalSMCWeightingService
**File:** `src/services/fractal-smc-weighting.service.ts`
**Phase:** 8.9.73
**Responsibility:** Smart Money Concepts (SMC) weighting
- Weights based on SMC principles (order blocks, FVG, etc.)
- Fractal structure analysis
- ErrorHandler with GRACEFUL_DEGRADE strategy

---

## Entry/Exit Logic Services

### 🔄 RetestEntryService
**File:** `src/services/retest-entry.service.ts`
**Phase:** 8.9.50
**Responsibility:** Retest entry detection
- Detects price retests of key levels
- Validates retest quality
- False breakout filtering
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 🎯 EntryConfirmationService
**File:** `src/services/entry-confirmation.service.ts`
**Phase:** 8.9.29
**Responsibility:** Entry signal confirmation
- Multi-condition confirmation
- Signal strength validation
- Prevents premature entries
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 🚪 ExitTypeDetectorService
**File:** `src/services/exit-type-detector.service.ts`
**Phase:** 8.9.38
**Responsibility:** Exit type classification
- Detects exit reason (TP1, TP2, TP3, SL, manual)
- Exit quality assessment
- ErrorHandler with SKIP strategy

### 🪜 LadderExitDetectorService
**File:** `src/services/ladder-exit-detector.service.ts`
**Phase:** 8.9.27
**Responsibility:** Ladder (partial) exit detection
- Detects partial position closes
- Tracks ladder exit progress (TP1 → TP2 → TP3)
- Calculates average exit price
- ErrorHandler with SKIP strategy

### 📊 StructureAwareExitService
**File:** `src/services/structure-aware-exit.service.ts`
**Phase:** 8.9.58
**Responsibility:** Structure-based exit logic
- Exits based on market structure breaks
- Swing high/low breaks
- Trend reversal detection
- ErrorHandler with GRACEFUL_DEGRADE strategy

### ⚡ EnhancedExitService
**File:** `src/services/enhanced-exit.service.ts`
**Phase:** 8.9.58
**Responsibility:** Advanced exit logic
- Combines multiple exit signals
- Volatility-adjusted stops
- Time-based exits
- ErrorHandler with GRACEFUL_DEGRADE strategy

---

## Take-Profit Services

### 🎯 TakeProfitManagerService
**File:** `src/services/take-profit-manager.service.ts`
**Phase:** 8.9.30
**Responsibility:** TP level management
- Manages multiple TP levels (TP1, TP2, TP3)
- TP order placement
- TP hit detection
- ErrorHandler with RETRY/GRACEFUL_DEGRADE strategies

### 🪜 LadderTPManagerService
**File:** `src/services/ladder-tp-manager.service.ts`
**Phase:** 8.9.31
**Responsibility:** Ladder TP management
- Manages partial exits (e.g., 30% @ TP1, 40% @ TP2, 30% @ TP3)
- Calculates remaining position size
- Updates TP orders after partial fill
- ErrorHandler with RETRY/GRACEFUL_DEGRADE strategies

---

## Safety & Validation Services

### 🛑 GracefulShutdownService
**File:** `src/services/graceful-shutdown.service.ts`
**Phase:** 8.4
**Tests:** 22
**Responsibility:** Safe bot shutdown
- Cancels all pending orders (RETRY strategy)
- Saves state to disk (GRACEFUL_DEGRADE - never blocks)
- Closes WebSocket connections
- State recovery on restart (FALLBACK strategy)

### 🔄 CircuitBreakerService (Trading)
**File:** `src/services/circuit-breaker.service.ts`
**Phase:** 8.9.41
**Responsibility:** Trading circuit breaker (prevents overtrading)
- Stops trading after consecutive losses
- Configurable failure threshold
- Automatic reset after cooldown
- ErrorHandler with SKIP strategy

### 🚫 AntiFlapService
**File:** `src/services/anti-flip.service.ts`
**Phase:** 8.9.29
**Responsibility:** Anti-flip protection
- Prevents flipping position direction too quickly
- Configurable cooldown period
- ErrorHandler with SKIP strategy

### ⏰ ActionQueueService
**File:** `src/services/action-queue.service.ts`
**Phase:** 8.9.4
**Responsibility:** Action rate limiting
- Queues actions to prevent rate limit errors
- Configurable rate limits
- FIFO queue processing
- ErrorHandler with SKIP strategy

### 📊 ConfigValidatorService
**File:** `src/services/config-validator.service.ts`
**Phase:** 8.9.39
**Responsibility:** Configuration validation
- Validates bot config on startup
- Schema validation
- Type checking
- ErrorHandler with THROW strategy (halts on invalid config)

### 💵 FundingRateFilterService
**File:** `src/services/funding-rate-filter.service.ts`
**Phase:** 8.9.39
**Responsibility:** Funding rate filtering
- Filters out trades with unfavorable funding rates
- Configurable funding rate threshold
- ErrorHandler with SKIP strategy

---

## Multi-Timeframe Services

### 🚪 MTFSnapshotGateService
**File:** `src/services/mtf-snapshot-gate.service.ts`
**Phase:** 8.9.30
**Responsibility:** Multi-timeframe snapshot gating
- Ensures all timeframes are loaded before processing
- Prevents partial data signals
- Snapshot validation
- ErrorHandler with SKIP strategy

---

## Monitoring & Data Collection

### 📊 DataCollectorService
**File:** `src/services/data-collector.service.ts`
**Phase:** 8.9.42
**Responsibility:** Market data collection
- Collects ticks, candles, orderbook snapshots
- Stores data for backtesting
- Data export to CSV/JSON
- ErrorHandler with SKIP strategy

### 📈 PerformanceAnalyticsService
**File:** `src/services/performance-analytics.service.ts`
**Phase:** 8.9.42
**Responsibility:** Performance analytics
- Sharpe ratio calculation
- Max drawdown calculation
- Win rate, profit factor, etc.
- ErrorHandler with GRACEFUL_DEGRADE strategy

### 📊 MarketHealthMonitor
**File:** `src/services/market-health.monitor.ts`
**Phase:** 8.9.3
**Responsibility:** Market health monitoring
- Spread monitoring
- Liquidity monitoring
- Volatility monitoring
- ErrorHandler with SKIP strategy

### 📈 TradeHistoryService
**File:** `src/services/trade-history.service.ts`
**Phase:** 8.9.46
**Responsibility:** Trade history tracking
- Stores historical trades
- Trade analytics
- Performance tracking
- ErrorHandler with GRACEFUL_DEGRADE strategy

---

## Lifecycle Services

### 🚀 BotInitializer
**File:** `src/services/bot-initializer.ts`
**Phase:** 8.9.1
**Responsibility:** Bot initialization
- Initializes all services in dependency order
- Validates configuration
- Establishes exchange connections
- ErrorHandler with THROW strategy (halts on critical failures)

### 🏭 BotFactory
**File:** `src/services/bot-factory.service.ts`
**Phase:** 8.9.45
**Responsibility:** Bot instance factory
- Creates bot instances
- Configures bot services
- Manages multiple bot instances
- ErrorHandler with THROW strategy

### 🔄 TradingLifecycleService
**File:** `src/services/trading-lifecycle.service.ts`
**Phase:** 8.9.43
**Responsibility:** Trading lifecycle management
- Start/stop trading
- Pause/resume trading
- Emergency stop
- ErrorHandler with GRACEFUL_DEGRADE strategy

---

## Test Utilities

### 🧪 PreCalculationMock
**File:** `src/services/pre-calculation.mock.ts`
**Phase:** Testing
**Responsibility:** Mock pre-calculation service for tests
- Mocks indicator pre-calculation
- Provides deterministic test data

---

## Summary Statistics

### Services by Phase
- **Phase 1 (Core):** 10+ services
- **Phase 3 (Orchestrators):** 3 services
- **Phase 4 (Analyzer Engine):** 1 service
- **Phase 6 (Repositories):** 4 services (3 implementations + interfaces)
- **Phase 7 (Error Handling):** 4 services
- **Phase 8.x (ErrorHandler Integration):** 78 services with ErrorHandler
- **Phase 9 (Live Trading):** Safety improvements
- **Phase 10 (Market Analysis):** 6 services (252 tests)
- **Phase 11 (Position Management):** 2 services (82 tests)
- **Phase 13 (Order Management):** 2 services (85 tests)
- **Phase 14.1 (Monitoring):** 3 services (68 tests)
- **Phase 14.2 (Resilience):** 5 services (117 tests)

### Test Coverage
- **Total Tests:** 6904 passing (296 test suites)
- **Pass Rate:** 100% (0 flaky tests)
- **Coverage:** All critical trading logic + All 78 services with ErrorHandler

### Recovery Strategies Used
- **RETRY:** Network errors, transient failures (exponential backoff)
- **FALLBACK:** Failed operations with alternative (e.g., cached data)
- **GRACEFUL_DEGRADE:** Non-critical failures (continue with reduced functionality)
- **SKIP:** Non-blocking failures (log and continue)
- **THROW:** Critical failures (halt execution)

---

## Quick Search by Responsibility

**Need to...**
- **Open a position?** → `PositionLifecycleService`
- **Close a position?** → `PositionExitingService`
- **Monitor position PnL?** → `PositionMonitorService`, `PositionPnLCalculatorService`
- **Validate risk?** → `RiskManager`, `RealTimeRiskMonitor`
- **Place an order?** → `OrderExecutionPipelineService`, `SmartOrderExecutionService`
- **Analyze order flow?** → `AdvancedOrderFlowService`, `OrderFlowAnalyzerService`
- **Detect liquidity?** → `LiquidityHeatmapService`
- **Size a position?** → `DynamicPositionSizerService`
- **Scale into a position?** → `PositionScalingService`
- **Detect patterns?** → `PatternRecognitionService`
- **Validate signals?** → `MLSignalValidatorService`
- **Detect anomalies?** → `AnomalyDetectionService`
- **Monitor health?** → `HealthCheckService`, `MonitoringServer`
- **Collect metrics?** → `PrometheusMetricsService`, `BotMetricsService`
- **Handle errors?** → `ErrorHandler`, `DomainErrors`, `ErrorRegistry`
- **Retry failed operations?** → `RetryPolicyService`
- **Rate limit requests?** → `RateLimiterService`
- **Isolate resources?** → `BulkheadService`
- **Fail fast?** → `CircuitBreakerService`
- **Coordinate resilience?** → `ResilienceCoordinator`
- **Send notifications?** → `TelegramService`
- **Log events?** → `LoggerService`
- **Journal trades?** → `TradingJournalService`
- **Manage WebSocket?** → `WebSocketManagerService`, `PublicWebSocketService`
- **Cache market data?** → `MarketDataCacheRepository`, `CandleProvider`
- **Store positions?** → `PositionMemoryRepository`
- **Calculate indicators?** → `IndicatorPreCalculationService`, `IndicatorCacheService`
- **Shutdown safely?** → `GracefulShutdownService`

---

**Generated:** 2026-02-10
**Maintained by:** Edison Trading Bot Team
**Status:** Phase 14.2 Complete (117/100 tests) - All components operational 🎉

