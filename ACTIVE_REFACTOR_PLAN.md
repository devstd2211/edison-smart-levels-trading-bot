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
- 2026-04-20: completed the next lifecycle/testability and suite-state narrowing slice across `action-queue.error-handling`, `anomaly-detection.error-handling`, `analyzer-registry.error-handling`, `bot-metrics.error-handling`, `bybit.error-handling`, `candle-aggregator.error-handling`, `data-collector.error-handling`, `delta-analyzer.service`, `delta-analyzer.error-handling`, and `event-deduplication.service`.
- Added helper-exported narrow runtime/factory aliases in the adjacent action-queue, anomaly-detection, analyzer-registry, bot-metrics, bybit, candle-aggregator, data-collector, delta-analyzer, and event-deduplication test utils, then moved the touched suites off direct `Managed*Context` imports and broad helper return types to helper-owned picks only, preserving setup/cleanup and lifecycle behavior.
- Reviewed adjacent production surfaces opportunistically during this slice across the corresponding queue, anomaly, registry, metrics, exchange, aggregation, collector, delta, and deduplication services; no small safe production refactor was required.

## Latest Verification
- 2026-04-20: `npm test -- --runInBand packages/core/src/__tests__/services/action-queue.error-handling.test.ts packages/core/src/__tests__/services/anomaly-detection.error-handling.test.ts packages/core/src/__tests__/services/analyzer-registry.error-handling.test.ts packages/core/src/__tests__/services/bot-metrics.error-handling.test.ts packages/core/src/__tests__/services/bybit.error-handling.test.ts packages/core/src/__tests__/services/candle-aggregator.error-handling.test.ts packages/core/src/__tests__/services/data-collector.error-handling.test.ts packages/core/src/__tests__/services/delta-analyzer.service.test.ts packages/core/src/__tests__/services/delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/event-deduplication.service.test.ts` PASS
- 2026-04-20: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
