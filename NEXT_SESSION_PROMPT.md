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

## Current Status (as of 2026-03-01)
- Domain-type migration in services/strategies/tests is complete via legacy re-exports.
- Multi-strategy module exports now re-export from legacy.
- Package-level verification run (2026-03-01): `build:contracts`, `build:web-server`, `build:core`, `build:web-client`, `test:web-client` passed.
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
- Legacy `IBotServices` interface removed from `packages/core/src/interfaces/IServices.ts`.
- Legacy `IBotServices` export removed from interfaces index (interface remains for legacy compatibility).
- BotFactory DI now returns adapter source; overrides refresh grouped core/market/web-api containers; tests updated to use grouped access.
- Adapter interfaces trimmed: removed duplicate `publicWebSocket`/`candleProvider` from `IBotServicesAdapterSource` + `IBotInitializerServices`, adapter now pulls from `marketDataServices`.
- Trading BotFactory now delegates service creation to DI BotFactory (single DI composition root for services).
- BotFactory internals split into factory modules (validation + overrides) to avoid “god factory”.
- BotServices builder split into modular builders (core/optional/position/websocket/orchestrator/monitoring/grouped).
- Contracts package now exports Web API contract types and response wrappers.
- Root build now runs `packages/contracts` then `web-server` before core build.
- Root + web-server tsconfig paths now resolve `@edison/contracts` to source.
- Core Web API imports started using `@edison/contracts` (bot/api/interfaces/grouped).
- Web-client tsconfig + Vite alias now resolve `@edison/contracts`; web-client types re-export contracts.
- Web-client feature code now imports Web API contract types directly from `@edison/contracts`.
- WebApiCandle is now part of contracts; web-server uses contracts types directly.
- Web-client WebSocket and chart types now pull WebApiCandle from contracts directly.
- WebApi response wrappers (candles/positions) moved to contracts; web-client API service imports them directly.
- Web-client types index no longer re-exports Web API contracts (use contracts directly).
- Removed redundant web-client Web API type file; web-server API types no longer re-export Web API contracts.
- Web API type imports now consistently come from `@edison/contracts`.
- Core web entrypoint now imports `WebServer` via package (no dynamic `dist` import).
- Project references scaffolded via `tsconfig.references.json` + composite builds (contracts/web-server/core).
- Added `build:refs` script to run reference builds.
- Build succeeded after switching to web-server package import (2026-02-28).
- Core sources moved to `packages/core/src`; root scripts updated to use new entrypoints.
- Build succeeded after full core move (2026-02-28).
- Composition roots split: CLI moved to `packages/core/src/cli/index.ts`, core entrypoint in `packages/core/src/core/index.ts`, `packages/core/src/index.ts` now wrapper.
- ConfigPipeline added to centralize strategy merge; CLI now loads via pipeline; BotFactory no longer merges strategies.
- README updated with entrypoints section.
- ConfigPipeline re-exported from `packages/core/src/config/index.ts` for convenience.
- CLI now uses `loadValidatedConfig()` from ConfigPipeline (validation centralized in pipeline).
- CLI entrypoint no longer depends on `TradingBot` class (uses BotLike interface).
- Core entrypoint now returns BotLike and avoids importing TradingBot.
- Risk management validation moved to `packages/core/src/config/risk-management.validate.ts`.
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
- Tooling/docs stale path audit completed for core-move follow-up; outdated `src/` references fixed in migration scripts and architecture docs.
- Packaging decision updated: `web-server` and `web-client` are now part of `packages/*` as `packages/web-server` and `packages/web-client`.
- CI package-level workflow added (`.github/workflows/package-builds.yml`) for independent builds of contracts/web-server/core/web-client.
- Root helper scripts added for CI package checks (`build:*` and `test:web-client`).
- `REFACTOR_TASKS.md` paths synced to `packages/core/src/*` for current repo layout.
- `web-server` and `web-client` migrated to `packages/web-server` and `packages/web-client`.
- Root scripts/tsconfig references updated to new package paths.
- Post-move verification passed: `npm run build` and `npm run test:web-client`.
- Optional package test wiring added: `test:core` + `test:web-server` scripts and CI steps (non-blocking).

## Next Session Start
- Continue targeted docs cleanup for remaining historical top-level `web-server`/`web-client` path mentions.
- Decide whether to make `core`/`web-server` test jobs blocking after stabilization.

## Next Tasks
1. Sweep remaining docs for stale top-level `web-server`/`web-client` paths when touched.
2. Promote optional `core`/`web-server` CI tests to blocking when stable.

## Next Iteration Plan (2026-02-28 end)
1. Complete DI Step 1: reduce `BotServices` to a thin adapter (use grouped containers directly).
2. Verify builders/factories are side-effect free; keep lifecycle sequencing in `BotInitializer`.
3. Only if regressions appear, revisit lifecycle cleanup.
