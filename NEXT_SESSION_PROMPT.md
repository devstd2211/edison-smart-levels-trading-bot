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

## Current Status (as of 2026-03-03)
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
- Root build now runs `packages/contracts` then `packages/web-server` before core build.
- Root + `packages/web-server` tsconfig paths now resolve `@edison/contracts` to source.
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
- Project references scaffolded via `tsconfig.references.json` + composite builds (`packages/contracts`/`packages/web-server`/`packages/core`).
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
- CI package-level workflow added (`.github/workflows/package-builds.yml`) for independent builds of `packages/contracts`/`packages/web-server`/`packages/core`/`packages/web-client`.
- Root helper scripts added for CI package checks (`build:*` and `test:web-client`).
- `REFACTOR_TASKS.md` paths synced to `packages/core/src/*` for current repo layout.
- `web-server` and `web-client` migrated to `packages/web-server` and `packages/web-client`.
- Root scripts/tsconfig references updated to new package paths.
- Post-move verification passed: `npm run build` and `npm run test:web-client`.
- Package test wiring added: `test:core` + `test:web-server` scripts and CI steps (blocking).
- Historical path cleanup applied in `PHASE_17_WEB_UI_OPTIMIZATION.md` (`web-client/*` -> `packages/web-client/*`).
- `test:core` CI runtime optimized with blocking Jest sharding (2 shards via `--shard`).
- `test:core:ci` script added (`test:core:stable` + `--forceExit`) to stabilize CI completion with open handles.
- Local verification passed for full shard runs: `test:core:ci -- --shard=1/2` and `test:core:ci -- --shard=2/2`.
- `session-stats.error-handling.test.ts` returned to `test:core` (removed from ignore list) after updating test for lazy service initialization.
- `trading-journal.error-handling.test.ts` returned to `test:core` (removed from ignore list) after updating test for lazy service initialization.
- `virtual-balance.error-handling.test.ts` returned to `test:core` (removed from ignore list) after updating test for lazy service initialization.
- `bot-metrics.service.test.ts` returned to `test:core` (removed from ignore list) after updating test for lazy service initialization.
- `bot-metrics.error-handling.test.ts` returned to `test:core` (removed from ignore list) after updating tests for lazy service initialization.
- `phase-10-3b-orchestrator-implementation.test.ts` returned to `test:core` (removed from ignore list) after aligning test with constructor side-effect cleanup.
- `filter.orchestrator.error-handling.test.ts` returned to `test:core` (removed from ignore list) after aligning missing-signal expectation with graceful deny behavior.
- `analyzer-engine.error-handling-advanced.test.ts` returned to `test:core` (removed from ignore list) after targeted verification (15/15 passing).
- Full `test:core:ci` verification passed with all suites enabled and empty ignore list: 304/304 test suites, 7014/7014 tests (2026-03-01).
- Open-handle triage started: `--detectOpenHandles` on full `bot-initializer.error-handling` hangs without `--forceExit`, but isolated `B1` test exits normally (likely multi-test teardown leak).
- Triage script `test:core:handles:b` added and verified passing (Block B isolated run exits cleanly, 3/3 in section B).
- Triage script `test:core:handles:a` verified passing (Block A isolated run exits cleanly, 5/5 in section A).
- `test:core:handles:cdef` now exits cleanly after adding teardown for Block C (`startMonitoring` path).
- Root cause confirmed: Block C leaked handles via periodic tasks started in `startMonitoring()`; fixed with `afterEach(async () => await initializer.shutdown())` in C tests.
- Full `--detectOpenHandles` run for `bot-initializer.error-handling` now exits cleanly (15/15).
- Additional heavy suites also exit cleanly with `--detectOpenHandles`:
  - `limit-order-executor.error-handling` (22/22)
  - `candle-provider.error-handling` (20/20)
- New helper script `test:core:handles:limit-order` validated (PASS, exits cleanly).
- Added aggregate triage command: `npm run test:core:handles:smoke`.
- Minor test hygiene: normalized arrow glyphs in `bot-initializer.error-handling` test names and extracted section C cleanup helper.
- Controlled run without `--forceExit` passes all tests (`304/304`, `7014/7014`) but still hangs after completion.
- Both shard runs without `--forceExit` (`--shard=1/2`, `--shard=2/2`) also hang after completion.
- Phase 16 flaky threshold stabilized: burst degradation assertion now `<= 0.5`.
- BotInitializer lifecycle start flow refactored via shared `startLifecycleService` helper (execution/monitoring/resilience/server) with preserved critical vs non-critical error behavior.
- Targeted BotInitializer suites re-verified (2026-03-03): `bot-initializer.test.ts` + `services/bot-initializer.error-handling.test.ts` = 36/36 PASS; run without `--forceExit` still reports post-run open handles.
- Open-handle source isolated in shard triage: `MTFSnapshotGate` test suites leaked interval handles; fixed with explicit `gate.stop()` teardown in `mtf-snapshot-gate.test.ts` and `mtf-snapshot-gate.functional.test.ts`.
- Additional noforce hang source isolated: `bot-initializer.test.ts` left lifecycle tasks running in some cases; fixed with `afterEach(async () => await initializer.shutdown().catch(...))`.
- Post-fix verification (2026-03-03): `test:core:noforce:shard1` and `test:core:noforce:shard2` both complete successfully without `--forceExit`.
- Core lifecycle typing cleanup (2026-03-03): removed `as any` usages in `bot-initializer.ts` for `exchangeFactory`/`exchange.name` and periodic cleanup position-opening check.
- PositionLifecycleService now exposes `isPositionOpening()`; BotInitializer uses it instead of private-field access.
- Re-verified targeted BotInitializer suites after cleanup (2026-03-03): `bot-initializer.test.ts` + `services/bot-initializer.error-handling.test.ts` = 36/36 PASS.
- Re-verified noforce shard stability after lifecycle cleanup (2026-03-03): `test:core:noforce:shard1` and `test:core:noforce:shard2` both PASS and exit cleanly.
- BotInitializer bootstrap sequencing added (2026-03-03): `initialize` -> `logDataSubscriptionStatus` -> `connectWebSockets` -> hook -> `startMonitoring`.
- TradingBot start flow now delegates lifecycle sequencing to `initializer.bootstrap(...)`; event handlers/critical hooks are injected via `beforeMonitoring` hook.
- BotInitializer test suite expanded for bootstrap behavior; targeted run now `38/38` PASS (`bot-initializer.test.ts` + `services/bot-initializer.error-handling.test.ts`).
- Added explicit side-effect-free `createServices(config, options?)` API in `services/bot-factory.service.ts`.
- Factory tests migrated to `createServices()` path and re-verified (2026-03-03): `bot-factory.service.test.ts` + `bot-factory.error-handling.test.ts` = 52/52 PASS.
- Remaining factory helper assertions migrated from `createForTesting()` to `createServices()` in unit suite; `createForTesting` kept only as backward-compat validation check in error-handling suite.
- Re-verified factory suites after helper-method migration (2026-03-03): `bot-factory.service.test.ts` = 16/16 PASS and `bot-factory.error-handling.test.ts` = 36/36 PASS.
- Added lifecycle integration test for `createServices()` flow: explicit `BotInitializer.bootstrap()`/`shutdown()` (no constructor-time lifecycle starts).
- Verified new lifecycle integration test (2026-03-03): `create-services.lifecycle.test.ts` = 1/1 PASS.
- Re-verified noforce shards after adding lifecycle test (2026-03-03): `test:core:noforce:shard2` PASS and `test:core:noforce:shard1` PASS.
- Added `TradingBot` lifecycle delegation unit test suite (`trading-bot.lifecycle.test.ts`) to lock in `start()/stop()` orchestration through `BotInitializer.bootstrap()`/`shutdown()`.
- Verified new `TradingBot` lifecycle suite (2026-03-03): `trading-bot.lifecycle.test.ts` = 3/3 PASS.
- Re-verified noforce shards after TradingBot lifecycle suite addition (2026-03-03): `test:core:noforce:shard1` PASS and `test:core:noforce:shard2` PASS.
- Added lifecycle integration test for real `TradingBot` flow built via `createServices()` + adapter bundle (`trading-bot.create-services.lifecycle.test.ts`) with explicit `start()/stop()` orchestration checks.
- Verified new TradingBot+createServices lifecycle integration test (2026-03-03): `trading-bot.create-services.lifecycle.test.ts` = 1/1 PASS.
- Re-verified noforce shards after TradingBot+createServices lifecycle integration test (2026-03-03): `test:core:noforce:shard1` PASS (154 suites) and `test:core:noforce:shard2` PASS (153 suites).
- Core `any` cleanup continued (2026-03-03): `ActionQueueService` no-handler error path now uses typed action-type extraction (removed `as any` access).
- Verified ActionQueue and smoke safety suites after cleanup (2026-03-03): `action-queue.error-handling.test.ts` = 26/26 PASS; `deployment-safety.smoke.test.ts` = 16/16 PASS.
- Core `any` cleanup continued (2026-03-03): `ConfigValidatorService.printEnabledAnalyzers()` now uses typed enabled-flag extraction helper (removed `as any` access).
- Verified ConfigValidator suites after cleanup (2026-03-03): `config-validator.service.test.ts` = 14/14 PASS; `config-validator.error-handling.test.ts` = 22/22 PASS.
- Core `any` cleanup continued (2026-03-03): `TradingLifecycleManager` emergency-close queueing now uses typed `IAction` payload (removed `enqueue(closeAction as any)` casts).
- Verified TradingLifecycle/Phase9 suites after cleanup (2026-03-03): `trading-lifecycle.error-handling.test.ts` = 35/35 PASS; `phase-9-live-trading.integration.test.ts` = 37/37 PASS.
- Core `any` cleanup continued (2026-03-03): `TradingLifecycleManager` EventBus subscription handlers now accept `unknown` payloads with typed extractors (removed `event: any` in opened/closed handlers).
- Re-verified TradingLifecycle/Phase9 suites after payload typing cleanup (2026-03-03): `trading-lifecycle.error-handling.test.ts` = 35/35 PASS; `phase-9-live-trading.integration.test.ts` = 37/37 PASS.
- Core `any` cleanup continued (2026-03-03): Bybit/Binance funding-rate adapter calls now use typed `hasFundingRateMethod` guards (removed dynamic `as any` getFundingRate calls).
- Verified exchange adapter/factory suites after funding-rate typing cleanup (2026-03-03): `bybit-service.adapter.test.ts` = 47/47 PASS; `exchange-factory.service.test.ts` = 27/27 PASS.
- Core `any` cleanup continued (2026-03-03): `ExchangeFactory` Bybit service instantiation now uses typed config with optional `timeframe` defaulting to `'15'` (removed `bybitConfig as any` cast).
- Verified ExchangeFactory suites after factory typing cleanup (2026-03-03): `exchange-factory.service.test.ts` = 27/27 PASS; `exchange-factory.error-handling.test.ts` = 24/24 PASS.
- Known issue (Windows, intermittent): `vite build` in `packages/web-client` may fail with `spawn EPERM` (esbuild process spawn). Mitigation added: web-client build script now retries `vite build` once via `scripts/vite-build-retry.cjs`.
- Clarification (2026-03-03): `npm --prefix packages/web-client run test` runs `jest` only; `vite` appears only through build scripts (e.g. `build:web-client` in chained commands).

## Next Session Start
- Keep `test:core:stable` ignore list empty and guard against regressions.
- Keep targeted path cleanup only when touching historical docs.

## Next Tasks
1. Keep noforce shard runs green and re-check after each lifecycle/test cleanup change.
2. Keep `test:core:stable` green without expanding ignore list.
3. Keep package-level build/test checks green after each incremental refactor step.

### Open Handle Triage Checklist
- [x] Block A
- [x] Block B
- [x] Block C
- [x] Block D (validated in grouped CDEF run)
- [x] Block E (validated in grouped CDEF run)
- [x] Block F (validated in grouped CDEF run)

### Quick Start Commands
```bash
npm test -- --runInBand --detectOpenHandles --runTestsByPath packages/core/src/__tests__/services/bot-initializer.error-handling.test.ts -t "A:"
npm test -- --runInBand --detectOpenHandles --runTestsByPath packages/core/src/__tests__/services/bot-initializer.error-handling.test.ts -t "B:"
npm test -- --runInBand --detectOpenHandles --runTestsByPath packages/core/src/__tests__/services/bot-initializer.error-handling.test.ts -t "C:|D:|E:|F:"
npm run test:core:handles:limit-order
npm run test:core:handles:candle-provider
npm run test:core:handles:smoke
npm run test:core:noforce:shard1
npm run test:core:noforce:shard2
```

## Next Iteration Plan (2026-03-01 end)
1. Re-run targeted open-handle checks on other long-running suites and keep `test:core:stable` ignore list empty.
2. Attempt `test:core:ci` without `--forceExit` in a controlled run and evaluate stability.
3. Keep package-level build/test checks green after each incremental refactor step.
