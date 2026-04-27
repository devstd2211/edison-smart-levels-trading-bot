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
- 2026-04-27: completed the next lifecycle/testability narrowing slice across `order-execution-detector.service`, `order-execution-detector.error-handling`, `position-pnl-calculator.service`, `position-pnl-calculator.error-handling`, `position-state-machine.service`, `position-state-machine.error-handling`, `prometheus-metrics`, `phase-10-integration`, `bot-factory.service`, `bot-factory.error-handling`, `create-services.lifecycle`, `trading-bot.create-services.lifecycle`, `websocket-authentication.service`, `websocket-authentication.error-handling`, `websocket-manager.service`, `websocket-manager.error-handling`, `take-profit-manager.service`, `take-profit-manager.error-handling`, `volume-profile.service`, and `volume-profile.error-handling`.
- Narrowed this 20-task batch by replacing helper-exported managed context/test aliases with suite-local `ReturnType<typeof createManaged...>` or local `ReturnType<typeof create...>` derivations, plus tighter property-pick locals where that kept async setup explicit while trimming suite-local runtime ownership.
- Reviewed adjacent production surfaces around order execution detection, position PnL/state services, Prometheus metrics, phase-10 integration, bot-factory lifecycle wiring, websocket auth/management, take-profit management, and volume profile calculation; no small safe production refactor was required in this slice.

## Latest Verification
- 2026-04-27: `npm test -- --runInBand packages/core/src/__tests__/services/order-execution-detector.service.test.ts packages/core/src/__tests__/services/order-execution-detector.error-handling.test.ts packages/core/src/__tests__/services/position-pnl-calculator.service.test.ts packages/core/src/__tests__/services/position-pnl-calculator.error-handling.test.ts packages/core/src/__tests__/services/position-state-machine.service.test.ts packages/core/src/__tests__/services/position-state-machine.error-handling.test.ts packages/core/src/__tests__/services/prometheus-metrics.test.ts packages/core/src/__tests__/services/phase-10-integration.test.ts packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/bot-factory.error-handling.test.ts packages/core/src/__tests__/services/create-services.lifecycle.test.ts packages/core/src/__tests__/trading-bot.create-services.lifecycle.test.ts packages/core/src/__tests__/services/websocket-authentication.service.test.ts packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts packages/core/src/__tests__/services/websocket-manager.service.test.ts packages/core/src/__tests__/services/websocket-manager.error-handling.test.ts packages/core/src/__tests__/services/take-profit-manager.service.test.ts packages/core/src/__tests__/services/take-profit-manager.error-handling.test.ts packages/core/src/__tests__/services/volume-profile.service.test.ts packages/core/src/__tests__/services/volume-profile.error-handling.test.ts` PASS
- 2026-04-27: `npm run build` PASS

## Archive
- Frozen archive of the previous oversized active plan: `REFACTOR_PLAN_01.md`
