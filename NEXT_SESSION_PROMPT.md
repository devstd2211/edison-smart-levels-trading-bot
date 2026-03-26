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

## Last Completed (2026-03-26)
- Completed a helper-managed context follow-up for `position-exiting.service`, `position-exiting.error-handling`, `position-exiting.functional`, `position-exiting.integration`, `position-exiting.transactional`, and `position-exiting.race-condition`:
  - added managed helper contexts so the shared `position-exiting` test utils own created service/harness families and cleanup for the standard / error-handling / functional / real-scenario / transactional / race-condition slices.
  - routed the target suites away from ad-hoc suite-local lifecycle ownership.
  - reviewed the adjacent production service and left production code unchanged.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-exiting.service.test.ts packages/core/src/__tests__/services/position-exiting.error-handling.test.ts packages/core/src/__tests__/services/position-exiting.functional.test.ts packages/core/src/__tests__/services/position-exiting.integration.test.ts packages/core/src/__tests__/services/position-exiting.transactional.test.ts packages/core/src/__tests__/services/position-exiting.race-condition.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue with the next helper-backed lifecycle/testability slice in the remaining suites whose helpers still lack managed-context ownership for created services, prioritizing the remaining helper-less clusters such as `position-lifecycle*`, `position-sync*`, `bybit.repository-integration`, or similarly concentrated harness families.
- After that, keep pushing toward broader grouped-service / `createServices()` narrowing only where no helper-managed cleanup path exists yet.
