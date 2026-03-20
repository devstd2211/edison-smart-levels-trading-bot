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
- Completed a `position-monitor.service` helper-consolidation follow-up:
  - extended `packages/core/src/__tests__/helpers/position-monitor-test.utils.ts` with a canonical scenario-position builder and a shared time-based-exit risk-config builder.
  - routed `packages/core/src/__tests__/services/position-monitor.service.test.ts` through those helpers plus the existing shared monitor/deep-sync cycle runners instead of local position bootstrap, repeated time-exit config literals, and repeated single-cycle timer advancement.
  - reviewed `services/position-monitor.service.ts`; left production code unchanged after review.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-monitor.service.test.ts packages/core/src/__tests__/services/position-monitor.error-handling.test.ts` -> PASS (2/2 suites, 46/46 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).

## Next Step
- Continue the testability stream before reopening adapter cleanup.
- Prefer the next compact untouched or only partially-normalized suite adjacent to the refreshed monitor/orderbook area, especially `orderbook-manager.service` or another neighboring suite that still rebuilds baseline scenario inputs and one-cycle timer/bootstrap inline.
- Keep favoring shared harnesses, explicit teardown where lifecycle exists, and minimal required dependency groups per suite.
