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

## Last Completed (2026-03-19)
- Completed another three-iteration event-processing helper-consolidation batch for adjacent detector coverage:
  - extended `packages/core/src/__tests__/helpers/order-execution-detector-test.utils.ts` with a harness-backed service factory plus reusable execution-sequence runner, and routed `order-execution-detector.service.test.ts` plus `order-execution-detector.error-handling.test.ts` through those helpers instead of repeated direct service construction and ad-hoc multi-execution setup.
  - reviewed `services/order-execution-detector.service.ts`; left production code unchanged after review.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/order-execution-detector.service.test.ts packages/core/src/__tests__/services/order-execution-detector.error-handling.test.ts` -> PASS (2/2 suites, 41/41 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).

## Next Step
- Continue the testability stream before reopening adapter cleanup.
- Prefer the next compact untouched suite with repeated inline bootstrap or lifecycle setup beyond the now-refreshed `circuit-breaker.error-handling`, `data-collector.error-handling`, `graceful-shutdown.error-handling`, `circuit-breaker.service`, `graceful-shutdown.service`, `bybit.error-handling`, `advanced-order-state-machine`, `multi-timeframe-trend`, `liquidity-heatmap`, `fractal-smc-weighting`, `pattern-recognition`, `retest-entry`, `swing-point-detector`, `whale-wall-tp`, `enhanced-exit`, `whale-detection`, `reality-check`, `volatility-regime`, `timeframe-weighting`, `risk-calculator`, `strategy-loader`, `session-stats`, `phase-10-integration`, `position-lifecycle.repository-integration`, `bybit.repository-integration`, `multi-strategy.cache`, `position-exiting.integration`, `order-flow-analyzer`, `smart-order-execution`, `structure-aware-exit`, `health-check`, `action-queue`, `time-service`, `dynamic-position-sizer`, `position-scaling`, `candle-aggregator`, `limit-order-executor`, `market-condition-analyzer`, `ml-feature-extractor`, `delta-analyzer`, `micro-wall-detector`, `tick-delta-analyzer`, `anomaly-detection`, `analyzer-engine`, `analyzer-registry`, `order-execution-detector`, `exit-type-detector`, `ladder-exit-detector`, and `analyzer-registration-fixes`.
- Likely next candidates: stay adjacent to the event-processing slice, especially `exit-type-detector.service`, `exit-type-detector.service.error-handling`, or another nearby detector suite still rebuilding order-history fixtures or scenario positions locally.
- Keep favoring shared harnesses, explicit teardown where lifecycle exists, and minimal required dependency groups per suite.
