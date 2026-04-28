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
- 2026-04-28: completed the next lifecycle/testability narrowing slice across `advanced-order-flow.error-handling`, `advanced-order-state-machine`, `anomaly-detection.error-handling`, `bot-factory.service`, `event-handlers.error-handling`, `fractal-smc-weighting.error-handling`, `indicator-cache.error-handling`, `indicator-precalculation.error-handling`, `limit-order-executor.service`, `limit-order-executor.error-handling`, `ladder-exit-detector.service.error-handling`, `trading-bot.lifecycle`, `trading-bot.create-services.lifecycle`, `create-services.lifecycle`, `whale-wall-tp.service`, `whale-wall-tp.error-handling`, `advanced-order-flow-test.utils`, `advanced-order-state-machine-test.utils`, `limit-order-executor-test.utils`, and `ladder-exit-detector-test.utils`.
- Narrowed this 20-task batch by replacing remaining suite-local `ReturnType<typeof createManaged...>` aliases with exported helper runtime/context types, and by promoting repeated helper option signatures into named exported factory/harness types so adjacent tests consume narrower shared contracts without local wrapper aliases.
- Reviewed adjacent production surfaces around order-flow/state-machine handling, anomaly detection, bot/service lifecycle orchestration, event handlers, indicator caching/precalculation, ladder exit analysis, limit-order execution, and whale-wall TP handling; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-28: `npm test -- --runInBand packages/core/src/__tests__/services/advanced-order-flow.error-handling.test.ts packages/core/src/__tests__/services/advanced-order-state-machine.test.ts packages/core/src/__tests__/services/anomaly-detection.error-handling.test.ts packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/event-handlers.error-handling.test.ts packages/core/src/__tests__/services/fractal-smc-weighting.error-handling.test.ts packages/core/src/__tests__/services/indicator-cache.error-handling.test.ts packages/core/src/__tests__/services/indicator-precalculation.error-handling.test.ts packages/core/src/__tests__/services/limit-order-executor.service.test.ts packages/core/src/__tests__/services/limit-order-executor.error-handling.test.ts packages/core/src/__tests__/services/ladder-exit-detector.service.error-handling.test.ts packages/core/src/__tests__/trading-bot.lifecycle.test.ts packages/core/src/__tests__/trading-bot.create-services.lifecycle.test.ts packages/core/src/__tests__/services/create-services.lifecycle.test.ts packages/core/src/__tests__/whale-wall-tp.service.test.ts packages/core/src/__tests__/services/whale-wall-tp.error-handling.test.ts` PASS
- 2026-04-28: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
