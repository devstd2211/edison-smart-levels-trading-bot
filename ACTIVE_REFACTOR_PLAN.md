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
- 2026-04-23: completed the next ten-task lifecycle/testability narrowing slice across `graceful-shutdown.service`, `graceful-shutdown.error-handling`, `indicator-cache.error-handling`, `session-stats.error-handling`, `strategy-manager.error-handling`, `risk-manager.service`, `risk-manager.error-handling`, `trading-journal.service`, `trading-journal.error-handling`, and `position-monitor.service`.
- Added narrower helper-owned suite/error aliases for graceful shutdown, indicator cache, session stats, strategy manager, risk manager, trading journal, and position monitor helpers, then switched the touched tests off broader managed-runtime naming and one remaining explicit cast in `risk-manager.error-handling`. The slice stayed behavior-preserving and kept the existing harness factories and teardown flow intact.
- Reviewed adjacent production surfaces around graceful shutdown orchestration, indicator caching, session stats persistence, strategy initialization, risk management, trading journal persistence, and position monitoring; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-23: `npm test -- --runInBand packages/core/src/__tests__/services/graceful-shutdown.service.test.ts packages/core/src/__tests__/services/graceful-shutdown.error-handling.test.ts packages/core/src/__tests__/services/indicator-cache.error-handling.test.ts packages/core/src/__tests__/services/session-stats.error-handling.test.ts packages/core/src/__tests__/services/strategy-manager.error-handling.test.ts packages/core/src/__tests__/services/risk-manager.service.test.ts packages/core/src/__tests__/services/risk-manager.error-handling.test.ts packages/core/src/__tests__/services/trading-journal.service.test.ts packages/core/src/__tests__/services/trading-journal.error-handling.test.ts packages/core/src/__tests__/services/position-monitor.service.test.ts` PASS
- 2026-04-23: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
