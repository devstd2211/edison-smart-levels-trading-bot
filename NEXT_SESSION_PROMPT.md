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

## Last Completed (2026-04-26)
- Completed the requested next lifecycle/testability narrowing slice across `tf-alignment.service`, `tf-alignment.error-handling`, `timeframe-weighting.error-handling`, `whale-wall-tp.error-handling`, `ml-signal-validator.error-handling`, `strategy-config-merger.error-handling`, `smart-order-placement.error-handling`, `swing-point-detector.error-handling`, `whale-detector.service`, `websocket-authentication.error-handling`, `websocket-authentication.service`, `websocket-event-handler.error-handling`, `websocket-keep-alive.service`, `whale-detection.error-handling`, `weight-matrix-calculator.error-handling`, `weight-matrix-calculator.service`, `websocket-manager.service`, `websocket-manager.error-handling`, `smart-order-execution`, and `trading-lifecycle.error-handling`.
  - narrowed a 20-task batch by replacing helper-exported managed runtime/state aliases with suite-local `ReturnType<typeof createManaged...>` context aliases and context property picks, trimming suite-local type surface while keeping helper ownership intact.
  - kept the slice behavior-preserving; no adjacent production refactor was required.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/tf-alignment.service.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts packages/core/src/__tests__/services/timeframe-weighting.error-handling.test.ts packages/core/src/__tests__/services/whale-wall-tp.error-handling.test.ts packages/core/src/__tests__/services/ml-signal-validator.error-handling.test.ts packages/core/src/__tests__/services/strategy-config-merger.error-handling.test.ts packages/core/src/__tests__/services/smart-order-placement.error-handling.test.ts packages/core/src/__tests__/services/swing-point-detector.error-handling.test.ts packages/core/src/__tests__/services/whale-detector.service.test.ts packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts packages/core/src/__tests__/services/websocket-authentication.service.test.ts packages/core/src/__tests__/services/websocket-event-handler.error-handling.test.ts packages/core/src/__tests__/services/websocket-keep-alive.service.test.ts packages/core/src/__tests__/services/whale-detection.error-handling.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.error-handling.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.service.test.ts packages/core/src/__tests__/services/websocket-manager.service.test.ts packages/core/src/__tests__/services/websocket-manager.error-handling.test.ts packages/core/src/__tests__/services/smart-order-execution.test.ts packages/core/src/__tests__/services/trading-lifecycle.error-handling.test.ts` -> PASS (20 suites / 519 tests).
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next nearby leftovers surfaced by `rg` after this slice, especially suites that still keep helper-accessor wrappers, broader-than-needed managed runtime aliases, or remaining local setup/binder indirection adjacent to this cluster.
- Good nearby follow-ups after this batch: `strategy-loader.test`, `strategy-loader.error-handling`, `multi-timeframe-trend.error-handling`, `orderbook-manager.service.test`, `orderbook-manager.service.error-handling`, `public-websocket.error-handling`, `retest-entry.service`, and `retest-entry.error-handling`.
