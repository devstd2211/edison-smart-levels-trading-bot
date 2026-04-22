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
- 2026-04-22: completed the next ten-item lifecycle/testability narrowing slice across `event-handlers.error-handling`, `session-stats.error-handling`, `retest-entry.service`, `retest-entry.error-handling`, `orderbook-manager.service`, `orderbook-manager.service.error-handling`, `funding-rate-filter.service`, `funding-rate-filter.error-handling`, `position-pnl-calculator.service`, and `position-pnl-calculator.error-handling`.
- Replaced remaining suite-local ownership of exported managed/runtime helper aliases with local `Pick<ReturnType<typeof createManaged...>>` slices in the touched suites, keeping fixture scope explicit without changing setup behavior or assertions.
- Reviewed adjacent production surfaces opportunistically around event handlers, session stats, retest entry, orderbook manager, funding rate filter, and position PnL calculator; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-22: `npm test -- --runInBand packages/core/src/__tests__/services/event-handlers.error-handling.test.ts packages/core/src/__tests__/services/session-stats.error-handling.test.ts packages/core/src/__tests__/services/retest-entry.service.test.ts packages/core/src/__tests__/services/retest-entry.error-handling.test.ts packages/core/src/__tests__/services/orderbook-manager.service.test.ts packages/core/src/__tests__/services/orderbook-manager.service.error-handling.test.ts packages/core/src/__tests__/services/funding-rate-filter.service.test.ts packages/core/src/__tests__/services/funding-rate-filter.error-handling.test.ts packages/core/src/__tests__/services/position-pnl-calculator.service.test.ts packages/core/src/__tests__/services/position-pnl-calculator.error-handling.test.ts` PASS
- 2026-04-22: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
