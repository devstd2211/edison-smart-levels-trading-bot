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

## Last Completed (2026-03-12)
- Completed testability batches 269-271 (behavior-preserving `retest-entry` / `tf-alignment` / `circuit-breaker` follow-up):
  - added shared helpers for canonical config/logger/error-handler wiring plus reusable retest signal/candle fixtures and alignment/circuit mock builders, and aligned the touched suites on the same setup path instead of repeated inline bootstrap blocks.
  - reviewed `services/retest-entry.service.ts`, `services/tf-alignment.service.ts`, and `services/circuit-breaker.service.ts`; kept production code unchanged because this batch only needed test-fixture consolidation.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/retest-entry.service.test.ts packages/core/src/__tests__/services/retest-entry.error-handling.test.ts packages/core/src/__tests__/services/tf-alignment.service.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts packages/core/src/__tests__/services/circuit-breaker.service.test.ts packages/core/src/__tests__/services/circuit-breaker.error-handling.test.ts` -> PASS (6/6 suites, 129/129 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).

## Next Step
- Continue the testability stream before reopening adapter cleanup.
- If starting a fresh session after commit/fixation, resume from the next compact lifecycle/testability boundary that still repeats local service construction beyond the now-covered `position-*`, `websocket-*`, `risk-manager`, `strategy-manager`, `telegram`, `take-profit-manager`, `ladder-tp-manager`, `orderbook-manager`, `wall-tracker`, `volume-profile`, `weight-matrix-calculator`, `compound-interest-calculator`, `entry-confirmation`, `exit-type-detector`, `volatility-regime`, `funding-rate-filter`, `order-execution-detector`, `micro-wall-detector`, `orderbook-imbalance`, `trading-journal`, `whale-detection`, `retest-entry`, `tf-alignment`, and `circuit-breaker` slices.
- Keep favoring shared harnesses, explicit teardown where lifecycle exists, and minimal required dependency groups per suite.
- Keep behavior unchanged, run targeted tests per slice, and log the batch in `ACTIVE_REFACTOR_PLAN.md`.
