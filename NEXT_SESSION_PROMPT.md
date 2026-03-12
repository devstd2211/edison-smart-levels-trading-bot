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

## Last Completed (2026-03-12)
- Completed testability batch 232 (behavior-preserving `position-monitor` follow-up):
  - added shared `position-monitor` test fixtures for monitored positions, service dependencies, default risk config, and monitor construction.
  - aligned `services/position-monitor.service.test.ts` and `services/position-monitor.error-handling.test.ts` on the shared harness.
  - collapsed repeated time-based-exit constructor blocks behind a local monitor rebuild helper that reuses the same mocked dependencies.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-monitor.service.test.ts packages/core/src/__tests__/services/position-monitor.error-handling.test.ts` -> PASS (2/2 suites, 46/46 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).

## Next Step
- Continue the testability stream before reopening adapter cleanup.
- Extend explicit lifecycle teardown and minimal grouped-service construction into the next lifecycle-adjacent suites beyond the current `bot` / `initializer` / `mtf-snapshot-gate` / `real-time-risk-monitor` / `position-monitor` slices.
- Prefer the next clustered boundary with repeated service startup/shutdown patterns (`position-*`, monitoring-adjacent, or similarly grouped suites) so three-at-a-time iterations stay cohesive.
- Keep behavior unchanged, run targeted tests per slice, and log the batch in `ACTIVE_REFACTOR_PLAN.md`.
