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
- 2026-04-20: completed the next lifecycle/testability and suite-state narrowing slice across `analyzer-engine.error-handling`, `analyzer-engine.error-handling-advanced`, `analyzer-registration-fixes`, `bot-initializer.error-handling`, `bybit.repository-integration`, `exchange-factory.error-handling`, `indicator-cache.error-handling`, and `indicator-precalculation.error-handling`.
- Replaced the remaining local runtime aliases, repeated managed-context picks, and one unnecessary cast in the affected suites with direct helper-exported managed-context contracts and narrower `Pick<>`-based state bindings, preserving setup/cleanup and helper-owned lifecycle behavior.
- Reviewed adjacent production surfaces opportunistically during this slice across the corresponding analyzer-engine, analyzer-registration, bot-initializer, bybit repository integration, exchange-factory, indicator-cache, and indicator-precalculation services; no small safe production refactor was required.

## Latest Verification
- 2026-04-20: `npm test -- --runInBand packages/core/src/__tests__/services/analyzer-engine.error-handling.test.ts packages/core/src/__tests__/services/analyzer-engine.error-handling-advanced.test.ts packages/core/src/__tests__/services/analyzer-registration-fixes.test.ts packages/core/src/__tests__/services/bot-initializer.error-handling.test.ts packages/core/src/__tests__/services/bybit.repository-integration.test.ts packages/core/src/__tests__/services/exchange-factory.error-handling.test.ts packages/core/src/__tests__/services/indicator-cache.error-handling.test.ts packages/core/src/__tests__/services/indicator-precalculation.error-handling.test.ts` PASS
- 2026-04-20: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
