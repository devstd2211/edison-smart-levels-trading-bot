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

## Last Completed (2026-03-21)
- Completed a three-step monitoring helper-consolidation batch:
  - extended `packages/core/src/__tests__/helpers/health-check-test.utils.ts` with a shared standard service path and routed the direct service bootstrap points in `packages/core/src/__tests__/services/health-check.test.ts` through it instead of repeated raw harness `createService(...)` calls.
  - extended `packages/core/src/__tests__/helpers/monitoring-server-test.utils.ts` with shared standard and started server factory paths and routed `packages/core/src/__tests__/services/monitoring-server.test.ts` through them instead of repeated direct harness `createServer(...)` / `startServer(...)` calls.
  - extended `packages/core/src/__tests__/helpers/prometheus-metrics-test.utils.ts` with shared standard and started tracked-service factory paths and routed `packages/core/src/__tests__/services/prometheus-metrics.test.ts` through them instead of repeated direct harness `createTrackedService(...)` / `createStartedTrackedService(...)` calls; reviewed `packages/core/src/services/health-check.service.ts`, `packages/core/src/services/monitoring-server.service.ts`, and `packages/core/src/services/prometheus-metrics.service.ts` and left production code unchanged after review.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/health-check.test.ts packages/core/src/__tests__/services/monitoring-server.test.ts packages/core/src/__tests__/services/prometheus-metrics.test.ts` -> PASS (3/3 suites, 68/68 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).

## Next Step
- Continue the testability stream before reopening adapter cleanup.
- Prefer the next adjacent partially-normalized monitoring/service slice next to the refreshed `health-check` / `monitoring-server` / `prometheus-metrics` area, such as `console-dashboard.error-handling`, `logger.service.error-handling`, or another nearby suite that still mixes local bootstrap with shared helpers.
- Keep favoring shared harnesses, explicit teardown where lifecycle exists, and minimal required dependency groups per suite.
