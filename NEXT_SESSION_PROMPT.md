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

## Last Completed (2026-03-29)
- Completed a lifecycle/testability and suite-state reduction follow-up for `websocket-manager.service`, `candle-provider.repository-integration`, `bybit.repository-integration`, `analyzer-engine.service`, `bot-factory.service`, and `create-services.lifecycle`.
  - replaced their remaining direct managed-context returns or `ReturnType<typeof createManaged...>` test bindings with explicit managed context types and narrower fixture bundles so those suites now keep only the services, harness factories, or lifecycle surfaces they actively exercise in scope while preserving the existing helper-managed cleanup path.
  - reviewed the adjacent production services for safe follow-up refactors; none were required in this slice.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/websocket-manager.service.test.ts packages/core/src/__tests__/services/candle-provider.repository-integration.test.ts packages/core/src/__tests__/services/bybit.repository-integration.test.ts packages/core/src/__tests__/services/analyzer-engine.service.test.ts packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/create-services.lifecycle.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Keep `ACTIVE_REFACTOR_PLAN.md` small and current; never paste chronological history back into it.
- Continue the explicit lifecycle/state-reduction stream around `createServices()` / `start` / `stop` usage and replacing broad suite-level helper state with minimal grouped services or narrower fixture/factory bundles in the adjacent cache/monitoring/managed-service suites.
- Favor the next remaining managed-service and integration slices that still keep full helper contexts, inline temporary managed contexts, or wider factory state in scope even though their lifecycle ownership is already centralized, especially adjacent exchange / monitoring / repository / cache suites that still bind whole helper contexts in `beforeEach`, including nearby analyzer-engine error-handling / bot-factory error-handling / bot-initializer / analyzer-engine scenario / tracked-service lifecycle style suites that still lean on broader managed-context surfaces or direct context returns.
- Keep reviewing adjacent production services opportunistically, but prefer test-owned lifecycle/state cleanup first unless a small behavior-preserving service refactor is clearly exposed.
