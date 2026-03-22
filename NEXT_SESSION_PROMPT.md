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

## Last Completed (2026-03-22)
- Completed a monitoring/lifecycle helper-consolidation batch for `prometheus-metrics`, `monitoring-server`, `real-time-risk-monitor.service`, `real-time-risk-monitor.error-handling`, and `real-time-risk-monitor.cache-invalidation`:
  - extended `packages/core/src/__tests__/helpers/prometheus-metrics-test.utils.ts` and `packages/core/src/__tests__/helpers/monitoring-server-test.utils.ts` with managed test-context wrappers for tracked lifecycle cleanup.
  - added a managed lifecycle harness path in `packages/core/src/__tests__/helpers/real-time-risk-monitor-test.utils.ts`.
  - routed the corresponding suites through those shared managed contexts instead of local tracked arrays, ad hoc harness objects, and direct `monitor.stop()` teardown.
  - reviewed `packages/core/src/services/prometheus-metrics.service.ts`, `packages/core/src/services/monitoring-server.service.ts`, and `packages/core/src/services/real-time-risk-monitor.service.ts` and left production code unchanged after review.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/prometheus-metrics.test.ts packages/core/src/__tests__/services/monitoring-server.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.service.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.error-handling.test.ts packages/core/src/__tests__/services/real-time-risk-monitor.cache-invalidation.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue the lifecycle/testability stream in the next adjacent suites that still keep broad service-state or manual tracked cleanup.
- Favor shared managed test contexts for started/stopped resources, explicit teardown paths, and minimal grouped service construction instead of suite-local tracked arrays or ad hoc harness objects.
- Re-scan remaining monitoring/bot/lifecycle-adjacent suites before reopening lower-signal constructor-only cleanup.
