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
- 2026-04-15: completed a lifecycle/testability and suite-state reduction follow-up for `advanced-order-flow.error-handling`, `advanced-order-state-machine`, `analyzer-registration-fixes`, `circuit-breaker.error-handling`, `bot-factory.service`, and `bot-factory.error-handling` by replacing direct exported `Managed*Context` test imports and suite-local whole-context ownership with narrow `ReturnType<typeof createManaged...>` aliases plus direct helper-owned cleanup bindings.
- Reviewed `packages/core/src/services/advanced-order-flow.service.ts`, `packages/core/src/services/advanced-order-state-machine.service.ts`, `packages/core/src/services/circuit-breaker.service.ts`, and `packages/core/src/services/bot-factory.service.ts`; no production refactor was required for this batch.

## Latest Verification
- 2026-04-15: `npm test -- --runInBand --silent packages/core/src/__tests__/services/advanced-order-flow.error-handling.test.ts packages/core/src/__tests__/services/advanced-order-state-machine.test.ts packages/core/src/__tests__/services/analyzer-registration-fixes.test.ts packages/core/src/__tests__/services/circuit-breaker.error-handling.test.ts packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/bot-factory.error-handling.test.ts` PASS
- 2026-04-15: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
