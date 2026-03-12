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

## Working Order Per Session
1. Pick next target from `ACTIVE_REFACTOR_PLAN.md` unchecked/in-progress items.
2. Use `REFACTOR_TASKS.md` for concrete task candidates if decomposition is needed.
3. Execute minimal safe refactor.
4. Run targeted tests for changed area.
5. Record results in `ACTIVE_REFACTOR_PLAN.md`.
6. Refresh only brief handoff below.

## Last Completed (2026-03-12)
- Completed compatibility-first typing batch 225 (behavior-preserving compact-service cleanup follow-up):
  - `services/indicator-precalculation.service.ts`:
    - replaced the remaining calculation-classification error-message extraction with shared `getErrorMessage()`.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/indicator-precalculation.error-handling.test.ts` -> PASS (1/1 suite, 20/20 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).

## Next Step
- Treat the compact-service cleanup stream as effectively exhausted outside exchange-adapter/partial files and minor builder/utils boundaries.
- Switch to the remaining testability tasks from `ACTIVE_REFACTOR_PLAN.md` unless an adjacent change explicitly requires adapter cleanup.
- Keep behavior unchanged, run targeted tests per slice, and log the batch in `ACTIVE_REFACTOR_PLAN.md`.
