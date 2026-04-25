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

## Last Completed (2026-04-25)
- Completed the requested next lifecycle/testability narrowing slice across `compound-interest-calculator.service`, `compound-interest-calculator.error-handling`, `exchange-factory.service`, `exchange-factory.error-handling`, `funding-rate-filter.service`, `funding-rate-filter.error-handling`, `exit-type-detector.service`, `exit-type-detector.service.error-handling`, `graceful-shutdown.service`, `graceful-shutdown.error-handling`, `tick-delta-analyzer.service`, `tick-delta-analyzer.error-handling`, `tf-alignment.service`, `tf-alignment.error-handling`, `trading-journal.service`, `trading-journal.error-handling`, `take-profit-manager.service`, `take-profit-manager.error-handling`, `websocket-authentication.service`, and `websocket-authentication.error-handling`.
  - narrowed another 20-suite batch of managed test state by replacing local `ReturnType<typeof createManaged...>` aliases and temporary managed-context locals with exported helper-owned runtime/state contracts.
  - kept the slice behavior-preserving; the immediate follow-up remains continuing the move away from leftover generic suite-state aliases, helper-accessor wrappers, and direct managed-context plumbing in adjacent service suites.
  - reviewed adjacent production surfaces opportunistically; no production follow-up was required in this slice.
- Verification:
  - `npm test -- --runInBand packages/core/src/__tests__/services/compound-interest-calculator.service.test.ts packages/core/src/__tests__/services/compound-interest-calculator.error-handling.test.ts packages/core/src/__tests__/services/exchange-factory.service.test.ts packages/core/src/__tests__/services/exchange-factory.error-handling.test.ts packages/core/src/__tests__/services/funding-rate-filter.service.test.ts packages/core/src/__tests__/services/funding-rate-filter.error-handling.test.ts packages/core/src/__tests__/services/exit-type-detector.service.test.ts packages/core/src/__tests__/services/exit-type-detector.service.error-handling.test.ts packages/core/src/__tests__/services/graceful-shutdown.service.test.ts packages/core/src/__tests__/services/graceful-shutdown.error-handling.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.service.test.ts packages/core/src/__tests__/services/tick-delta-analyzer.error-handling.test.ts packages/core/src/__tests__/services/tf-alignment.service.test.ts packages/core/src/__tests__/services/tf-alignment.error-handling.test.ts packages/core/src/__tests__/services/trading-journal.service.test.ts packages/core/src/__tests__/services/trading-journal.error-handling.test.ts packages/core/src/__tests__/services/take-profit-manager.service.test.ts packages/core/src/__tests__/services/take-profit-manager.error-handling.test.ts packages/core/src/__tests__/services/websocket-authentication.service.test.ts packages/core/src/__tests__/services/websocket-authentication.error-handling.test.ts` -> PASS.
  - `npm run build` -> PASS.

## Next Step
- Continue from the short candidate list in `ACTIVE_REFACTOR_PLAN.md`.
- Favor the next nearby leftovers surfaced by `rg` after this slice, especially other service-adjacent suites that still keep direct managed-context exports, repeated `ReturnType<typeof createManaged...>` expressions, helper-accessor wrappers, unnecessary suite-state casts, or wider-than-needed state aliases.
- Good nearby follow-ups after this batch: `health-check`, `indicator-registry.error-handling`, `ladder-tp-manager.error-handling`, `risk-manager.service`, `risk-manager.error-handling`, `take-profit-manager` adjacent leftovers in nearby service suites, `trade-history.error-handling`, `time.service.test`, `wall-tracker.service`, `wall-tracker.error-handling`, and the next adjacent suites still surfaced by `rg` in `packages/core/src/__tests__/services` with leftover nested type aliases or generic managed-context names.
