# Next Session Prompt

You are continuing a refactor in `D:\src\Edison`.

Current artifacts:
- `REFACTOR_PLAN.md` contains the global plan and per-area checklists.
- `REFACTOR_TASKS.md` contains issue-ready task lists by area.

Focus for this session:
1. Lifecycle cleanup (remove constructor side effects, explicit start/stop orchestration).
2. Keep DI changes minimal while wiring lifecycle sequencing.

Steps to do:
1. Keep `BotServices` construction side-effect free (no `.start()` calls in builder).
2. Ensure `BotInitializer` owns lifecycle sequencing and shutdown for sockets/monitors.
3. Update tests that asserted connect/disconnect to use start/stop.
4. Do not change runtime behavior beyond start/stop relocation.

Constraints:
- Keep constructors side-effect free when introducing new containers.
- Avoid changing behavior until lifecycle and minimal interfaces are in place.

Deliverables for this session:
- Lifecycle wiring in `BotInitializer` with start/stop.
- Updated tests for lifecycle start/stop.
- Progress update for next session.

## Current Status (as of 2026-02-27)
- Domain-type migration in services/strategies/tests is complete via legacy re-exports.
- Multi-strategy module exports now re-export from legacy.
- Tests not run.
- BotServicesAdapter decoupled from BotServices via IBotServicesAdapterSource.
- BotFactory createForTesting overrides typed to IBotServicesAdapterSource.
- BotServices builder created; BotServices now thin wrapper with readonly fields restored.
- Dependency map refreshed and aligned to `bot-services.builder.ts` source.
- Build run (`npm run build`) succeeded after fixing legacy exports, adapter typings, and test configs.
- BotFactory main flow now uses `buildBotServices` directly (reduces BotServices class dependency in core create path).
- BotFactory DI service (`services/bot-factory.service.ts`) now returns builder state; BotServices class dependency reduced.
- BotFactory `createServices` now returns builder state (no BotServices class dependency).
- BotServices class reduced to a thin legacy wrapper (no explicit fields or container logic).
- BotServices export removed from `services/index.ts` (avoid new usage).
- BotServices legacy wrapper removed entirely; codebase now uses builder state directly.
- Legacy `IBotServices` export removed from interfaces index (interface remains for legacy compatibility).
- Lifecycle groundwork added: `ILifecycle` interface and `LifecycleManager` service.
- ILifecycle implemented for WebSocketManagerService, PublicWebSocketService, PositionMonitorService, MonitoringServer.
- MonitoringServer start removed from `bot-services.builder.ts` (no side effects during build).
- BotInitializer now owns lifecycle shutdown sequencing via `LifecycleManager`.
- BotInitializer starts websockets via `start()` wrappers and starts MonitoringServer after init.
- BotInitializer tests updated to expect start/stop instead of connect/disconnect.
- TradingOrchestrator constructor side effects moved into `start()` with `stop()` for snapshot gate.
- BotInitializer now starts TradingOrchestrator during initialize (before websockets).
- AdvancedOrderStateMachineService timeout checker moved into `start()`/`stop()`.
- BulkheadService queue checker moved into `start()`/`stop()`.
- BotInitializer now starts Bulkhead and OrderStateMachine (when enabled).
- TradeHistoryService/TradingJournalService/VirtualBalanceService constructors are now side-effect free (lazy `start()` via ensure).
- SessionStatsService now lazy-initializes via `start()`/`ensureInitialized()`.
- BotMetricsService now lazy-initializes via `start()`/`ensureStarted()`.
- TradingLifecycleManager subscriptions moved to explicit `start()/stop()`.
- PositionStateMachineService constructor logging removed (no constructor side effects).
- Constructor logging removed in exit/ladder/tick-delta/orderbook/bybit/circuit-breaker services.
- Constructor logging removed in limit-order executor, binance adapter, multi-timeframe trend, strategy cache, exit handler, scalping strategies.
- Constructor side effects moved out for BotEventEmitter (bridge subscriptions), GracefulShutdownManager (state dir), and SQLite backtest providers (fs auto-detect).
- Constructor side effects moved out for RealTimeRiskMonitor (event subscription), JournalFileRepository (fs load/dir), WorkerPool (worker init), and BacktestEngineV5 (strategy file IO).
- Audit complete: no remaining constructor side effects found (timers/subscriptions/IO).
- Re-scan of constructors (timers/subscriptions/IO heuristics) found no remaining side effects.

## Next Session Start
- Return to DI Step 1: reduce `BotServices` to thin adapter once lifecycle work is stable.
- Verify builders/factories remain side-effect free as DI is simplified.

## Next Iteration Plan (2026-02-27 end)
1. Complete DI Step 1: reduce `BotServices` to a thin adapter (use grouped containers directly).
2. Verify builders/factories are side-effect free; keep lifecycle sequencing in `BotInitializer`.
3. Only if regressions appear, revisit lifecycle cleanup.
