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
- Completed the next ten-item lifecycle/testability narrowing slice across `advanced-order-flow.error-handling`, `advanced-order-state-machine`, `analyzer-engine.error-handling`, `analyzer-engine.error-handling-advanced`, `analyzer-engine.service`, `analyzer-registration-fixes`, `bot-factory.error-handling`, `bot-factory.service`, `bot-initializer.error-handling`, and `candle-provider.error-handling`.
  - removed remaining suite-local `state`/`fixtures`/`cleanup` wrappers and temporary test-only aliases where helpers already exposed the needed runtime/factory contracts, keeping setup/cleanup and assertions unchanged.
  - reviewed adjacent production surfaces opportunistically; no production follow-up was required in this slice.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/advanced-order-flow.error-handling.test.ts packages/core/src/__tests__/services/advanced-order-state-machine.test.ts packages/core/src/__tests__/services/analyzer-engine.error-handling.test.ts packages/core/src/__tests__/services/analyzer-engine.error-handling-advanced.test.ts packages/core/src/__tests__/services/analyzer-engine.service.test.ts packages/core/src/__tests__/services/analyzer-registration-fixes.test.ts packages/core/src/__tests__/services/bot-factory.error-handling.test.ts packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/bot-initializer.error-handling.test.ts packages/core/src/__tests__/services/candle-provider.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next remaining suites that still keep direct exported `Managed*Context` types, broader helper-bound runtime state, temporary fixture/service wrappers, or repeated `ReturnType<typeof createManaged...>` ownership outside the completed batches, especially nearby leftovers such as `analyzer-registry.error-handling`, `bot-metrics.error-handling`, `bybit.repository-integration`, `candle-provider.repository-integration`, `circuit-breaker.error-handling`, `circuit-breaker.service`, `compound-interest-calculator.error-handling`, `compound-interest-calculator.service`, `config-validator.service`, and `create-services.lifecycle`.
- Keep reviewing adjacent production services opportunistically, but prefer test-owned lifecycle/state cleanup first unless a small behavior-preserving service refactor is clearly exposed.
