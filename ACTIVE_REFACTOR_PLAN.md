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
- 2026-04-26: completed the next lifecycle/testability narrowing slice across `position-monitor.error-handling`, `position-lifecycle.repository-integration`, `position-lifecycle.error-handling`, `position-lifecycle.p0-safety`, `position-exiting.service`, `position-exiting.race-condition`, `position-exiting.integration`, `position-exiting.functional`, `position-exiting.error-handling`, `position-exiting.transactional`, `dynamic-position-sizer`, `strategy-manager.error-handling`, `risk-manager.service`, `risk-manager.error-handling`, `risk-calculator.error-handling`, `real-time-risk-monitor.service`, `real-time-risk-monitor.error-handling`, `real-time-risk-monitor.cache-invalidation`, `take-profit-manager.service`, and `take-profit-manager.error-handling`.
- Narrowed this 20-task batch by removing direct helper-exported managed runtime/state test-type dependencies in favor of suite-local `ReturnType<typeof createManaged...>` aliases, keeping helper-owned setup boundaries intact and trimming suite-local managed-context surface without changing behavior.
- Reviewed adjacent production surfaces around position lifecycle / exiting, dynamic sizing, strategy management, risk management / calculation, real-time risk monitoring, and take-profit management; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-26: `npm test -- --runInBand packages/core/src/__tests__/services/position-monitor.error-handling.test.ts packages/core/src/__tests__/services/position-lifecycle.repository-integration.test.ts packages/core/src/__tests__/services/position-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/position-lifecycle.p0-safety.test.ts packages/core/src/__tests__/services/position-exiting.service.test.ts packages/core/src/__tests__/services/position-exiting.race-condition.test.ts packages/core/src/__tests__/services/position-exiting.integration.test.ts packages/core/src/__tests__/services/position-exiting.functional.test.ts packages/core/src/__tests__/services/position-exiting.error-handling.test.ts packages/core/src/__tests__/services/position-exiting.transactional.test.ts packages/core/src/__tests__/services/dynamic-position-sizer.test.ts packages/core/src/__tests__/services/strategy-manager.error-handling.test.ts packages/core/src/__tests__/services/risk-manager.service.test.ts packages/core/src/__tests__/services/risk-manager.error-handling.test.ts packages/core/src/__tests__/services/risk-calculator.error-handling.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.service.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.error-handling.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.cache-invalidation.test.ts packages/core/src/__tests__/services/take-profit-manager.service.test.ts packages/core/src/__tests__/services/take-profit-manager.error-handling.test.ts` PASS (20 suites / 447 tests)
- 2026-04-26: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
