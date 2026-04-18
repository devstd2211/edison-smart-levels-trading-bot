# Next Session Prompt

You are continuing refactoring in `D:\src\Edison`.

## Session Objective
- Continue incremental, behavior-preserving refactor.
- Prioritize lifecycle/testability cleanup in `packages/core/src/__tests__/services/*` and adjacent production services when a small safe follow-up is clearly exposed.

## Source of Truth
- Current active work only: `ACTIVE_REFACTOR_PLAN.md`.
- Task catalog/backlog by area: `REFACTOR_TASKS.md`.
- Frozen archive: `REFACTOR_PLAN_01.md` and any other historical plan files.

## Context Rules
1. Do not load historical archive files by default.
2. Do not paste or rebuild chronological history into `ACTIVE_REFACTOR_PLAN.md`.
3. Keep only the latest completed slice and latest verification in `ACTIVE_REFACTOR_PLAN.md`.
4. Use archive files only if the user explicitly asks for historical detail or a previous decision rationale.

## Mandatory Session Rules
1. Always update `ACTIVE_REFACTOR_PLAN.md` with the latest completed slice and latest verification before session end.
2. Update `REFACTOR_TASKS.md` only when adding/removing/restructuring backlog tasks.
3. For each test refactor, review the related production service as refactor candidate.
4. If service is a candidate, perform a behavior-preserving service refactor in the same session or note a short pending item in `ACTIVE_REFACTOR_PLAN.md`.
5. Keep this file short: refresh only `Last Completed` and `Next Step`.
6. Keep user-facing replies short by default unless the user explicitly asks for more detail.
7. Do not maintain a running historical journal here.

## Working Order Per Session
1. Read `ACTIVE_REFACTOR_PLAN.md`.
2. Pick the next unchecked item.
3. Use `REFACTOR_TASKS.md` only if decomposition is needed.
4. Execute minimal safe refactor.
5. Run targeted tests for the changed area.
6. Run `npm run build`.
7. Update only the concise handoff below and the active plan.

## Last Completed (2026-04-18)
- Completed the next lifecycle/testability and suite-state reduction follow-up for `position-lifecycle.error-handling`, `exit-type-detector.service`, `volume-profile.error-handling`, `websocket-manager.service`, `websocket-manager.error-handling`, `websocket-keep-alive.service`, `websocket-event-handler.error-handling`, `websocket-authentication.service`, `websocket-authentication.error-handling`, and `volatility-regime.service`.
  - replaced remaining direct `Managed*Context` / `ReturnType<typeof createManaged...>`-driven suite state with local `Pick<>` slices, narrowed setup ownership to the exact fields each suite uses, and kept the slice test-only and behavior-preserving.
  - reviewed adjacent production surfaces opportunistically; no production follow-up was required in this slice.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/position-lifecycle.error-handling.test.ts packages/core/src/__tests__/services/exit-type-detector.service.test.ts packages/core/src/__tests__/services/volume-profile.error-handling.test.ts packages/core/src/__tests__/services/websocket-manager.service.test.ts packages/core/src/__tests__/services/websocket-manager.error-handling.test.ts packages/core/src/__tests__/services/websocket-keep-alive.service.test.ts packages/core/src/__tests__/services/websocket-event-handler.error-handling.test.ts packages/core/src/__tests__/services/websocket-authentication.service.test.ts packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts packages/core/src/__tests__/services/volatility-regime.service.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next remaining suites that still keep direct exported `Managed*Context` types, repeated `ReturnType<typeof createManaged...>` expressions, binder wrappers, fixture-accessor wrappers, or temporary managed-context locals, especially nearby remaining `virtual-balance.error-handling`, `volatility-regime.error-handling`, `websocket-authentication` / `websocket-manager` adjacent tails, `exit-type-detector.service.error-handling`, and the next lifecycle-oriented service/error-handling suites surfaced by `rg`.
- Keep reviewing adjacent production services opportunistically, but prefer test-owned lifecycle/state cleanup first unless a small behavior-preserving service refactor is clearly exposed.
