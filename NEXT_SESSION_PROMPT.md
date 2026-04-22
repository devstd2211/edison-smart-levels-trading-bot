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

## Last Completed (2026-04-22)
- Completed the next ten-item lifecycle/testability narrowing slice across `compound-interest-calculator.error-handling`, `config-validator.service`, `config-validator.error-handling`, `create-services.lifecycle`, `data-collector.error-handling`, `delta-analyzer.service`, `delta-analyzer.error-handling`, `dynamic-position-sizer`, `entry-confirmation.service`, and `entry-confirmation.error-handling`.
  - added narrow helper-exported state aliases for data collector, delta analyzer, dynamic position sizer, and entry confirmation suites, then switched the touched tests to those helper-owned contracts.
  - replaced the inline suite-local dynamic-position-sizer state Pick with a helper export and aligned both entry-confirmation suites on shared helper-owned state aliases.
  - reviewed adjacent production surfaces opportunistically; no production follow-up was required in this slice, and `compound-interest-calculator.error-handling`, both config-validator suites, and `create-services.lifecycle` were already narrow enough without code changes.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/compound-interest-calculator.error-handling.test.ts packages/core/src/__tests__/services/config-validator.service.test.ts packages/core/src/__tests__/services/config-validator.error-handling.test.ts packages/core/src/__tests__/services/create-services.lifecycle.test.ts packages/core/src/__tests__/services/data-collector.error-handling.test.ts packages/core/src/__tests__/services/delta-analyzer.service.test.ts packages/core/src/__tests__/services/delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/dynamic-position-sizer.test.ts packages/core/src/__tests__/services/entry-confirmation.service.test.ts packages/core/src/__tests__/services/entry-confirmation.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next nearby leftovers surfaced by `rg`, especially `enhanced-exit.error-handling`, `event-deduplication.service`, `event-deduplication.error-handling`, `event-handlers.error-handling`, `exchange-factory.service`, `exchange-factory.error-handling`, `exit-type-detector.service`, `exit-type-detector.service.error-handling`, `funding-rate-filter.service`, and `funding-rate-filter.error-handling`.
- Keep reviewing adjacent production services opportunistically, but prefer test-owned lifecycle/state cleanup first unless a small behavior-preserving service refactor is clearly exposed.
