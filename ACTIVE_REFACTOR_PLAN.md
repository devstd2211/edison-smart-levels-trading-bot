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
- 2026-04-28: completed the next lifecycle/testability narrowing slice across `websocket-keep-alive.service`, `websocket-event-handler.error-handling`, `bot-metrics.error-handling`, `volume-profile.service`, `volume-profile.error-handling`, `volatility-regime.service`, `volatility-regime.error-handling`, `trading-lifecycle.error-handling`, `websocket-keep-alive-test.utils`, `websocket-event-handler-test.utils`, `bot-metrics-test.utils`, `volume-profile-test.utils`, `volatility-regime-test.utils`, and `trading-lifecycle-test.utils`.
- Narrowed this 20-task batch by replacing suite-local `ReturnType<typeof createManaged...>` field picks with exported helper runtime/state/factory types and by promoting repeated helper service/factory override objects into named option contracts across the websocket keep-alive, websocket event handler, bot metrics, volume profile, volatility regime, and trading lifecycle clusters.
- Reviewed adjacent production surfaces around websocket keep-alive, websocket event handling, bot metrics, volume profile, volatility regime, and trading lifecycle; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-28: `npm test -- --runInBand packages/core/src/__tests__/services/websocket-keep-alive.service.test.ts packages/core/src/__tests__/services/websocket-event-handler.error-handling.test.ts packages/core/src/__tests__/services/bot-metrics.error-handling.test.ts packages/core/src/__tests__/services/volume-profile.service.test.ts packages/core/src/__tests__/services/volume-profile.error-handling.test.ts packages/core/src/__tests__/services/volatility-regime.service.test.ts packages/core/src/__tests__/services/volatility-regime.error-handling.test.ts packages/core/src/__tests__/services/trading-lifecycle.error-handling.test.ts` PASS
- 2026-04-28: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
