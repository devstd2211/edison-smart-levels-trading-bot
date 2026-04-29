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
- 2026-04-29: completed the next lifecycle/testability narrowing slice across `strategy-loader.test`, `strategy-loader.error-handling.test`, `smart-order-placement.error-handling.test`, `position-scaling.test`, `position-state-machine.service.test`, `position-state-machine.error-handling.test`, `pattern-recognition.error-handling.test`, `risk-calculator.error-handling.test`, `smart-order-execution.test`, the full `position-exiting.*` cluster, and the remaining `position-lifecycle.*` repository/safety/error-handling suites, plus the supporting helper exports in `strategy-loader-test.utils`, `smart-order-placement-test.utils`, `position-scaling-test.utils`, `position-state-machine-test.utils`, `pattern-recognition-test.utils`, and `position-exiting-test.utils`.
- Narrowed this slice by replacing the remaining suite-local `ReturnType<typeof createManaged...>` aliases and nearby direct managed-context field picks with helper-owned runtime/suite/error state contracts, and by exposing the missing helper factory/runtime types needed to keep these suites off direct managed-context ownership.
- Reviewed adjacent production surfaces around `strategy-loader.service`, `smart-order-placement.service`, `position-scaling.service`, `position-state-machine.service`, `pattern-recognition.service`, `risk-calculator.service`, `smart-order-execution.service`, `position-exiting.service`, and `position-lifecycle.service`; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-29: `npm test -- --runInBand packages/core/src/__tests__/services/strategy-loader.test.ts packages/core/src/__tests__/services/strategy-loader.error-handling.test.ts packages/core/src/__tests__/services/smart-order-placement.error-handling.test.ts packages/core/src/__tests__/services/position-scaling.test.ts packages/core/src/__tests__/services/position-state-machine.service.test.ts packages/core/src/__tests__/services/position-state-machine.error-handling.test.ts` PASS
- 2026-04-29: `npm test -- --runInBand packages/core/src/__tests__/services/pattern-recognition.error-handling.test.ts packages/core/src/__tests__/services/risk-calculator.error-handling.test.ts packages/core/src/__tests__/services/smart-order-execution.test.ts` PASS
- 2026-04-29: `npm test -- --runInBand packages/core/src/__tests__/services/position-exiting.service.test.ts packages/core/src/__tests__/services/position-exiting.error-handling.test.ts packages/core/src/__tests__/services/position-exiting.functional.test.ts packages/core/src/__tests__/services/position-exiting.integration.test.ts packages/core/src/__tests__/services/position-exiting.race-condition.test.ts packages/core/src/__tests__/services/position-exiting.transactional.test.ts packages/core/src/__tests__/services/position-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/position-lifecycle.p0-safety.test.ts packages/core/src/__tests__/services/position-lifecycle.repository-integration.test.ts` PASS
- 2026-04-29: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
