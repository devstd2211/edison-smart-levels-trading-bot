# Active Refactor Plan

This file is the active source of truth for current refactor work only.
Historical detail is archived elsewhere and should not be copied here.

## Open Streams
- [ ] Continue lifecycle/testability cleanup in service-adjacent suites that still keep broad managed-context ownership or temporary local service state.
- [ ] Continue replacing broad service-state construction in tests with minimal grouped services or helper-owned tracked state.
- [ ] Continue explicit lifecycle coverage around `createServices()` / `start()` / `stop()` where tests still own teardown directly.
- [ ] Continue adjacent `any` cleanup only when exposed by the current service/test refactor slice.

## Current Focus
- [ ] Prefer remaining service and error-handling suites that still keep direct exported `Managed*Context` types, repeated `ReturnType<typeof createManaged...>` expressions, binder wrappers, fixture-accessor wrappers, or wider-than-needed factory state in scope.

## Immediate Next Candidates
- [ ] Next nearby lifecycle-oriented suites surfaced by `rg` with temporary managed-context locals or helper-accessor wrappers.

## Working Rules
1. Pick the next unchecked item from this file.
2. Apply minimal behavior-preserving changes only.
3. Run targeted tests for the changed slice.
4. Run `npm run build`.
5. Update this file with only the latest completed slice and latest verification.
6. Do not paste chronological history here.

## Latest Completed
- 2026-04-26: completed the next lifecycle/testability narrowing slice across `bot-metrics.error-handling`, `fractal-smc-weighting.error-handling`, `health-check`, `indicator-precalculation.error-handling`, `ladder-exit-detector.service.error-handling`, `ladder-tp-manager.error-handling`, `ladder-tp-manager.service`, `limit-order-executor.error-handling`, `limit-order-executor.service`, `liquidity-heatmap.error-handling`, `market-condition-analyzer.error-handling`, `micro-wall-detector.error-handling`, `micro-wall-detector.service`, `ml-feature-extractor.error-handling`, `ml-feature-extractor.service`, `monitoring-server`, `mtf-snapshot-gate.error-handling`, `mtf-snapshot-gate.functional`, `mtf-snapshot-gate`, and `multi-strategy.cache`.
- Narrowed a 20-task cleanup batch in those suites by replacing direct helper-exported `Managed*Context` test-type dependencies with suite-local `ReturnType<typeof createManaged...>` aliases, keeping managed setup ownership at the helper boundary and trimming suite-local managed-context surface without changing behavior.
- Reviewed adjacent production surfaces around bot metrics, fractal weighting, health checks, indicator precalculation, ladder exit / ladder TP handling, limit-order execution, liquidity heatmaps, market condition analysis, micro-wall detection, ML feature extraction, monitoring server, MTF snapshot gating, and multi-strategy cache; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-26: `npm test -- --runInBand packages/core/src/__tests__/services/bot-metrics.error-handling.test.ts packages/core/src/__tests__/services/fractal-smc-weighting.error-handling.test.ts packages/core/src/__tests__/services/health-check.test.ts packages/core/src/__tests__/services/indicator-precalculation.error-handling.test.ts packages/core/src/__tests__/services/ladder-exit-detector.service.error-handling.test.ts packages/core/src/__tests__/services/ladder-tp-manager.error-handling.test.ts packages/core/src/__tests__/services/ladder-tp-manager.service.test.ts packages/core/src/__tests__/services/limit-order-executor.error-handling.test.ts packages/core/src/__tests__/services/limit-order-executor.service.test.ts packages/core/src/__tests__/services/liquidity-heatmap.error-handling.test.ts packages/core/src/__tests__/services/market-condition-analyzer.error-handling.test.ts packages/core/src/__tests__/services/micro-wall-detector.error-handling.test.ts packages/core/src/__tests__/services/micro-wall-detector.service.test.ts packages/core/src/__tests__/services/ml-feature-extractor.error-handling.test.ts packages/core/src/__tests__/services/ml-feature-extractor.service.test.ts packages/core/src/__tests__/services/monitoring-server.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.error-handling.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.functional.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.test.ts packages/core/src/__tests__/services/multi-strategy.cache.test.ts` PASS (20 suites / 494 tests)
- 2026-04-26: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
