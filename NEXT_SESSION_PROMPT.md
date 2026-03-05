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

## Last Completed (2026-03-05)
- Removed local `any` usages in:
  - `phase-12-parallel-processing.test.ts`
  - `position-exiting.service.test.ts`
- Related services reviewed: `StrategyProcessingPoolService`, `PositionExitingService` (no safe behavior-preserving decomposition required in this pass).
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/phase-12-parallel-processing.test.ts packages/core/src/__tests__/position-exiting.service.test.ts` -> 2/2 suites PASS, 72/72 tests PASS.
  - Note: Jest reports open handles after this batch (existing suite behavior; functional assertions pass).

## Next Step
- Active non-archived `__tests__` files are `any`-clean. Remaining `any` usage is only in archived suite: `__tests__/services/market-data-collector.service.test.ARCHIVED.ts`.
