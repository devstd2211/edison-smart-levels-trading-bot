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
- [ ] `advanced-order-flow.error-handling.test.ts`
- [ ] `advanced-order-state-machine.test.ts`
- [ ] `analyzer-registration-fixes.test.ts`
- [ ] `circuit-breaker.error-handling.test.ts`
- [ ] `bot-factory.service.test.ts`
- [ ] Next nearby lifecycle-oriented suites surfaced by `rg` with temporary managed-context locals or helper-accessor wrappers.

## Working Rules
1. Pick the next unchecked item from this file.
2. Apply minimal behavior-preserving changes only.
3. Run targeted tests for the changed slice.
4. Run `npm run build`.
5. Update this file with only the latest completed slice and latest verification.
6. Do not paste chronological history here.

## Latest Completed
- 2026-04-14: completed a lifecycle/testability and suite-state reduction follow-up for `action-queue.error-handling`, `bot-metrics.error-handling`, `config-validator.service`, `config-validator.error-handling`, `circuit-breaker.service`, and `compound-interest-calculator.service` by removing the remaining direct `Managed*Context` test imports, suite-local whole-context ownership, and managed-context property typing in favor of narrow helper-factory-derived bindings plus direct helper-owned cleanup handles.
- Reviewed `packages/core/src/services/action-queue.service.ts`, `packages/core/src/services/bot-metrics.service.ts`, `packages/core/src/services/config-validator.service.ts`, `packages/core/src/services/circuit-breaker.service.ts`, and `packages/core/src/services/compound-interest-calculator.service.ts`; no production refactor was required for this batch.

## Latest Verification
- 2026-04-14: `npm test -- --runInBand --silent packages/core/src/__tests__/services/action-queue.error-handling.test.ts packages/core/src/__tests__/services/bot-metrics.error-handling.test.ts packages/core/src/__tests__/services/config-validator.service.test.ts packages/core/src/__tests__/services/config-validator.error-handling.test.ts packages/core/src/__tests__/services/circuit-breaker.service.test.ts packages/core/src/__tests__/services/compound-interest-calculator.service.test.ts` PASS
- 2026-04-14: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
