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
- 2026-04-28: completed the next lifecycle/testability narrowing slice across `position-state-machine.service`, `position-state-machine.error-handling`, `websocket-authentication.service`, `websocket-authentication.error-handling`, `volume-profile.service`, `volume-profile.error-handling`, `health-check`, `websocket-keep-alive.service`, `websocket-event-handler.error-handling`, `wall-tracker.service`, `wall-tracker.error-handling`, `weight-matrix-calculator.service`, `weight-matrix-calculator.error-handling`, `whale-detector.service`, `whale-detection.error-handling`, `whale-wall-tp.service`, `whale-wall-tp.error-handling`, `volatility-regime.service`, `volatility-regime.error-handling`, and `websocket-manager.error-handling`.
- Narrowed this 20-task batch by removing remaining suite-local managed/context aliases, collapsing temporary `managed*` setup bindings into direct helper context usage, and standardizing direct `ReturnType<typeof createManaged...>` field picks without changing test behavior.
- Reviewed adjacent production surfaces around position state management, websocket auth/keep-alive/event handling, volume profile, wall/whale analysis, volatility regime, health checks, and weight matrix calculation; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-28: `npm test -- --runInBand packages/core/src/__tests__/services/position-state-machine.service.test.ts packages/core/src/__tests__/services/position-state-machine.error-handling.test.ts packages/core/src/__tests__/services/websocket-authentication.service.test.ts packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts packages/core/src/__tests__/services/volume-profile.service.test.ts packages/core/src/__tests__/services/volume-profile.error-handling.test.ts packages/core/src/__tests__/services/health-check.test.ts packages/core/src/__tests__/services/websocket-keep-alive.service.test.ts packages/core/src/__tests__/services/websocket-event-handler.error-handling.test.ts packages/core/src/__tests__/services/wall-tracker.service.test.ts packages/core/src/__tests__/services/wall-tracker.error-handling.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.service.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.error-handling.test.ts packages/core/src/__tests__/services/whale-detector.service.test.ts packages/core/src/__tests__/services/whale-detection.error-handling.test.ts packages/core/src/__tests__/services/whale-wall-tp.error-handling.test.ts packages/core/src/__tests__/whale-wall-tp.service.test.ts packages/core/src/__tests__/services/volatility-regime.service.test.ts packages/core/src/__tests__/services/volatility-regime.error-handling.test.ts packages/core/src/__tests__/services/websocket-manager.error-handling.test.ts` PASS
- 2026-04-28: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
