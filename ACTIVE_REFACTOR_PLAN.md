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
- 2026-04-21: completed the next lifecycle/testability and suite-state narrowing slice across `circuit-breaker.service`, `circuit-breaker.error-handling`, `resilience/circuit-breaker`, `console-dashboard.error-handling`, `market-condition-analyzer.error-handling`, `micro-wall-detector.error-handling`, `retest-entry.service`, `retest-entry.error-handling`, `risk-calculator.error-handling`, and `ladder-exit-detector.service.error-handling`, plus adjacent helper narrowing in `circuit-breaker-test.utils`, `resilience-test.utils`, `console-dashboard-test.utils`, `market-condition-analyzer-test.utils`, `micro-wall-detector-test.utils`, `retest-entry-test.utils`, `risk-calculator-test.utils`, and `ladder-exit-detector-test.utils`.
- Added helper-exported narrow runtime/error-handling aliases for the touched harnesses, then moved the suites off local broad `Managed*Context`/inline `Pick<...>` ownership toward helper-owned aliases only, preserving setup/cleanup behavior and existing lifecycle flow.
- Reviewed adjacent production surfaces opportunistically during this slice across the corresponding circuit breaker, console dashboard, market condition analyzer, micro wall detector, retest entry, risk calculator, and ladder exit detector services; no small safe production refactor was required.

## Latest Verification
- 2026-04-21: `npm test -- --runInBand packages/core/src/__tests__/services/circuit-breaker.service.test.ts packages/core/src/__tests__/services/circuit-breaker.error-handling.test.ts packages/core/src/__tests__/services/resilience/circuit-breaker.test.ts packages/core/src/__tests__/services/console-dashboard.error-handling.test.ts packages/core/src/__tests__/services/market-condition-analyzer.error-handling.test.ts packages/core/src/__tests__/services/micro-wall-detector.error-handling.test.ts packages/core/src/__tests__/services/retest-entry.service.test.ts packages/core/src/__tests__/services/retest-entry.error-handling.test.ts packages/core/src/__tests__/services/risk-calculator.error-handling.test.ts packages/core/src/__tests__/services/ladder-exit-detector.service.error-handling.test.ts` PASS
- 2026-04-21: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
