# Next Session Prompt

You are continuing a refactor in `D:\src\Edison`.

Current artifacts:
- `REFACTOR_PLAN.md` contains the global plan and per‑area checklists.
- `REFACTOR_TASKS.md` contains issue‑ready task lists by area.

Focus for this session:
1. Start with DI + Containers (Area A) and prepare the dependency map.
2. Identify the smallest safe slice to refactor first, without touching runtime behavior.

Steps to do:
1. Open `src/services/bot-services.ts` and enumerate all services and their dependencies.
2. Create `docs/architecture/dependency-map.md` with a flat list of services and immediate dependencies.
3. Propose the first migration slice, likely a non‑critical adapter such as `BotWebAPI` or a read‑only service group.
4. Do not modify runtime paths yet. Keep changes minimal and focused on architecture scaffolding.

Constraints:
- Keep constructors side‑effect free when introducing new containers.
- Avoid changing behavior until the dependency map and minimal interfaces are in place.

Deliverables for this session:
- `docs/architecture/dependency-map.md`
- A short summary of the first migration slice and why it is low‑risk.

## Current Status (as of 2026-02-27)
- Domain-type migration in services/strategies/tests is complete via legacy re-exports.
- Multi-strategy module exports now re-export from legacy.
- Tests not run.
- BotServicesAdapter decoupled from BotServices via IBotServicesAdapterSource.
- BotFactory createForTesting overrides typed to IBotServicesAdapterSource.
- Grouped container wiring extracted into createGroupedServices helper.
- BotServices grouped container wiring moved into initializeGroupedServices helper.
- BotServices optional services initialization moved into initializeOptionalServices helper.
- BotServices monitoring/resilience initialization moved into initializeMonitoringAndResilience helper.
- BotServices websocket/orderbook/position monitor initialization moved into initializeWebSocketAndMonitoring helper.
- BotServices position management initialization moved into initializePositionManagement helper.
- BotServices orchestrator/handlers initialization moved into initializeOrchestratorAndHandlers helper.
- BotServices dashboard/logger/repositories initialization moved into initializeCoreInfrastructure helper.
- BotServices service fields made non-readonly to allow helper-based initialization.
- BotServices builder created; BotServices now thin wrapper with readonly fields restored.
- Dependency map refreshed and aligned to `bot-services.builder.ts` source.
- Build run (`npm run build`) succeeded after fixing legacy exports, adapter typings, and test configs.
- Legacy type cleanup: removed duplicate exports, restored enum/class value exports, added missing re-exports, aligned SwingPoint to include index/strength, and split smart-order placement strategic config.
- BotServicesAdapter source contract expanded to include web API read services + logger; adapter now passes logger/webApiServices explicitly to avoid logger type mismatch.
- Pattern recognition service/tests updated to use `SwingPointType` enum and index field.
- Test fixes: bot-initializer config completed (exchange/trading/indicators/risk/logging/entryConfig), event handlers ctor typing + side literals, integration TP/OrderType enums, smoke tests SignalDirection checks, position validator mock usage, error context typing.

## Next Session Start
- Continue: reduce `BotServices` to thin adapter (REFACTOR_PLAN Step 1 remaining).
- Proceed to lifecycle cleanup when ready (remove side effects from constructors).
