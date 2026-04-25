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
- 2026-04-25: completed the next lifecycle/testability narrowing slice across `advanced-order-state-machine`, `exchange-factory.service`, `exchange-factory.error-handling`, `candle-provider.repository-integration`, `market-condition-analyzer.error-handling`, `entry-confirmation.service`, `entry-confirmation.error-handling`, `graceful-shutdown.service`, `graceful-shutdown.error-handling`, `health-check`, `limit-order-executor.service`, `limit-order-executor.error-handling`, `ml-feature-extractor.service`, `ml-feature-extractor.error-handling`, `position-monitor.service`, `position-pnl-calculator.service`, `position-pnl-calculator.error-handling`, `tick-delta-analyzer.service`, `tick-delta-analyzer.error-handling`, and `tf-alignment.error-handling`.
- Narrowed another 20-file batch of helper-managed suite state by replacing generic `ManagedContext` and similarly broad suite aliases with suite-specific names, and by hoisting leftover nested `ReturnType<typeof createManaged...>` declarations to file scope where they still lived inside `describe`.
- Reviewed adjacent production surfaces around exchange factory creation, candle-provider repository integration, shutdown orchestration, limit-order execution, feature extraction, position monitoring, PnL calculation, tick-delta analysis, and TF alignment; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-25: `npm test -- --runInBand packages/core/src/__tests__/services/advanced-order-state-machine.test.ts packages/core/src/__tests__/services/exchange-factory.service.test.ts packages/core/src/__tests__/services/exchange-factory.error-handling.test.ts packages/core/src/__tests__/services/candle-provider.repository-integration.test.ts packages/core/src/__tests__/services/market-condition-analyzer.error-handling.test.ts packages/core/src/__tests__/services/entry-confirmation.service.test.ts packages/core/src/__tests__/services/entry-confirmation.error-handling.test.ts packages/core/src/__tests__/services/graceful-shutdown.service.test.ts packages/core/src/__tests__/services/graceful-shutdown.error-handling.test.ts packages/core/src/__tests__/services/health-check.test.ts packages/core/src/__tests__/services/limit-order-executor.service.test.ts packages/core/src/__tests__/services/limit-order-executor.error-handling.test.ts packages/core/src/__tests__/services/ml-feature-extractor.service.test.ts packages/core/src/__tests__/services/ml-feature-extractor.error-handling.test.ts packages/core/src/__tests__/services/position-monitor.service.test.ts packages/core/src/__tests__/services/position-pnl-calculator.service.test.ts packages/core/src/__tests__/services/position-pnl-calculator.error-handling.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.service.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts` PASS
- 2026-04-25: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
