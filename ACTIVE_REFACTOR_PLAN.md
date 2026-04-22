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
- 2026-04-22: completed the next ten-item lifecycle/testability narrowing slice across `action-queue.error-handling`, `advanced-order-flow.error-handling`, `micro-wall-detector.service`, `micro-wall-detector.error-handling`, `logger.service.error-handling`, `position-monitor.service`, `position-monitor.error-handling`, `position-exiting.transactional`, `risk-manager.service`, and `risk-manager.error-handling`.
- Added the missing helper-owned runtime contracts for `micro-wall-detector`, `logger`, `position-monitor`, `position-exiting` transactional helpers, and `risk-manager`; then switched the targeted suites off direct `Managed*Context` ownership and onto helper-exported runtime slices. `advanced-order-flow.error-handling` was tightened to existing helper runtime/factory exports, while `action-queue.error-handling` was verified as already narrow enough and required no code changes.
- Reviewed adjacent production surfaces around action queueing, advanced order flow, micro wall detection, logging, position monitoring, transactional exit handling, and risk management; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-22: `npm test -- --runInBand packages/core/src/__tests__/services/action-queue.error-handling.test.ts packages/core/src/__tests__/services/advanced-order-flow.error-handling.test.ts packages/core/src/__tests__/services/micro-wall-detector.service.test.ts packages/core/src/__tests__/services/micro-wall-detector.error-handling.test.ts packages/core/src/__tests__/services/logger.service.error-handling.test.ts packages/core/src/__tests__/services/position-monitor.service.test.ts packages/core/src/__tests__/services/position-monitor.error-handling.test.ts packages/core/src/__tests__/services/position-exiting.transactional.test.ts packages/core/src/__tests__/services/risk-manager.service.test.ts packages/core/src/__tests__/services/risk-manager.error-handling.test.ts` PASS
- 2026-04-22: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
