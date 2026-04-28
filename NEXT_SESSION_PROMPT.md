# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Session Objective
- Continue incremental, behavior-preserving refactor.
- Prioritize lifecycle/testability cleanup in `packages/core/src/__tests__/services/*` and adjacent production services when a small safe follow-up is clearly exposed.

## Source of Truth
- Current active work only: `ACTIVE_REFACTOR_PLAN.md`.
- Task catalog/backlog by area: `REFACTOR_TASKS.md`.
- Frozen archive: `REFACTOR_PLAN_01.md` and any other historical plan files.

## Context Rules
1. Do not load historical archive files by default.
2. Do not paste or rebuild chronological history into `ACTIVE_REFACTOR_PLAN.md`.
3. Keep only the latest completed slice and latest verification in `ACTIVE_REFACTOR_PLAN.md`.
4. Use archive files only if the user explicitly asks for historical detail or a previous decision rationale.

## Mandatory Session Rules
1. Always update `ACTIVE_REFACTOR_PLAN.md` with the latest completed slice and latest verification before session end.
2. Update `REFACTOR_TASKS.md` only when adding/removing/restructuring backlog tasks.
3. For each test refactor, review the related production service as refactor candidate.
4. If service is a candidate, perform a behavior-preserving service refactor in the same session or note a short pending item in `ACTIVE_REFACTOR_PLAN.md`.
5. Keep this file short: refresh only `Last Completed` and `Next Step`.
6. Keep user-facing replies short by default unless the user explicitly asks for more detail.
7. Do not maintain a running historical journal here.

## Working Order Per Session
1. Read `ACTIVE_REFACTOR_PLAN.md`.
2. Pick the next unchecked item.
3. Use `REFACTOR_TASKS.md` only if decomposition is needed.
4. Execute minimal safe refactor.
5. Run targeted tests for the changed area.
6. Run `npm run build`.
7. Update only the concise handoff below and the active plan.

## Last Completed (2026-04-28)
- Completed the requested next lifecycle/testability narrowing slice across `advanced-order-flow.error-handling`, `advanced-order-state-machine`, `anomaly-detection.error-handling`, `bot-factory.service`, `event-handlers.error-handling`, `fractal-smc-weighting.error-handling`, `indicator-cache.error-handling`, `indicator-precalculation.error-handling`, `limit-order-executor.service`, `limit-order-executor.error-handling`, `ladder-exit-detector.service.error-handling`, `trading-bot.lifecycle`, `trading-bot.create-services.lifecycle`, `create-services.lifecycle`, `whale-wall-tp.service`, `whale-wall-tp.error-handling`, `advanced-order-flow-test.utils`, `advanced-order-state-machine-test.utils`, `limit-order-executor-test.utils`, and `ladder-exit-detector-test.utils`.
  - narrowed a 20-task batch by replacing remaining suite-local `ReturnType<typeof createManaged...>` aliases with exported helper runtime/context types, and by promoting repeated helper option signatures into named shared factory/harness types.
  - reviewed adjacent production surfaces around order-flow/state-machine handling, anomaly detection, lifecycle orchestration, event handlers, indicator caching/precalculation, ladder exit analysis, limit-order execution, and whale-wall TP handling; no small safe production refactor was required.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/advanced-order-flow.error-handling.test.ts packages/core/src/__tests__/services/advanced-order-state-machine.test.ts packages/core/src/__tests__/services/anomaly-detection.error-handling.test.ts packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/event-handlers.error-handling.test.ts packages/core/src/__tests__/services/fractal-smc-weighting.error-handling.test.ts packages/core/src/__tests__/services/indicator-cache.error-handling.test.ts packages/core/src/__tests__/services/indicator-precalculation.error-handling.test.ts packages/core/src/__tests__/services/limit-order-executor.service.test.ts packages/core/src/__tests__/services/limit-order-executor.error-handling.test.ts packages/core/src/__tests__/services/ladder-exit-detector.service.error-handling.test.ts packages/core/src/__tests__/trading-bot.lifecycle.test.ts packages/core/src/__tests__/trading-bot.create-services.lifecycle.test.ts packages/core/src/__tests__/services/create-services.lifecycle.test.ts packages/core/src/__tests__/whale-wall-tp.service.test.ts packages/core/src/__tests__/services/whale-wall-tp.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next nearby leftovers surfaced by `rg` after this slice, especially suites that still keep direct `ReturnType<typeof createManaged...>` field picks, duplicated inline factory option objects, or redundant cast/accessor wrappers adjacent to this cluster.
- Good nearby follow-ups after this batch: `trading-bot.create-services.lifecycle`, `trading-bot.lifecycle`, `create-services.lifecycle`, `websocket-manager.service`, `websocket-manager.error-handling`, `websocket-authentication.service`, `websocket-authentication.error-handling`, `wall-tracker.service`, `wall-tracker.error-handling`, `whale-detection.error-handling`, and `weight-matrix-calculator.*`.
