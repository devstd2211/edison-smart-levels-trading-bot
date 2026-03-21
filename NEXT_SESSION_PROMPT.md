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
- Completed another three-step orderbook-adjacent helper-consolidation batch:
  - extended `packages/core/src/__tests__/helpers/wall-tracker-test.utils.ts` with harness-backed standard and legacy service factories.
  - routed both `packages/core/src/__tests__/services/wall-tracker.service.test.ts` and `packages/core/src/__tests__/services/wall-tracker.error-handling.test.ts` through those shared legacy paths instead of repeated direct no-error-handler service bootstrap.
  - extended `packages/core/src/__tests__/helpers/volume-profile-test.utils.ts` with harness-backed standard and legacy service factories, then routed `packages/core/src/__tests__/services/volume-profile.service.test.ts` through the shared legacy path instead of repeated direct `createVolumeProfileServiceWithHarness(...)` bootstrap.
  - reviewed `services/wall-tracker.service.ts`; left production code unchanged after review.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/wall-tracker.service.test.ts` -> PASS (1/1 suite, 21/21 tests).
  - `npm test -- --runInBand packages/core/src/__tests__/services/wall-tracker.error-handling.test.ts` -> PASS (1/1 suite, 23/23 tests).
  - `npm test -- --runInBand packages/core/src/__tests__/services/volume-profile.service.test.ts` -> PASS (1/1 suite, 18/18 tests).
  - `npm run build` -> PASS (`packages/contracts`, `packages/web-server`, `packages/core`, `packages/web-client`).

## Next Step
- Continue the testability stream before reopening adapter cleanup.
- Prefer the next adjacent partially-normalized constructor-heavy analytics slice such as `volume-profile.error-handling`, `whale-detection`, or another nearby service/error-handling pair adjacent to the refreshed wall-tracker / orderbook analytics cluster.
- Keep favoring shared harnesses, explicit teardown where lifecycle exists, and minimal required dependency groups per suite.
