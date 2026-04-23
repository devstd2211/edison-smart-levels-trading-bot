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

## Last Completed (2026-04-23)
- Completed the next ten-task lifecycle/testability narrowing slice across `graceful-shutdown.service`, `graceful-shutdown.error-handling`, `indicator-cache.error-handling`, `session-stats.error-handling`, `strategy-manager.error-handling`, `risk-manager.service`, `risk-manager.error-handling`, `trading-journal.service`, `trading-journal.error-handling`, and `position-monitor.service`.
  - added narrower helper-owned suite/error aliases for graceful shutdown, indicator cache, session stats, strategy manager, risk manager, trading journal, and position monitor helpers, then switched the touched tests off broader managed-runtime naming and one remaining explicit cast in `risk-manager.error-handling`.
  - kept the slice behavior-preserving; the main follow-up inside the batch was continuing the move from managed-context-derived names and ad hoc runtime casts toward explicit suite contracts while preserving the same harness factories and cleanup semantics.
  - reviewed adjacent production surfaces opportunistically; no production follow-up was required in this slice.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/graceful-shutdown.service.test.ts packages/core/src/__tests__/services/graceful-shutdown.error-handling.test.ts packages/core/src/__tests__/services/indicator-cache.error-handling.test.ts packages/core/src/__tests__/services/session-stats.error-handling.test.ts packages/core/src/__tests__/services/strategy-manager.error-handling.test.ts packages/core/src/__tests__/services/risk-manager.service.test.ts packages/core/src/__tests__/services/risk-manager.error-handling.test.ts packages/core/src/__tests__/services/trading-journal.service.test.ts packages/core/src/__tests__/services/trading-journal.error-handling.test.ts packages/core/src/__tests__/services/position-monitor.service.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next nearby leftovers surfaced by `rg` after this slice, especially suites like `position-lifecycle.error-handling`, `advanced-order-state-machine`, `advanced-order-flow.error-handling`, `exit-type-detector.service`, `exit-type-detector.service.error-handling`, `timeframe-weighting.error-handling`, `trading-lifecycle.error-handling`, `indicator-cache`-adjacent leftovers, or other nearby suites that still keep direct managed-context exports, repeated `ReturnType<typeof createManaged...>` expressions, helper-accessor wrappers, or wider-than-needed state aliases.
- Keep reviewing adjacent production services opportunistically, but prefer test-owned lifecycle/state cleanup first unless a small behavior-preserving service refactor is clearly exposed.
