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
- 2026-04-24: completed the next requested ten-task lifecycle/testability narrowing slice across `pattern-recognition.error-handling`, `performance-analytics.service`, `smart-order-placement.error-handling`, `smart-order-execution`, `strategy-config-merger.error-handling`, `volume-profile.service`, `wall-tracker.service`, `wall-tracker.error-handling`, `reality-check.error-handling`, and `retest-entry.service`.
- Replaced another batch of temporary `suiteState`/`managedContext` locals, binder-owned helper-return holders, and wider-than-needed setup aliases with direct helper destructuring and narrower helper-owned runtime access while preserving cleanup semantics, harness wiring, and behavior.
- Reviewed adjacent production surfaces around pattern recognition, performance analytics, smart order placement/execution, strategy config merging, volume profiling, wall tracking, reality checks, and retest entry; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-24: `npm test -- --runInBand packages/core/src/__tests__/services/pattern-recognition.error-handling.test.ts packages/core/src/__tests__/services/performance-analytics.service.test.ts packages/core/src/__tests__/services/smart-order-placement.error-handling.test.ts packages/core/src/__tests__/services/smart-order-execution.test.ts packages/core/src/__tests__/services/strategy-config-merger.error-handling.test.ts packages/core/src/__tests__/services/volume-profile.service.test.ts packages/core/src/__tests__/services/wall-tracker.service.test.ts packages/core/src/__tests__/services/wall-tracker.error-handling.test.ts packages/core/src/__tests__/services/reality-check.error-handling.test.ts packages/core/src/__tests__/services/retest-entry.service.test.ts` PASS
- 2026-04-24: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
