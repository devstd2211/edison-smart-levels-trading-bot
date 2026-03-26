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

## Last Completed (2026-03-26)
- Completed a helper-managed context follow-up for `event-handlers.error-handling`, `websocket-event-handler.error-handling`, `monitoring-server`, `prometheus-metrics`, `session-stats.error-handling`, and `performance-analytics.service`:
  - extended the adjacent event-handlers / monitoring-server / prometheus-metrics / session-stats / performance-analytics test utils so managed contexts own bound factory helpers, tracked services, and cleanup.
  - routed the target suites away from suite-local harness ownership and ad-hoc lifecycle tracking.
  - reviewed the adjacent production services and left production code unchanged.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/event-handlers.error-handling.test.ts packages/core/src/__tests__/services/websocket-event-handler.error-handling.test.ts packages/core/src/__tests__/services/monitoring-server.test.ts packages/core/src/__tests__/services/prometheus-metrics.test.ts packages/core/src/__tests__/services/session-stats.error-handling.test.ts packages/core/src/__tests__/services/performance-analytics.service.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue with the next helper-backed lifecycle/testability slice in the remaining monitoring/cache-adjacent suites that still keep suite-local cleanup or over-broad grouped service construction, prioritizing helpers that do not yet fully own created service tracking.
- After that, keep pushing toward broader grouped-service / `createServices()` narrowing only where no helper-managed cleanup path exists yet.
