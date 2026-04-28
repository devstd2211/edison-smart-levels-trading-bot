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
- 2026-04-28: completed the next lifecycle/testability narrowing slice across `analyzer-engine.service`, `analyzer-engine.error-handling`, `analyzer-engine.error-handling-advanced`, `phase-10-integration`, `bot-metrics.service`, `anti-flip.service`, `analyzer-engine-test.utils`, `phase-10-integration-test.utils`, `bot-metrics-test.utils`, `anti-flip-test.utils`, `service-lifecycle-test.utils`, `liquidity-heatmap-test.utils`, `analyzer-registration-fixes-test.utils`, `analyzer-registry-test.utils`, `anomaly-detection-test.utils`, `bot-factory-test.utils`, `event-handlers-test.utils`, `fractal-smc-weighting-test.utils`, `indicator-cache-test.utils`, and `indicator-precalculation-test.utils`.
- Narrowed this 20-task batch by replacing remaining local managed-context `ReturnType<typeof createManaged...>` aliases with exported helper context/harness types, removing suite-local accessor wrappers, and standardizing helper-owned runtime/factory option types so adjacent tests depend on narrower shared contracts.
- Reviewed adjacent production surfaces around analyzer execution, phase-10 integration, anti-flip protection, bot metrics, lifecycle harnessing, and nearby helper-backed services; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-28: `npm test -- --runInBand packages/core/src/__tests__/services/analyzer-engine.service.test.ts packages/core/src/__tests__/services/analyzer-engine.error-handling.test.ts packages/core/src/__tests__/services/analyzer-engine.error-handling-advanced.test.ts packages/core/src/__tests__/services/phase-10-integration.test.ts packages/core/src/__tests__/bot-metrics.service.test.ts packages/core/src/__tests__/anti-flip.service.test.ts` PASS
- 2026-04-28: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
