# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Session Objective
- Continue incremental, behavior-preserving refactor.
- Prioritize lifecycle/testability and `any` cleanup in `packages/core/src/__tests__/services/*` and related services.

## Source of Truth
- Progress log and status tracking: `REFACTOR_PLAN.md` (single source of truth).
- Task catalog/backlog by area: `REFACTOR_TASKS.md`.
- This file (`NEXT_SESSION_PROMPT.md`) is operational guidance only; do not store full historical progress here.

## Mandatory Session Rules
1. Always update `REFACTOR_PLAN.md` with completed work and verification results before session end.
2. Update `REFACTOR_TASKS.md` only when adding/removing/restructuring backlog tasks.
3. For each test refactor, review the related production service as refactor candidate.
4. If service is a candidate, perform a behavior-preserving service refactor in same session (or add explicit pending item to `REFACTOR_PLAN.md` with reason).
5. Keep this file short: only refresh "Last Completed" and "Next Step".

## Working Order Per Session
1. Pick next target from `REFACTOR_PLAN.md` unchecked/in-progress items.
2. Use `REFACTOR_TASKS.md` for concrete task candidates if decomposition is needed.
3. Execute minimal safe refactor.
4. Run targeted tests for changed area.
5. Record results in `REFACTOR_PLAN.md`.
6. Refresh only brief handoff below.

## Last Completed (2026-03-07)
- Completed major lifecycle extraction pass:
  - Added `position-lifecycle-sync-lifecycle.orchestrator.ts` and moved websocket sync route/log orchestration out of service.
  - Added `position-lifecycle-clear-lifecycle.orchestrator.ts` and moved clear-finalize lifecycle (repo clear log + runtime reset + close event emit) out of service.
  - Added `position-lifecycle-open-lifecycle.orchestrator.ts` and moved full open workflow orchestration out of service.
- `PositionLifecycleService` now primarily keeps public API guards/state access and delegates lifecycle workflows.
- Current `packages/core/src/services/position-lifecycle.service.ts` size: 362 lines (reduced from ~1743 baseline context).
- Behavior preserved (open lock semantics, route handling, resilience configs, and event/log ordering).
- `PositionLifecycleService` refactor track considered closed for current scope.
- Updated `REFACTOR_PLAN.md` session log.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/position-lifecycle.p0-safety.test.ts packages/core/src/__tests__/services/position-lifecycle.repository-integration.test.ts` -> 3/3 suites PASS, 51/51 tests PASS.

## Next Step
- Move to next god-object candidate from `REFACTOR_PLAN.md` and continue the same behavior-preserving extraction workflow.
