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

## Last Completed (2026-03-08)
- Continued `WhaleDetectionService` refactor track with additional decomposition (iterations 4-5 after prior 1-3):
  - extracted side-loop helpers for wall break/disappearance (`tryDetectWallBreakForSide`, `tryDetectWallDisappearanceForSide`).
  - extracted per-side wall tracking and expiry helpers (`updateTrackedWallsForSide`, `removeExpiredTrackedWalls`).
  - preserved signal ordering/semantics and cleanup behavior.
- Current `WhaleDetectionService` track summary (iterations 1-5 in total):
  - extracted signal/key helpers to `whale-detection/whale-detection-signal.utils.ts` (no-signal, detection-failed, wall-break key).
  - extracted tracked-wall upsert helper to `whale-detection/whale-detection-wall.utils.ts`.
  - compacted repeated THROW validation boilerplate via shared service helper while preserving error message text and ErrorHandler behavior.
  - service reduced to 937 lines (from 1054 at start of this track) with detection sequencing and error-handling behavior preserved.
- Updated `REFACTOR_PLAN.md` with iteration log, candidate review, size update, and closure note.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/whale-detection.error-handling.test.ts` -> PASS (1/1 suite, 16/16 tests) after each iteration

## Next Step
- Select next candidate from backlog (`REFACTOR_PLAN.md` / `REFACTOR_TASKS.md`) after extended `WhaleDetectionService` decomposition:
  - prioritize behavior-preserving decomposition or remaining lifecycle/testability cleanup items,
  - run targeted suite(s) for changed area,
  - record candidate review + verification results in `REFACTOR_PLAN.md`.
