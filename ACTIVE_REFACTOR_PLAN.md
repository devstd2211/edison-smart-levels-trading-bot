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
- 2026-04-28: completed the next lifecycle/testability narrowing slice across `websocket-manager.service`, `websocket-manager.error-handling`, `websocket-authentication.service`, `websocket-authentication.error-handling`, `wall-tracker.service`, `wall-tracker.error-handling`, `whale-detector.service`, `whale-detection.error-handling`, `weight-matrix-calculator.service`, `weight-matrix-calculator.error-handling`, `websocket-manager-test.utils`, `websocket-authentication-test.utils`, `wall-tracker-test.utils`, `whale-detection-test.utils`, and `weight-matrix-calculator-test.utils`.
- Narrowed this 20-task batch by replacing suite-local `ReturnType<typeof createManaged...>` field picks with exported helper runtime/state types and by promoting repeated helper factory/harness option objects into named exported option contracts so the websocket, wall/whale, and weight-matrix clusters share narrower test-owned surfaces.
- Reviewed adjacent production surfaces around websocket manager/authentication, wall tracking, whale detection, and weight-matrix calculation; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-28: `npm test -- --runInBand packages/core/src/__tests__/services/websocket-manager.service.test.ts packages/core/src/__tests__/services/websocket-manager.error-handling.test.ts packages/core/src/__tests__/services/websocket-authentication.service.test.ts packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts packages/core/src/__tests__/services/wall-tracker.service.test.ts packages/core/src/__tests__/services/wall-tracker.error-handling.test.ts packages/core/src/__tests__/services/whale-detector.service.test.ts packages/core/src/__tests__/services/whale-detection.error-handling.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.service.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.error-handling.test.ts` PASS
- 2026-04-28: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
