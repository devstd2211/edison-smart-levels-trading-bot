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
- 2026-04-22: completed the next ten-item lifecycle/testability narrowing slice across `wall-tracker.error-handling`, `weight-matrix-calculator.service`, `volume-profile.error-handling`, `volume-profile.service`, `tick-delta-analyzer.error-handling`, `tick-delta-analyzer.service`, `whale-wall-tp.error-handling`, `bybit.repository-integration`, `circuit-breaker.service`, and `circuit-breaker.error-handling`.
- Added helper-exported runtime contracts for the remaining `tick-delta-analyzer` and `volume-profile` suites, then replaced suite-local `Pick<ReturnType<typeof createManaged...>>` aliases and broader managed-context ownership in `tick-delta-analyzer.*`, `volume-profile.*`, `bybit.repository-integration`, and `circuit-breaker.*`.
- Reviewed `wall-tracker.error-handling`, `weight-matrix-calculator.service`, and `whale-wall-tp.error-handling` in the same batch and left them unchanged because they already consume adequately narrow helper-owned runtime/factory state for this refactor target.
- Reviewed adjacent production surfaces opportunistically around wall tracking, weight matrix scoring, volume profile, tick delta analysis, whale-wall TP, bybit repository integration, and circuit breaker flows; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-22: `npm test -- --runInBand packages/core/src/__tests__/services/wall-tracker.error-handling.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.service.test.ts packages/core/src/__tests__/services/volume-profile.error-handling.test.ts packages/core/src/__tests__/services/volume-profile.service.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.service.test.ts packages/core/src/__tests__/services/whale-wall-tp.error-handling.test.ts packages/core/src/__tests__/services/bybit.repository-integration.test.ts packages/core/src/__tests__/services/circuit-breaker.service.test.ts packages/core/src/__tests__/services/circuit-breaker.error-handling.test.ts` PASS
- 2026-04-22: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
