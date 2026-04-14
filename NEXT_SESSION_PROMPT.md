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

## Last Completed (2026-04-14)
- Completed a lifecycle/testability and suite-state reduction follow-up for `volatility-regime.service`, `wall-tracker.error-handling`, `weight-matrix-calculator.service`, `websocket-authentication.service`, `websocket-event-handler.error-handling`, and `websocket-authentication.error-handling`.
  - removed the remaining suite-local runtime/factory fixture aliases, cast-backed managed-context envelope splits, and wrapper destructuring in favor of direct helper-exported managed context property types and helper-owned service, logger, handler, mock, factory, and cleanup bindings so each suite keeps only the surfaces it actively exercises.
  - reviewed adjacent `volatility-regime` / `wall-tracker` / `weight-matrix-calculator` / `websocket-authentication` / `websocket-event-handler` production services; no production follow-up was required in this slice.
- Verification:
  - `npm test -- --runInBand --silent packages/core/src/__tests__/services/volatility-regime.service.test.ts packages/core/src/__tests__/services/wall-tracker.error-handling.test.ts packages/core/src/__tests__/services/weight-matrix-calculator.service.test.ts packages/core/src/__tests__/services/websocket-authentication.service.test.ts packages/core/src/__tests__/services/websocket-event-handler.error-handling.test.ts packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Keep `ACTIVE_REFACTOR_PLAN.md` small and current; never paste chronological history back into it.
- Continue the explicit lifecycle/state-reduction stream around `createServices()` / `start` / `stop` usage and replacing broad suite-level helper state with minimal grouped services or narrower fixture/factory bundles in the remaining service and resilience suites.
- Favor the next remaining slices that still keep binder wrappers, direct exported `Managed*Context` types, repeated inline `ReturnType<typeof createManaged...>` expressions, fixture-accessor wrappers, or wider factory state in scope even though their lifecycle ownership is already centralized; continue after the refreshed `volatility-regime.service` / `wall-tracker.error-handling` / `weight-matrix-calculator.service` / `websocket-authentication.service` / `websocket-event-handler.error-handling` / `websocket-authentication.error-handling` block into the next adjacent suites surfaced by `ACTIVE_REFACTOR_PLAN.md` and `rg`, especially `volatility-regime.error-handling`, `wall-tracker.service`, `weight-matrix-calculator.error-handling`, `websocket-manager.service`, `websocket-manager.error-handling`, and `websocket-keep-alive.service`.
- Keep reviewing adjacent production services opportunistically, but prefer test-owned lifecycle/state cleanup first unless a small behavior-preserving service refactor is clearly exposed.
