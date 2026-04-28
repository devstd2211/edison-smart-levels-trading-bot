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
- Completed the requested next lifecycle/testability narrowing slice across `health-check.test`, `monitoring-server.test`, `time.service.test`, `trade-history.error-handling.test`, `virtual-balance.error-handling.test`, and `monitoring-server-test.utils`.
  - narrowed a 20-task batch by replacing the selected suite-local `ReturnType<typeof createManaged...>` field picks with exported helper runtime/state contracts, and by promoting `createDegradedHealthStatus` onto the managed monitoring-server context to remove the remaining nested helper accessor wrapper.
  - reviewed adjacent production surfaces around `health-check.service`, `monitoring-server.service`, `time.service`, `trade-history.service`, and `virtual-balance.service`; no small safe production refactor was required.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/health-check.test.ts packages/core/src/__tests__/services/monitoring-server.test.ts packages/core/src/__tests__/services/time.service.test.ts packages/core/src/__tests__/services/trade-history.error-handling.test.ts packages/core/src/__tests__/services/virtual-balance.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next nearby leftovers surfaced by `rg` after this slice, especially suites that still keep direct `ReturnType<typeof createManaged...>` field picks, direct context aliases, duplicated inline factory option objects, or helper-owned accessor wrappers adjacent to the monitoring/timeframe utilities cluster.
- Good nearby follow-ups after this batch: the remaining `virtual-balance.*` integration locals, `timeframe-weighting.*`, `tf-alignment.*`, `mtf-snapshot-gate.*`, and any adjacent helper exports needed to eliminate the next binder/accessor leftovers cleanly.
