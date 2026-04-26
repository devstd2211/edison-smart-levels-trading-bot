# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Session Objective
- Continue incremental, behavior-preserving refactor.
- Prioritize lifecycle/testability cleanup in `packages/core/src/__tests__/services/*` and adjacent production services when a small safe follow-up is clearly exposed.

## Source of Truth
- Current active work only: `ACTIVE_REFACTOR_PLAN.md`.
- Task catalog/backlog by area: `REFACTOR_TASKS.md`.
- Frozen archive: `REFACTOR_PLAN_01.md` and any other historical plan files.

## Context Rules
1. Do not load historical archive files by default.
2. Do not paste or rebuild chronological history into `ACTIVE_REFACTOR_PLAN.md`.
3. Keep only the latest completed slice and latest verification in `ACTIVE_REFACTOR_PLAN.md`.
4. Use archive files only if the user explicitly asks for historical detail or a previous decision rationale.

## Mandatory Session Rules
1. Always update `ACTIVE_REFACTOR_PLAN.md` with the latest completed slice and latest verification before session end.
2. Update `REFACTOR_TASKS.md` only when adding/removing/restructuring backlog tasks.
3. For each test refactor, review the related production service as refactor candidate.
4. If service is a candidate, perform a behavior-preserving service refactor in the same session or note a short pending item in `ACTIVE_REFACTOR_PLAN.md`.
5. Keep this file short: refresh only `Last Completed` and `Next Step`.
6. Keep user-facing replies short by default unless the user explicitly asks for more detail.
7. Do not maintain a running historical journal here.

## Working Order Per Session
1. Read `ACTIVE_REFACTOR_PLAN.md`.
2. Pick the next unchecked item.
3. Use `REFACTOR_TASKS.md` only if decomposition is needed.
4. Execute minimal safe refactor.
5. Run targeted tests for the changed area.
6. Run `npm run build`.
7. Update only the concise handoff below and the active plan.

## Last Completed (2026-04-26)
- Completed the requested next lifecycle/testability narrowing slice across `bot-metrics.error-handling`, `fractal-smc-weighting.error-handling`, `health-check`, `indicator-precalculation.error-handling`, `ladder-exit-detector.service.error-handling`, `ladder-tp-manager.error-handling`, `ladder-tp-manager.service`, `limit-order-executor.error-handling`, `limit-order-executor.service`, `liquidity-heatmap.error-handling`, `market-condition-analyzer.error-handling`, `micro-wall-detector.error-handling`, `micro-wall-detector.service`, `ml-feature-extractor.error-handling`, `ml-feature-extractor.service`, `monitoring-server`, `mtf-snapshot-gate.error-handling`, `mtf-snapshot-gate.functional`, `mtf-snapshot-gate`, and `multi-strategy.cache`.
  - narrowed a 20-task batch in that cluster by replacing direct helper-exported `Managed*Context` test-type dependencies with suite-local `ReturnType<typeof createManaged...>` aliases and trimming suite-local managed-context surface.
  - kept the slice behavior-preserving; no adjacent production refactor was required.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/bot-metrics.error-handling.test.ts packages/core/src/__tests__/services/fractal-smc-weighting.error-handling.test.ts packages/core/src/__tests__/services/health-check.test.ts packages/core/src/__tests__/services/indicator-precalculation.error-handling.test.ts packages/core/src/__tests__/services/ladder-exit-detector.service.error-handling.test.ts packages/core/src/__tests__/services/ladder-tp-manager.error-handling.test.ts packages/core/src/__tests__/services/ladder-tp-manager.service.test.ts packages/core/src/__tests__/services/limit-order-executor.error-handling.test.ts packages/core/src/__tests__/services/limit-order-executor.service.test.ts packages/core/src/__tests__/services/liquidity-heatmap.error-handling.test.ts packages/core/src/__tests__/services/market-condition-analyzer.error-handling.test.ts packages/core/src/__tests__/services/micro-wall-detector.error-handling.test.ts packages/core/src/__tests__/services/micro-wall-detector.service.test.ts packages/core/src/__tests__/services/ml-feature-extractor.error-handling.test.ts packages/core/src/__tests__/services/ml-feature-extractor.service.test.ts packages/core/src/__tests__/services/monitoring-server.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.error-handling.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.functional.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.test.ts packages/core/src/__tests__/services/multi-strategy.cache.test.ts` -> PASS (20 suites / 494 tests).
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next nearby leftovers surfaced by `rg` after this slice, especially suites that still keep helper-accessor wrappers, broader-than-needed managed runtime aliases, or remaining local setup/binder indirection outside this cluster.
- Good nearby follow-ups after this batch: adjacent `packages/core/src/__tests__/services` suites such as `multi-timeframe-trend.error-handling`, `orderbook-imbalance.*`, `orderbook-manager.*`, `order-execution-detector.*`, `pattern-recognition.error-handling`, `performance-analytics.*`, `pnl-calculator.*`, and nearby `position-*` suites that still expose direct exported `Managed*Context` types or helper-wrapper setup.
