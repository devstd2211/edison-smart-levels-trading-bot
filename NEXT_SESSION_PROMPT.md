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

## Last Completed (2026-04-21)
- Completed the next lifecycle/testability and suite-state narrowing follow-up across `take-profit-manager.error-handling`, `take-profit-manager.service`, `tick-delta-analyzer.error-handling`, `tick-delta-analyzer.service`, `swing-point-detector.error-handling`, `trade-history.error-handling`, `position-pnl-calculator.error-handling`, `position-pnl-calculator.service`, `position-state-machine.error-handling`, and `position-state-machine.service`, plus the adjacent helper narrowing in `take-profit-manager-test.utils`, `tick-delta-analyzer-test.utils`, `swing-point-detector-test.utils`, `trade-history-test.utils`, `position-pnl-calculator-test.utils`, and `position-state-machine-test.utils`.
  - added helper-exported narrow runtime/factory/state aliases, then replaced local wide `Managed*Context` ownership and repeated suite-local fixture composition with helper-owned picks only, keeping setup/cleanup behavior unchanged.
  - reviewed adjacent production surfaces opportunistically; no production follow-up was required in this slice.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/take-profit-manager.error-handling.test.ts packages/core/src/__tests__/services/take-profit-manager.service.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.service.test.ts packages/core/src/__tests__/services/swing-point-detector.error-handling.test.ts packages/core/src/__tests__/services/trade-history.error-handling.test.ts packages/core/src/__tests__/services/position-pnl-calculator.error-handling.test.ts packages/core/src/__tests__/services/position-pnl-calculator.service.test.ts packages/core/src/__tests__/services/position-state-machine.error-handling.test.ts packages/core/src/__tests__/services/position-state-machine.service.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next remaining suites that still keep direct exported `Managed*Context` types, broader helper-bound runtime state, or temporary fixture/service wrappers, especially the nearby leftovers still surfaced by `rg` after this slice such as `public-websocket.error-handling`, `position-sync.service*`, `reality-check.error-handling`, `resilience/*`, `prometheus-metrics`, and similar remaining `ReturnType<typeof createManaged...>` ownership outside the completed batches.
- Keep reviewing adjacent production services opportunistically, but prefer test-owned lifecycle/state cleanup first unless a small behavior-preserving service refactor is clearly exposed.
