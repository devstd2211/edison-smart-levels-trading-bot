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
- 2026-04-17: completed the next lifecycle/testability and suite-state reduction follow-up for `position-exiting.error-handling`, `position-exiting.service`, `position-exiting.race-condition`, `position-lifecycle.error-handling`, `position-lifecycle.p0-safety`, `position-scaling`, `position-monitor.error-handling`, `position-state-machine.error-handling`, `position-sync.service.error-handling`, and `smart-order-placement.error-handling` by replacing remaining local `ReturnType<typeof createManaged...>` aliases with helper-exported managed context types where available, removing binder/accessor/runtime-fixture wrappers, and narrowing `beforeEach` bindings to direct managed-context picks while preserving behavior and staying test-only.
- Reviewed adjacent production surfaces opportunistically during this slice across the corresponding services; no small safe production refactor was required.

## Latest Verification
- 2026-04-17: `npm test -- --runInBand --silent packages/core/src/__tests__/services/position-exiting.error-handling.test.ts packages/core/src/__tests__/services/position-exiting.service.test.ts packages/core/src/__tests__/services/position-exiting.race-condition.test.ts packages/core/src/__tests__/services/position-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/position-lifecycle.p0-safety.test.ts packages/core/src/__tests__/services/position-scaling.test.ts packages/core/src/__tests__/services/position-monitor.error-handling.test.ts packages/core/src/__tests__/services/position-state-machine.error-handling.test.ts packages/core/src/__tests__/services/position-sync.service.error-handling.test.ts packages/core/src/__tests__/services/smart-order-placement.error-handling.test.ts` PASS
- 2026-04-17: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
