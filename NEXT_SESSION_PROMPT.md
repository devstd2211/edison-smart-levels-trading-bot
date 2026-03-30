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
- Completed a lifecycle/testability and suite-state reduction follow-up for `compound-interest-calculator.error-handling`, `data-collector.error-handling`, `delta-analyzer.error-handling`, `enhanced-exit.error-handling`, `entry-confirmation.error-handling`, and `event-deduplication.error-handling`.
  - renamed the remaining suite-owned `bind*Context()` helpers in those suites to narrower fixture-oriented binders and removed duplicated local fixture aliases in the data-collector, delta-analyzer, enhanced-exit, and event-deduplication suites.
  - reviewed the adjacent production services for safe follow-up refactors; none were required in this slice.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/compound-interest-calculator.error-handling.test.ts packages/core/src/__tests__/services/data-collector.error-handling.test.ts packages/core/src/__tests__/services/delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/enhanced-exit.error-handling.test.ts packages/core/src/__tests__/services/entry-confirmation.error-handling.test.ts packages/core/src/__tests__/services/event-deduplication.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Keep `ACTIVE_REFACTOR_PLAN.md` small and current; never paste chronological history back into it.
- Continue the explicit lifecycle/state-reduction stream around `createServices()` / `start` / `stop` usage and replacing broad suite-level helper state with minimal grouped services or narrower fixture/factory bundles in the remaining service and resilience suites.
- Favor the next remaining slices that still keep full helper contexts, inline temporary managed contexts, wider factory state, or optional cleanup wrappers in scope even though their lifecycle ownership is already centralized, especially the remaining service and resilience suites that still expose repeated `getFixtures()`/`getContext()` access, context-named fixture binders, duplicated fixture-type aliases, or suite-local cleanup/state holders around `createServices()` lifecycle helpers after the latest compound-interest/data-collector/delta-analyzer/enhanced-exit/entry-confirmation/event-deduplication cleanup slice is reduced.
- Keep reviewing adjacent production services opportunistically, but prefer test-owned lifecycle/state cleanup first unless a small behavior-preserving service refactor is clearly exposed.
