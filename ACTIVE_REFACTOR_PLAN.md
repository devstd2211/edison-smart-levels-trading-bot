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
- 2026-04-19: completed the next lifecycle/testability and suite-state reduction follow-up for `whale-detection.error-handling`, `volatility-regime.service`, `volatility-regime.error-handling`, `take-profit-manager.service`, `take-profit-manager.error-handling`, `tf-alignment.service`, `tf-alignment.error-handling`, `timeframe-weighting.error-handling`, `strategy-manager.error-handling`, and `virtual-balance.error-handling` by replacing direct exported `Managed*Context` suite coupling with narrower local runtime aliases derived from `createManaged...` helpers and by trimming the remaining helper-return casts where the managed runtime already matched the narrowed suite state.
- Reviewed adjacent production surfaces opportunistically during this slice across the corresponding whale, volatility, take-profit, alignment, timeframe-weighting, strategy-manager, and virtual-balance services; no small safe production refactor was required.

## Latest Verification
- 2026-04-19: `npm test -- --runInBand packages/core/src/__tests__/services/whale-detection.error-handling.test.ts packages/core/src/__tests__/services/volatility-regime.service.test.ts packages/core/src/__tests__/services/volatility-regime.error-handling.test.ts packages/core/src/__tests__/services/take-profit-manager.service.test.ts packages/core/src/__tests__/services/take-profit-manager.error-handling.test.ts packages/core/src/__tests__/services/tf-alignment.service.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts packages/core/src/__tests__/services/timeframe-weighting.error-handling.test.ts packages/core/src/__tests__/services/strategy-manager.error-handling.test.ts packages/core/src/__tests__/services/virtual-balance.error-handling.test.ts` PASS
- 2026-04-19: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
