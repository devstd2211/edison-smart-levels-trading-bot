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
- 2026-04-15: completed a lifecycle/testability and suite-state reduction follow-up for `anti-flip.error-handling`, `bybit.error-handling`, `candle-aggregator.error-handling`, `candle-provider.error-handling`, `config-validator.service`, `config-validator.error-handling`, `console-dashboard.error-handling`, `create-services.lifecycle`, `trading-journal.service`, and `volume-profile.error-handling` by narrowing suite-owned runtime/factory bindings with local `Pick` aliases, hoisting repeated `Parameters<>`/cleanup aliases, and removing unnecessary managed-context casts while keeping the slice behavior-preserving and test-only.
- Reviewed adjacent service surfaces opportunistically during this slice; no small safe production refactor was required.

## Latest Verification
- 2026-04-15: `npm test -- --runInBand --silent packages/core/src/__tests__/services/anti-flip.error-handling.test.ts packages/core/src/__tests__/services/bybit.error-handling.test.ts packages/core/src/__tests__/services/candle-aggregator.error-handling.test.ts packages/core/src/__tests__/services/candle-provider.error-handling.test.ts packages/core/src/__tests__/services/config-validator.service.test.ts packages/core/src/__tests__/services/config-validator.error-handling.test.ts packages/core/src/__tests__/services/console-dashboard.error-handling.test.ts packages/core/src/__tests__/services/create-services.lifecycle.test.ts packages/core/src/__tests__/services/trading-journal.service.test.ts packages/core/src/__tests__/services/volume-profile.error-handling.test.ts` PASS
- 2026-04-15: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
