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

## Last Completed (2026-03-30)
- Completed a lifecycle/testability and suite-state reduction follow-up for `exit-type-detector.service`, `funding-rate-filter.service`, `health-check`, `ladder-tp-manager.service`, `limit-order-executor.service`, and `ml-feature-extractor.service`.
  - renamed the remaining context-shaped suite binders in those service suites to fixture-oriented helper accessors so each suite now reads only the narrowed helper-managed state it actively exercises.
  - reviewed the adjacent production services for safe follow-up refactors; none were required in this slice.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/exit-type-detector.service.test.ts packages/core/src/__tests__/services/funding-rate-filter.service.test.ts packages/core/src/__tests__/services/health-check.test.ts packages/core/src/__tests__/services/ladder-tp-manager.service.test.ts packages/core/src/__tests__/services/limit-order-executor.service.test.ts packages/core/src/__tests__/services/ml-feature-extractor.service.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Keep `ACTIVE_REFACTOR_PLAN.md` small and current; never paste chronological history back into it.
- Continue the explicit lifecycle/state-reduction stream around `createServices()` / `start` / `stop` usage and replacing broad suite-level helper state with minimal grouped services or narrower fixture/factory bundles in the remaining service and resilience suites.
- Favor the next remaining slices that still keep full helper contexts, inline temporary managed contexts, wider factory state, or optional cleanup wrappers in scope even though their lifecycle ownership is already centralized, especially the remaining service and resilience suites that still expose repeated `getFixtures()`/`getContext()` access, context-named fixture binders, duplicated fixture-type aliases, or suite-local cleanup/state holders around `createServices()` lifecycle helpers after the latest exit-type-detector/funding-rate-filter/health-check/ladder-tp-manager/limit-order-executor/ml-feature-extractor cleanup slice is reduced.
- Keep reviewing adjacent production services opportunistically, but prefer test-owned lifecycle/state cleanup first unless a small behavior-preserving service refactor is clearly exposed.
