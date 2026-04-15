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
- 2026-04-15: completed a lifecycle/testability and suite-state reduction follow-up for `telegram.error-handling`, `virtual-balance.error-handling`, `structure-aware-exit.service`, `structure-aware-exit.error-handling`, `trading-journal.error-handling`, `trading-journal.service`, `trading-orchestrator.error-handling`, `position-pnl-calculator.error-handling`, `position-pnl-calculator.service`, and `trade-history.error-handling` by replacing remaining broad managed-context imports/usages with narrow `ReturnType<typeof createManaged...>` aliases, focused runtime/factory picks, and direct helper-owned cleanup bindings.
- Reviewed `packages/core/src/services/telegram.service.ts`, `packages/core/src/services/virtual-balance.service.ts`, `packages/core/src/services/structure-aware-exit.service.ts`, `packages/core/src/services/trading-journal.service.ts`, `packages/core/src/services/position-pnl-calculator.service.ts`, and `packages/core/src/services/trade-history.service.ts`; no production refactor was required for this batch.

## Latest Verification
- 2026-04-15: `npm test -- --runInBand --silent packages/core/src/__tests__/services/telegram.error-handling.test.ts packages/core/src/__tests__/services/virtual-balance.error-handling.test.ts packages/core/src/__tests__/services/structure-aware-exit.service.test.ts packages/core/src/__tests__/services/structure-aware-exit.error-handling.test.ts packages/core/src/__tests__/services/trading-journal.error-handling.test.ts packages/core/src/__tests__/services/trading-journal.service.test.ts packages/core/src/__tests__/services/trading-orchestrator.error-handling.test.ts packages/core/src/__tests__/services/position-pnl-calculator.error-handling.test.ts packages/core/src/__tests__/services/position-pnl-calculator.service.test.ts packages/core/src/__tests__/services/trade-history.error-handling.test.ts` PASS
- 2026-04-15: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
