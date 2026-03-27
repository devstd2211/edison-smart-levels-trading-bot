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
- Completed a lifecycle/testability cleanup follow-up for `performance-analytics.error-handling`, `position-pnl-calculator.error-handling`, `strategy-circuit-breaker.error-handling`, `real-time-risk-monitor.error-handling`, `websocket-authentication.error-handling`, and `weight-matrix-calculator.error-handling`.
  - replaced the remaining direct suite-local managed-context ownership with shared suite-owned binders, including suites that still passed the managed context into helper seeders or reached back into the context for alternate standard/legacy factory creation.
  - kept the touched suites on their existing helper-owned service / lifecycle / legacy factory paths instead of rebuilding local setup wiring.
  - reviewed the adjacent production services for safe follow-up refactors; none were required in this slice.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/performance-analytics.error-handling.test.ts packages/core/src/__tests__/services/position-pnl-calculator.error-handling.test.ts packages/core/src/__tests__/services/strategy-circuit-breaker.error-handling.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.error-handling.test.ts packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Keep `ACTIVE_REFACTOR_PLAN.md` small and current; never paste chronological history back into it.
- Continue with the next concentrated lifecycle/testability slice in suites that still keep direct managed-context setup/cleanup, nested per-describe lifecycle ownership, or scenario-local context creation.
- Prioritize the next six-file batch of error-handling suites where `createManaged...Context()` still bypasses a single suite-owned binder, and keep preferring suite-owned binders plus helper-owned standard/legacy factories.
