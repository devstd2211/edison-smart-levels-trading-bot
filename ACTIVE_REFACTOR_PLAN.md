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
- 2026-04-23: completed the next ten-task lifecycle/testability narrowing slice across `event-handlers.error-handling`, `fractal-smc-weighting.error-handling`, `micro-wall-detector.service`, `micro-wall-detector.error-handling`, `multi-timeframe-trend.error-handling`, `performance-analytics.service`, `prometheus-metrics`, `reality-check.error-handling`, `retest-entry.service`, and `position-scaling`.
- Replaced another batch of temporary managed-context/runtime/factory holders with narrower suite-state aliases, direct helper destructuring, and helper-owned non-null runtime wiring while preserving harness wiring, cleanup, and test behavior.
- Reviewed adjacent production surfaces around event handlers, fractal weighting, micro-wall detection, multi-timeframe trend analysis, performance analytics, Prometheus metrics, reality checks, retest entry, and position scaling; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-23: `npm test -- --runInBand packages/core/src/__tests__/services/event-handlers.error-handling.test.ts packages/core/src/__tests__/services/fractal-smc-weighting.error-handling.test.ts packages/core/src/__tests__/services/micro-wall-detector.service.test.ts packages/core/src/__tests__/services/micro-wall-detector.error-handling.test.ts packages/core/src/__tests__/services/multi-timeframe-trend.error-handling.test.ts packages/core/src/__tests__/services/performance-analytics.service.test.ts packages/core/src/__tests__/services/prometheus-metrics.test.ts packages/core/src/__tests__/services/reality-check.error-handling.test.ts packages/core/src/__tests__/services/retest-entry.service.test.ts packages/core/src/__tests__/services/position-scaling.test.ts` PASS
- 2026-04-23: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
