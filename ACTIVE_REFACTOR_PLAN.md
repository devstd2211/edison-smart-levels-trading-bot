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
- 2026-04-20: completed the next lifecycle/testability and suite-state narrowing slice across `exit-type-detector.service`, `exit-type-detector.service.error-handling`, `funding-rate-filter.service`, `funding-rate-filter.error-handling`, `volume-profile.service`, `volume-profile.error-handling`, `volatility-regime.service`, `volatility-regime.error-handling`, `wall-tracker.service`, and `wall-tracker.error-handling`.
- Added helper-exported narrow runtime/factory aliases in the adjacent exit-type-detector, funding-rate-filter, volume-profile, volatility-regime, and wall-tracker test utils, then moved the touched suites off direct `Managed*Context` imports and local ad hoc state picks to helper-owned picks only, preserving setup/cleanup and lifecycle behavior.
- Reviewed adjacent production surfaces opportunistically during this slice across the corresponding exit-type, funding, volume, volatility, and wall tracking services; no small safe production refactor was required.

## Latest Verification
- 2026-04-20: `npm test -- --runInBand packages/core/src/__tests__/services/exit-type-detector.service.test.ts packages/core/src/__tests__/services/exit-type-detector.service.error-handling.test.ts packages/core/src/__tests__/services/funding-rate-filter.service.test.ts packages/core/src/__tests__/services/funding-rate-filter.error-handling.test.ts packages/core/src/__tests__/services/volume-profile.service.test.ts packages/core/src/__tests__/services/volume-profile.error-handling.test.ts packages/core/src/__tests__/services/volatility-regime.service.test.ts packages/core/src/__tests__/services/volatility-regime.error-handling.test.ts packages/core/src/__tests__/services/wall-tracker.service.test.ts packages/core/src/__tests__/services/wall-tracker.error-handling.test.ts` PASS
- 2026-04-20: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
