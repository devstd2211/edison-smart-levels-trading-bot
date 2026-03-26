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
- Completed a helper-managed context follow-up for `analyzer-engine.error-handling`, `indicator-precalculation.error-handling`, `pattern-recognition.error-handling`, `logger.service.error-handling`, `delta-analyzer.error-handling`, and `circuit-breaker.error-handling`:
  - extended the adjacent helpers so managed contexts own scenario, service, and harness creation plus cleanup.
  - routed the target suites away from repeated suite-local construction.
  - reviewed the adjacent production services and left production code unchanged.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/analyzer-engine.error-handling.test.ts packages/core/src/__tests__/services/indicator-precalculation.error-handling.test.ts packages/core/src/__tests__/services/pattern-recognition.error-handling.test.ts packages/core/src/__tests__/services/logger.service.error-handling.test.ts packages/core/src/__tests__/services/delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/circuit-breaker.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue with the next helper-backed lifecycle/testability slice in the remaining suites whose helpers still lack managed-context ownership for created services, prioritizing the next concentrated harness families beyond the now-refreshed analyzer / indicator / logger / delta-analyzer / circuit-breaker clusters.
- After that, keep pushing toward broader grouped-service / `createServices()` narrowing only where no helper-managed cleanup path exists yet.
