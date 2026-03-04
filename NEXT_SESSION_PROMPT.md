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

## Last Completed (2026-03-04)
- `exit-type-detector.service.error-handling.test.ts`: removed local `any` usages (typed logger/position/order fixtures, invalid-input casts via `unknown`).
- `ExitTypeDetectorService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `position-pnl-calculator.error-handling.test.ts`: removed local `as any` usages (typed ErrorHandler logger, typed invalid `Position`/`PositionSide` inputs, typed internal-method spy interface).
- `PositionPnLCalculatorService`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- `websocket-event-handler.error-handling.test.ts`: removed local `as any` usages (typed dependency mock casters, typed `ErrorHandler.handle` static mock result, typed order/SL/TP fixtures).
- `WebSocketEventHandler`: reviewed as related service candidate; no safe behavior-preserving decomposition needed in this pass.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/exit-type-detector.service.error-handling.test.ts` -> 12/12 PASS.
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-pnl-calculator.error-handling.test.ts` -> 29/29 PASS.
  - `npm test -- --runInBand packages/core/src/__tests__/services/websocket-event-handler.error-handling.test.ts` -> 21/21 PASS.
  - `npm test -- --runInBand packages/core/src/__tests__/services/exit-type-detector.service.error-handling.test.ts packages/core/src/__tests__/services/position-pnl-calculator.error-handling.test.ts packages/core/src/__tests__/services/websocket-event-handler.error-handling.test.ts` -> 62/62 PASS.

## Next Step
- Continue `__tests__/services/*` `any` cleanup with same rule (test refactor + related service candidate check + targeted verification + `REFACTOR_PLAN.md` update); next target candidate: `dynamic-position-sizer.test.ts`.
