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
- 2026-04-25: completed the next lifecycle/testability narrowing slice across `action-queue.error-handling`, `advanced-order-flow.error-handling`, `analyzer-engine.service`, `analyzer-engine.error-handling`, `analyzer-registry.error-handling`, `anomaly-detection.error-handling`, `bot-factory.service`, `bot-factory.error-handling`, `bot-initializer.error-handling`, `bybit.error-handling`, `candle-aggregator.error-handling`, `candle-provider.error-handling`, `circuit-breaker.service`, `circuit-breaker.error-handling`, `config-validator.service`, `config-validator.error-handling`, `console-dashboard.error-handling`, `create-services.lifecycle`, `event-deduplication.service`, `event-deduplication.error-handling`, `event-handlers.error-handling`, `funding-rate-filter.service`, `funding-rate-filter.error-handling`, and `monitoring-server`.
- Narrowed another nearby batch of helper-managed suite state by hoisting nested `ReturnType<typeof createManaged...>` aliases to file scope where they still lived inside `describe`, replacing broad or generic context alias names with suite-specific ones, and keeping setup ownership limited to the exact helper outputs each suite actually uses.
- Reviewed adjacent production surfaces around analyzer execution, factory/bootstrap lifecycle, monitoring, event handling, validation, funding-rate filtering, candle access, and circuit-breaker behavior; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-25: `npm test -- --runInBand packages/core/src/__tests__/services/analyzer-engine.service.test.ts packages/core/src/__tests__/services/analyzer-engine.error-handling.test.ts packages/core/src/__tests__/services/advanced-order-flow.error-handling.test.ts packages/core/src/__tests__/services/event-handlers.error-handling.test.ts packages/core/src/__tests__/services/monitoring-server.test.ts packages/core/src/__tests__/services/config-validator.service.test.ts packages/core/src/__tests__/services/bybit.error-handling.test.ts packages/core/src/__tests__/services/console-dashboard.error-handling.test.ts packages/core/src/__tests__/services/circuit-breaker.service.test.ts packages/core/src/__tests__/services/circuit-breaker.error-handling.test.ts packages/core/src/__tests__/services/config-validator.error-handling.test.ts packages/core/src/__tests__/services/event-deduplication.service.test.ts packages/core/src/__tests__/services/event-deduplication.error-handling.test.ts packages/core/src/__tests__/services/funding-rate-filter.service.test.ts packages/core/src/__tests__/services/funding-rate-filter.error-handling.test.ts packages/core/src/__tests__/services/analyzer-registry.error-handling.test.ts packages/core/src/__tests__/services/anomaly-detection.error-handling.test.ts packages/core/src/__tests__/services/action-queue.error-handling.test.ts packages/core/src/__tests__/services/candle-provider.error-handling.test.ts packages/core/src/__tests__/services/candle-aggregator.error-handling.test.ts packages/core/src/__tests__/services/bot-initializer.error-handling.test.ts packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/bot-factory.error-handling.test.ts packages/core/src/__tests__/services/create-services.lifecycle.test.ts` PASS
- 2026-04-25: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
