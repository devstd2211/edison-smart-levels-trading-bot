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
- 2026-04-19: completed the next lifecycle/testability and suite-state narrowing slice across `bybit.error-handling`, `entry-confirmation.service`, `enhanced-exit.error-handling`, `exit-type-detector.service`, `exit-type-detector.service.error-handling`, `take-profit-manager.service`, `take-profit-manager.error-handling`, `tick-delta-analyzer.service`, `tick-delta-analyzer.error-handling`, `tf-alignment.service`, and `tf-alignment.error-handling`.
- Replaced the remaining direct `ReturnType<typeof createManaged...>` usage in the affected suites with explicit managed-context imports and narrow local `Pick<>`-based fixture contracts, keeping helper ownership and teardown flow unchanged.
- Reviewed adjacent production surfaces opportunistically during this slice across the corresponding bybit, entry-confirmation, enhanced-exit, exit-type-detector, take-profit-manager, tick-delta-analyzer, and tf-alignment services; no small safe production refactor was required.

## Latest Verification
- 2026-04-19: `npm test -- --runInBand packages/core/src/__tests__/services/bybit.error-handling.test.ts packages/core/src/__tests__/services/entry-confirmation.service.test.ts packages/core/src/__tests__/services/enhanced-exit.error-handling.test.ts packages/core/src/__tests__/services/exit-type-detector.service.test.ts packages/core/src/__tests__/services/exit-type-detector.service.error-handling.test.ts packages/core/src/__tests__/services/take-profit-manager.service.test.ts packages/core/src/__tests__/services/take-profit-manager.error-handling.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.service.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/tf-alignment.service.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts` PASS
- 2026-04-19: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
