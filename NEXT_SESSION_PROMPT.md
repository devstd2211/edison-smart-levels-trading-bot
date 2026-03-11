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

## Working Order Per Session
1. Pick next target from `ACTIVE_REFACTOR_PLAN.md` unchecked/in-progress items.
2. Use `REFACTOR_TASKS.md` for concrete task candidates if decomposition is needed.
3. Execute minimal safe refactor.
4. Run targeted tests for changed area.
5. Record results in `ACTIVE_REFACTOR_PLAN.md`.
6. Refresh only brief handoff below.

## Last Completed (2026-03-11)
- Completed compatibility-first typing batch 223 (behavior-preserving boundary-handler cleanup):
  - `services/handlers/websocket.handler.ts`:
    - replaced the remaining fallback/recovery/logging error-message extraction with shared `getErrorMessage()`.
  - `services/handlers/position.handler.ts`:
    - replaced the remaining monitoring/fallback error-message extraction with shared `getErrorMessage()`.
  - `services/data-collector/database-writer.ts`:
    - replaced the remaining batch/final-write error-message extraction with shared `getErrorMessage()`.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/public-websocket.error-handling.test.ts packages/core/src/__tests__/services/position-exiting.error-handling.test.ts packages/core/src/__tests__/services/data-collector.error-handling.test.ts` -> PASS (3/3 suites, 63/63 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).

## Next Step
- Continue `Core any cleanup (phase 3: src)` in isolated compatibility-first batches.
- Prefer a final scan for any remaining small non-adapter leftovers (`pattern-recognition.service.ts`, `orderbook-manager.service.ts`, `strategy-loader.service.ts`, minor builder/utils boundaries), then decide whether to close the compact-service stream before touching the larger exchange adapters.
- If no meaningful service leftovers remain, close the service cleanup stream and switch to the remaining testability tasks from `ACTIVE_REFACTOR_PLAN.md`.
- Keep behavior unchanged, run targeted tests per slice, and log the batch in `ACTIVE_REFACTOR_PLAN.md`.
