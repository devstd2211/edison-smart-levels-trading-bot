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

## Last Completed (2026-04-11)
- Completed a lifecycle/testability and suite-state reduction follow-up for `orderbook-manager.service`, `orderbook-manager.service.error-handling`, `volatility-regime.service`, `volume-profile.service`, `monitoring-server`, and `websocket-manager.service`.
  - collapsed the remaining broad fixture containers, repeated managed-context aliasing, and inline cleanup ownership into narrower helper-owned runtime, factory, harness, and cleanup groupings so each suite keeps only the orderbook, volatility, volume-profile, monitoring, and websocket surfaces it actively exercises.
  - reviewed `packages/core/src/services/orderbook-manager.service.ts`, `packages/core/src/services/volatility-regime.service.ts`, `packages/core/src/services/volume-profile.service.ts`, `packages/core/src/services/monitoring-server.service.ts`, and `packages/core/src/services/websocket-manager.service.ts`; no production follow-up was required in this slice.
- Verification:
  - `npm test -- --runInBand --silent packages/core/src/__tests__/services/orderbook-manager.service.test.ts packages/core/src/__tests__/services/orderbook-manager.service.error-handling.test.ts packages/core/src/__tests__/services/volatility-regime.service.test.ts packages/core/src/__tests__/services/volume-profile.service.test.ts packages/core/src/__tests__/services/monitoring-server.test.ts packages/core/src/__tests__/services/websocket-manager.service.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Keep `ACTIVE_REFACTOR_PLAN.md` small and current; never paste chronological history back into it.
- Continue the explicit lifecycle/state-reduction stream around `createServices()` / `start` / `stop` usage and replacing broad suite-level helper state with minimal grouped services or narrower fixture/factory bundles in the remaining service and resilience suites.
- Favor the next remaining slices that still keep direct exported `Managed*Context` types, repeated inline `ReturnType<typeof createManaged...>` expressions, fixture-accessor wrappers, or wider factory state in scope even though their lifecycle ownership is already centralized; continue after the refreshed `orderbook-manager.service` / `orderbook-manager.service.error-handling` / `volatility-regime.service` / `volume-profile.service` / `monitoring-server` / `websocket-manager.service` block into the next adjacent remaining service suites surfaced by `ACTIVE_REFACTOR_PLAN.md` and `rg`, especially untouched orderbook-imbalance / position-monitor / real-time-risk-monitor / monitoring-adjacent slices.
- Keep reviewing adjacent production services opportunistically, but prefer test-owned lifecycle/state cleanup first unless a small behavior-preserving service refactor is clearly exposed.
