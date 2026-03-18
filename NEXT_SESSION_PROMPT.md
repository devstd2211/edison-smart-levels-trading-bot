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

## Last Completed (2026-03-18)
- Completed another three-step lifecycle/testability batch:
  - added `packages/core/src/__tests__/helpers/bot-factory-test.utils.ts` with canonical factory config + config-path mutation builders, routed both `bot-factory.service.test.ts` and `bot-factory.error-handling.test.ts` through that helper, and extended the existing `bot-metrics` helper with seeded fixture setup so report/reset sections stop rebuilding the same trades/events inline.
  - reviewed `services/bot-factory.service.ts` and `services/bot-metrics.service.ts`; kept production code unchanged because the batch only needed test-harness consolidation.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/bot-factory.error-handling.test.ts packages/core/src/__tests__/services/bot-metrics.error-handling.test.ts` -> PASS (3/3 suites, 88/88 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).

## Next Step
- Continue the testability stream before reopening adapter cleanup.
- Prefer the next compact untouched suite with repeated inline bootstrap or lifecycle setup beyond the now-refreshed `circuit-breaker.error-handling`, `data-collector.error-handling`, `graceful-shutdown.error-handling`, `circuit-breaker.service`, `graceful-shutdown.service`, `bybit.error-handling`, `advanced-order-state-machine`, `multi-timeframe-trend`, `liquidity-heatmap`, `fractal-smc-weighting`, `pattern-recognition`, `retest-entry`, `swing-point-detector`, `whale-wall-tp`, `enhanced-exit`, `whale-detection`, `reality-check`, `volatility-regime`, `timeframe-weighting`, `risk-calculator`, `strategy-loader`, `session-stats`, `phase-10-integration`, `position-lifecycle.repository-integration`, `bybit.repository-integration`, `multi-strategy.cache`, `position-exiting.integration`, `order-flow-analyzer`, `smart-order-execution`, `structure-aware-exit`, `health-check`, `action-queue`, `time-service`, `dynamic-position-sizer`, and `position-scaling`.
- Likely next candidates: remaining bot/lifecycle-adjacent suites that still build broad service state inline, or another constructor-heavy error-handling suite adjacent to the refreshed `bot-factory` / `bot-initializer` / `bot-metrics` helpers.
- Keep favoring shared harnesses, explicit teardown where lifecycle exists, and minimal required dependency groups per suite.
