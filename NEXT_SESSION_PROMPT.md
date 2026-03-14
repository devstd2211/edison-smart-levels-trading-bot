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
- Completed the `swing-point-detector` testability follow-up slice:
  - added shared helpers for canonical mock logger/ErrorHandler bootstrap plus reusable candle arrays, failing-loggers, swing-point builders, and typed cast helpers, then aligned the error-handling suite on that harness instead of repeating local service construction and fixture factories throughout the file.
  - reviewed `services/swing-point-detector.service.ts`; kept production code unchanged because this batch only needed test-harness consolidation.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/swing-point-detector.error-handling.test.ts` -> PASS (1/1 suite, 20/20 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).

## Next Step
- Continue the testability stream before reopening adapter cleanup.
- If starting a fresh session after commit/fixation, resume from the next compact lifecycle/testability boundary that still repeats local service construction or started-service cleanup beyond the now-covered `position-*`, `websocket-*`, `risk-manager`, `strategy-manager`, `telegram`, `take-profit-manager`, `ladder-tp-manager`, `orderbook-manager`, `wall-tracker`, `volume-profile`, `weight-matrix-calculator`, `compound-interest-calculator`, `entry-confirmation`, `exit-type-detector`, `volatility-regime`, `funding-rate-filter`, `order-execution-detector`, `micro-wall-detector`, `orderbook-imbalance`, `trading-journal`, `whale-detection`, `retest-entry`, `tf-alignment`, `circuit-breaker`, `services/resilience/*`, `graceful-shutdown`, `health-check`, `websocket-keep-alive`, `prometheus-metrics`, `monitoring-server`, `action-queue`, `event-deduplication`, `time-service`, `ml-feature-extractor`, `tick-delta-analyzer`, `exchange-factory`, `delta-analyzer`, `pnl-calculator`, `anti-flip`, `bot-metrics`, `config-validator`, `performance-analytics`, `trading-lifecycle`, `trade-history`, `virtual-balance`, `trading-orchestrator`, `candle-aggregator`, `analyzer-engine`, `market-condition-analyzer`, `analyzer-registry`, `indicator-registry`, `indicator-cache`, `indicator-precalculation`, `advanced-order-flow`, `candle-provider`, `event-handlers`, `advanced-order-state-machine`, `anomaly-detection`, `liquidity-heatmap`, `smart-order-placement`, `phase-10-integration`, `pattern-recognition`, `whale-detection`, `whale-wall-tp`, `enhanced-exit`, `structure-aware-exit`, `risk-calculator`, `reality-check`, `swing-point-detector`, and the `analyzer-engine` service-suite slice.
- Prefer the next compact untouched suite with substantial repeated inline bootstrap from the same low-risk class of unit tests; another still-local constructor-heavy suite outside the now-covered phase-10 slice is a better next pass than reopening already-shared helper files.
- Keep favoring shared harnesses, explicit teardown where lifecycle exists, and minimal required dependency groups per suite.
- Keep behavior unchanged, run targeted tests per slice, and log the batch in `ACTIVE_REFACTOR_PLAN.md`.
