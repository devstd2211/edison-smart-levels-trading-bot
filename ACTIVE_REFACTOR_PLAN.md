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
- 2026-04-23: completed the next ten-task lifecycle/testability narrowing slice across `public-websocket.error-handling`, `position-pnl-calculator.service`, `position-pnl-calculator.error-handling`, `position-state-machine.service`, `position-state-machine.error-handling`, `real-time-risk-monitor.cache-invalidation`, `reality-check.error-handling`, `indicator-precalculation.error-handling`, `candle-aggregator.error-handling`, and `action-queue.error-handling`.
- Added narrower helper-owned suite aliases for public websocket, position PnL calculator, position state machine, reality check, indicator precalculation, and action queue helpers, then switched the touched suites off mixed `Managed*Runtime` and broad shared/factory combinations toward direct suite-state ownership while preserving the same harness factories and cleanup semantics.
- Reviewed adjacent production surfaces around public websocket handling, position PnL calculation, position state management, reality check analysis, indicator precalculation, candle aggregation, and action queue processing; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-23: `npm test -- --runInBand packages/core/src/__tests__/services/public-websocket.error-handling.test.ts packages/core/src/__tests__/services/position-pnl-calculator.service.test.ts packages/core/src/__tests__/services/position-pnl-calculator.error-handling.test.ts packages/core/src/__tests__/services/position-state-machine.service.test.ts packages/core/src/__tests__/services/position-state-machine.error-handling.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.cache-invalidation.test.ts packages/core/src/__tests__/services/reality-check.error-handling.test.ts packages/core/src/__tests__/services/indicator-precalculation.error-handling.test.ts packages/core/src/__tests__/services/candle-aggregator.error-handling.test.ts packages/core/src/__tests__/services/action-queue.error-handling.test.ts` PASS
- 2026-04-23: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
