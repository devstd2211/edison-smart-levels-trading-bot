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

## Last Completed (2026-03-28)
- Completed a lifecycle/testability and suite-state reduction follow-up for `action-queue.error-handling`, `anomaly-detection.error-handling`, `circuit-breaker.error-handling`, `bybit.error-handling`, `anti-flip.error-handling`, and `indicator-registry.error-handling`.
  - replaced their remaining broad suite-level managed helper binding patterns with narrower typed fixture bundles so those suites now keep only the queue fixtures, anomaly services, circuit-breaker setup, bybit exchange stubs, anti-flip builders, or indicator-registry surfaces they actively exercise in scope while preserving the existing helper-managed cleanup path.
  - reviewed the adjacent production services for safe follow-up refactors; none were required in this slice.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/action-queue.error-handling.test.ts packages/core/src/__tests__/services/anomaly-detection.error-handling.test.ts packages/core/src/__tests__/services/circuit-breaker.error-handling.test.ts packages/core/src/__tests__/services/bybit.error-handling.test.ts packages/core/src/__tests__/services/anti-flip.error-handling.test.ts packages/core/src/__tests__/services/indicator-registry.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Keep `ACTIVE_REFACTOR_PLAN.md` small and current; never paste chronological history back into it.
- Continue the explicit lifecycle/state-reduction stream around `createServices()` / `start` / `stop` usage and replacing broad suite-level helper state with minimal grouped services or narrower fixture/factory bundles in the adjacent cache/monitoring/managed-service suites.
- Favor the next remaining error-handling slices that still keep full helper contexts, inline temporary managed contexts, or wider factory state in scope even though their lifecycle ownership is already centralized, especially the remaining initializer / exchange / handler / monitoring-style suites plus any adjacent shutdown/metrics-style suites that still bind whole helper contexts in `beforeEach`.
- Keep reviewing adjacent production services opportunistically, but prefer test-owned lifecycle/state cleanup first unless a small behavior-preserving service refactor is clearly exposed.
