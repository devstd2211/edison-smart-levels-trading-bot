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
- 2026-04-19: completed the next lifecycle/testability and suite-state reduction slice across `bybit.repository-integration`, `circuit-breaker.error-handling`, `circuit-breaker.service`, `entry-confirmation.error-handling`, `graceful-shutdown.service`, `graceful-shutdown.error-handling`, `funding-rate-filter.service`, `funding-rate-filter.error-handling`, `dynamic-position-sizer`, and `console-dashboard.error-handling`.
- Replaced the remaining direct `ReturnType<typeof createManaged...>` ownership and broad managed-context binding in the affected suites with narrow local runtime aliases, explicit mock/harness contracts, and helper-shaped fixture state while preserving the existing setup/cleanup flow.
- Reviewed adjacent production surfaces opportunistically during this slice across the corresponding bybit repository integration, circuit-breaker, entry-confirmation, graceful-shutdown, funding-rate-filter, dynamic-position-sizer, and console-dashboard services; no small safe production refactor was required.

## Latest Verification
- 2026-04-19: `npm test -- --runInBand packages/core/src/__tests__/services/bybit.repository-integration.test.ts packages/core/src/__tests__/services/circuit-breaker.error-handling.test.ts packages/core/src/__tests__/services/circuit-breaker.service.test.ts packages/core/src/__tests__/services/entry-confirmation.error-handling.test.ts packages/core/src/__tests__/services/graceful-shutdown.service.test.ts packages/core/src/__tests__/services/graceful-shutdown.error-handling.test.ts packages/core/src/__tests__/services/funding-rate-filter.service.test.ts packages/core/src/__tests__/services/funding-rate-filter.error-handling.test.ts packages/core/src/__tests__/services/dynamic-position-sizer.test.ts packages/core/src/__tests__/services/console-dashboard.error-handling.test.ts` PASS
- 2026-04-19: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
