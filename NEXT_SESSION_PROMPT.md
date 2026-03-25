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
- Completed an explicit managed-context typing follow-up for `orderbook-manager.service`, `orderbook-manager.service.error-handling`, `orderbook-imbalance.service`, `orderbook-imbalance.error-handling`, `pnl-calculator.service`, and `pnl-calculator.error-handling`:
  - routed those suites to exported helper context types instead of local `ReturnType<typeof ...>` inference while keeping helper-owned cleanup unchanged.
  - tightened the adjacent orderbook and pnl service suites without changing runtime behavior.
  - reviewed `packages/core/src/services/orderbook-manager.service.ts`, `packages/core/src/services/orderbook-imbalance.service.ts`, and `packages/core/src/services/pnl-calculator.service.ts` and left production code unchanged after review.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/orderbook-manager.service.test.ts packages/core/src/__tests__/services/orderbook-manager.service.error-handling.test.ts packages/core/src/__tests__/services/orderbook-imbalance.service.test.ts packages/core/src/__tests__/services/orderbook-imbalance.error-handling.test.ts packages/core/src/__tests__/services/pnl-calculator.service.test.ts packages/core/src/__tests__/services/pnl-calculator.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue the lifecycle/testability stream in the next adjacent suites that still keep local harness ownership, repeated bootstrap, or ad hoc cleanup around the remaining monitoring/cache slice.
- Favor shared managed test contexts and explicit helper-owned context typing in follow-ups adjacent to this batch, especially the remaining service suites that still rely on `ReturnType<typeof ...>` or broader tracked-service ownership before reopening lower-signal constructor-only cleanup.
