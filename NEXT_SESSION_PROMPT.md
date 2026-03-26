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
- Completed a helper-owned factory-path follow-up for `advanced-order-flow.error-handling`, `advanced-order-state-machine`, `trading-journal.error-handling`, and their adjacent test helpers:
  - extended the three helpers with explicit managed standard/legacy factory paths so the target suites no longer reach for residual direct legacy factory helpers outside managed contexts.
  - routed the affected backward-compatibility and lifecycle assertions through helper-owned factory paths while preserving behavior and existing coverage.
  - reviewed `advanced-order-flow.service.ts`, `advanced-order-state-machine.service.ts`, and `trading-journal.service.ts` and left production code unchanged.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/advanced-order-flow.error-handling.test.ts packages/core/src/__tests__/services/advanced-order-state-machine.test.ts packages/core/src/__tests__/services/trading-journal.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue with the next concentrated lifecycle/testability slice in suites that still rely on broad grouped-service setup or residual suite-local factory/setup helpers outside helper-owned creation boundaries, prioritizing the next six-file batch beyond the now-refreshed advanced-order-flow / advanced-order-state-machine / trading-journal-error-handling cluster.
- Keep pushing toward narrower grouped-service / `createServices()` ownership only where no helper-managed cleanup path exists yet, and prefer helper-owned standard/legacy or injected-service factory paths over suite-local service construction whenever the target suite is primarily validating compatibility, lifecycle, or logging-failure behavior.
