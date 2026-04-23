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
- 2026-04-23: completed the next ten-item lifecycle/testability narrowing slice across `public-websocket.error-handling`, `wall-tracker.service`, `wall-tracker.error-handling`, `volume-profile.service`, `volume-profile.error-handling`, `micro-wall-detector.service`, `micro-wall-detector.error-handling`, `retest-entry.service`, `retest-entry.error-handling`, and `websocket-event-handler.error-handling`.
- Added helper-owned shared/factory aliases for public websocket, wall tracker, volume profile, micro-wall detector, retest entry, and websocket event handler suites, then switched the touched tests off older managed-runtime naming paths and suite-local state composition. The touched helpers now expose explicit harness/shared contracts instead of leaning on repeated `ReturnType<typeof create...>` or broader managed-context picks.
- Reviewed adjacent production surfaces around public websocket handling, wall tracking, volume profile calculation, micro-wall detection, retest entry, and websocket event flow; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-23: `npm test -- --runInBand packages/core/src/__tests__/services/public-websocket.error-handling.test.ts packages/core/src/__tests__/services/wall-tracker.service.test.ts packages/core/src/__tests__/services/wall-tracker.error-handling.test.ts packages/core/src/__tests__/services/volume-profile.service.test.ts packages/core/src/__tests__/services/volume-profile.error-handling.test.ts packages/core/src/__tests__/services/micro-wall-detector.service.test.ts packages/core/src/__tests__/services/micro-wall-detector.error-handling.test.ts packages/core/src/__tests__/services/retest-entry.service.test.ts packages/core/src/__tests__/services/retest-entry.error-handling.test.ts packages/core/src/__tests__/services/websocket-event-handler.error-handling.test.ts` PASS
- 2026-04-23: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
