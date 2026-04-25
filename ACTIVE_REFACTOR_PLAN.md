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
- 2026-04-25: completed the next 20-suite lifecycle/testability narrowing slice across `data-collector.error-handling`, `delta-analyzer.service`, `delta-analyzer.error-handling`, `dynamic-position-sizer`, `entry-confirmation.service`, `entry-confirmation.error-handling`, `exit-type-detector.service`, `exit-type-detector.service.error-handling`, `fractal-smc-weighting.error-handling`, `graceful-shutdown.service`, `graceful-shutdown.error-handling`, `health-check`, `ladder-tp-manager.service`, `ladder-tp-manager.error-handling`, `limit-order-executor.service`, `limit-order-executor.error-handling`, `micro-wall-detector.service`, `micro-wall-detector.error-handling`, `ml-feature-extractor.service`, and `ml-feature-extractor.error-handling`.
- Removed another nearby batch of local managed-context clutter by hoisting repeated `ReturnType<typeof createManaged...>` aliases out of nested suite scope, replacing temporary `managedContext` setup ownership with direct destructuring or narrow local assignments, and keeping explicit local casts only where helper return types remained intentionally broader than suite-specific mock contracts.
- Reviewed adjacent production surfaces around data collection, delta analysis, graceful shutdown orchestration, ladder TP handling, limit-order execution, micro-wall detection, ML feature extraction, and health checks; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-25: `npm test -- --runInBand packages/core/src/__tests__/services/data-collector.error-handling.test.ts packages/core/src/__tests__/services/delta-analyzer.service.test.ts packages/core/src/__tests__/services/delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/dynamic-position-sizer.test.ts packages/core/src/__tests__/services/entry-confirmation.service.test.ts packages/core/src/__tests__/services/entry-confirmation.error-handling.test.ts packages/core/src/__tests__/services/exit-type-detector.service.test.ts packages/core/src/__tests__/services/exit-type-detector.service.error-handling.test.ts packages/core/src/__tests__/services/fractal-smc-weighting.error-handling.test.ts packages/core/src/__tests__/services/graceful-shutdown.error-handling.test.ts packages/core/src/__tests__/services/graceful-shutdown.service.test.ts packages/core/src/__tests__/services/health-check.test.ts packages/core/src/__tests__/services/ladder-tp-manager.service.test.ts packages/core/src/__tests__/services/ladder-tp-manager.error-handling.test.ts packages/core/src/__tests__/services/limit-order-executor.service.test.ts packages/core/src/__tests__/services/limit-order-executor.error-handling.test.ts packages/core/src/__tests__/services/micro-wall-detector.service.test.ts packages/core/src/__tests__/services/micro-wall-detector.error-handling.test.ts packages/core/src/__tests__/services/ml-feature-extractor.service.test.ts packages/core/src/__tests__/services/ml-feature-extractor.error-handling.test.ts` PASS
- 2026-04-25: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
