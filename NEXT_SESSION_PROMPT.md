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

## Last Completed (2026-03-20)
- Completed another three-iteration anomaly/execution/scaling helper-consolidation batch:
  - extended `packages/core/src/__tests__/helpers/anomaly-detection-test.utils.ts` with reusable value-series and trade-series builders, then routed `anomaly-detection.error-handling` through those helpers instead of repeated inline numeric arrays and trade lists.
  - extended `packages/core/src/__tests__/helpers/smart-order-execution-test.utils.ts` with canonical request-series and execution-report builders, then routed `smart-order-execution` through those helpers instead of repeated inline request literals and fake active-order bootstrap.
  - extended `packages/core/src/__tests__/helpers/position-scaling-test.utils.ts` with extreme-position and scale-sequence builders, then routed `position-scaling` through those helpers instead of repeated inline overflow/scaling-state construction.
  - reviewed `services/anomaly-detection.service.ts`, `services/smart-order-execution.service.ts`, and `services/position-scaling.service.ts`; left production code unchanged after review.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/anomaly-detection.error-handling.test.ts packages/core/src/__tests__/services/smart-order-execution.test.ts packages/core/src/__tests__/services/position-scaling.test.ts` -> PASS (3/3 suites, 115/115 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).

## Next Step
- Continue the testability stream before reopening adapter cleanup.
- Prefer the next compact untouched suite with repeated inline bootstrap or lifecycle setup beyond the now-refreshed `circuit-breaker.error-handling`, `data-collector.error-handling`, `graceful-shutdown.error-handling`, `circuit-breaker.service`, `graceful-shutdown.service`, `bybit.error-handling`, `advanced-order-state-machine`, `multi-timeframe-trend`, `liquidity-heatmap`, `fractal-smc-weighting`, `pattern-recognition`, `retest-entry`, `swing-point-detector`, `whale-wall-tp`, `enhanced-exit`, `whale-detection`, `reality-check`, `volatility-regime`, `timeframe-weighting`, `risk-calculator`, `strategy-loader`, `session-stats`, `phase-10-integration`, `position-lifecycle.repository-integration`, `bybit.repository-integration`, `multi-strategy.cache`, `position-exiting.integration`, `order-flow-analyzer`, `smart-order-execution`, `structure-aware-exit`, `health-check`, `action-queue`, `time-service`, `dynamic-position-sizer`, `position-scaling`, `candle-aggregator`, `limit-order-executor`, `market-condition-analyzer`, `ml-feature-extractor`, `delta-analyzer`, `micro-wall-detector`, `tick-delta-analyzer`, `anomaly-detection`, `analyzer-engine`, `analyzer-registry`, `order-execution-detector`, `exit-type-detector`, `ladder-exit-detector`, and `analyzer-registration-fixes`.
- Likely next candidates: with `anomaly-detection`, `smart-order-execution`, and `position-scaling` now normalized, move to the next nearby untouched harness-heavy suite such as `candle-aggregator.error-handling`, `action-queue.error-handling`, `health-check`, or another lifecycle-adjacent test still rebuilding baseline scenario inputs and service variants inline.
- Keep favoring shared harnesses, explicit teardown where lifecycle exists, and minimal required dependency groups per suite.
