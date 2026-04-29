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
- 2026-04-29: closed the residual logger/testability issue exposed by the previous `bot-factory.service.test` verification pass and then finished the last narrow suite-state follow-up in nearby service tests.
- Adjusted `packages/core/src/services/logger.service.ts` so background log-retention cleanup no longer emits direct asynchronous console housekeeping output; cleanup remains best-effort and still routes failures through `ErrorHandler` when present.
- Narrowed the remaining direct suite-field ownership in `analyzer-engine.error-handling.test.ts`, `analyzer-engine.service.test.ts`, `analyzer-engine.error-handling-advanced.test.ts`, `candle-provider.error-handling.test.ts`, `bybit.repository-integration.test.ts`, `smart-order-placement.error-handling.test.ts`, and `position-lifecycle.repository-integration.test.ts`.
- Re-scanned `packages/core/src/__tests__/services/*.test.ts`; the direct `Context['...']` / `ReturnType<typeof createManaged...>` test ownership pattern that drove this campaign is now empty.

## Latest Verification
- 2026-04-29: `npm test -- --runInBand packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/bot-factory.error-handling.test.ts packages/core/src/__tests__/services/logger.service.error-handling.test.ts` PASS
- 2026-04-29: `npm test -- --runInBand packages/core/src/__tests__/services/analyzer-engine.error-handling.test.ts packages/core/src/__tests__/services/analyzer-engine.service.test.ts packages/core/src/__tests__/services/candle-provider.error-handling.test.ts packages/core/src/__tests__/services/bybit.repository-integration.test.ts packages/core/src/__tests__/services/smart-order-placement.error-handling.test.ts` PASS
- 2026-04-29: `npm test -- --runInBand packages/core/src/__tests__/services/analyzer-engine.error-handling-advanced.test.ts packages/core/src/__tests__/services/position-lifecycle.repository-integration.test.ts` PASS
- 2026-04-29: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
