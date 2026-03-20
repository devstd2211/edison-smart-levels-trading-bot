# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Session Objective
- Continue incremental, behavior-preserving refactor.
- Prioritize lifecycle/testability and `any` cleanup in `packages/core/src/__tests__/services/*` and related services.

## Source of Truth
- Progress log and active status tracking: `ACTIVE_REFACTOR_PLAN.md` (single source of truth).
- Completed historical log: `REFACTOR_PLAN.md` (archived completed track).
- Task catalog/backlog by area: `REFACTOR_TASKS.md`.
- This file (`NEXT_SESSION_PROMPT.md`) is operational guidance only; do not store full historical progress here.

## Mandatory Session Rules
1. Always update `ACTIVE_REFACTOR_PLAN.md` with completed work and verification results before session end.
2. Update `REFACTOR_TASKS.md` only when adding/removing/restructuring backlog tasks.
3. For each test refactor, review the related production service as refactor candidate.
4. If service is a candidate, perform a behavior-preserving service refactor in same session (or add explicit pending item to `ACTIVE_REFACTOR_PLAN.md` with reason).
5. Keep this file short: only refresh "Last Completed" and "Next Step".
6. Keep user-facing replies short by default unless the user explicitly asks for more detail.

## Working Order Per Session
1. Pick next target from `ACTIVE_REFACTOR_PLAN.md` unchecked/in-progress items.
2. Use `REFACTOR_TASKS.md` for concrete task candidates if decomposition is needed.
3. Execute minimal safe refactor.
4. Run targeted tests for changed area.
5. Record results in `ACTIVE_REFACTOR_PLAN.md`.
6. Refresh only brief handoff below.

## Last Completed (2026-03-20)
- Completed another three-iteration `position-exiting.error-handling` helper-consolidation batch:
  - extended `packages/core/src/__tests__/helpers/position-exiting-test.utils.ts` with a canonical error-handling harness, reusable retry-config/retry-sequence helpers, and a shared atomic-close guard.
  - routed the retry, fallback, and atomic-lock sections of `packages/core/src/__tests__/services/position-exiting.error-handling.test.ts` through those helpers instead of repeated inline config/bootstrap, repeated manual retry loops, repeated trade-close payload construction, and repeated ad-hoc lock-map setup.
  - reviewed `services/position-exiting.service.ts`; left production code unchanged after review.
- Completed another three-iteration repository-helper consolidation batch:
  - extended `packages/core/src/__tests__/helpers/position-repository-test.utils.ts` with canonical repository take-profit builders, a reusable history seeder, and a seeded query harness.
  - routed `packages/core/src/__tests__/services/position-lifecycle.repository-integration.test.ts` through those helpers instead of repeated inline take-profit arrays, repeated `createRepositoryPositions(...).forEach(addToHistory)` loops, and repeated current-plus-history bootstrap objects.
  - reviewed repository implementation with no production changes required.
- Completed another three-iteration `position-exiting.service` helper-consolidation follow-up:
  - extended `packages/core/src/__tests__/helpers/position-exiting-test.utils.ts` with a canonical exited-position builder that merges `stopLoss` overrides plus a reusable `executePositionExitSequence(...)` runner.
  - routed the `updateStopLoss`, `activateTrailingStop`, `recordPositionCloseInJournal`, and sequential edge-case sections of `packages/core/src/__tests__/services/position-exiting.service.test.ts` through that shared helper path instead of repeated inline stop-loss variant construction, repeated `executeExitAction(...)` close/update/trailing argument packs, and ad-hoc sequential action orchestration.
  - reviewed `services/position-exiting.service.ts`; left production code unchanged after review.
- Completed another three-iteration `position-exiting` helper-consolidation batch:
  - extended `packages/core/src/__tests__/helpers/position-exiting-test.utils.ts` with canonical transactional close request/flow helpers, a close-status guard, entry-price state/lifecycle diagnostics, and parsed WebSocket update analysis.
  - routed `packages/core/src/__tests__/services/position-exiting.transactional.test.ts`, `packages/core/src/__tests__/services/position-exiting.functional.test.ts`, and `packages/core/src/__tests__/services/position-exiting.integration.test.ts` through those helpers instead of repeated inline trade-close payloads, repeated rollback flow wiring, repeated entry-price corruption math, and repeated WebSocket parse-sequence mapping.
  - reviewed `services/position-exiting.service.ts`; left production code unchanged after review.
- Completed another three-iteration lifecycle/race helper-consolidation batch:
  - extended `packages/core/src/__tests__/helpers/position-lifecycle-test.utils.ts` with a dedicated safety harness, canonical WebSocket-position builder, and shared lifecycle log-call finder.
  - extended `packages/core/src/__tests__/helpers/position-exiting-test.utils.ts` with canonical full-close request/concurrent-close runners for race-condition scenarios.
  - routed `packages/core/src/__tests__/services/position-lifecycle.p0-safety.test.ts`, `packages/core/src/__tests__/services/position-lifecycle.error-handling.test.ts`, and `packages/core/src/__tests__/services/position-exiting.race-condition.test.ts` through those helpers instead of repeated internal-state bootstrap, repeated cloned WebSocket position construction, repeated full-close argument packs, and repeated concurrent close setup; reviewed `services/position-lifecycle.service.ts` and `services/position-exiting.service.ts` with no production changes required.
- Completed a `position-exiting` service-suite helper-consolidation follow-up:
  - extended `packages/core/src/__tests__/helpers/position-exiting-test.utils.ts` with a shared `executePositionExitRequest(...)` executor for canonical exit-action request assembly plus execution.
  - routed the routing/partial-close/full-close sections of `packages/core/src/__tests__/services/position-exiting.service.test.ts` through that helper instead of repeated inline `executeExitAction(...)` argument packs and repeated baseline request bootstrap.
  - reviewed `services/position-exiting.service.ts`; left production code unchanged after review.
- Completed another three-iteration position-sync/state-machine helper-consolidation batch:
  - extended `packages/core/src/__tests__/helpers/position-sync-test.utils.ts` with canonical closed-sync and deep-sync protection scenario builders, and extended `packages/core/src/__tests__/helpers/position-state-machine-test.utils.ts` with a shared single-transition helper hardened to preserve default transition fields.
  - routed `packages/core/src/__tests__/services/position-sync.service.test.ts`, `packages/core/src/__tests__/services/position-sync.service.error-handling.test.ts`, and `packages/core/src/__tests__/services/position-state-machine.service.test.ts` through those helpers instead of repeated order-history/current-price bootstrap, repeated protected-order arrays, and repeated direct transition payload construction.
  - reviewed `services/position-sync.service.ts` and `services/position-state-machine.service.ts`; left production code unchanged after review.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-exiting.error-handling.test.ts packages/core/src/__tests__/services/position-exiting.transactional.test.ts packages/core/src/__tests__/services/position-exiting.race-condition.test.ts` -> PASS (3/3 suites, 44/44 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-lifecycle.repository-integration.test.ts` -> PASS (1/1 suite, 15/15 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-exiting.service.test.ts packages/core/src/__tests__/services/position-exiting.transactional.test.ts packages/core/src/__tests__/services/position-exiting.functional.test.ts packages/core/src/__tests__/services/position-exiting.integration.test.ts packages/core/src/__tests__/services/position-exiting.race-condition.test.ts` -> PASS (5/5 suites, 85/85 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-exiting.transactional.test.ts packages/core/src/__tests__/services/position-exiting.functional.test.ts packages/core/src/__tests__/services/position-exiting.integration.test.ts` -> PASS (3/3 suites, 24/24 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-lifecycle.p0-safety.test.ts packages/core/src/__tests__/services/position-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/position-exiting.race-condition.test.ts` -> PASS (3/3 suites, 50/50 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-exiting.service.test.ts packages/core/src/__tests__/services/position-exiting.error-handling.test.ts packages/core/src/__tests__/services/position-exiting.functional.test.ts packages/core/src/__tests__/services/position-exiting.integration.test.ts packages/core/src/__tests__/services/position-exiting.race-condition.test.ts packages/core/src/__tests__/services/position-exiting.transactional.test.ts` -> PASS (6/6 suites, 107/107 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-sync.service.test.ts packages/core/src/__tests__/services/position-sync.service.error-handling.test.ts packages/core/src/__tests__/services/position-state-machine.service.test.ts` -> PASS (3/3 suites, 68/68 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).

## Next Step
- Continue the testability stream before reopening adapter cleanup.
- Prefer the next compact untouched or only partially-normalized suite adjacent to the refreshed lifecycle/exit area, especially `position-lifecycle.error-handling`, `position-monitor`-adjacent lifecycle slices, or another neighboring suite that still rebuilds baseline scenario inputs, rollback state, or concurrent close variants inline.
- Keep favoring shared harnesses, explicit teardown where lifecycle exists, and minimal required dependency groups per suite.
