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
- 2026-04-24: completed the next requested ten-task lifecycle/testability narrowing slice across `candle-aggregator.error-handling`, `bybit.repository-integration`, `circuit-breaker.service`, `circuit-breaker.error-handling`, `compound-interest-calculator.service`, `compound-interest-calculator.error-handling`, `config-validator.error-handling`, `data-collector.error-handling`, `console-dashboard.error-handling`, and `create-services.lifecycle`.
- Replaced another batch of exported helper `*State/*Runtime/*LifecycleState` type dependencies with local `ReturnType<typeof createManaged...>` context aliases and direct destructuring, keeping lifecycle harness cleanup and factory wiring behavior-preserving.
- Reviewed adjacent production surfaces around candle aggregation, Bybit repository integration, circuit breaker behavior, compound-interest calculations, config validation, data collection, dashboard updates, and create-services lifecycle orchestration; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-24: `npm test -- --runInBand packages/core/src/__tests__/services/candle-aggregator.error-handling.test.ts packages/core/src/__tests__/services/bybit.repository-integration.test.ts packages/core/src/__tests__/services/circuit-breaker.service.test.ts packages/core/src/__tests__/services/circuit-breaker.error-handling.test.ts packages/core/src/__tests__/services/compound-interest-calculator.service.test.ts packages/core/src/__tests__/services/compound-interest-calculator.error-handling.test.ts packages/core/src/__tests__/services/config-validator.error-handling.test.ts packages/core/src/__tests__/services/data-collector.error-handling.test.ts packages/core/src/__tests__/services/console-dashboard.error-handling.test.ts packages/core/src/__tests__/services/create-services.lifecycle.test.ts` PASS
- 2026-04-24: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
