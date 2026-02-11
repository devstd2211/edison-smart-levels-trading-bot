# Claude Code Session Guide

## 🎯 Current Status

**BUILD STATUS:** ✅ **SUCCESS** | **6943 Tests Passing** (+39 Phase 16.1) | **0 Flaky Tests** | **0 Regressions**

**Completed Phases:**
- ✅ Phase 0: Core Types & Decision Engine (132 tests)
- ✅ Phase 3: Strategy Coordinator (20 tests)
- ✅ Phase 4: Analyzer Engine (28 tests)
- ✅ Phase 5: Dependency Injection (16 tests)
- ✅ Phase 6: Repository Pattern (152 tests)
- ✅ Phase 7: Error Handling System (138 tests)
- ✅ Phase 8: ErrorHandler Integration (531 tests - **ALL 78 Services Complete** ✅)
- ✅ Phase 9: Live Trading Engine + Safety Guards (123 tests)
- ✅ Phase 10: Advanced Market Analysis (252 tests - **ALL 6 Services + Integration Complete** ✅)
- ✅ Phase 11: Dynamic Position Sizing (82 tests - **ALL COMPLETE** 🎉)
- ✅ **Phase 13: Advanced Order Management** (85/85 tests - **ALL COMPLETE** 🎉🎉🎉)
- ✅ **Phase 14.1: Monitoring & Observability** (68/68 tests - **ALL COMPLETE** 🎉)
- ✅ **Phase 14.2: Resilience Patterns** (117/100 tests - **ALL COMPLETE** 🎉🎉🎉)
  - ✅ **Phase 14.2.1:** CircuitBreakerService (27/27 tests - **COMPLETE** 🎉)
  - ✅ **Phase 14.2.2:** RateLimiterService (25/25 tests - **COMPLETE** 🎉)
  - ✅ **Phase 14.2.3:** RetryPolicyService (25/25 tests - **COMPLETE** 🎉)
  - ✅ **Phase 14.2.4:** BulkheadService (16/16 tests - **COMPLETE** 🎉)
  - ✅ **Phase 14.2.5:** ResilienceCoordinator (24/24 tests - **COMPLETE** 🎉)

**🎉 Current Status:** Phase 16.1 ✅ **COMPLETE** (Core Trading Engine Validation - 39 tests, 0 regressions) | Phase 12 postponed

---

## 📚 Learning Path

**For architecture deep-dive:** See `ARCHITECTURE_QUICK_START.md`
- Component overview and relationships
- Phase implementation details
- System design patterns

---

## 🔧 Commands

```bash
# Testing
npm test                               # Run all tests
npm test -- position-exiting           # Run specific test suite

# Building
npm run build                          # Full build (TypeScript + web server + web client)

# Backtesting
npm run backtest-v5                    # Run V5 backtest
```

---

## 📁 Key Files

### Core Services
- `src/services/trading-orchestrator.service.ts` - Main trading engine
- `src/services/position-lifecycle.service.ts` - Position lifecycle management with ErrorHandler integration (Phase 8.9.17)
- `src/services/position-exiting.service.ts` - Position exit logic with atomic locks
- `src/services/websocket-manager.service.ts` - Real-time market data handling
- `src/services/bot-services.ts` - Service factory and dependency injection

### Error Handling (Phase 7-8)
- `src/errors/ErrorHandler.ts` - Recovery strategies (RETRY, FALLBACK, GRACEFUL_DEGRADE, SKIP, THROW)
- `src/errors/DomainErrors.ts` - 20 specialized domain error types (+ 4 NOTIFICATION errors)
- `src/errors/ErrorRegistry.ts` - Centralized error telemetry
- `src/services/telegram.service.ts` - Telegram notifications with error resilience (Phase 8.9.5)
- `src/providers/candle.provider.ts` - Multi-timeframe candle caching with RETRY/SKIP (Phase 8.9.9)

### Data Access (Phase 6)
- `src/repositories/IRepositories.ts` - Repository interfaces
- `src/repositories/PositionMemoryRepository.ts` - Position storage (18 tests)
- `src/repositories/JournalFileRepository.ts` - Trade persistence (18 tests)
- `src/repositories/MarketDataCacheRepository.ts` - Candle caching (18 tests)

### Orchestrators
- `src/orchestrators/entry.orchestrator.ts` - Entry decision logic
- `src/orchestrators/exit.orchestrator.ts` - Exit state machine (TP1 → TP2 → TP3)
- `src/orchestrators/filter.orchestrator.ts` - Signal filtering

### Configuration
- `config.json` - Bot configuration
- `strategies/json/simple-levels.strategy.json` - Current strategy (TP: 0.5%, 1%, 1.5%)

### Tests
- `src/__tests__/services/` - All service tests (4600+ tests)
- `src/__tests__/orchestrators/` - Orchestrator tests (140+ tests)
- Phase 8 Error Handling Tests:
  - `trading-orchestrator.error-handling.test.ts` (12 tests)
  - `position-exiting.error-handling.test.ts` (22 tests)
  - `position-lifecycle.error-handling.test.ts` (22 tests) ← Phase 8.9.17 COMPLETE
  - `candle-provider.error-handling.test.ts` (20 tests) ← Phase 8.9.9
  - `session-stats.error-handling.test.ts` (20 tests) ← Phase 8.9.10
  - `bybit.error-handling.test.ts` (17 tests)
  - `order-execution-pipeline.error-handling.test.ts` (27 tests)
  - `graceful-shutdown.error-handling.test.ts` (22 tests)
  - `real-time-risk-monitor.error-handling.test.ts` (15 tests) ← Phase 8.5
  - `telegram.error-handling.test.ts` (29 tests) ← Phase 8.9.5

---

## 🏗️ Architecture Overview

```
Trading Bot (Main Engine)
├─ TradingOrchestrator [SKIP recovery]
│  ├─ StrategyCoordinatorService (parallel analyzer execution)
│  ├─ EntryOrchestrator (signal ranking, MTF validation)
│  └─ ExitOrchestrator (state machine for TP levels)
│
├─ BybitService [RETRY + GRACEFUL_DEGRADE recovery] ← Phase 8.3
│  ├─ OrderExecutionPipeline [RETRY strategy] ← Phase 8.3
│  ├─ Positions (open/close operations)
│  ├─ Orders (TP, SL management)
│  └─ MarketData (candle fetching + caching)
│
├─ PositionExitingService [RETRY + FALLBACK + SKIP] ← Phase 8.2
│  ├─ Atomic lock pattern (prevents concurrent closes)
│  ├─ Journal recording (transactional)
│  └─ Telegram notifications (non-blocking)
│
├─ GracefulShutdownManager [RETRY + GRACEFUL_DEGRADE + FALLBACK] ← Phase 8.4
│  ├─ Order cancellation with RETRY strategy
│  ├─ State persistence with GRACEFUL_DEGRADE (never blocks)
│  └─ State recovery with FALLBACK strategy
│
├─ RealTimeRiskMonitor [GRACEFUL_DEGRADE + SKIP] ← Phase 8.5
│  ├─ Position validation with cached health scores
│  ├─ Price validation with fallback to entry price
│  └─ Event publishing with non-blocking failure handling
│
├─ Data Layer (Phase 6)
│  ├─ PositionRepository (in-memory, O(1) access)
│  ├─ JournalRepository (file-based persistence)
│  └─ MarketDataRepository (LRU cache with TTL)
│
└─ Error Handling (Phase 7-8)
   ├─ ErrorHandler (5 recovery strategies)
   ├─ Error classification (domain-specific errors)
   └─ ErrorRegistry (telemetry & statistics)
```

---

## ✅ Key Features

### Advanced Order Management (Phase 13.1) 🎉 **NEW!**
- **Smart Order Execution:** Adaptive execution with slippage minimization
- **Order Splitting:** Automatic order splitting to minimize market impact
- **TWAP Execution:** Time-weighted average price distribution
- **VWAP Execution:** Volume-weighted average price matching
- **Adaptive Monitoring:** Real-time price adjustments based on market movement
- **Partial Fill Handling:** Intelligent continuation/cancellation logic
- **Market Impact Estimation:** Square-root model for price impact prediction
- **State Management:** Track and monitor active orders
- **Performance:** 1677 lines of production code, 45 tests, 100% ErrorHandler coverage

### Error Handling (Phase 7-8)
- **5 Recovery Strategies:** RETRY (exponential backoff), FALLBACK, GRACEFUL_DEGRADE, SKIP, THROW
- **Error Classification:** Domain-specific errors (PositionNotFound, InsufficientBalance, etc.)
- **Exponential Backoff:** 100ms → 200ms → 400ms (configurable multiplier)
- **Callbacks:** onRetry, onRecover, onFailure for monitoring
- **Phase 8.9.2:** TradingJournalService with persistence domain errors
- **Phase 8.9.5:** TelegramService with notification resilience (RETRY for network, GRACEFUL_DEGRADE for rate limits, SKIP for all notification errors)

### Data Management (Phase 6)
- **Repository Pattern:** Abstracts data access layer
- **LRU Caching:** Bounded memory with TTL expiration
- **Concurrent Safety:** Atomic operations for race condition prevention

### Live Trading (Phase 9)
- **Atomic Locks:** Prevents WebSocket ↔ timeout close race condition
- **Runtime Validation:** Catches NaN crashes from type mismatches
- **Atomic Snapshots:** Safe concurrent reads during live updates

### Advanced Market Analysis (Phase 10) 🎉
- **Tick-Level Order Flow:** Real-time buy/sell imbalance, spoofing detection, momentum calculation
- **Liquidity Heatmap:** Support/resistance detection, slippage calculation, execution cost estimation
- **Smart Order Placement:** Optimal order splitting, fill probability estimation, adaptive execution
- **ML Signal Validation:** Historical win rate tracking, regime adjustment, confidence scoring
- **Pattern Recognition:** 15+ candlestick patterns, fibonacci levels, supply/demand zones
- **Anomaly Detection:** Volume/volatility spikes, whale activity detection, manipulation flags
- **Performance:** <100ms liquidity analysis, <30ms signal validation
- **Integration:** All services work together seamlessly with 0 regressions

---

## 🧪 Testing

- **Total Tests:** 6904 passing (100% pass rate - 0 flaky tests)
- **Test Suites:** 296 test files
- **Coverage:** All critical trading logic + All 78 services with ErrorHandler integration + Phase 10 + Phase 11 + Phase 13 + Phase 14.1 COMPLETE + Phase 14.2 COMPLETE
- **Latest Tests:** Phase 14.2.5 (24 tests - ResilienceCoordinator complete) | Phase 14.2 ✅ COMPLETE (117/100 tests, 117%)

Run specific test categories:
```bash
npm test -- "error-handling"           # All error handling tests
npm test -- "bybit"                    # All Bybit service tests
npm test -- "position-exiting"         # Position close tests
```

---

## ⚠️ Known Issues

**None Critical.** Phase 9 runtime validation prevents NaN crashes from type mismatches.

Pre-existing TypeScript errors in test utilities (non-production code) don't affect runtime execution.

---

## 🚀 Next Steps

**🎉 Phase 10 (Advanced Market Analysis) - COMPLETE** 🎉
- ✅ **6 Services** with advanced market analysis capabilities
- ✅ **252 new tests** passing (0 regressions)
- ✅ **Full backward compatibility** maintained

**Phase 10 Summary (6 Services):**

**Phase 10.1 (Real-Time Market Microstructure):** ✅
- ✅ AdvancedOrderFlowService (44 tests) - Tick-level order flow, spoofing detection
- ✅ LiquidityHeatmapService (43 tests) - Support/resistance, slippage calculation
- ✅ SmartOrderPlacementService (33 tests) - Optimal order splitting, fill probability

**Phase 10.2 (ML-Based Signal Validation):** ✅
- ✅ MLSignalValidatorService (45 tests) - Win rate tracking, regime adjustment
- ✅ PatternRecognitionService (40 tests) - 15+ patterns, fibonacci levels
- ✅ AnomalyDetectionService (35 tests) - Volume/volatility anomalies, whale detection

**Phase 10.3 (Integration & Optimization):** ✅ **COMPLETE**
- ✅ Integration Testing (12 tests) - All services working together
- ✅ Documentation & Cleanup - Complete

**🎉 Phase 11 (Dynamic Position Sizing) - COMPLETE** 🎉🎉🎉
- ✅ **Phase 11.1 COMPLETE:** DynamicPositionSizerService (47 tests)
  - Kelly Criterion-based position sizing
  - Volatility adjustment (ATR-based)
  - Confidence-weighted sizing
  - Account risk limits
- ✅ **Phase 11.2 COMPLETE:** PositionScalingService (35 tests)
  - Scale into winning positions
  - Move SL to breakeven
  - Dynamic pyramiding logic
  - Size reduction per scale (0.5x, 0.25x, 0.125x...)

**🎉 Phase 13 (Advanced Order Management) - COMPLETE** 🎉🎉🎉
- ✅ **Phase 13.1 COMPLETE:** SmartOrderExecutionService (45 tests)
  - Adaptive execution with slippage minimization
  - Order splitting to minimize market impact
  - TWAP/VWAP execution strategies
  - Market impact estimation
  - Partial fill handling
- ✅ **Phase 13.2 COMPLETE:** AdvancedOrderStateMachineService (40 tests)
  - State validation & transition control
  - Automatic timeout handling
  - Complete state history tracking
  - Concurrent safety with locks
  - Rollback support on errors

**Phase 14+ Planning:** Production Hardening
- ⏸️ Multi-exchange coordination (Phase 12) - **POSTPONED** until later
- ✅ **Phase 14.2:** Resilience Patterns (117/100 tests, 117% - **ALL COMPLETE** 🎉🎉🎉)
  - ✅ **14.2.1:** CircuitBreakerService (27 tests) - **COMPLETE**
  - ✅ **14.2.2:** RateLimiterService (25 tests) - **COMPLETE**
  - ✅ **14.2.3:** RetryPolicyService (25 tests) - **COMPLETE**
  - ✅ **14.2.4:** BulkheadService (16 tests) - **COMPLETE**
  - ✅ **14.2.5:** ResilienceCoordinator (24 tests) - **COMPLETE**
- ✅ **Phase 15.1-15.5:** Code Quality & Performance (Grade A+, 95/100)
- ✅ **Phase 16.1:** Core Trading Engine Validation - **COMPLETE** ✅
  - ✅ **16.1.1:** Logic Validation (29 tests - entry/exit, PnL, risk management)
  - ✅ **16.1.2:** Real Integration Tests (10 tests - services integration, error recovery)
- 🎯 **Phase 16.2:** Security & Compliance - NEXT

See `PHASE_10_ROADMAP.md`, `PHASE_11_PROGRESS.md`, `PHASE_13_PROGRESS.md`, `PHASE_14_PROGRESS.md`, and `PHASE_16_ROADMAP.md` for detailed roadmap.

---

**Last Updated:** 2026-02-11 | **Session:** 102
**Status:** 🎉 **Phase 16.1 ✅ COMPLETE** (Core Trading Engine Validation - 39 tests, 0 regressions) | 6943 Tests Passing | **Next: Phase 16.2 - Security & Compliance**
