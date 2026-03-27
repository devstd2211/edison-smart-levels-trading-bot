# Active Refactor Plan

This file is the active source of truth for open refactor tasks only.
Completed history belongs in `REFACTOR_PLAN.md`, not here.

## Open Streams
- [ ] Move optional services behind feature toggles with explicit capability interfaces.
- [ ] Update tests to build only the required groups instead of a broad/global container.
- [ ] Core `any` cleanup in remaining `src` boundaries discovered during adjacent refactors.
- [ ] Continue updating tests to use explicit lifecycle control via `createServices()` + `start/stop`.

## Current Execution Focus
- [ ] Continue lifecycle/testability cleanup in services-adjacent suites that still create throwaway managed contexts or suite-local service instances outside helper-owned cleanup.
- [ ] Continue replacing broad service-state construction in tests with minimal grouped services or tracked helper-managed state.

## Immediate Next Candidates
- [ ] Finish the remaining helper-owned factory/cleanup follow-ups in error-handling suites that still instantiate temporary managed contexts inline.
- [ ] Continue explicit lifecycle teardown coverage beyond the refreshed bot-factory, trading-bot, and grouped lifecycle slices.
- [ ] Keep converting tests away from global container ownership toward minimal grouped service construction.

## Working Rules
1. Pick the next unchecked item from this file.
2. Apply minimal behavior-preserving changes only.
3. Run targeted tests for the changed slice.
4. Run `npm run build`.
5. Record completed batch history in `REFACTOR_PLAN.md`; keep this file limited to active status and a short handoff.
6. Keep `NEXT_SESSION_PROMPT.md` short: `Last Completed` + `Next Step`.

## Active Notes
- Latest completed slice (2026-03-27): completed the remaining lifecycle/testability follow-up for `wall-tracker.error-handling`, `websocket-event-handler.error-handling`, `whale-wall-tp.error-handling`, and `candle-provider.error-handling` by moving the residual direct suite-local managed-context ownership onto shared suite-owned binders and converting candle-provider error-handling scenarios onto managed standard/legacy helper-owned contexts.
- Latest verification (2026-03-27): `npm test -- --runInBand packages/core/src/__tests__/services/wall-tracker.error-handling.test.ts packages/core/src/__tests__/services/websocket-event-handler.error-handling.test.ts packages/core/src/__tests__/services/whale-wall-tp.error-handling.test.ts packages/core/src/__tests__/services/candle-provider.error-handling.test.ts` PASS; `npm run build` PASS.
- Latest completed slice (2026-03-27): completed a lifecycle/testability follow-up for `analyzer-engine.error-handling-advanced`, `analyzer-engine.error-handling`, `ml-signal-validator.error-handling`, `retest-entry.error-handling`, `trading-lifecycle.error-handling`, and `volatility-regime.error-handling` by moving their remaining direct suite-local managed-context setup / cleanup onto shared suite-owned binders, including the analyzer-engine slices that still tracked multiple managed scenario contexts manually.
- Latest verification (2026-03-27): `npm test -- --runInBand packages/core/src/__tests__/services/analyzer-engine.error-handling-advanced.test.ts packages/core/src/__tests__/services/analyzer-engine.error-handling.test.ts packages/core/src/__tests__/services/ml-signal-validator.error-handling.test.ts packages/core/src/__tests__/services/retest-entry.error-handling.test.ts packages/core/src/__tests__/services/trading-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/volatility-regime.error-handling.test.ts` PASS; `npm run build` PASS.
- Latest completed slice (2026-03-27): completed a lifecycle/testability follow-up for `order-execution-detector.error-handling`, `order-execution-pipeline.error-handling`, `orderbook-imbalance.error-handling`, `orderbook-manager.service.error-handling`, `pattern-recognition.error-handling`, and `position-lifecycle.error-handling` by moving their remaining direct suite-local managed-context setup / cleanup onto shared suite-owned binders while preserving the existing helper-owned service and factory paths.
- Latest verification (2026-03-27): `npm test -- --runInBand packages/core/src/__tests__/services/order-execution-detector.error-handling.test.ts packages/core/src/__tests__/services/order-execution-pipeline.error-handling.test.ts packages/core/src/__tests__/services/orderbook-imbalance.error-handling.test.ts packages/core/src/__tests__/services/orderbook-manager.service.error-handling.test.ts packages/core/src/__tests__/services/pattern-recognition.error-handling.test.ts packages/core/src/__tests__/services/position-lifecycle.error-handling.test.ts` PASS; `npm run build` PASS.
- Latest completed slice (2026-03-27): completed a lifecycle/testability follow-up for `session-stats.error-handling`, `structure-aware-exit.error-handling`, `swing-point-detector.error-handling`, `take-profit-manager.error-handling`, `telegram.error-handling`, and `tf-alignment.error-handling` by moving their remaining direct suite-local managed-context setup / cleanup onto shared suite-owned binders while preserving the existing helper-owned service and factory paths.
- Latest verification (2026-03-27): `npm test -- --runInBand packages/core/src/__tests__/services/session-stats.error-handling.test.ts packages/core/src/__tests__/services/structure-aware-exit.error-handling.test.ts packages/core/src/__tests__/services/swing-point-detector.error-handling.test.ts packages/core/src/__tests__/services/take-profit-manager.error-handling.test.ts packages/core/src/__tests__/services/telegram.error-handling.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts` PASS; `npm run build` PASS.
- Latest completed slice (2026-03-27): completed a lifecycle/testability follow-up for `performance-analytics.error-handling`, `position-pnl-calculator.error-handling`, `strategy-circuit-breaker.error-handling`, `real-time-risk-monitor.error-handling`, `websocket-authentication.error-handling`, and `weight-matrix-calculator.error-handling` by moving their remaining direct suite-local managed-context ownership onto shared suite-owned binders while preserving the existing helper-owned service, monitor, and legacy factory paths.
- Latest verification (2026-03-27): `npm test -- --runInBand packages/core/src/__tests__/services/performance-analytics.error-handling.test.ts packages/core/src/__tests__/services/position-pnl-calculator.error-handling.test.ts packages/core/src/__tests__/services/strategy-circuit-breaker.error-handling.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.error-handling.test.ts packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.error-handling.test.ts` PASS; `npm run build` PASS.
- Current target batch: direct managed-context ownership cleanup across `services/*error-handling*.test.ts` is complete; continue with the next lifecycle/testability stream around explicit lifecycle control, minimal grouped service construction, and non-error-handling suites that still own broader service state or cleanup directly.

## Guardrails
- `types/*` cleanup is complete; reopen only if an adjacent service refactor requires a compatibility follow-up.
- Non-`services` / non-`types` phase-3 cleanup is complete for previously targeted boundaries; reopen only when an adjacent refactor exposes a mixed-boundary issue.
- Main remaining stream is lifecycle/testability work around explicit `createServices()` state, teardown ownership, and minimal grouped service construction in tests.
- Exchange-adapter cleanup stays deprioritized unless a current testability slice exposes a low-risk adjacent follow-up.
