# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Session Objective
- Continue incremental, behavior-preserving refactor.
- Prioritize lifecycle/testability and `any` cleanup in `packages/core/src/__tests__/services/*` and related services.

## Source of Truth
- Progress log and status tracking: `REFACTOR_PLAN.md` (single source of truth).
- Task catalog/backlog by area: `REFACTOR_TASKS.md`.
- This file (`NEXT_SESSION_PROMPT.md`) is operational guidance only; do not store full historical progress here.

## Mandatory Session Rules
1. Always update `REFACTOR_PLAN.md` with completed work and verification results before session end.
2. Update `REFACTOR_TASKS.md` only when adding/removing/restructuring backlog tasks.
3. For each test refactor, review the related production service as refactor candidate.
4. If service is a candidate, perform a behavior-preserving service refactor in same session (or add explicit pending item to `REFACTOR_PLAN.md` with reason).
5. Keep this file short: only refresh "Last Completed" and "Next Step".

## Working Order Per Session
1. Pick next target from `REFACTOR_PLAN.md` unchecked/in-progress items.
2. Use `REFACTOR_TASKS.md` for concrete task candidates if decomposition is needed.
3. Execute minimal safe refactor.
4. Run targeted tests for changed area.
5. Record results in `REFACTOR_PLAN.md`.
6. Refresh only brief handoff below.

## Last Completed (2026-03-06)
- God-object recovery track continued with `packages/core/src/services/position-lifecycle.service.ts` iteration 1.
- Extracted WebSocket sync/snapshot helpers to `packages/core/src/services/position-lifecycle/position-lifecycle-sync.utils.ts`.
- Added persistence access helpers in service (`readStoredPosition` / `writeStoredPosition`) and integrated them into storage/clear flows.
- Progress tracking updated in `REFACTOR_PLAN.md`: 2/10 recovery candidates completed, 8/10 pending.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/position-lifecycle.p0-safety.test.ts` -> 2/2 suites PASS, 36/36 tests PASS.

## Next Step
- Continue recovery track with next highest-impact candidate: `packages/core/src/services/trading-journal.service.ts` (behavior-preserving extraction of write/read/stats adapters + targeted tests + progress update).
