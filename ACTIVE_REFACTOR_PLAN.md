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
- 2026-04-21: completed the next lifecycle/testability and suite-state narrowing slice across `order-execution-detector.error-handling`, `order-execution-pipeline.service`, `order-execution-pipeline.error-handling`, `smart-order-execution`, `weight-matrix-calculator.service`, `weight-matrix-calculator.error-handling`, `websocket-authentication.service`, `websocket-authentication.error-handling`, `wall-tracker.service`, and `wall-tracker.error-handling`, plus adjacent helper narrowing in `order-execution-detector-test.utils`, `order-execution-pipeline-test.utils`, `smart-order-execution-test.utils`, `weight-matrix-calculator-test.utils`, `websocket-authentication-test.utils`, and `wall-tracker-test.utils`.
- Added helper-exported narrow runtime/error-handling/factory aliases for the touched harnesses, then moved the suites off direct broad `Managed*Context` ownership and suite-local wide `Pick<...>` state toward helper-owned aliases only, preserving setup/cleanup behavior and existing lifecycle flow.
- Reviewed adjacent production surfaces opportunistically during this slice across the corresponding order execution detector, order execution pipeline, smart order execution, weight matrix calculator, websocket authentication, and wall tracker services; no small safe production refactor was required.

## Latest Verification
- 2026-04-21: `npm test -- --runInBand packages/core/src/__tests__/services/order-execution-detector.error-handling.test.ts packages/core/src/__tests__/services/order-execution-pipeline.service.test.ts packages/core/src/__tests__/services/order-execution-pipeline.error-handling.test.ts packages/core/src/__tests__/services/smart-order-execution.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.service.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.error-handling.test.ts packages/core/src/__tests__/services/websocket-authentication.service.test.ts packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts packages/core/src/__tests__/services/wall-tracker.service.test.ts packages/core/src/__tests__/services/wall-tracker.error-handling.test.ts` PASS
- 2026-04-21: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
