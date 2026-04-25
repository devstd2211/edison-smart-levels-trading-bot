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
- 2026-04-25: completed the next lifecycle/testability narrowing slice across `health-check`, `ladder-tp-manager.service`, `ladder-tp-manager.error-handling`, `trade-history.error-handling`, `time.service`, `wall-tracker.service`, `wall-tracker.error-handling`, `volume-profile.service`, `volume-profile.error-handling`, `websocket-manager.service`, `websocket-manager.error-handling`, `position-monitor.service`, `position-pnl-calculator.service`, `position-pnl-calculator.error-handling`, `indicator-cache.error-handling`, `indicator-precalculation.error-handling`, `anti-flip.error-handling`, `fractal-smc-weighting.error-handling`, `market-condition-analyzer.error-handling`, and `liquidity-heatmap.error-handling`.
- Narrowed another 20-suite batch of managed test state by replacing local `ReturnType<typeof createManaged...>` aliases with helper-exported managed context contracts, reducing direct suite-owned context typing and keeping test state aligned with helper-defined boundaries.
- Reviewed adjacent production surfaces around health checks, ladder TP handling, trade history persistence, time sync, wall tracking, volume profile calculation, websocket management, position monitoring/PnL, indicator caching/precalculation, anti-flip filtering, fractal weighting, market-condition TP adjustment, and liquidity heatmap processing; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-25: `npm test -- --runInBand packages/core/src/__tests__/services/health-check.test.ts packages/core/src/__tests__/services/ladder-tp-manager.service.test.ts packages/core/src/__tests__/services/ladder-tp-manager.error-handling.test.ts packages/core/src/__tests__/services/trade-history.error-handling.test.ts packages/core/src/__tests__/services/time.service.test.ts packages/core/src/__tests__/services/wall-tracker.service.test.ts packages/core/src/__tests__/services/wall-tracker.error-handling.test.ts packages/core/src/__tests__/services/volume-profile.service.test.ts packages/core/src/__tests__/services/volume-profile.error-handling.test.ts packages/core/src/__tests__/services/websocket-manager.service.test.ts packages/core/src/__tests__/services/websocket-manager.error-handling.test.ts packages/core/src/__tests__/services/position-monitor.service.test.ts packages/core/src/__tests__/services/position-pnl-calculator.service.test.ts packages/core/src/__tests__/services/position-pnl-calculator.error-handling.test.ts packages/core/src/__tests__/services/indicator-cache.error-handling.test.ts packages/core/src/__tests__/services/indicator-precalculation.error-handling.test.ts packages/core/src/__tests__/services/anti-flip.error-handling.test.ts packages/core/src/__tests__/services/fractal-smc-weighting.error-handling.test.ts packages/core/src/__tests__/services/market-condition-analyzer.error-handling.test.ts packages/core/src/__tests__/services/liquidity-heatmap.error-handling.test.ts` PASS
- 2026-04-25: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
