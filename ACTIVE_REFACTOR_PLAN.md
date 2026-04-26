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
- 2026-04-26: completed the next lifecycle/testability narrowing slice across `bot-metrics.error-handling`, `fractal-smc-weighting.error-handling`, `micro-wall-detector.error-handling`, `order-execution-detector.error-handling`, `phase-10-integration`, `position-sync.service.error-handling`, `resilience/circuit-breaker`, `retest-entry.error-handling`, `risk-calculator.error-handling`, `smart-order-placement.error-handling`, `structure-aware-exit.error-handling`, `swing-point-detector.error-handling`, `tf-alignment.error-handling`, `tick-delta-analyzer.error-handling`, `timeframe-weighting.error-handling`, and `weight-matrix-calculator.error-handling`.
- Narrowed a 20-task cleanup batch in those suites by removing temporary managed-context handoff locals, dropping suite-local fixture accessor/binder wrappers, collapsing redundant harness destructuring, and keeping helper-owned contracts at the boundary without changing behavior.
- Reviewed adjacent production surfaces around metrics, fractal weighting, micro-wall detection, execution detection, phase-10 integration, position sync, circuit breaking, retest entry, risk calculation, smart order placement, structure-aware exits, swing/tick delta analysis, timeframe alignment/weighting, and weight-matrix scoring; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-26: `npm test -- --runInBand packages/core/src/__tests__/services/bot-metrics.error-handling.test.ts packages/core/src/__tests__/services/fractal-smc-weighting.error-handling.test.ts packages/core/src/__tests__/services/micro-wall-detector.error-handling.test.ts packages/core/src/__tests__/services/order-execution-detector.error-handling.test.ts packages/core/src/__tests__/services/phase-10-integration.test.ts packages/core/src/__tests__/services/position-sync.service.error-handling.test.ts packages/core/src/__tests__/services/resilience/circuit-breaker.test.ts packages/core/src/__tests__/services/retest-entry.error-handling.test.ts packages/core/src/__tests__/services/risk-calculator.error-handling.test.ts packages/core/src/__tests__/services/smart-order-placement.error-handling.test.ts packages/core/src/__tests__/services/structure-aware-exit.error-handling.test.ts packages/core/src/__tests__/services/swing-point-detector.error-handling.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/timeframe-weighting.error-handling.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.error-handling.test.ts` PASS (16 suites / 417 tests)
- 2026-04-26: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
