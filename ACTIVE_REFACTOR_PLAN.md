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
- 2026-04-21: completed the next lifecycle/testability and suite-state narrowing slice across `take-profit-manager.error-handling`, `take-profit-manager.service`, `tick-delta-analyzer.error-handling`, `tick-delta-analyzer.service`, `swing-point-detector.error-handling`, `trade-history.error-handling`, `position-pnl-calculator.error-handling`, `position-pnl-calculator.service`, `position-state-machine.error-handling`, and `position-state-machine.service`, plus adjacent helper narrowing in `take-profit-manager-test.utils`, `tick-delta-analyzer-test.utils`, `swing-point-detector-test.utils`, `trade-history-test.utils`, `position-pnl-calculator-test.utils`, and `position-state-machine-test.utils`.
- Added helper-exported narrow runtime/factory/state aliases for the touched harnesses, then moved the suites off local wide `Managed*Context` composition and repeated suite-local state aliases to helper-owned picks only, preserving setup/cleanup behavior and existing test flow.
- Reviewed adjacent production surfaces opportunistically during this slice across the corresponding take-profit, tick delta, swing point, trade history, position PnL, and position state machine services; no small safe production refactor was required.

## Latest Verification
- 2026-04-21: `npm test -- --runInBand packages/core/src/__tests__/services/take-profit-manager.error-handling.test.ts packages/core/src/__tests__/services/take-profit-manager.service.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.service.test.ts packages/core/src/__tests__/services/swing-point-detector.error-handling.test.ts packages/core/src/__tests__/services/trade-history.error-handling.test.ts packages/core/src/__tests__/services/position-pnl-calculator.error-handling.test.ts packages/core/src/__tests__/services/position-pnl-calculator.service.test.ts packages/core/src/__tests__/services/position-state-machine.error-handling.test.ts packages/core/src/__tests__/services/position-state-machine.service.test.ts` PASS
- 2026-04-21: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
