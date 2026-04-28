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
- 2026-04-28: completed the next lifecycle/testability narrowing slice across `prometheus-metrics.test`, `public-websocket.error-handling.test`, `real-time-risk-monitor.cache-invalidation.test`, `reality-check.error-handling.test`, `retest-entry.error-handling.test`, and `retest-entry.service.test`.
- Narrowed this 20-task batch by replacing nearby suite-local `ReturnType<typeof createManaged...>` aliases and managed context field picks with exported helper runtime/factory/state contracts in the monitoring, websocket, risk-monitor, reality-check, and retest-entry cluster.
- Reviewed adjacent production surfaces around `prometheus-metrics.service`, `public-websocket.service`, `real-time-risk-monitor.service`, `reality-check.service`, and `retest-entry.service`; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-28: `npm test -- --runInBand packages/core/src/__tests__/services/prometheus-metrics.test.ts packages/core/src/__tests__/services/public-websocket.error-handling.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.cache-invalidation.test.ts packages/core/src/__tests__/services/reality-check.error-handling.test.ts packages/core/src/__tests__/services/retest-entry.error-handling.test.ts packages/core/src/__tests__/services/retest-entry.service.test.ts` PASS
- 2026-04-28: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
