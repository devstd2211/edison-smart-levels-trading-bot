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

## Last Completed (2026-03-25)
- Completed an explicit managed-context typing follow-up for `strategy-loader`, `strategy-loader.error-handling`, `position-monitor.service`, `position-monitor.error-handling`, `risk-manager.service`, and `risk-manager.error-handling`:
  - routed those suites to exported helper-managed context types instead of local `ReturnType<typeof ...>` and `Awaited<ReturnType<...>>` ownership.
  - kept cleanup ownership in the existing helper-managed contexts instead of suite-local inferred harness types.
  - reviewed `packages/core/src/services/strategy-loader.service.ts`, `packages/core/src/services/position-monitor.service.ts`, and `packages/core/src/services/risk-manager.service.ts` and left production code unchanged after review.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/strategy-loader.test.ts packages/core/src/__tests__/services/strategy-loader.error-handling.test.ts packages/core/src/__tests__/services/position-monitor.service.test.ts packages/core/src/__tests__/services/position-monitor.error-handling.test.ts packages/core/src/__tests__/services/risk-manager.service.test.ts packages/core/src/__tests__/services/risk-manager.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue the lifecycle/testability stream in the next untouched suites that still keep local harness ownership or local `ReturnType<typeof ...>` typing around remaining helper-managed contexts.
- Favor adjacent follow-ups around other helper-backed service suites that already export managed context types but still infer them locally inside the test files before reopening lower-signal constructor-only cleanup.
