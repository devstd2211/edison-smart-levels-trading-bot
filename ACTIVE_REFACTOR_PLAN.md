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
- 2026-04-25: completed the next lifecycle/testability narrowing slice across `bot-metrics.error-handling`, `indicator-precalculation.error-handling`, `indicator-cache.error-handling`, `real-time-risk-monitor.cache-invalidation`, `mtf-snapshot-gate.error-handling`, `mtf-snapshot-gate.functional`, `orderbook-manager.service`, `orderbook-manager.service.error-handling`, `orderbook-imbalance.service`, `orderbook-imbalance.error-handling`, `bot-factory.service`, `bot-factory.error-handling`, `create-services.lifecycle`, `analyzer-engine.service`, `analyzer-engine.error-handling`, `anti-flip.error-handling`, `anomaly-detection.error-handling`, `advanced-order-state-machine`, `analyzer-registry.error-handling`, and `advanced-order-flow.error-handling`.
- Narrowed another 20-file batch of suite-managed test state by replacing generic context aliases with suite-specific names, hoisting remaining `ReturnType<typeof createManaged...>` declarations out of `describe` blocks, and collapsing a few redundant pass-through suite-context aliases.
- Reviewed adjacent production surfaces around snapshot gating, orderbook handling, analyzer execution/registry, bot factory lifecycle, anti-flip, anomaly detection, and advanced order flow/state-machine behavior; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-25: `npm test -- --runInBand packages/core/src/__tests__/services/bot-metrics.error-handling.test.ts packages/core/src/__tests__/services/indicator-precalculation.error-handling.test.ts packages/core/src/__tests__/services/indicator-cache.error-handling.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.cache-invalidation.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.error-handling.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.functional.test.ts packages/core/src/__tests__/services/orderbook-manager.service.test.ts packages/core/src/__tests__/services/orderbook-manager.service.error-handling.test.ts packages/core/src/__tests__/services/orderbook-imbalance.service.test.ts packages/core/src/__tests__/services/orderbook-imbalance.error-handling.test.ts packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/bot-factory.error-handling.test.ts packages/core/src/__tests__/services/create-services.lifecycle.test.ts packages/core/src/__tests__/services/analyzer-engine.service.test.ts packages/core/src/__tests__/services/analyzer-engine.error-handling.test.ts packages/core/src/__tests__/services/anti-flip.error-handling.test.ts packages/core/src/__tests__/services/anomaly-detection.error-handling.test.ts packages/core/src/__tests__/services/advanced-order-state-machine.test.ts packages/core/src/__tests__/services/analyzer-registry.error-handling.test.ts packages/core/src/__tests__/services/advanced-order-flow.error-handling.test.ts` PASS
- 2026-04-25: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
