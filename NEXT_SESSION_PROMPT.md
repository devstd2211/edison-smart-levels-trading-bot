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
- Completed the requested next lifecycle/testability narrowing slice across `position-monitor.error-handling`, `position-lifecycle.repository-integration`, `position-lifecycle.error-handling`, `position-lifecycle.p0-safety`, `position-exiting.service`, `position-exiting.race-condition`, `position-exiting.integration`, `position-exiting.functional`, `position-exiting.error-handling`, `position-exiting.transactional`, `dynamic-position-sizer`, `strategy-manager.error-handling`, `risk-manager.service`, `risk-manager.error-handling`, `risk-calculator.error-handling`, `real-time-risk-monitor.service`, `real-time-risk-monitor.error-handling`, `real-time-risk-monitor.cache-invalidation`, `take-profit-manager.service`, and `take-profit-manager.error-handling`.
  - narrowed a 20-task batch by replacing direct helper-exported managed runtime/state test-type dependencies with suite-local `ReturnType<typeof createManaged...>` aliases and trimming suite-local managed-context surface.
  - kept the slice behavior-preserving; no adjacent production refactor was required.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-monitor.error-handling.test.ts packages/core/src/__tests__/services/position-lifecycle.repository-integration.test.ts packages/core/src/__tests__/services/position-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/position-lifecycle.p0-safety.test.ts packages/core/src/__tests__/services/position-exiting.service.test.ts packages/core/src/__tests__/services/position-exiting.race-condition.test.ts packages/core/src/__tests__/services/position-exiting.integration.test.ts packages/core/src/__tests__/services/position-exiting.functional.test.ts packages/core/src/__tests__/services/position-exiting.error-handling.test.ts packages/core/src/__tests__/services/position-exiting.transactional.test.ts packages/core/src/__tests__/services/dynamic-position-sizer.test.ts packages/core/src/__tests__/services/strategy-manager.error-handling.test.ts packages/core/src/__tests__/services/risk-manager.service.test.ts packages/core/src/__tests__/services/risk-manager.error-handling.test.ts packages/core/src/__tests__/services/risk-calculator.error-handling.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.service.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.error-handling.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.cache-invalidation.test.ts packages/core/src/__tests__/services/take-profit-manager.service.test.ts packages/core/src/__tests__/services/take-profit-manager.error-handling.test.ts` -> PASS (20 suites / 447 tests).
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next nearby leftovers surfaced by `rg` after this slice, especially suites that still keep helper-accessor wrappers, broader-than-needed managed runtime aliases, or remaining local setup/binder indirection outside this cluster.
- Good nearby follow-ups after this batch: `smart-order-execution`, `websocket-manager.service`, `websocket-manager.error-handling`, `tf-alignment.service`, `tf-alignment.error-handling`, `timeframe-weighting.error-handling`, `whale-wall-tp.error-handling`, and `ml-signal-validator.error-handling`.
