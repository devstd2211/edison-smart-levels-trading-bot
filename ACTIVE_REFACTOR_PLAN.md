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
- 2026-04-29: completed the next cleanup follow-up across `analyzer-engine.error-handling-advanced.test`, `bot-factory.service.test`, `phase-10-integration.test`, and `position-lifecycle.repository-integration.test`, plus the supporting `phase-10-integration-test.utils` helper export.
- Narrowed this slice by removing the remaining direct `Managed*Context`-type ownership in those suites and switching them to narrower helper-owned runtime/suite state contracts that match the already-refactored pattern.
- Re-scanned the original managed-context narrowing query after this slice; the direct `ReturnType<typeof createManaged...>` / `Managed*Context['...']` candidate class that drove the recent batches is now effectively exhausted in `packages/core/src/__tests__/services`.

## Latest Verification
- 2026-04-29: `npm test -- --runInBand packages/core/src/__tests__/services/analyzer-engine.error-handling-advanced.test.ts packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/phase-10-integration.test.ts packages/core/src/__tests__/services/position-lifecycle.repository-integration.test.ts` assertions PASS, but the overall Jest process returned non-zero because of a pre-existing async logger cleanup warning from `LoggerService.cleanOldLogs` during `bot-factory.service.test` ("Cannot log after tests are done").
- 2026-04-29: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
