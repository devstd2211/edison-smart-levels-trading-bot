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

## Last Completed (2026-03-14)
- Completed the `indicator-cache` + `market-condition-analyzer` + `multi-timeframe-trend` testability follow-up batch:
  - extended the shared `indicator-cache` helpers with explicit service factory wiring that preserves repository-only and logger-only backward-compatibility paths, then aligned the remaining error-handling suite constructor sites on those helpers instead of repeating direct `IndicatorCacheService` construction.
  - extended the shared `market-condition-analyzer` helpers with an explicit service factory for canonical logger/ErrorHandler bootstrap and no-handler paths, then aligned the remaining error-handling suite constructor sites on those helpers instead of repeating direct `MarketConditionAnalyzerService` construction.
  - added shared `multi-timeframe-trend` helpers with explicit service factory/harness wiring plus reusable candle/data builders and swing-detector bootstrap, then aligned the error-handling suite on those helpers instead of repeating direct `MultiTimeframeTrendService` and `SwingPointDetectorService` construction.
  - reviewed `services/indicator-cache.service.ts`, `services/market-condition-analyzer.service.ts`, and `services/multi-timeframe-trend.service.ts`; kept production code unchanged because this batch only needed test-harness consolidation.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/indicator-cache.error-handling.test.ts packages/core/src/__tests__/services/market-condition-analyzer.error-handling.test.ts packages/core/src/__tests__/services/multi-timeframe-trend.error-handling.test.ts` -> PASS (3/3 suites, 70/70 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).

## Next Step
- Continue the testability stream before reopening adapter cleanup.
- If starting a fresh session after commit/fixation, resume from the next compact lifecycle/testability boundary that still repeats local service construction or started-service cleanup beyond the now-covered `position-*`, `websocket-*`, `risk-manager`, `strategy-manager`, `strategy-circuit-breaker`, `strategy-config-merger`, `strategy-loader`, `telegram`, `take-profit-manager`, `ladder-tp-manager`, `orderbook-manager`, `wall-tracker`, `volume-profile`, `weight-matrix-calculator`, `compound-interest-calculator`, `entry-confirmation`, `exit-type-detector`, `volatility-regime`, `funding-rate-filter`, `order-execution-detector`, `micro-wall-detector`, `orderbook-imbalance`, `trading-journal`, `whale-detection`, `retest-entry`, `tf-alignment`, `circuit-breaker`, `services/resilience/*`, `graceful-shutdown`, `health-check`, `websocket-keep-alive`, `prometheus-metrics`, `monitoring-server`, `action-queue`, `event-deduplication`, `time-service`, `ml-feature-extractor`, `tick-delta-analyzer`, `exchange-factory`, `delta-analyzer`, `pnl-calculator`, `anti-flip`, `bot-metrics`, `config-validator`, `performance-analytics`, `ladder-exit-detector`, `trading-lifecycle`, `trade-history`, `virtual-balance`, `trading-orchestrator`, `candle-aggregator`, `analyzer-engine`, `market-condition-analyzer`, `analyzer-registry`, `indicator-registry`, `indicator-cache`, `indicator-precalculation`, `advanced-order-flow`, `candle-provider`, `console-dashboard`, `event-handlers`, `advanced-order-state-machine`, `anomaly-detection`, `timeframe-weighting`, `liquidity-heatmap`, `multi-timeframe-trend`, `smart-order-placement`, `phase-10-integration`, `pattern-recognition`, `whale-wall-tp`, `enhanced-exit`, `structure-aware-exit`, `risk-calculator`, `reality-check`, `swing-point-detector`, `websocket-authentication`, and the `analyzer-engine` service-suite slice.
- Prefer the next compact untouched suite with substantial repeated inline bootstrap from the same low-risk class of unit tests; another still-local constructor-heavy suite outside the now-covered phase-10 slice is a better next pass than reopening already-shared helper files.
- Keep favoring shared harnesses, explicit teardown where lifecycle exists, and minimal required dependency groups per suite.
- Keep behavior unchanged, run targeted tests per slice, and log the batch in `ACTIVE_REFACTOR_PLAN.md`.
