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
- 2026-04-26: completed the next lifecycle/testability narrowing slice across `tf-alignment.service`, `tf-alignment.error-handling`, `timeframe-weighting.error-handling`, `whale-wall-tp.error-handling`, `ml-signal-validator.error-handling`, `strategy-config-merger.error-handling`, `smart-order-placement.error-handling`, `swing-point-detector.error-handling`, `whale-detector.service`, `websocket-authentication.error-handling`, `websocket-authentication.service`, `websocket-event-handler.error-handling`, `websocket-keep-alive.service`, `whale-detection.error-handling`, `weight-matrix-calculator.error-handling`, `weight-matrix-calculator.service`, `websocket-manager.service`, `websocket-manager.error-handling`, `smart-order-execution`, and `trading-lifecycle.error-handling`.
- Narrowed this 20-task batch by replacing helper-exported managed runtime/state aliases in suites with local `ReturnType<typeof createManaged...>` context aliases and context property picks, trimming suite-local type surface without changing helper ownership or test behavior.
- Reviewed adjacent production surfaces around TF alignment / weighting, whale detection / TP, websocket auth / manager / handler / keep-alive flows, smart-order execution / placement, weight-matrix calculation, trading lifecycle, strategy config merging, and ML validation; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-26: `npm test -- --runInBand packages/core/src/__tests__/services/tf-alignment.service.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts packages/core/src/__tests__/services/timeframe-weighting.error-handling.test.ts packages/core/src/__tests__/services/whale-wall-tp.error-handling.test.ts packages/core/src/__tests__/services/ml-signal-validator.error-handling.test.ts packages/core/src/__tests__/services/strategy-config-merger.error-handling.test.ts packages/core/src/__tests__/services/smart-order-placement.error-handling.test.ts packages/core/src/__tests__/services/swing-point-detector.error-handling.test.ts packages/core/src/__tests__/services/whale-detector.service.test.ts packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts packages/core/src/__tests__/services/websocket-authentication.service.test.ts packages/core/src/__tests__/services/websocket-event-handler.error-handling.test.ts packages/core/src/__tests__/services/websocket-keep-alive.service.test.ts packages/core/src/__tests__/services/whale-detection.error-handling.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.error-handling.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.service.test.ts packages/core/src/__tests__/services/websocket-manager.service.test.ts packages/core/src/__tests__/services/websocket-manager.error-handling.test.ts packages/core/src/__tests__/services/smart-order-execution.test.ts packages/core/src/__tests__/services/trading-lifecycle.error-handling.test.ts` PASS (20 suites / 519 tests)
- 2026-04-26: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
