# Claude Code Session Guide

## 🎯 Current Status

**BUILD STATUS:** ✅ **SUCCESS** | **5851 Tests Passing** (+29 Phase 8.9.60) | **ZERO Regressions**

**Completed Phases:**
- ✅ Phase 0: Core Types & Decision Engine (132 tests)
- ✅ Phase 3: Strategy Coordinator (20 tests)
- ✅ Phase 4: Analyzer Engine (28 tests)
- ✅ Phase 5: Dependency Injection (16 tests)
- ✅ Phase 6: Repository Pattern (152 tests)
- ✅ Phase 7: Error Handling System (138 tests)
- ✅ Phase 8: ErrorHandler Integration (436 tests - Stages 1-9.60)
- ✅ Phase 9: Live Trading Engine + Safety Guards (123 tests)

**Current Phase:** 8.9.60 (PositionPnLCalculatorService) ✅ COMPLETE

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

---

## 🧪 Testing

- **Total Tests:** 5791 passing (100% pass rate)
- **Test Suites:** 258 test files
- **Coverage:** All critical trading logic
- **Latest Tests:** Phase 8.9.55 (33 tests for LoggerService error handling)

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

**Phase 8 Stages 9.1-9.40:** ErrorHandler integration into remaining services
- ✅ TradingJournalService (RETRY + GRACEFUL_DEGRADE + SKIP strategies) ← Phase 8.9.2 COMPLETE
- ✅ PositionMonitorService (~18 tests) ← Phase 8.9.3 COMPLETE
- ✅ Position Event Handlers (~15 tests) ← Phase 8.9.4 COMPLETE
- ✅ TelegramService (~29 tests, notification resilience) ← Phase 8.9.5 COMPLETE
- ✅ StrategyLoaderService (~18 tests) ← Phase 8.9.6 COMPLETE
- ✅ BotInitializerService (~15 tests, CRITICAL for startup) ← Phase 8.9.7 COMPLETE
- ✅ PublicWebSocketService (~18 tests) ← Phase 8.9.8 COMPLETE
- ✅ CandleProvider (~20 tests, multi-timeframe caching) ← Phase 8.9.9 COMPLETE
- ✅ SessionStatsService (~20 tests, session persistence) ← Phase 8.9.10 COMPLETE
- ✅ PositionStateMachineService (~18 tests) ← Phase 8.9.11 COMPLETE
- ✅ PositionSyncService (~19 tests) ← Phase 8.9.12 COMPLETE
- ✅ AnalyzerEngineService - Basic (~16 tests) ← Phase 8.9.13 COMPLETE
- ✅ AnalyzerEngineService - Advanced (~15 tests) ← Phase 8.9.14 COMPLETE
- ✅ LimitOrderExecutorService (~22 tests, RETRY/SKIP strategies) ← Phase 8.9.15 COMPLETE
- ✅ IndicatorPreCalculationService (~20 tests, SKIP strategies) ← Phase 8.9.16 COMPLETE
- ✅ PositionLifecycleService (~22 tests, RETRY/FALLBACK/GRACEFUL_DEGRADE/SKIP) ← Phase 8.9.17 COMPLETE
- ✅ **40 more services completed (8.9.18-8.9.39)** ← Phases 8.9.18-8.9.39 COMPLETE
- ✅ **BotMetricsService (~34 tests, RETRY/GRACEFUL_DEGRADE/SKIP)** ← Phase 8.9.40 COMPLETE
- ✅ **SwingPointDetectorService (~20 tests, THROW/GRACEFUL_DEGRADE/SKIP)** ← Phase 8.9.44 COMPLETE
- ✅ **MultiTimeframeTrendService (~20 tests, THROW/GRACEFUL_DEGRADE/SKIP)** ← Phase 8.9.45 COMPLETE
- ✅ **VolatilityRegimeService (~20 tests, THROW/GRACEFUL_DEGRADE/SKIP)** ← Phase 8.9.46 COMPLETE
- ✅ **VolumeProfileService (~44 tests, THROW/GRACEFUL_DEGRADE/SKIP)** ← Phase 8.9.47 COMPLETE
- ✅ **OrderFlowAnalyzerService (~26 tests, THROW/GRACEFUL_DEGRADE/SKIP)** ← Phase 8.9.48 COMPLETE
- ✅ **OrderbookImbalanceService (~25 tests, THROW/GRACEFUL_DEGRADE/SKIP)** ← Phase 8.9.49 COMPLETE
- ✅ **OrderExecutionDetectorService (~25 tests, THROW/GRACEFUL_DEGRADE/SKIP)** ← Phase 8.9.50 COMPLETE
- ✅ **RetestEntryService (~27 tests, THROW/GRACEFUL_DEGRADE/SKIP)** ← Phase 8.9.51 COMPLETE
- ✅ **StructureAwareExitService (~26 tests, THROW/GRACEFUL_DEGRADE/SKIP)** ← Phase 8.9.52 COMPLETE
- ✅ **EnhancedExitService (~25 tests, THROW/GRACEFUL_DEGRADE/SKIP)** ← Phase 8.9.53 COMPLETE
- ✅ **PnLCalculatorService (~20 tests, THROW validation)** ← Phase 8.9.54 COMPLETE
- ✅ **LoggerService (~33 tests, THROW/GRACEFUL_DEGRADE/SKIP)** ← Phase 8.9.55 COMPLETE
- ✅ **AnalyzerRegistryService (~25 tests, THROW/GRACEFUL_DEGRADE/SKIP)** ← Phase 8.9.56 COMPLETE
- ✅ **IndicatorRegistry (~25 tests, THROW/GRACEFUL_DEGRADE/SKIP)** ← Phase 8.9.57 COMPLETE
- ✅ **IndicatorCacheService (~25 tests, THROW/GRACEFUL_DEGRADE/SKIP)** ← Phase 8.9.58 COMPLETE
- ✅ **MarketConditionAnalyzerService (~25 tests, THROW/GRACEFUL_DEGRADE/SKIP)** ← Phase 8.9.59 COMPLETE
- ✅ **PositionPnLCalculatorService (~24 tests, THROW/GRACEFUL_DEGRADE)** ← Phase 8.9.60 COMPLETE
- **Priority 2 Services:** weight-matrix-calculator, delta-analyzer, tick-delta-analyzer (~16-22 tests)
- **Priority 3 Services:** Technical indicators (~50+ tests remaining)

**Phase 9 Continuation:** Advanced trading features
- Dynamic position sizing
- Advanced order management
- Real-time risk limits

---

**Last Updated:** 2026-02-05 | **Session:** 82
**Status:** Phase 8.1-8.9.55 ✅ COMPLETE | Phase 9 ✅ COMPLETE | 5791 Tests Passing
