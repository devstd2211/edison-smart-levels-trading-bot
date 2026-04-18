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
- 2026-04-18: completed the next lifecycle/testability and suite-state reduction follow-up for `anti-flip.error-handling`, `anomaly-detection.error-handling`, `analyzer-registry.error-handling`, `action-queue.error-handling`, `circuit-breaker.error-handling`, `delta-analyzer.error-handling`, `data-collector.error-handling`, `console-dashboard.error-handling`, `config-validator.error-handling`, and `tf-alignment.error-handling` by replacing remaining `ReturnType<typeof createManaged...>` aliases, redundant factory-only state splits, temporary runtime locals, and broader helper-context ownership with narrower local `Pick<>` suite state and direct setup destructuring.
- Reviewed adjacent production surfaces opportunistically during this slice across the corresponding services; no small safe production refactor was required.

## Latest Verification
- 2026-04-18: `npm test -- --runInBand packages/core/src/__tests__/services/anti-flip.error-handling.test.ts packages/core/src/__tests__/services/anomaly-detection.error-handling.test.ts packages/core/src/__tests__/services/analyzer-registry.error-handling.test.ts packages/core/src/__tests__/services/action-queue.error-handling.test.ts packages/core/src/__tests__/services/circuit-breaker.error-handling.test.ts packages/core/src/__tests__/services/delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/data-collector.error-handling.test.ts packages/core/src/__tests__/services/console-dashboard.error-handling.test.ts packages/core/src/__tests__/services/config-validator.error-handling.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts` PASS
- 2026-04-18: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
