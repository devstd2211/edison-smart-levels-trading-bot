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
- 2026-04-28: completed the next lifecycle/testability narrowing slice across `advanced-order-flow.error-handling`, `advanced-order-state-machine`, `analyzer-registration-fixes`, `analyzer-registry.error-handling`, `anomaly-detection.error-handling`, `anti-flip.error-handling`, `bot-factory.service`, `bot-factory.error-handling`, `bot-metrics.error-handling`, `create-services.lifecycle`, `event-handlers.error-handling`, `fractal-smc-weighting.error-handling`, `indicator-cache.error-handling`, `indicator-precalculation.error-handling`, `ladder-exit-detector.service.error-handling`, `ladder-tp-manager.service`, `ladder-tp-manager.error-handling`, `limit-order-executor.service`, `limit-order-executor.error-handling`, and `liquidity-heatmap.error-handling`.
- Narrowed this 20-task batch by removing remaining suite-local managed/context type aliases, collapsing temporary managed setup bindings into direct helper context usage, and standardizing direct `ReturnType<typeof createManaged...>` field picks without changing test behavior.
- Reviewed adjacent production surfaces around advanced order flow/state handling, analyzer registration/registry, anomaly and anti-flip protection, bot factory/lifecycle orchestration, event handlers, indicator cache/precalculation, ladder exits/TP management, limit order execution, and liquidity heatmap analysis; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-28: `npm test -- --runInBand packages/core/src/__tests__/services/advanced-order-flow.error-handling.test.ts packages/core/src/__tests__/services/advanced-order-state-machine.test.ts packages/core/src/__tests__/services/analyzer-registration-fixes.test.ts packages/core/src/__tests__/services/analyzer-registry.error-handling.test.ts packages/core/src/__tests__/services/anomaly-detection.error-handling.test.ts packages/core/src/__tests__/services/anti-flip.error-handling.test.ts packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/bot-factory.error-handling.test.ts packages/core/src/__tests__/services/bot-metrics.error-handling.test.ts packages/core/src/__tests__/services/create-services.lifecycle.test.ts packages/core/src/__tests__/services/event-handlers.error-handling.test.ts packages/core/src/__tests__/services/fractal-smc-weighting.error-handling.test.ts packages/core/src/__tests__/services/indicator-cache.error-handling.test.ts packages/core/src/__tests__/services/indicator-precalculation.error-handling.test.ts packages/core/src/__tests__/services/ladder-exit-detector.service.error-handling.test.ts packages/core/src/__tests__/services/ladder-tp-manager.service.test.ts packages/core/src/__tests__/services/ladder-tp-manager.error-handling.test.ts packages/core/src/__tests__/services/limit-order-executor.service.test.ts packages/core/src/__tests__/services/limit-order-executor.error-handling.test.ts packages/core/src/__tests__/services/liquidity-heatmap.error-handling.test.ts` PASS
- 2026-04-28: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
