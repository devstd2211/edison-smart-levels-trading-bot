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

## Last Completed (2026-04-24)
- Completed the next requested five-task lifecycle/testability narrowing slice across `action-queue.error-handling`, `advanced-order-state-machine`, `advanced-order-flow.error-handling`, `analyzer-engine.service`, and `analyzer-engine.error-handling`.
  - removed another batch of now-unused helper runtime/state exports around those suites, and switched `advanced-order-flow.error-handling` to a direct local `ReturnType<typeof createManaged...>` alias instead of importing helper state.
  - kept the slice behavior-preserving; the immediate follow-up remains continuing the move away from exported managed-context aliases, helper-return repetition, helper-accessor wrappers, unnecessary suite-state casts, and wider-than-needed state aliases in nearby service-adjacent suites.
  - reviewed adjacent production surfaces opportunistically; no production follow-up was required in this slice.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/action-queue.error-handling.test.ts packages/core/src/__tests__/services/advanced-order-state-machine.test.ts packages/core/src/__tests__/services/advanced-order-flow.error-handling.test.ts packages/core/src/__tests__/services/analyzer-engine.service.test.ts packages/core/src/__tests__/services/analyzer-engine.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next nearby leftovers surfaced by `rg` after this slice, especially other service-adjacent suites that still keep direct managed-context exports, repeated `ReturnType<typeof createManaged...>` expressions, helper-accessor wrappers, unnecessary suite-state casts, or wider-than-needed state aliases.
- Good nearby follow-ups after this batch: `analyzer-engine.error-handling-advanced`, `analyzer-registry.error-handling`, `anti-flip.error-handling`, `anomaly-detection.error-handling`, `bot-metrics.error-handling`, `bot-initializer.error-handling`, `bot-factory.service`, `bot-factory.error-handling`, `candle-provider.error-handling`, and `candle-provider.repository-integration`, or the next adjacent suites still surfaced by `rg` in `packages/core/src/__tests__/services`.
