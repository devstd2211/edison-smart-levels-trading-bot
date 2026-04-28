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
- 2026-04-28: completed the next lifecycle/testability narrowing slice across `multi-timeframe-trend.error-handling.test`, `ml-signal-validator.error-handling.test`, `position-pnl-calculator.service.test`, `position-pnl-calculator.error-handling.test`, `multi-strategy.cache.test`, `strategy-config-merger.error-handling.test`, `performance-analytics.service.test`, `performance-analytics.error-handling.test`, `pnl-calculator.service.test`, and `pnl-calculator.error-handling.test`, plus the supporting `multi-strategy-cache-test.utils` and `pnl-calculator-test.utils` helpers.
- Narrowed this 20-task batch by replacing the remaining suite-local `ReturnType<typeof createManaged...>` aliases and inline context picks with exported helper suite/error/runtime state contracts, and by exporting the missing helper-owned state types needed to keep those suites off direct managed-context shape ownership.
- Reviewed adjacent production surfaces around `multi-timeframe-trend.service`, `ml-signal-validator.service`, `position-pnl-calculator.service`, `strategy-orchestrator-cache.service`, `strategy-config-merger.service`, `performance-analytics.service`, and `pnl-calculator.service`; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-28: `npm test -- --runInBand packages/core/src/__tests__/services/multi-timeframe-trend.error-handling.test.ts packages/core/src/__tests__/services/ml-signal-validator.error-handling.test.ts packages/core/src/__tests__/services/position-pnl-calculator.service.test.ts packages/core/src/__tests__/services/position-pnl-calculator.error-handling.test.ts packages/core/src/__tests__/services/multi-strategy.cache.test.ts packages/core/src/__tests__/services/strategy-config-merger.error-handling.test.ts packages/core/src/__tests__/services/performance-analytics.service.test.ts packages/core/src/__tests__/services/performance-analytics.error-handling.test.ts packages/core/src/__tests__/services/pnl-calculator.service.test.ts packages/core/src/__tests__/services/pnl-calculator.error-handling.test.ts` PASS
- 2026-04-28: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
