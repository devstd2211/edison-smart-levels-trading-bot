# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Session Objective
- Continue incremental, behavior-preserving refactor.
- Prioritize lifecycle/testability and `any` cleanup in `packages/core/src/__tests__/services/*` and related services.

## Source of Truth
- Active status + current target only: `ACTIVE_REFACTOR_PLAN.md` (single source of truth for open work).
- Completed historical log: `REFACTOR_PLAN.md` (archived completed track; do not load unless historical detail is needed).
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

## Last Completed (2026-04-06)
- Completed a lifecycle/testability and suite-state reduction follow-up for `data-collector.error-handling`, `event-deduplication.error-handling`, `ml-feature-extractor.error-handling`, `mtf-snapshot-gate.error-handling`, `multi-timeframe-trend.error-handling`, and `position-monitor.error-handling`.
  - moved the remaining helper-owned fixture bindings in those resilience suites behind narrower grouped `runtime` / `factories` bundles so each suite now reads through a smaller helper-managed surface while centralized cleanup ownership stays unchanged.
  - reviewed the adjacent production services for safe follow-up refactors; none were required in this slice.
- Completed a lifecycle/testability and suite-state reduction follow-up for `funding-rate-filter.error-handling`, `indicator-cache.error-handling`, `indicator-precalculation.error-handling`, `indicator-registry.error-handling`, `ladder-tp-manager.error-handling`, and `limit-order-executor.error-handling`.
  - moved the remaining flat helper-owned fixture bindings in those resilience suites behind narrower grouped `runtime` / `factories` bundles so each suite now reads through a smaller helper-managed surface while centralized cleanup ownership stays unchanged.
  - reviewed the adjacent production services for safe follow-up refactors; none were required in this slice.
- Completed a lifecycle/testability and suite-state reduction follow-up for `logger.service.error-handling`, `ladder-exit-detector.service.error-handling`, `fractal-smc-weighting.error-handling`, `smart-order-placement.error-handling`, `reality-check.error-handling`, and `public-websocket.error-handling`.
  - replaced the remaining flat suite-level helper bindings in those resilience suites with narrower grouped runtime/factories/paths bundles so each test now keeps only the helper-managed state it actively exercises in scope while cleanup ownership stays centralized.
  - silenced suite-local `console` noise in the logger and ladder-exit slices where expected error-path logging was flooding targeted test output.
  - reviewed the adjacent production services for safe follow-up refactors; none were required in this slice.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/data-collector.error-handling.test.ts packages/core/src/__tests__/services/event-deduplication.error-handling.test.ts packages/core/src/__tests__/services/ml-feature-extractor.error-handling.test.ts packages/core/src/__tests__/services/mtf-snapshot-gate.error-handling.test.ts packages/core/src/__tests__/services/multi-timeframe-trend.error-handling.test.ts packages/core/src/__tests__/services/position-monitor.error-handling.test.ts` -> PASS.
  - `npm test -- --runInBand packages/core/src/__tests__/services/funding-rate-filter.error-handling.test.ts packages/core/src/__tests__/services/indicator-cache.error-handling.test.ts packages/core/src/__tests__/services/indicator-precalculation.error-handling.test.ts packages/core/src/__tests__/services/indicator-registry.error-handling.test.ts packages/core/src/__tests__/services/ladder-tp-manager.error-handling.test.ts packages/core/src/__tests__/services/limit-order-executor.error-handling.test.ts` -> PASS.
  - `npm test -- --runInBand packages/core/src/__tests__/services/logger.service.error-handling.test.ts packages/core/src/__tests__/services/ladder-exit-detector.service.error-handling.test.ts packages/core/src/__tests__/services/fractal-smc-weighting.error-handling.test.ts packages/core/src/__tests__/services/smart-order-placement.error-handling.test.ts packages/core/src/__tests__/services/reality-check.error-handling.test.ts packages/core/src/__tests__/services/public-websocket.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Keep `ACTIVE_REFACTOR_PLAN.md` small and current; never paste chronological history back into it.
- Continue the explicit lifecycle/state-reduction stream around `createServices()` / `start` / `stop` usage and replacing broad suite-level helper state with minimal grouped services or narrower fixture/factory bundles in the remaining service and resilience suites.
- Favor the next remaining slices that still keep full helper contexts, inline temporary managed contexts, wider factory state, or optional cleanup wrappers in scope even though their lifecycle ownership is already centralized, with `bot-factory.error-handling`, `create-services.lifecycle`, `health-check`, `time.service`, `websocket-keep-alive.service`, and `signal-processing.timeframe-conflict` as the next easy cleanup candidates, and separately decide whether `packages/core/src/__tests__/services/phase-10-integration.test.ts` should keep its current memory-growth threshold or be stabilized with a less environment-sensitive assertion before continuing adjacent suite cleanup.
- Keep reviewing adjacent production services opportunistically, but prefer test-owned lifecycle/state cleanup first unless a small behavior-preserving service refactor is clearly exposed.
