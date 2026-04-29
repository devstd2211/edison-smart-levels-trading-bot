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
- Completed the next cleanup follow-up across `analyzer-engine.error-handling-advanced.test`, `bot-factory.service.test`, `phase-10-integration.test`, and `position-lifecycle.repository-integration.test`, plus the supporting `phase-10-integration-test.utils` helper export.
  - narrowed this slice by removing the remaining direct `Managed*Context`-type ownership in those suites and switching them to narrower helper-owned runtime/suite state contracts that match the already-refactored pattern.
  - re-scanned the original managed-context narrowing query after this slice; the direct `ReturnType<typeof createManaged...>` / `Managed*Context['...']` candidate class that drove the recent batches is now effectively exhausted in `packages/core/src/__tests__/services`.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/analyzer-engine.error-handling-advanced.test.ts packages/core/src/__tests__/services/bot-factory.service.test.ts packages/core/src/__tests__/services/phase-10-integration.test.ts packages/core/src/__tests__/services/position-lifecycle.repository-integration.test.ts` -> assertions PASS, but Jest returned non-zero because of a pre-existing async logger cleanup warning from `LoggerService.cleanOldLogs` during `bot-factory.service.test` ("Cannot log after tests are done").
  - `npm run build` -> PASS.

## Next Step
- Treat the original managed-context narrowing campaign as essentially closed: the direct `rg` scans that were driving the recent batches are now empty.
- If the user wants more refactor in this area, move to a broader cleanup class only: duplicated inline harness option objects, local binder/accessor wrappers, context objects kept around longer than necessary, or adjacent `any` cleanup surfaced by those suites.
- If targeted verification touches `bot-factory.service.test`, expect the current residual issue: assertions pass, but Jest can still return non-zero because `LoggerService.cleanOldLogs` logs asynchronously after test completion. Only address that if the user wants a production/test-behavior fix rather than more mechanical narrowing.
