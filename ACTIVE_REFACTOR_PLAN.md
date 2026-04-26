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
- 2026-04-26: completed the next lifecycle/testability narrowing slice across `analyzer-registration-fixes`, `bybit.repository-integration`, `position-exiting.service`, `position-sync.service.error-handling`, `prometheus-metrics`, `real-time-risk-monitor.cache-invalidation`, `resilience/circuit-breaker`, `risk-calculator.error-handling`, `smart-order-placement.error-handling`, `strategy-loader`, `strategy-manager.error-handling`, `structure-aware-exit.service`, `structure-aware-exit.error-handling`, `swing-point-detector.error-handling`, `tf-alignment.service`, `tf-alignment.error-handling`, `tick-delta-analyzer.error-handling`, `timeframe-weighting.error-handling`, `trading-lifecycle.error-handling`, and `whale-detection.error-handling`.
- Narrowed another 20-suite batch of managed test setup by removing temporary `managedContext` / `suiteState` pass-through locals, replacing remaining suite-local `ReturnType<typeof createManaged...>` aliases with helper-exported managed contracts where available, and keeping helper-owned runtime typing at the boundary without changing behavior.
- Reviewed adjacent production surfaces around position sync/exiting, metrics/risk monitoring, circuit breaking, strategy loading/management, structure-aware exits, swing/tick delta analysis, timeframe alignment/weighting, lifecycle coordination, whale detection, and smart order placement; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-26: `npm test -- --runInBand packages/core/src/__tests__/services/analyzer-registration-fixes.test.ts packages/core/src/__tests__/services/bybit.repository-integration.test.ts packages/core/src/__tests__/services/position-sync.service.error-handling.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.cache-invalidation.test.ts packages/core/src/__tests__/services/risk-calculator.error-handling.test.ts packages/core/src/__tests__/services/resilience/circuit-breaker.test.ts packages/core/src/__tests__/services/structure-aware-exit.service.test.ts packages/core/src/__tests__/services/structure-aware-exit.error-handling.test.ts packages/core/src/__tests__/services/strategy-loader.test.ts packages/core/src/__tests__/services/strategy-manager.error-handling.test.ts packages/core/src/__tests__/services/tf-alignment.service.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/timeframe-weighting.error-handling.test.ts packages/core/src/__tests__/services/trading-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/swing-point-detector.error-handling.test.ts packages/core/src/__tests__/services/position-exiting.service.test.ts packages/core/src/__tests__/services/whale-detection.error-handling.test.ts packages/core/src/__tests__/services/smart-order-placement.error-handling.test.ts packages/core/src/__tests__/services/prometheus-metrics.test.ts` PASS (20 suites / 520 tests)
- 2026-04-26: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
