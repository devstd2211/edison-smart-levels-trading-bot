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
- Completed an adjacent helper-consolidation batch for `console-dashboard.error-handling`, `circuit-breaker.service`, `circuit-breaker.error-handling`, `compound-interest-calculator.service`, and `compound-interest-calculator.error-handling`:
  - extended `packages/core/src/__tests__/helpers/console-dashboard-test.utils.ts` and `packages/core/src/__tests__/helpers/circuit-breaker-test.utils.ts` with harness-backed shared service recreation paths so suites stop mixing direct legacy/standard service construction with ad hoc harness bootstrap.
  - added shared harness aliases in `packages/core/src/__tests__/helpers/compound-interest-calculator-test.utils.ts` and routed both compound-interest suites through those harness-backed calculator creators instead of mixing bound-factory and direct factory setup.
  - reviewed `packages/core/src/services/console-dashboard.service.ts`, `packages/core/src/services/circuit-breaker.service.ts`, and `packages/core/src/services/compound-interest-calculator.service.ts` and left production code unchanged after review.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/console-dashboard.error-handling.test.ts packages/core/src/__tests__/services/circuit-breaker.service.test.ts packages/core/src/__tests__/services/circuit-breaker.error-handling.test.ts packages/core/src/__tests__/services/compound-interest-calculator.service.test.ts packages/core/src/__tests__/services/compound-interest-calculator.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue the compact helper-consolidation stream before reopening adapter cleanup.
- Prefer the next adjacent constructor-heavy helper/error-handling or helper/service pair still mixing shared setup with direct recreation after the refreshed `console-dashboard` / `circuit-breaker` / `compound-interest` cluster.
- Keep favoring shared harnesses, explicit standard/legacy creation paths, and minimal required dependency groups per suite.
