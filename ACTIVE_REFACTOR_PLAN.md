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
- 2026-04-21: completed the next ten-item lifecycle/testability narrowing slice across `advanced-order-flow.error-handling`, `advanced-order-state-machine`, `analyzer-engine.error-handling`, `analyzer-engine.error-handling-advanced`, `analyzer-engine.service`, `analyzer-registration-fixes`, `bot-factory.error-handling`, `bot-factory.service`, `bot-initializer.error-handling`, and `candle-provider.error-handling`.
- Removed remaining suite-local `state`/`fixtures`/`cleanup` wrappers and temporary test-only aliases where helpers already exposed the needed runtime/factory contracts, keeping setup/cleanup and assertions unchanged.
- Reviewed adjacent production surfaces opportunistically around the touched advanced-order-flow, advanced-order-state-machine, analyzer-engine, analyzer registration, bot factory, bot initializer, and candle provider areas; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-21: `npm test -- --runInBand packages/core/src/__tests__/services/advanced-order-flow.error-handling.test.ts packages/core/src/__tests__/services/advanced-order-state-machine.test.ts packages/core/src/__tests__/services/analyzer-engine.error-handling.test.ts packages/core/src/__tests__/services/analyzer-engine.error-handling-advanced.test.ts packages/core/src/__tests__/services/analyzer-engine.service.test.ts packages/core/src/__tests__/services/analyzer-registration-fixes.test.ts packages/core/src/__tests__/services/bot-factory.error-handling.test.ts packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/bot-initializer.error-handling.test.ts packages/core/src/__tests__/services/candle-provider.error-handling.test.ts` PASS
- 2026-04-21: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
