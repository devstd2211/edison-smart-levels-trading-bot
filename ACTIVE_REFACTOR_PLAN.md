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
- 2026-04-18: completed the next lifecycle/testability and suite-state reduction follow-up for `order-execution-pipeline.error-handling`, `position-lifecycle.repository-integration`, `position-exiting.service`, `position-exiting.error-handling`, `position-exiting.integration`, `position-exiting.functional`, `position-exiting.transactional`, `position-exiting.race-condition`, `dynamic-position-sizer`, and `smart-order-execution` by replacing repeated managed-context ownership and `ReturnType<typeof createManaged...>` usage with local `Pick<>` suite slices, removing remaining broad managed-context locals where still present, and keeping the slice behavior-preserving and test-only.
- Reviewed adjacent production surfaces opportunistically during this slice across the corresponding services; no small safe production refactor was required.

## Latest Verification
- 2026-04-18: `npm test -- --runInBand packages/core/src/__tests__/services/order-execution-pipeline.error-handling.test.ts packages/core/src/__tests__/services/position-lifecycle.repository-integration.test.ts packages/core/src/__tests__/services/position-exiting.service.test.ts packages/core/src/__tests__/services/position-exiting.error-handling.test.ts packages/core/src/__tests__/services/position-exiting.integration.test.ts packages/core/src/__tests__/services/position-exiting.functional.test.ts packages/core/src/__tests__/services/position-exiting.transactional.test.ts packages/core/src/__tests__/services/position-exiting.race-condition.test.ts packages/core/src/__tests__/services/dynamic-position-sizer.test.ts packages/core/src/__tests__/services/smart-order-execution.test.ts` PASS
- 2026-04-18: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
