# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Session Objective
- Continue incremental, behavior-preserving refactor.
- Prioritize lifecycle/testability and `any` cleanup in `packages/core/src/__tests__/services/*` and related services.

## Source of Truth
- Progress log and active status tracking: `ACTIVE_REFACTOR_PLAN.md` (single source of truth).
- Completed historical log: `REFACTOR_PLAN.md` (archived completed track).
- Task catalog/backlog by area: `REFACTOR_TASKS.md`.
- This file (`NEXT_SESSION_PROMPT.md`) is operational guidance only; do not store full historical progress here.

## Mandatory Session Rules
1. Always update `ACTIVE_REFACTOR_PLAN.md` with completed work and verification results before session end.
2. Update `REFACTOR_TASKS.md` only when adding/removing/restructuring backlog tasks.
3. For each test refactor, review the related production service as refactor candidate.
4. If service is a candidate, perform a behavior-preserving service refactor in same session (or add explicit pending item to `ACTIVE_REFACTOR_PLAN.md` with reason).
5. Keep this file short: only refresh "Last Completed" and "Next Step".
6. Keep user-facing replies short by default unless the user explicitly asks for more detail.

## Working Order Per Session
1. Pick next target from `ACTIVE_REFACTOR_PLAN.md` unchecked/in-progress items.
2. Use `REFACTOR_TASKS.md` for concrete task candidates if decomposition is needed.
3. Execute minimal safe refactor.
4. Run targeted tests for changed area.
5. Record results in `ACTIVE_REFACTOR_PLAN.md`.
6. Refresh only brief handoff below.

## Last Completed (2026-03-22)
- Completed a lifecycle/state-machine helper-consolidation batch:
  - extended `packages/core/src/__tests__/helpers/position-lifecycle-test.utils.ts` with explicit shared standard and legacy repository/memory/safety service paths and routed `packages/core/src/__tests__/services/position-lifecycle.error-handling.test.ts` plus `packages/core/src/__tests__/services/position-lifecycle.p0-safety.test.ts` through them instead of broad harness extraction.
  - extended `packages/core/src/__tests__/helpers/position-state-machine-test.utils.ts` with explicit shared standard and legacy service/harness initialization paths and routed `packages/core/src/__tests__/services/position-state-machine.service.test.ts` plus `packages/core/src/__tests__/services/position-state-machine.error-handling.test.ts` through them instead of generic `withErrorHandler: false` branches.
  - reviewed `packages/core/src/services/position-lifecycle.service.ts` and `packages/core/src/services/position-state-machine.service.ts` and left production code unchanged after review.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/position-lifecycle.p0-safety.test.ts packages/core/src/__tests__/services/position-state-machine.service.test.ts packages/core/src/__tests__/services/position-state-machine.error-handling.test.ts` -> PASS (4/4 suites, 75/75 tests).

## Next Step
- Continue the testability stream before reopening adapter cleanup.
- Prefer the next adjacent lifecycle/position slice next to the refreshed lifecycle/state-machine area, such as `position-sync.service`, `position-monitor.service`, `position-exiting.*`, or another nearby constructor-heavy suite that still mixes shared setup with direct service recreation or generic legacy branches.
- Keep favoring shared harnesses, explicit teardown where lifecycle exists, and minimal required dependency groups per suite.
