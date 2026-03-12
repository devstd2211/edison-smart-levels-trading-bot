# Active Refactor Plan

This file is the active source of truth for open refactor tasks only.
Completed history is intentionally removed from this file and kept in `REFACTOR_PLAN.md`.

## Open Tasks Migrated (2026-03-09)
- [ ] Move optional services behind feature toggles with explicit "capability" interfaces.
- [ ] Update tests to build only the required groups (no global container).
- [ ] Core any cleanup (phase 3: src).
- [ ] Update tests to use `createServices()` + explicit `start/stop`.

## Current Execution Focus
- [ ] Continue `Update tests to use createServices() + explicit start/stop` in lifecycle-adjacent suites.
- [ ] Continue `Update tests to build only the required groups (no global container)` in bot/lifecycle-focused tests.

## Immediate Next Candidates
- [ ] Extend explicit lifecycle teardown coverage beyond `bot-factory` / `trading-bot` suites into the next lifecycle-adjacent test slices (`create-services.lifecycle`, `trading-bot.create-services`, then remaining initializer-adjacent boundaries).
- [ ] Continue replacing broad service-state construction in tests with the minimal required grouped services or tracked `createServices()` state.

## Working Rules
1. Pick the next unchecked item from this file.
2. Apply minimal behavior-preserving changes only.
3. Run targeted tests for the changed slice.
4. Run `npm run build`.
5. Record only active status here; keep completed batch history in `REFACTOR_PLAN.md`.
6. Keep `NEXT_SESSION_PROMPT.md` short: `Last Completed` + `Next Step`.

## Active Notes
- `types/*` cleanup is complete; do not reopen unless a service refactor requires a compatibility follow-up.
- Non-`services`/non-`types` phase-3 cleanup is complete for the previously targeted boundaries; only reopen when new mixed boundaries are discovered during adjacent work.
- Main remaining stream is compact service-by-service cleanup with dedicated test coverage.
- `handlers/websocket.handler.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining fallback/recovery/logging error-message extraction with shared `getErrorMessage()` and re-running targeted tests plus full `npm run build`.
- `handlers/position.handler.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining monitoring/fallback error-message extraction with shared `getErrorMessage()` and re-running targeted tests plus full `npm run build`.
- `data-collector/database-writer.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining batch/final-write error-message extraction with shared `getErrorMessage()` and re-running targeted tests plus full `npm run build`.
- `console-dashboard.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining dashboard state/update error-message extraction with shared `getErrorMessage()` and re-running targeted tests plus full `npm run build`.
- `multi-strategy/strategy-orchestrator.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining candle-routing/orchestrator-creation error-message extraction with shared `getErrorMessage()` and re-running the multi-strategy suite plus full `npm run build`.
- `event-deduplication.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining degraded-cleanup warning error-message extraction with shared `getErrorMessage()` and re-running targeted tests plus full `npm run build`.
- `ladder-tp-manager.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining partial-close / breakeven / trailing error-message extraction with shared `getErrorMessage()` and re-running targeted tests plus full `npm run build`.
- `limit-order-executor.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining placement / timeout / cancel / fallback error-message extraction with shared `getErrorMessage()` and re-running targeted tests plus full `npm run build`.
- `position-state-machine.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining corrupted-state / corrupted-history recovery message extraction with shared `getErrorMessage()` and re-running targeted tests plus full `npm run build`.
- `funding-rate-filter.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining cache-write error-message extraction with shared `getErrorMessage()` and re-running targeted error-handling tests plus full `npm run build`.
- `multi-strategy/strategy-state-manager.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining strategy-switch failure message extraction with shared `getErrorMessage()` and re-running the multi-strategy suite plus full `npm run build`.
- `ml-signal-validator.service.ts` was cleared from the active candidate list on 2026-03-11 after replacing its remaining inline error-message extraction with shared `getErrorMessage()` and re-running its targeted error-handling suite plus full `npm run build`.
- `lifecycle-manager.service.ts`, `graceful-shutdown.service.ts`, and `event-bus.ts` were cleared from the active candidate list on 2026-03-11 after replacing their remaining inline error-message extraction with shared helpers and re-running targeted tests/build.
- `pattern-recognition.service.ts` was cleared from the active candidate list on 2026-03-12 after replacing its remaining fallback logging error-message extraction with shared `getErrorMessage()` and re-running its targeted error-handling suite plus full `npm run build`.
- `orderbook-manager.service.ts` was cleared from the active candidate list on 2026-03-12 after replacing its remaining WallTracker warning error-message extraction with shared `getErrorMessage()` and re-running its targeted error-handling suite plus full `npm run build`.
- `strategy-loader.service.ts` was cleared from the active candidate list on 2026-03-12 after replacing its remaining load/directory-read error-message extraction with shared `getErrorMessage()` and re-running its targeted error-handling suite plus full `npm run build`.
- `indicator-precalculation.service.ts` was cleared from the active candidate list on 2026-03-12 after replacing its remaining calculation-classification error-message extraction with shared `getErrorMessage()` and re-running its targeted error-handling suite plus full `npm run build`.
- Compact-service cleanup status on 2026-03-12: the remaining obvious inline error-message leftovers in `services/*` are now concentrated in exchange-adapter/partial files (`services/binance/*`, `services/bybit/*`) plus minor builder/utils boundaries; do not expand that stream unless a testability task directly requires it.
- Testability batch status on 2026-03-12: started the `createServices()` + explicit lifecycle stream with tracked teardown helpers and real service-state coverage in `bot-factory` / `trading-bot` suites; continue this stream before reopening adapter cleanup.
- Testability batch status on 2026-03-12 follow-up: extended the tracked lifecycle fixture into `create-services.lifecycle` and `trading-bot.create-services` suites and aligned `bot-initializer.test.ts` setup around a single initializer rebuild helper; continue with the remaining lifecycle-adjacent suites before reopening adapter cleanup.
- Testability batch status on 2026-03-12 follow-up: aligned `bot-initializer.error-handling.test.ts` and `bot-event-emitter.test.ts` around shared setup / teardown helpers so initializer rebuilds and started secondary emitters are cleaned up consistently.
- Testability batch status on 2026-03-12 follow-up: aligned `monitoring-server.test.ts`, `prometheus-metrics.test.ts`, and `websocket-keep-alive.service.test.ts` around local tracked builders and suite-level teardown helpers instead of ad hoc per-test lifecycle cleanup.
- Testability batch status on 2026-03-12 follow-up: added shared `mtf-snapshot-gate` test fixtures and tracked auxiliary gate teardown so the unit / functional / error-handling suites use one startup path and destroy every started gate.
- Testability batch status on 2026-03-12 follow-up: added shared `real-time-risk-monitor` fixtures and explicit `monitor.stop()` teardown; the cache-invalidation suite now exercises the real `position-closed` subscription path instead of isolated `Map` simulations.
- Testability batch status on 2026-03-12 follow-up: added shared `position-monitor` fixtures and service construction helpers; the unit and error-handling suites now share one harness and reuse a local config rebuild helper for time-based-exit scenarios instead of hand-written constructor blocks.
- Verification on 2026-03-12 for the compact-service cleanup slice:
  - `npm test -- --runInBand packages/core/src/__tests__/services/pattern-recognition.error-handling.test.ts packages/core/src/__tests__/services/orderbook-manager.service.error-handling.test.ts packages/core/src/__tests__/services/strategy-loader.error-handling.test.ts` -> PASS (3/3 suites, 77/77 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Verification on 2026-03-12 for the indicator pre-calculation cleanup slice:
  - `npm test -- --runInBand packages/core/src/__tests__/services/indicator-precalculation.error-handling.test.ts` -> PASS (1/1 suite, 20/20 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Verification on 2026-03-12 for the lifecycle testability slice:
  - `npm test -- --runInBand packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/bot-factory.error-handling.test.ts packages/core/src/__tests__/trading-bot.lifecycle.test.ts` -> PASS (3/3 suites, 57/57 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Verification on 2026-03-12 for the lifecycle testability follow-up slice:
  - `npm test -- --runInBand packages/core/src/__tests__/services/create-services.lifecycle.test.ts packages/core/src/__tests__/trading-bot.create-services.lifecycle.test.ts packages/core/src/__tests__/bot-initializer.test.ts` -> PASS (3/3 suites, 25/25 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Verification on 2026-03-12 for the initializer/event-emitter follow-up slice:
  - `npm test -- --runInBand packages/core/src/__tests__/services/bot-initializer.error-handling.test.ts packages/core/src/__tests__/bot-event-emitter.test.ts` -> PASS (2/2 suites, 47/47 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Verification on 2026-03-12 for the monitoring/websocket lifecycle follow-up slice:
  - `npm test -- --runInBand packages/core/src/__tests__/services/monitoring-server.test.ts packages/core/src/__tests__/services/prometheus-metrics.test.ts packages/core/src/__tests__/services/websocket-keep-alive.service.test.ts` -> PASS (3/3 suites, 65/65 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Verification on 2026-03-12 for the `mtf-snapshot-gate` lifecycle follow-up slice:
  - `npm test -- --runInBand packages/core/src/__tests__/services/mtf-snapshot-gate.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.functional.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.error-handling.test.ts` -> PASS (3/3 suites, 44/44 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Verification on 2026-03-12 for the `real-time-risk-monitor` lifecycle follow-up slice:
  - `npm test -- --runInBand packages/core/src/__tests__/services/real-time-risk-monitor.service.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.error-handling.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.cache-invalidation.test.ts` -> PASS (3/3 suites, 59/59 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
- Verification on 2026-03-12 for the `position-monitor` lifecycle follow-up slice:
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-monitor.service.test.ts packages/core/src/__tests__/services/position-monitor.error-handling.test.ts` -> PASS (2/2 suites, 46/46 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
