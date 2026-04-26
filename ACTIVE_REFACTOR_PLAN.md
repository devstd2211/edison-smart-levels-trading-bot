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
- 2026-04-26: completed the next lifecycle/testability narrowing slice across `ladder-exit-detector.service.error-handling`, `multi-timeframe-trend.error-handling`, `pattern-recognition.error-handling`, `position-scaling`, `prometheus-metrics`, `reality-check.error-handling`, `risk-calculator.error-handling`, `smart-order-placement.error-handling`, `smart-order-execution`, `strategy-loader`, `strategy-loader.error-handling`, `strategy-config-merger.error-handling`, `strategy-manager.error-handling`, `swing-point-detector.error-handling`, `tf-alignment`, `tf-alignment.error-handling`, `timeframe-weighting.error-handling`, `trading-lifecycle.error-handling`, `whale-detector.service`, and `whale-wall-tp.error-handling`.
- Narrowed another 20-suite batch of managed test state by replacing remaining suite-local `ReturnType<typeof createManaged...>` aliases and temporary state wrappers with helper-exported `Managed*Context` contracts, keeping ownership of runtime typing at helper boundaries without changing behavior.
- Reviewed adjacent production surfaces around ladder exits, multi-timeframe trend/alignment, pattern recognition, position scaling, metrics, reality check, risk calculation, smart order placement/execution, strategy loading/merging/management, swing-point detection, lifecycle coordination, and whale-detection flows; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-26: `npm test -- --runInBand packages/core/src/__tests__/services/ladder-exit-detector.service.error-handling.test.ts packages/core/src/__tests__/services/multi-timeframe-trend.error-handling.test.ts packages/core/src/__tests__/services/pattern-recognition.error-handling.test.ts packages/core/src/__tests__/services/position-scaling.test.ts packages/core/src/__tests__/services/prometheus-metrics.test.ts packages/core/src/__tests__/services/reality-check.error-handling.test.ts packages/core/src/__tests__/services/risk-calculator.error-handling.test.ts packages/core/src/__tests__/services/smart-order-placement.error-handling.test.ts packages/core/src/__tests__/services/smart-order-execution.test.ts packages/core/src/__tests__/services/strategy-loader.test.ts packages/core/src/__tests__/services/strategy-loader.error-handling.test.ts packages/core/src/__tests__/services/strategy-config-merger.error-handling.test.ts packages/core/src/__tests__/services/strategy-manager.error-handling.test.ts packages/core/src/__tests__/services/swing-point-detector.error-handling.test.ts packages/core/src/__tests__/services/whale-wall-tp.error-handling.test.ts packages/core/src/__tests__/services/whale-detector.service.test.ts packages/core/src/__tests__/services/tf-alignment.service.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts packages/core/src/__tests__/services/timeframe-weighting.error-handling.test.ts packages/core/src/__tests__/services/trading-lifecycle.error-handling.test.ts` PASS (20 suites / 576 tests)
- 2026-04-26: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
