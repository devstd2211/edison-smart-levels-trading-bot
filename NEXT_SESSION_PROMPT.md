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

## Last Completed (2026-04-29)
- Closed the residual production-side logger/testability issue that remained after the managed-context narrowing campaign, then finished the last narrow suite-state follow-up in nearby service tests.
  - updated `packages/core/src/services/logger.service.ts` so background log-retention cleanup no longer emits direct asynchronous housekeeping output to `console`, while preserving best-effort cleanup behavior and `ErrorHandler` routing for failures.
  - narrowed the remaining direct suite-field ownership in `analyzer-engine.error-handling.test.ts`, `analyzer-engine.service.test.ts`, `analyzer-engine.error-handling-advanced.test.ts`, `candle-provider.error-handling.test.ts`, `bybit.repository-integration.test.ts`, `smart-order-placement.error-handling.test.ts`, and `position-lifecycle.repository-integration.test.ts`.
  - re-scanned `packages/core/src/__tests__/services/*.test.ts`; the direct `Context['...']` / `ReturnType<typeof createManaged...>` ownership pattern that drove the recent campaign is now empty there.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/bot-factory.error-handling.test.ts packages/core/src/__tests__/services/logger.service.error-handling.test.ts` -> PASS.
  - `npm test -- --runInBand packages/core/src/__tests__/services/analyzer-engine.error-handling.test.ts packages/core/src/__tests__/services/analyzer-engine.service.test.ts packages/core/src/__tests__/services/candle-provider.error-handling.test.ts packages/core/src/__tests__/services/bybit.repository-integration.test.ts packages/core/src/__tests__/services/smart-order-placement.error-handling.test.ts` -> PASS.
  - `npm test -- --runInBand packages/core/src/__tests__/services/analyzer-engine.error-handling-advanced.test.ts packages/core/src/__tests__/services/position-lifecycle.repository-integration.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Treat the original managed-context narrowing campaign as closed.
- Continue only with a broader cleanup class: duplicated inline harness option objects, local binder/accessor wrappers, context objects kept around longer than necessary, or adjacent `any` cleanup surfaced by the remaining service suites.
