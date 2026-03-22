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
- Completed an adjacent managed-context follow-up for `advanced-order-state-machine`, `ml-signal-validator.error-handling`, and `pattern-recognition.error-handling`:
  - extended `packages/core/src/__tests__/helpers/advanced-order-state-machine-test.utils.ts`, `packages/core/src/__tests__/helpers/ml-signal-validator-test.utils.ts`, and `packages/core/src/__tests__/helpers/pattern-recognition-test.utils.ts` with shared managed contexts for service/history cleanup and helper bootstrap.
  - routed the corresponding suites through those helper-owned contexts instead of local harness ownership and per-suite cleanup.
  - reviewed `packages/core/src/services/advanced-order-state-machine.service.ts`, `packages/core/src/services/ml-signal-validator.service.ts`, and `packages/core/src/services/pattern-recognition.service.ts` and left production code unchanged after review.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/advanced-order-state-machine.test.ts packages/core/src/__tests__/services/ml-signal-validator.error-handling.test.ts packages/core/src/__tests__/services/pattern-recognition.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue the lifecycle/testability stream in the next adjacent suites that still keep local async timing ownership, repeated harness bootstrap, or ad hoc mock error-handler branches outside the now-covered monitoring, journaling, loader, state-machine, and analyzer slices.
- Favor shared managed test contexts and helper-owned teardown in the next adjacent follow-ups such as `orderbook-manager.service.error-handling`, `micro-wall-detector.error-handling`, `advanced-order-flow.error-handling`, or similarly mock/spy-owned suites before reopening lower-signal constructor-only cleanup.
