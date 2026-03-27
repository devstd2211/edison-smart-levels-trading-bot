# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Session Objective
- Continue incremental, behavior-preserving refactor.
- Prioritize lifecycle/testability and `any` cleanup in `packages/core/src/__tests__/services/*` and related services.

## Source of Truth
- Active status + current target only: `ACTIVE_REFACTOR_PLAN.md` (single source of truth for open work).
- Completed historical log: `REFACTOR_PLAN.md` (archived completed track; do not load unless historical detail is needed).
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

## Last Completed (2026-03-27)
- Completed a lifecycle/testability follow-up for `position-exiting.service`, `position-exiting.integration`, `position-exiting.functional`, `position-exiting.race-condition`, `position-exiting.transactional`, and `multi-strategy.cache`.
  - replaced their remaining suite-local managed-context ownership with local binder-owned helper-managed setup/cleanup so those non-error-handling suites now share one explicit lifecycle path per suite.
  - reviewed the adjacent production services for safe follow-up refactors; none were required in this slice.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-exiting.service.test.ts packages/core/src/__tests__/services/position-exiting.integration.test.ts packages/core/src/__tests__/services/position-exiting.functional.test.ts packages/core/src/__tests__/services/position-exiting.race-condition.test.ts packages/core/src/__tests__/services/position-exiting.transactional.test.ts packages/core/src/__tests__/services/multi-strategy.cache.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Keep `ACTIVE_REFACTOR_PLAN.md` small and current; never paste chronological history back into it.
- Continue the non-error-handling lifecycle/testability slice around explicit lifecycle ownership, `createServices()` / `start` / `stop` usage, and replacing broad suite-level service state with minimal grouped services in the next highest-signal suites that still keep direct managed-context setup/cleanup.
- Favor the next remaining adjacent non-error-handling cache/monitoring/managed-service suites that still hold direct managed-context setup/cleanup after the `position-exiting.service` / `position-exiting.integration` / `position-exiting.functional` / `position-exiting.race-condition` / `position-exiting.transactional` / `multi-strategy.cache` batch.
- Keep reviewing adjacent production services opportunistically, but prefer test-owned lifecycle/state cleanup first unless a small behavior-preserving service refactor is clearly exposed.
