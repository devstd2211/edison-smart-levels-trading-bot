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
- Completed another three-iteration pnl/state-machine/health helper-consolidation batch:
  - extended `packages/core/src/__tests__/helpers/position-pnl-calculator-test.utils.ts` with a bound factory for shared service + position builders, then routed both `position-pnl-calculator.service` and `position-pnl-calculator.error-handling` through that helper instead of local aliases and direct service bootstrap.
  - extended `packages/core/src/__tests__/helpers/position-state-machine-test.utils.ts` with reusable position-id and transition-sequence helpers, then routed `position-state-machine.service` through them instead of repeated inline lifecycle transition setup.
  - extended `packages/core/src/__tests__/helpers/health-check-test.utils.ts` with canned degraded/down exchange and websocket service builders, then routed `health-check` through those helpers instead of ad-hoc mock rewiring inside the suite.
  - reviewed `services/position-pnl-calculator.service.ts`, `services/position-state-machine.service.ts`, and `services/health-check.service.ts`; left production code unchanged after review.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-pnl-calculator.service.test.ts packages/core/src/__tests__/services/position-pnl-calculator.error-handling.test.ts packages/core/src/__tests__/services/position-state-machine.service.test.ts packages/core/src/__tests__/services/health-check.test.ts` -> PASS (4/4 suites, 108/108 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).

## Next Step
- Continue the testability stream before reopening adapter cleanup.
- Prefer the next compact untouched or only partially-normalized suite with repeated inline nested config/bootstrap beyond the now-refreshed `config-validator`, `exchange-factory`, `funding-rate-filter`, `orderbook-imbalance`, `compound-interest-calculator`, `performance-analytics`, `risk-manager`, `entry-confirmation`, `take-profit-manager`, `volume-profile`, `position-pnl-calculator`, `position-state-machine.service`, `health-check`, `circuit-breaker.error-handling`, `data-collector.error-handling`, `graceful-shutdown.error-handling`, `circuit-breaker.service`, `graceful-shutdown.service`, `bybit.error-handling`, `advanced-order-state-machine`, `multi-timeframe-trend`, `liquidity-heatmap`, `fractal-smc-weighting`, `pattern-recognition`, `retest-entry`, `swing-point-detector`, `whale-wall-tp`, `enhanced-exit`, `whale-detection`, `reality-check`, `volatility-regime`, `timeframe-weighting`, `risk-calculator`, `strategy-loader`, `session-stats`, `phase-10-integration`, `position-lifecycle.repository-integration`, `bybit.repository-integration`, `multi-strategy.cache`, `position-exiting.integration`, `order-flow-analyzer`, `smart-order-execution`, `structure-aware-exit`, `action-queue`, `time-service`, `dynamic-position-sizer`, `position-scaling`, `candle-aggregator`, `limit-order-executor`, `market-condition-analyzer`, `ml-feature-extractor`, `delta-analyzer`, `micro-wall-detector`, `tick-delta-analyzer`, `anomaly-detection`, `analyzer-engine`, `analyzer-registry`, `order-execution-detector`, `exit-type-detector`, `ladder-exit-detector`, and `analyzer-registration-fixes`.
- Likely next candidates: another compact config/bootstrap-heavy trio such as `position-state-machine.error-handling`, `action-queue.error-handling`, `time.service`, or a neighboring suite that still rebuilds baseline scenario inputs and service variants inline.
- Keep favoring shared harnesses, explicit teardown where lifecycle exists, and minimal required dependency groups per suite.
