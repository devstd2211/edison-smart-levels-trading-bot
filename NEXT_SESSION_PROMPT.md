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
- Legacy `IBotServices` export removed from interfaces index (interface remains for legacy compatibility).
- Lifecycle groundwork added: `ILifecycle` interface and `LifecycleManager` service.
- ILifecycle implemented for WebSocketManagerService, PublicWebSocketService, PositionMonitorService, MonitoringServer.
- MonitoringServer start removed from `bot-services.builder.ts` (no side effects during build).
- BotInitializer now owns lifecycle shutdown sequencing via `LifecycleManager`.
- BotInitializer starts websockets via `start()` wrappers and starts MonitoringServer after init.
- BotInitializer tests updated to expect start/stop instead of connect/disconnect.
- TradingOrchestrator constructor side effects moved into `start()` with `stop()` for snapshot gate.
- BotInitializer now starts TradingOrchestrator during initialize (before websockets).

## Next Session Start
- Continue lifecycle cleanup: remove remaining constructor side effects; ensure TradingBot.start orchestrates lifecycle only.
- Return to DI Step 1: reduce `BotServices` to thin adapter once lifecycle is stable.
