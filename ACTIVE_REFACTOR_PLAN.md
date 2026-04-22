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
- 2026-04-22: completed the next ten-item lifecycle/testability narrowing slice across `compound-interest-calculator.error-handling`, `config-validator.service`, `config-validator.error-handling`, `create-services.lifecycle`, `data-collector.error-handling`, `delta-analyzer.service`, `delta-analyzer.error-handling`, `dynamic-position-sizer`, `entry-confirmation.service`, and `entry-confirmation.error-handling`.
- Added narrow helper-exported state aliases for data collector, delta analyzer, dynamic position sizer, and entry confirmation suites, then switched the touched tests onto those helper-owned contracts instead of local ad hoc state definitions. `dynamic-position-sizer` now uses a helper-exported state alias instead of an inline suite-local Pick, and both entry-confirmation suites now share helper-owned state aliases.
- Reviewed adjacent production surfaces around compound interest sizing, config validation, create-services lifecycle orchestration, data collection, delta analysis, dynamic sizing, and entry confirmation; no small safe production refactor was required in this slice. `compound-interest-calculator.error-handling`, both config-validator suites, and `create-services.lifecycle` were verified as already narrow enough and required no code changes.

## Latest Verification
- 2026-04-22: `npm test -- --runInBand packages/core/src/__tests__/services/compound-interest-calculator.error-handling.test.ts packages/core/src/__tests__/services/config-validator.service.test.ts packages/core/src/__tests__/services/config-validator.error-handling.test.ts packages/core/src/__tests__/services/create-services.lifecycle.test.ts packages/core/src/__tests__/services/data-collector.error-handling.test.ts packages/core/src/__tests__/services/delta-analyzer.service.test.ts packages/core/src/__tests__/services/delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/dynamic-position-sizer.test.ts packages/core/src/__tests__/services/entry-confirmation.service.test.ts packages/core/src/__tests__/services/entry-confirmation.error-handling.test.ts` PASS
- 2026-04-22: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
