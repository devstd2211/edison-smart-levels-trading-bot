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
- [ ] Extend explicit lifecycle teardown coverage beyond `bot-factory` / `trading-bot` suites into the next lifecycle-adjacent test slices.
- [ ] Continue replacing broad service-state construction in tests with the minimal required grouped services or tracked `createServices()` state.
- [ ] Continue the compact harness stream with the next untouched constructor-heavy unit/error-handling suites adjacent to the recently refreshed helpers.

## Working Rules
1. Pick the next unchecked item from this file.
2. Apply minimal behavior-preserving changes only.
3. Run targeted tests for the changed slice.
4. Run `npm run build`.
5. Record only active status here; keep completed batch history in `REFACTOR_PLAN.md`.
6. Keep `NEXT_SESSION_PROMPT.md` short: `Last Completed` + `Next Step`.

## Active Notes
- Latest completed slice (2026-03-18): completed a three-step lifecycle/testability follow-up for `bot-factory` and adjacent `bot-metrics` coverage by adding a shared `bot-factory-test.utils` helper with canonical factory config + config-path mutation builders, routing both `bot-factory.service.test.ts` and `bot-factory.error-handling.test.ts` through that helper, and extending the existing `bot-metrics` helper with seeded fixture setup so report/reset sections stop rebuilding the same trades/events inline; production `services/bot-factory.service.ts` and `services/bot-metrics.service.ts` were reviewed and left unchanged.
- Latest verification (2026-03-18): `npm test -- --runInBand packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/bot-factory.error-handling.test.ts packages/core/src/__tests__/services/bot-metrics.error-handling.test.ts` PASS; `npm run build` PASS.
- Latest completed slice (2026-03-18): completed a three-step lifecycle/testability follow-up for `bot-initializer` and `bot-factory.service` by adding a shared `bot-initializer-test.utils` helper with canonical config/logger/service mock builders, routing both `bot-initializer.test.ts` and `bot-initializer.error-handling.test.ts` through that helper, and switching `bot-factory.service.test.ts` to the shared lifecycle config/tracked harness path instead of local inline bootstrap; production `services/bot-initializer.ts` and `services/bot-factory.service.ts` were reviewed and left unchanged.
- Latest verification (2026-03-18): `npm test -- --runInBand packages/core/src/__tests__/bot-initializer.test.ts packages/core/src/__tests__/services/bot-initializer.error-handling.test.ts packages/core/src/__tests__/services/bot-factory.service.test.ts` PASS; `npm run build` PASS.
- Latest completed slice (2026-03-18): completed a lifecycle-helper consolidation batch for `trading-bot.lifecycle`, `trading-bot.create-services.lifecycle`, and `create-services.lifecycle` by extending `service-lifecycle-test.utils` with a canonical tracked lifecycle harness and routing those suites through one shared `config + exchange + telegram + tracked services` bootstrap path; production `bot.ts`, `services/bot-factory.service.ts`, and `services/bot-initializer.ts` were reviewed and left unchanged.
- Latest verification (2026-03-18): `npm test -- --runInBand packages/core/src/__tests__/trading-bot.lifecycle.test.ts packages/core/src/__tests__/trading-bot.create-services.lifecycle.test.ts packages/core/src/__tests__/services/create-services.lifecycle.test.ts` PASS; `npm run build` PASS.
- Latest completed slice (2026-03-18): completed an integration-helper consolidation batch for `position-lifecycle.repository-integration`, `position-exiting.integration`, and `phase-10-integration` by adding seeded repository shortcuts, a canonical real-scenario position-exiting harness, and shared phase-10 workflow fixtures so those suites stop rebuilding the same seeded/integration bootstrap inline; production repository and service code was reviewed and left unchanged.
- Latest verification (2026-03-18): `npm test -- --runInBand packages/core/src/__tests__/services/position-lifecycle.repository-integration.test.ts packages/core/src/__tests__/services/position-exiting.integration.test.ts packages/core/src/__tests__/services/phase-10-integration.test.ts` PASS; `npm run build` PASS.
- Latest completed slice (2026-03-18): completed another three-step helper consolidation batch for `smart-order-execution`, `position-scaling`, and `dynamic-position-sizer` by extending their shared helpers with canonical no-handler / broken-service / base-request builders and routing the suites through those builders instead of recreating the same service variants and baseline requests inline; production `services/smart-order-execution.service.ts`, `services/position-scaling.service.ts`, and `services/dynamic-position-sizer.service.ts` were reviewed and left unchanged.
- Latest verification (2026-03-18): `npm test -- --runInBand packages/core/src/__tests__/services/smart-order-execution.test.ts packages/core/src/__tests__/services/position-scaling.test.ts packages/core/src/__tests__/services/dynamic-position-sizer.test.ts` PASS; `npm run build` PASS.
- Latest completed slice (2026-03-18): completed a three-step helper consolidation batch for `action-queue.error-handling`, `health-check`, and `time.service` by routing the suites through shared harness builders (`createAction`/`createHandler`, unavailable-service/threshold config builders, and `createSyncedService(...)`), reducing repeated inline bootstrap while keeping production `services/action-queue.service.ts`, `services/health-check.service.ts`, and `services/time.service.ts` unchanged after review.
- Latest verification (2026-03-18): `npm test -- --runInBand packages/core/src/__tests__/services/action-queue.error-handling.test.ts packages/core/src/__tests__/services/health-check.test.ts packages/core/src/__tests__/services/time.service.test.ts` PASS; `npm run build` PASS.
- Latest completed slice (2026-03-18): completed a three-step `strategy-loader` follow-up by extending the shared helper with canonical metadata/analyzer builders, refactoring `strategy-loader.test.ts` to reuse those builders for validation/integration fixtures, and refactoring `strategy-loader.error-handling.test.ts` to reuse the same fixture builders plus the shared `createLoader(...)` path for no-handler coverage; production `services/strategy-loader.service.ts` was reviewed and left unchanged.
- Latest verification (2026-03-18): `npm test -- --runInBand packages/core/src/__tests__/services/strategy-loader.test.ts packages/core/src/__tests__/services/strategy-loader.error-handling.test.ts` PASS; `npm run build` PASS.
- Latest completed slice (2026-03-18): refreshed `session-stats.error-handling` to reuse a shared `createService(...)` builder from the session-stats test helper and to exercise the service's explicit `start()` lifecycle for load/restart scenarios; production `services/session-stats.service.ts` was reviewed and left unchanged.
- Latest verification (2026-03-18): `npm test -- --runInBand packages/core/src/__tests__/services/session-stats.error-handling.test.ts` PASS; `npm run build` PASS.
- `types/*` cleanup is complete; do not reopen unless a service refactor requires a compatibility follow-up.
- Non-`services`/non-`types` phase-3 cleanup is complete for the previously targeted boundaries; only reopen when new mixed boundaries are discovered during adjacent work.
- Main remaining stream is lifecycle/testability work around explicit `createServices()` state, teardown coverage, and minimal grouped service construction in tests.
- Compact service-by-service harness cleanup is still active, but most low-risk constructor-heavy suites have already been refreshed; prefer only adjacent untouched suites now.
- Exchange-adapter cleanup should stay deprioritized unless a testability slice directly exposes a safe follow-up.
